import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guards';
import { Role } from '../users/entities/user.entity';
import { ClientsService } from './clients.service';
import {
  AssignTagsDto,
  ClientsQueryDto,
  CreateClientDto,
  CreateClientNoteDto,
  CreateTagDto,
  ImportClientsDto,
  LinkClientDto,
  UpdateClientDto,
} from './dto/crm.dto';

@ApiTags('CRM')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.BUSINESS, Role.ADMIN)
@Controller('crm')
export class CrmController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post('businesses/:businessId/clients')
  createClient(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Body() dto: CreateClientDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clientsService.create(
      businessId,
      dto,
      req.user.sub,
      req.user.role,
    );
  }

  @Get('businesses/:businessId/clients')
  listClients(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Query() query: ClientsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clientsService.findByBusiness(
      businessId,
      query,
      req.user.sub,
      req.user.role,
    );
  }

  @Get('businesses/:businessId/metrics')
  businessMetrics(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clientsService.businessMetrics(
      businessId,
      req.user.sub,
      req.user.role,
    );
  }

  @Post('businesses/:businessId/clients/import')
  importClients(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Body() dto: ImportClientsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clientsService.importFromCsvText(
      businessId,
      dto,
      req.user.sub,
      req.user.role,
    );
  }

  @Post('businesses/:businessId/tags')
  createTag(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Body() dto: CreateTagDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clientsService.createTag(
      businessId,
      dto,
      req.user.sub,
      req.user.role,
    );
  }

  @Get('businesses/:businessId/tags')
  listTags(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clientsService.listTags(
      businessId,
      req.user.sub,
      req.user.role,
    );
  }

  @Get('clients/:id')
  findClient(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clientsService.findOne(id, req.user.sub, req.user.role);
  }

  @Patch('clients/:id')
  updateClient(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClientDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clientsService.update(id, dto, req.user.sub, req.user.role);
  }

  @Delete('clients/:id')
  removeClient(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clientsService.remove(id, req.user.sub, req.user.role);
  }

  @Post('clients/:id/link')
  linkClient(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LinkClientDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clientsService.link(
      id,
      req.user.sub,
      req.user.role,
      dto.userId,
    );
  }

  @Post('clients/:id/unlink')
  unlinkClient(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clientsService.unlink(id, req.user.sub, req.user.role);
  }

  @Get('clients/:id/history')
  clientHistory(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clientsService.history(id, req.user.sub, req.user.role);
  }

  @Get('clients/:id/metrics')
  clientMetrics(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clientsService.clientMetrics(id, req.user.sub, req.user.role);
  }

  @Post('clients/:id/notes')
  addNote(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateClientNoteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clientsService.addNote(id, dto, req.user.sub, req.user.role);
  }

  @Get('clients/:id/notes')
  listNotes(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clientsService.listNotes(id, req.user.sub, req.user.role);
  }

  @Post('clients/:id/tags')
  assignTags(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignTagsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clientsService.assignTags(id, dto, req.user.sub, req.user.role);
  }

  @Delete('clients/:id/tags/:tagId')
  removeTag(
    @Param('id', ParseIntPipe) id: number,
    @Param('tagId', ParseIntPipe) tagId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clientsService.removeTag(
      id,
      tagId,
      req.user.sub,
      req.user.role,
    );
  }
}
