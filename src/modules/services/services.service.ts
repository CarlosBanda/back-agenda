import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from './entities/service.entity';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { BusinessService } from '../business/business.service';
import { Role } from '../users/entities/user.entity';

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private readonly repo: Repository<Service>,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly businessService: BusinessService,
  ) {}

  async create(
    dto: CreateServiceDto,
    userId: number,
    role: Role,
  ): Promise<Service> {
    await this.businessService.assertCanManage(dto.businessId, userId, role);
    const currentUsage = await this.repo.count({
      where: { businessId: dto.businessId, isActive: true },
    });
    await this.subscriptionsService.assertQuota(
      dto.businessId,
      'maxServices',
      currentUsage,
    );
    return this.repo.save(this.repo.create(dto));
  }

  findByBusiness(businessId: number): Promise<Service[]> {
    return this.repo.find({ where: { businessId, isActive: true } });
  }

  async findOne(id: number): Promise<Service> {
    const service = await this.repo.findOne({ where: { id } });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async update(
    id: number,
    dto: UpdateServiceDto,
    userId: number,
    role: Role,
  ): Promise<Service> {
    const service = await this.findOne(id);
    await this.businessService.assertCanManage(
      service.businessId,
      userId,
      role,
    );
    Object.assign(service, dto);
    return this.repo.save(service);
  }

  async remove(id: number, userId: number, role: Role): Promise<void> {
    const service = await this.findOne(id);
    await this.businessService.assertCanManage(
      service.businessId,
      userId,
      role,
    );
    service.isActive = false;
    await this.repo.save(service);
  }
}
