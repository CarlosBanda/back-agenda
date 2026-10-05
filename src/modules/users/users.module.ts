import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]), // 👈 ESTA LÍNEA ES LA CLAVE
  ],
  providers: [UsersService],
  exports: [UsersService], // 👈 para que Auth pueda usarlo
})
export class UsersModule {}
