import { Body, Controller, INestApplication, Post } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppController } from './../src/app.controller';
import { configureBodyParsers } from './../src/config/body-parser';

@Controller()
class PayloadProbeController {
  @Post('payload-probe')
  probe(@Body('content') content: string) {
    return { length: content.length };
  }
}

describe('Health endpoint (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController, PayloadProbeController],
    }).compile();

    const expressApp =
      moduleFixture.createNestApplication<NestExpressApplication>({
        bodyParser: false,
        rawBody: true,
      });
    configureBodyParsers(expressApp);
    app = expressApp;
    await app.init();
  });

  afterAll(async () => app.close());

  it('/health (GET)', async () => {
    await request(app.getHttpServer() as App)
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('accepts a JSON CSV payload of 1,000,000 characters', async () => {
    const content = 'x'.repeat(1_000_000);

    await request(app.getHttpServer() as App)
      .post('/payload-probe')
      .send({ content })
      .expect(201)
      .expect({ length: content.length });
  });
});
