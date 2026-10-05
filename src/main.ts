import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { configureBodyParsers } from './config/body-parser';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
    bodyParser: false,
  });
  configureBodyParsers(app);
  const configService = app.get(ConfigService);
  const allowedOrigins = configService
    .getOrThrow<string>('CORS_ORIGIN')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(helmet());
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (configService.get<string>('SWAGGER_ENABLED', 'false') === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Agenda de Citas API')
      .setDescription(
        'API para gestión de citas, negocios, servicios y personal',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.getOrThrow<number>('PORT');
  const host = configService.get<string>('HOST', '0.0.0.0');
  await app.listen(port, host);
}

void bootstrap().catch((error: unknown) => {
  Logger.error(error, 'Application bootstrap failed');
  process.exitCode = 1;
});
