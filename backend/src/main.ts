import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors(); // Enable CORS for frontend access

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Nutricion API')
    .setDescription('API del MVP Nutrición (NestJS + Prisma)')
    .setVersion('1.0')
    .addBearerAuth() // habilita el botón Authorize con JWT
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(4000); // Changed to port 4000 to avoid conflict with Next.js
}
bootstrap();