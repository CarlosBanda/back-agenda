import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BusinessService } from './business.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guards';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../users/entities/user.entity';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';

@ApiTags('Businesses')
@Controller('businesses')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Get()
  findAll(@Query() pagination: PaginationDto) {
    return this.businessService.findAll(pagination);
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.businessService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BUSINESS, Role.ADMIN)
  create(@Body() dto: CreateBusinessDto, @Req() req: AuthenticatedRequest) {
    return this.businessService.create(dto, req.user.sub);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BUSINESS, Role.ADMIN)
  update(
    @Param('id') id: number,
    @Body() dto: UpdateBusinessDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.businessService.update(id, dto, req.user.sub, req.user.role);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BUSINESS, Role.ADMIN)
  remove(@Param('id') id: number, @Req() req: AuthenticatedRequest) {
    return this.businessService.remove(id, req.user.sub, req.user.role);
  }

  @Get('my/businesses')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BUSINESS)
  findMine(@Req() req: AuthenticatedRequest) {
    return this.businessService.findByOwner(req.user.sub);
  }
}
