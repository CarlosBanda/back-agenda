import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Staff } from './entities/staff.entity';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { BusinessService } from '../business/business.service';
import { Role } from '../users/entities/user.entity';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(Staff)
    private readonly repo: Repository<Staff>,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly businessService: BusinessService,
  ) {}

  async create(
    dto: CreateStaffDto,
    userId: number,
    role: Role,
  ): Promise<Staff> {
    await this.businessService.assertCanManage(dto.businessId, userId, role);
    const currentUsage = await this.repo.count({
      where: { businessId: dto.businessId, isActive: true },
    });
    await this.subscriptionsService.assertQuota(
      dto.businessId,
      'maxStaff',
      currentUsage,
    );
    return this.repo.save(this.repo.create(dto));
  }

  findByBusiness(businessId: number): Promise<Staff[]> {
    return this.repo.find({ where: { businessId, isActive: true } });
  }

  async findOne(id: number): Promise<Staff> {
    const staff = await this.repo.findOne({ where: { id } });
    if (!staff) throw new NotFoundException('Staff not found');
    return staff;
  }

  async update(
    id: number,
    dto: UpdateStaffDto,
    userId: number,
    role: Role,
  ): Promise<Staff> {
    const staff = await this.findOne(id);
    await this.businessService.assertCanManage(staff.businessId, userId, role);
    Object.assign(staff, dto);
    return this.repo.save(staff);
  }

  async remove(id: number, userId: number, role: Role): Promise<void> {
    const staff = await this.findOne(id);
    await this.businessService.assertCanManage(staff.businessId, userId, role);
    staff.isActive = false;
    await this.repo.save(staff);
  }
}
