import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import type { Appointment } from '../appointments/entities/appointment.entity';
import type { BusinessService } from '../business/business.service';
import { Role, type User } from '../users/entities/user.entity';
import { ClientsService } from './clients.service';
import { Client } from './entities/client.entity';
import type { ClientNote } from './entities/client-note.entity';
import type { ClientTag } from './entities/client-tag.entity';

function buildService(maxRows = 1000) {
  const saveClient = jest.fn((value: Client) => Promise.resolve(value));
  const findClient = jest.fn();
  const clientRepo = {
    create: jest.fn((value: Partial<Client>) => value as Client),
    save: saveClient,
    find: jest.fn().mockResolvedValue([{ phone: '5512345678', email: null }]),
    findOne: findClient,
  } as unknown as Repository<Client>;
  const tagRepo = {
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((value: Partial<ClientTag>) => value as ClientTag),
    save: jest.fn((value: ClientTag) => Promise.resolve({ ...value, id: 1 })),
  } as unknown as Repository<ClientTag>;
  const userSave = jest.fn();
  const findUser = jest.fn();
  const userRepo = {
    save: userSave,
    findOne: findUser,
  } as unknown as Repository<User>;
  const assertCanManage = jest.fn().mockResolvedValue(undefined);
  const businessService = {
    assertCanManage,
  } as unknown as BusinessService;
  const config = {
    get: jest.fn().mockReturnValue(String(maxRows)),
  } as unknown as ConfigService;

  const service = new ClientsService(
    clientRepo,
    tagRepo,
    {} as Repository<ClientNote>,
    {} as Repository<Appointment>,
    userRepo,
    businessService,
    config,
  );
  return {
    service,
    saveClient,
    userSave,
    assertCanManage,
    clientRepo,
    userRepo,
    findClient,
    findUser,
  };
}

describe('ClientsService.importFromCsvText', () => {
  it('normalizes, deduplicates by business and never creates users', async () => {
    const { service, saveClient, userSave, assertCanManage } = buildService();
    const content = [
      'name,phone,email',
      'Ana,55 1234 5678,ana@example.com',
      'Beto,5551110000,beto@example.com',
      'Beto2,5551110000,other@example.com',
      ',5552220000,x@example.com',
      'Carla,,carla@example.com',
    ].join('\n');

    const result = await service.importFromCsvText(
      9,
      { content },
      1,
      Role.BUSINESS,
    );

    expect(assertCanManage).toHaveBeenCalledWith(9, 1, Role.BUSINESS);
    expect(result.created).toBe(2);
    expect(result.duplicatesInDb).toBe(1);
    expect(result.duplicatesInFile).toBe(1);
    expect(result.invalid).toBe(1);
    expect(saveClient).toHaveBeenCalledTimes(2);
    // Critical: importing clients must never create platform users/passwords.
    expect(userSave).not.toHaveBeenCalled();
  });

  it('rejects imports that exceed the configured row limit', async () => {
    const { service } = buildService(2);
    const content = [
      'name,phone',
      'A,5550000001',
      'B,5550000002',
      'C,5550000003',
    ].join('\n');

    await expect(
      service.importFromCsvText(9, { content }, 1, Role.BUSINESS),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ClientsService CSV validation', () => {
  it('reports malformed Mexican phones and emails without persisting rows', async () => {
    const { service, saveClient } = buildService();
    const content = [
      'name,phone,email',
      'Teléfono corto,1234,valid@example.com',
      'Correo inválido,5551110000,not-an-email',
    ].join('\n');

    const result = await service.importFromCsvText(
      9,
      { content },
      1,
      Role.BUSINESS,
    );

    expect(result.invalid).toBe(2);
    expect(result.created).toBe(0);
    expect(saveClient).not.toHaveBeenCalled();
  });
});

describe('ClientsService.link', () => {
  it('rejects linking an arbitrary user whose contact does not match', async () => {
    const { service, findClient, findUser } = buildService();
    findClient.mockResolvedValue({
      id: 4,
      businessId: 9,
      name: 'Ana CRM',
      phone: '5512345678',
      email: 'ana@example.com',
      isActive: true,
    } as Client);
    findUser.mockResolvedValue({
      id: 99,
      name: 'Otra persona',
      email: 'otra@example.com',
      phone: '5599999999',
      role: Role.CLIENT,
      isActive: true,
    } as User);

    await expect(service.link(4, 1, Role.BUSINESS, 99)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
