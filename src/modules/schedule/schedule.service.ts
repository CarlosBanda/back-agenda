import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule } from './entities/schedule.entity';
import { BlockedSlot } from './entities/blocked-slot.entity';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { CreateBlockedSlotDto } from './dto/create-blocked-slot.dto';
import { BusinessService } from '../business/business.service';
import { StaffService } from '../staff/staff.service';
import { Role } from '../users/entities/user.entity';

@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(Schedule)
    private readonly scheduleRepo: Repository<Schedule>,
    @InjectRepository(BlockedSlot)
    private readonly blockedRepo: Repository<BlockedSlot>,
    private readonly businessService: BusinessService,
    private readonly staffService: StaffService,
  ) {}

  async createSchedule(
    dto: CreateScheduleDto,
    userId: number,
    role: Role,
  ): Promise<Schedule> {
    await this.businessService.assertCanManage(dto.businessId, userId, role);
    await this.assertStaffBelongsToBusiness(dto.staffId, dto.businessId);
    return this.scheduleRepo.save(this.scheduleRepo.create(dto));
  }

  findByBusiness(businessId: number): Promise<Schedule[]> {
    return this.scheduleRepo.find({ where: { businessId, isActive: true } });
  }

  findByStaff(staffId: number): Promise<Schedule[]> {
    return this.scheduleRepo.find({ where: { staffId, isActive: true } });
  }

  async removeSchedule(id: number, userId: number, role: Role): Promise<void> {
    const schedule = await this.scheduleRepo.findOne({ where: { id } });
    if (!schedule) throw new NotFoundException('Schedule not found');
    await this.businessService.assertCanManage(
      schedule.businessId,
      userId,
      role,
    );
    await this.scheduleRepo.remove(schedule);
  }

  async createBlockedSlot(
    dto: CreateBlockedSlotDto,
    userId: number,
    role: Role,
  ): Promise<BlockedSlot> {
    await this.businessService.assertCanManage(dto.businessId, userId, role);
    await this.assertStaffBelongsToBusiness(dto.staffId, dto.businessId);
    return this.blockedRepo.save(this.blockedRepo.create(dto));
  }

  findBlockedSlots(businessId: number, date: string): Promise<BlockedSlot[]> {
    return this.blockedRepo.find({ where: { businessId, date } });
  }

  async removeBlockedSlot(
    id: number,
    userId: number,
    role: Role,
  ): Promise<void> {
    const slot = await this.blockedRepo.findOne({ where: { id } });
    if (!slot) throw new NotFoundException('Blocked slot not found');
    await this.businessService.assertCanManage(slot.businessId, userId, role);
    await this.blockedRepo.remove(slot);
  }

  private async assertStaffBelongsToBusiness(
    staffId: number | undefined,
    businessId: number,
  ): Promise<void> {
    if (!staffId) return;
    const staff = await this.staffService.findOne(staffId);
    if (staff.businessId !== businessId || !staff.isActive) {
      throw new BadRequestException('Staff does not belong to this business');
    }
  }
}
