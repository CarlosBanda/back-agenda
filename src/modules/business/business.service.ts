import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from './entities/business.entity';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import {
  PaginationDto,
  PaginatedResult,
} from '../../common/dto/pagination.dto';
import { Role } from '../users/entities/user.entity';

@Injectable()
export class BusinessService {
  constructor(
    @InjectRepository(Business)
    private readonly repo: Repository<Business>,
  ) {}

  async create(dto: CreateBusinessDto, ownerId: number): Promise<Business> {
    return this.repo.save(this.repo.create({ ...dto, ownerId }));
  }

  async findAll(pagination: PaginationDto): Promise<PaginatedResult<Business>> {
    const { page = 1, limit = 10 } = pagination;
    const [data, total] = await this.repo.findAndCount({
      where: { isActive: true },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: number): Promise<Business> {
    const business = await this.repo.findOne({ where: { id } });
    if (!business) throw new NotFoundException('Business not found');
    return business;
  }

  findByOwner(ownerId: number): Promise<Business[]> {
    return this.repo.find({ where: { ownerId } });
  }

  async assertCanManage(
    id: number,
    userId: number,
    role: Role,
  ): Promise<Business> {
    const business = await this.findOne(id);
    if (role !== Role.ADMIN && business.ownerId !== userId) {
      throw new ForbiddenException('You do not manage this business');
    }
    return business;
  }

  async update(
    id: number,
    dto: UpdateBusinessDto,
    userId: number,
    role: Role,
  ): Promise<Business> {
    const business = await this.assertCanManage(id, userId, role);
    Object.assign(business, dto);
    return this.repo.save(business);
  }

  async remove(id: number, userId: number, role: Role): Promise<void> {
    const business = await this.assertCanManage(id, userId, role);
    business.isActive = false;
    await this.repo.save(business);
  }
}
