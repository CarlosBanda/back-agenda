import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from '../appointments/entities/appointment.entity';
import { BusinessModule } from '../business/business.module';
import { User } from '../users/entities/user.entity';
import { ClientsService } from './clients.service';
import { CrmController } from './crm.controller';
import { Client } from './entities/client.entity';
import { ClientNote } from './entities/client-note.entity';
import { ClientTag } from './entities/client-tag.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Client,
      ClientTag,
      ClientNote,
      Appointment,
      User,
    ]),
    BusinessModule,
  ],
  controllers: [CrmController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class CrmModule {}
