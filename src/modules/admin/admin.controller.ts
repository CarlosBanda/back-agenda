import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from '../business/entities/business.entity';
import { User } from '../users/entities/user.entity';
import {
  PaginationDto,
  PaginatedResult,
} from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guards';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../users/entities/user.entity';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class AdminController {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  @Get('businesses')
  async findAllBusinesses(
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResult<Business>> {
    const { page = 1, limit = 10 } = pagination;
    const [data, total] = await this.businessRepo.findAndCount({
      relations: ['owner'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  @Get('businesses/:id')
  async findBusiness(@Param('id') id: number) {
    return this.businessRepo.findOne({
      where: { id },
      relations: ['owner'],
    });
  }

  @Patch('businesses/:id/toggle')
  async toggleBusiness(@Param('id') id: number) {
    const business = await this.businessRepo.findOne({ where: { id } });
    if (!business) throw new Error('Business not found');
    business.isActive = !business.isActive;
    return this.businessRepo.save(business);
  }

  @Get('stats')
  async getStats() {
    const totalBusinesses = await this.businessRepo.count();
    const activeBusinesses = await this.businessRepo.count({
      where: { isActive: true },
    });
    const totalUsers = await this.userRepo.count();
    const businessUsers = await this.userRepo.count({
      where: { role: Role.BUSINESS },
    });
    const clientUsers = await this.userRepo.count({
      where: { role: Role.CLIENT },
    });

    return {
      totalBusinesses,
      activeBusinesses,
      inactiveBusinesses: totalBusinesses - activeBusinesses,
      totalUsers,
      businessUsers,
      clientUsers,
    };
  }
}
