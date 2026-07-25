import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.enableCors({
    origin: true,
    credentials: true,
  }); // Enable CORS for frontend access
  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Nutricion API')
    .setDescription('API del MVP Nutrición (NestJS + Prisma)')
    .setVersion('1.0')
    .addBearerAuth() // habilita el botón Authorize con JWT
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = configService.get<number>('PORT', 4100);
  await app.listen(port, '0.0.0.0');
}
bootstrap();
