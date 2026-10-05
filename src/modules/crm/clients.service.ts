import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import type { PaginatedResult } from '../../common/dto/pagination.dto';
import { BusinessService } from '../business/business.service';
import {
  Appointment,
  AppointmentStatus,
} from '../appointments/entities/appointment.entity';
import { Role, User } from '../users/entities/user.entity';
import { Client, ClientSource } from './entities/client.entity';
import { ClientNote } from './entities/client-note.entity';
import { ClientTag } from './entities/client-tag.entity';
import {
  AssignTagsDto,
  ClientsQueryDto,
  CreateClientDto,
  CreateClientNoteDto,
  CreateTagDto,
  ImportClientsDto,
  UpdateClientDto,
} from './dto/crm.dto';
import {
  normalizeEmail,
  normalizePhone,
  parseCsv,
  parseTagList,
} from './utils/csv.util';

export interface ImportResult {
  totalRows: number;
  created: number;
  duplicatesInFile: number;
  duplicatesInDb: number;
  invalid: number;
  tagsCreated: number;
  errors: { row: number; reason: string }[];
}

@Injectable()
export class ClientsService {
  private readonly importMaxRows: number;

  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(ClientTag)
    private readonly tagRepo: Repository<ClientTag>,
    @InjectRepository(ClientNote)
    private readonly noteRepo: Repository<ClientNote>,
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly businessService: BusinessService,
    config: ConfigService,
  ) {
    this.importMaxRows = Number(
      config.get<string>('CRM_IMPORT_MAX_ROWS', '1000'),
    );
  }

  async create(
    businessId: number,
    dto: CreateClientDto,
    userId: number,
    role: Role,
  ): Promise<Client> {
    await this.businessService.assertCanManage(businessId, userId, role);
    const phone = normalizePhone(dto.phone);
    const email = normalizeEmail(dto.email);
    this.assertValidPhone(phone);
    await this.assertNoDuplicate(businessId, phone, email, null);
    const client = this.clientRepo.create({
      businessId,
      name: dto.name.trim(),
      phone,
      email,
      notes: dto.notes?.trim() || null,
      source: ClientSource.MANUAL,
      linkedUserId: null,
      isActive: true,
    });
    return this.clientRepo.save(client);
  }

  async findByBusiness(
    businessId: number,
    query: ClientsQueryDto,
    userId: number,
    role: Role,
  ): Promise<PaginatedResult<Client>> {
    await this.businessService.assertCanManage(businessId, userId, role);
    const { page = 1, limit = 10 } = query;
    const builder = this.clientRepo
      .createQueryBuilder('client')
      .leftJoinAndSelect('client.tags', 'tag')
      .where('client.businessId = :businessId', { businessId })
      .andWhere('client.isActive = :active', { active: true })
      .orderBy('client.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.source) {
      builder.andWhere('client.source = :source', { source: query.source });
    }
    if (query.search) {
      const term = `%${query.search.trim()}%`;
      builder.andWhere(
        '(client.name LIKE :term OR client.phone LIKE :term OR client.email LIKE :term)',
        { term },
      );
    }
    if (query.tagId) {
      // Filter by tag membership without dropping the full tag list per client.
      builder.andWhere(
        'client.id IN ' +
          builder
            .subQuery()
            .select('link.clientId')
            .from('client_tag_links', 'link')
            .where('link.tagId = :tagId')
            .getQuery(),
        { tagId: query.tagId },
      );
    }

    const [data, total] = await builder.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: number, userId: number, role: Role): Promise<Client> {
    return this.requireClientManaged(id, userId, role, ['tags', 'linkedUser']);
  }

  async update(
    id: number,
    dto: UpdateClientDto,
    userId: number,
    role: Role,
  ): Promise<Client> {
    const client = await this.requireClientManaged(id, userId, role);
    const phone =
      dto.phone !== undefined ? normalizePhone(dto.phone) : client.phone;
    const email =
      dto.email !== undefined ? normalizeEmail(dto.email) : client.email;
    this.assertValidPhone(phone);
    await this.assertNoDuplicate(client.businessId, phone, email, client.id);
    if (dto.name !== undefined) client.name = dto.name.trim();
    client.phone = phone;
    client.email = email;
    if (dto.notes !== undefined) client.notes = dto.notes.trim() || null;
    return this.clientRepo.save(client);
  }

  async remove(id: number, userId: number, role: Role): Promise<void> {
    const client = await this.requireClientManaged(id, userId, role);
    client.isActive = false;
    await this.clientRepo.save(client);
  }

  async link(
    id: number,
    userId: number,
    role: Role,
    targetUserId: number,
  ): Promise<Client> {
    const client = await this.requireClientManaged(id, userId, role);
    const user = await this.userRepo.findOne({ where: { id: targetUserId } });
    if (!user || !user.isActive || user.role !== Role.CLIENT) {
      throw new NotFoundException('Active client user not found');
    }
    const emailMatches =
      client.email != null && normalizeEmail(user.email) === client.email;
    const phoneMatches =
      client.phone != null && normalizePhone(user.phone) === client.phone;
    if (!emailMatches && !phoneMatches) {
      throw new BadRequestException(
        'The platform user contact must match the CRM client',
      );
    }
    const alreadyLinked = await this.clientRepo.findOne({
      where: { businessId: client.businessId, linkedUserId: targetUserId },
    });
    if (alreadyLinked && alreadyLinked.id !== client.id) {
      throw new ConflictException(
        'Another client record is already linked to this user',
      );
    }
    client.linkedUserId = targetUserId;
    client.source = ClientSource.LINKED;
    return this.clientRepo.save(client);
  }

  async unlink(id: number, userId: number, role: Role): Promise<Client> {
    const client = await this.requireClientManaged(id, userId, role);
    client.linkedUserId = null;
    return this.clientRepo.save(client);
  }

  async addNote(
    id: number,
    dto: CreateClientNoteDto,
    userId: number,
    role: Role,
  ): Promise<ClientNote> {
    const client = await this.requireClientManaged(id, userId, role);
    return this.noteRepo.save(
      this.noteRepo.create({
        clientId: client.id,
        authorId: userId,
        body: dto.body.trim(),
      }),
    );
  }

  async listNotes(
    id: number,
    userId: number,
    role: Role,
  ): Promise<ClientNote[]> {
    const client = await this.requireClientManaged(id, userId, role);
    return this.noteRepo.find({
      where: { clientId: client.id },
      order: { createdAt: 'DESC' },
    });
  }

  async createTag(
    businessId: number,
    dto: CreateTagDto,
    userId: number,
    role: Role,
  ): Promise<ClientTag> {
    await this.businessService.assertCanManage(businessId, userId, role);
    const name = dto.name.trim();
    const existing = await this.tagRepo.findOne({
      where: { businessId, name },
    });
    if (existing) throw new ConflictException('Tag already exists');
    return this.tagRepo.save(
      this.tagRepo.create({
        businessId,
        name,
        color: dto.color?.trim() || null,
      }),
    );
  }

  async listTags(
    businessId: number,
    userId: number,
    role: Role,
  ): Promise<ClientTag[]> {
    await this.businessService.assertCanManage(businessId, userId, role);
    return this.tagRepo.find({
      where: { businessId },
      order: { name: 'ASC' },
    });
  }

  async assignTags(
    id: number,
    dto: AssignTagsDto,
    userId: number,
    role: Role,
  ): Promise<Client> {
    const client = await this.requireClientManaged(id, userId, role, ['tags']);
    const tags = await this.loadOwnedTags(client.businessId, dto.tagIds);
    const currentIds = new Set((client.tags ?? []).map((tag) => tag.id));
    for (const tag of tags) {
      if (!currentIds.has(tag.id)) client.tags.push(tag);
    }
    return this.clientRepo.save(client);
  }

  async removeTag(
    id: number,
    tagId: number,
    userId: number,
    role: Role,
  ): Promise<Client> {
    const client = await this.requireClientManaged(id, userId, role, ['tags']);
    client.tags = (client.tags ?? []).filter((tag) => tag.id !== tagId);
    return this.clientRepo.save(client);
  }

  async history(id: number, userId: number, role: Role) {
    const client = await this.requireClientManaged(id, userId, role);
    const appointments = await this.clientAppointments(client);
    return appointments;
  }

  async clientMetrics(id: number, userId: number, role: Role) {
    const client = await this.requireClientManaged(id, userId, role);
    const appointments = await this.clientAppointments(client);
    const counts = {
      total: appointments.length,
      completed: 0,
      cancelled: 0,
      noShow: 0,
      upcoming: 0,
    };
    let totalSpent = 0;
    let depositsPaid = 0;
    let lastVisit: string | null = null;
    const today = this.today();
    for (const appt of appointments) {
      if (appt.status === AppointmentStatus.COMPLETED) {
        counts.completed++;
        totalSpent += Number(appt.service?.price ?? 0);
        if (!lastVisit || appt.date > lastVisit) lastVisit = appt.date;
      } else if (appt.status === AppointmentStatus.CANCELLED) {
        counts.cancelled++;
      } else if (appt.status === AppointmentStatus.NO_SHOW) {
        counts.noShow++;
      }
      if (
        appt.date >= today &&
        (appt.status === AppointmentStatus.PENDING ||
          appt.status === AppointmentStatus.CONFIRMED)
      ) {
        counts.upcoming++;
      }
      if (appt.depositPaidAmount != null) {
        depositsPaid += Number(appt.depositPaidAmount);
      }
    }
    return {
      clientId: client.id,
      appointments: counts,
      totalSpent: totalSpent.toFixed(2),
      depositsPaid: depositsPaid.toFixed(2),
      lastVisit,
    };
  }

  async businessMetrics(businessId: number, userId: number, role: Role) {
    await this.businessService.assertCanManage(businessId, userId, role);
    const monthStart = `${this.today().slice(0, 7)}-01`;

    const [total, imported, linked, manual, newThisMonth] = await Promise.all([
      this.clientRepo.count({ where: { businessId, isActive: true } }),
      this.clientRepo.count({
        where: { businessId, isActive: true, source: ClientSource.IMPORTED },
      }),
      this.clientRepo.count({
        where: { businessId, isActive: true, source: ClientSource.LINKED },
      }),
      this.clientRepo.count({
        where: { businessId, isActive: true, source: ClientSource.MANUAL },
      }),
      this.clientRepo.count({
        where: {
          businessId,
          isActive: true,
          createdAt: Between(
            new Date(`${monthStart}T00:00:00.000Z`),
            new Date(),
          ),
        },
      }),
    ]);

    const statuses = Object.values(AppointmentStatus);
    const statusCounts = await Promise.all(
      statuses.map(async (status) => ({
        status,
        count: await this.appointmentRepo.count({
          where: { businessId, status },
        }),
      })),
    );
    const byStatus = Object.fromEntries(
      statusCounts.map(({ status, count }) => [status, count]),
    ) as Record<AppointmentStatus, number>;
    const completed = byStatus[AppointmentStatus.COMPLETED] ?? 0;
    const noShow = byStatus[AppointmentStatus.NO_SHOW] ?? 0;
    const attended = completed + noShow;
    const noShowRate =
      attended === 0 ? 0 : Number((noShow / attended).toFixed(4));

    const tagCounts = await this.tagRepo
      .createQueryBuilder('tag')
      .leftJoin('client_tag_links', 'link', 'link.tagId = tag.id')
      .where('tag.businessId = :businessId', { businessId })
      .select('tag.id', 'id')
      .addSelect('tag.name', 'name')
      .addSelect('COUNT(link.clientId)', 'count')
      .groupBy('tag.id')
      .addGroupBy('tag.name')
      .orderBy('count', 'DESC')
      .getRawMany<{ id: number; name: string; count: string }>();

    return {
      clients: { total, imported, linked, manual, newThisMonth },
      appointments: { byStatus, noShowRate },
      tags: tagCounts.map((row) => ({
        id: Number(row.id),
        name: row.name,
        clients: Number(row.count),
      })),
    };
  }

  async importFromCsvText(
    businessId: number,
    dto: ImportClientsDto,
    userId: number,
    role: Role,
  ): Promise<ImportResult> {
    await this.businessService.assertCanManage(businessId, userId, role);
    const rows = parseCsv(dto.content);
    if (rows.length === 0) {
      throw new BadRequestException('CSV content is empty');
    }
    const hasHeader = dto.hasHeader ?? true;
    const header = hasHeader ? rows[0].map((h) => h.trim().toLowerCase()) : [];
    const dataRows = hasHeader ? rows.slice(1) : rows;

    if (dataRows.length > this.importMaxRows) {
      throw new BadRequestException(
        `Import exceeds the maximum of ${this.importMaxRows} rows`,
      );
    }

    const idx = this.columnIndexes(header);
    const defaultTags = dto.defaultTagIds?.length
      ? await this.loadOwnedTags(businessId, dto.defaultTagIds)
      : [];

    // Preload existing dedup keys and tags for this business.
    const existing = await this.clientRepo.find({
      where: { businessId },
      select: { id: true, phone: true, email: true },
    });
    const existingPhones = new Set(
      existing.map((c) => c.phone).filter((p): p is string => p != null),
    );
    const existingEmails = new Set(
      existing.map((c) => c.email).filter((e): e is string => e != null),
    );
    const tagCache = new Map<string, ClientTag>();
    for (const tag of await this.tagRepo.find({ where: { businessId } })) {
      tagCache.set(tag.name.toLowerCase(), tag);
    }

    const result: ImportResult = {
      totalRows: dataRows.length,
      created: 0,
      duplicatesInFile: 0,
      duplicatesInDb: 0,
      invalid: 0,
      tagsCreated: 0,
      errors: [],
    };
    const seenPhones = new Set<string>();
    const seenEmails = new Set<string>();
    const toCreate: { client: Client; tagNames: string[] }[] = [];

    dataRows.forEach((row, offset) => {
      const rowNumber = offset + (hasHeader ? 2 : 1);
      const name = (row[idx.name] ?? '').trim();
      const phone = normalizePhone(row[idx.phone] ?? '');
      const email = normalizeEmail(row[idx.email] ?? '');
      const notes = idx.notes >= 0 ? row[idx.notes]?.trim() || null : null;
      const rawTagNames = idx.tags >= 0 ? parseTagList(row[idx.tags]) : [];
      if (name === '' || name.length > 150) {
        result.invalid++;
        result.errors.push({
          row: rowNumber,
          reason: name === '' ? 'Missing name' : 'Name exceeds 150 characters',
        });
        return;
      }
      if (phone && phone.length !== 10) {
        result.invalid++;
        result.errors.push({
          row: rowNumber,
          reason: 'Phone must contain 10 Mexican digits',
        });
        return;
      }
      if (
        email &&
        (email.length > 191 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      ) {
        result.invalid++;
        result.errors.push({ row: rowNumber, reason: 'Invalid email' });
        return;
      }
      if (notes && notes.length > 5000) {
        result.invalid++;
        result.errors.push({
          row: rowNumber,
          reason: 'Notes exceed 5000 characters',
        });
        return;
      }
      if (
        rawTagNames.length > 50 ||
        rawTagNames.some((tag) => tag.length > 60)
      ) {
        result.invalid++;
        result.errors.push({ row: rowNumber, reason: 'Invalid tag list' });
        return;
      }
      if (
        (phone && (existingPhones.has(phone) || seenPhones.has(phone))) ||
        (email && (existingEmails.has(email) || seenEmails.has(email)))
      ) {
        if (
          (phone && existingPhones.has(phone)) ||
          (email && existingEmails.has(email))
        ) {
          result.duplicatesInDb++;
        } else {
          result.duplicatesInFile++;
        }
        return;
      }
      if (phone) seenPhones.add(phone);
      if (email) seenEmails.add(email);
      const tagNames = [
        ...new Map(
          rawTagNames.map((tag) => [tag.toLocaleLowerCase('es-MX'), tag]),
        ).values(),
      ];
      const client = this.clientRepo.create({
        businessId,
        name,
        phone,
        email,
        notes,
        source: ClientSource.IMPORTED,
        linkedUserId: null,
        isActive: true,
      });
      toCreate.push({ client, tagNames });
    });

    // Ensure referenced tags exist (create missing ones once).
    for (const entry of toCreate) {
      for (const tagName of entry.tagNames) {
        const key = tagName.toLowerCase();
        if (!tagCache.has(key)) {
          const created = await this.tagRepo.save(
            this.tagRepo.create({
              businessId,
              name: tagName.slice(0, 60),
              color: null,
            }),
          );
          tagCache.set(key, created);
          result.tagsCreated++;
        }
      }
    }

    for (const entry of toCreate) {
      const rowTags = entry.tagNames
        .map((tagName) => tagCache.get(tagName.toLowerCase()))
        .filter((tag): tag is ClientTag => tag != null);
      const tagMap = new Map<number, ClientTag>();
      for (const tag of [...defaultTags, ...rowTags]) tagMap.set(tag.id, tag);
      entry.client.tags = [...tagMap.values()];
      await this.clientRepo.save(entry.client);
      result.created++;
    }

    return result;
  }

  private async clientAppointments(client: Client): Promise<Appointment[]> {
    const builder = this.appointmentRepo
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.service', 'service')
      .leftJoinAndSelect('appointment.staff', 'staff')
      .where('appointment.businessId = :businessId', {
        businessId: client.businessId,
      })
      .orderBy('appointment.date', 'DESC')
      .addOrderBy('appointment.startTime', 'DESC');
    if (client.linkedUserId != null) {
      builder.andWhere(
        '(appointment.clientRecordId = :clientRecordId OR appointment.clientId = :linkedUserId)',
        { clientRecordId: client.id, linkedUserId: client.linkedUserId },
      );
    } else {
      builder.andWhere('appointment.clientRecordId = :clientRecordId', {
        clientRecordId: client.id,
      });
    }
    return builder.getMany();
  }

  private async loadOwnedTags(
    businessId: number,
    tagIds: number[],
  ): Promise<ClientTag[]> {
    if (tagIds.length === 0) return [];
    const tags = await this.tagRepo.find({
      where: { id: In(tagIds), businessId },
    });
    if (tags.length !== new Set(tagIds).size) {
      throw new BadRequestException(
        'One or more tags do not belong to this business',
      );
    }
    return tags;
  }

  private async assertNoDuplicate(
    businessId: number,
    phone: string | null,
    email: string | null,
    excludeId: number | null,
  ): Promise<void> {
    if (!phone && !email) return;
    const builder = this.clientRepo
      .createQueryBuilder('client')
      .where('client.businessId = :businessId', { businessId });
    const conditions: string[] = [];
    if (phone) conditions.push('client.phone = :phone');
    if (email) conditions.push('client.email = :email');
    builder.andWhere(`(${conditions.join(' OR ')})`, { phone, email });
    if (excludeId != null) {
      builder.andWhere('client.id != :excludeId', { excludeId });
    }
    const duplicate = await builder.getOne();
    if (duplicate) {
      throw new ConflictException(
        'A client with the same phone or email already exists',
      );
    }
  }

  private async requireClientManaged(
    id: number,
    userId: number,
    role: Role,
    relations: string[] = [],
  ): Promise<Client> {
    const client = await this.clientRepo.findOne({ where: { id }, relations });
    if (!client) throw new NotFoundException('Client not found');
    await this.businessService.assertCanManage(client.businessId, userId, role);
    return client;
  }

  private columnIndexes(header: string[]): {
    name: number;
    phone: number;
    email: number;
    notes: number;
    tags: number;
  } {
    if (header.length === 0) {
      return { name: 0, phone: 1, email: 2, notes: 3, tags: 4 };
    }
    const find = (aliases: string[]): number =>
      header.findIndex((col) => aliases.includes(col));
    return {
      name: Math.max(find(['name', 'nombre', 'cliente']), 0),
      phone: find(['phone', 'telefono', 'teléfono', 'celular', 'movil']),
      email: find(['email', 'correo', 'e-mail']),
      notes: find(['notes', 'notas', 'nota']),
      tags: find(['tags', 'etiquetas', 'etiqueta']),
    };
  }

  private assertValidPhone(phone: string | null): void {
    if (phone != null && phone.length !== 10) {
      throw new BadRequestException('Phone must contain 10 Mexican digits');
    }
  }

  private today(): string {
    return new Date().toISOString().split('T')[0];
  }
}
