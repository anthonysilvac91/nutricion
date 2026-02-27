import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { PatientsModule } from './patients/patients.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRES_IN: Joi.string().required(),
        PORT: Joi.number().default(4000),
      }),
    }),
    PrismaModule,
    AuthModule,
    PatientsModule,
    AdminModule,
  ],
  controllers: [
    AppController,
    HealthController,
  ],
  providers: [
    AppService,
  ],
})
export class AppModule { }
