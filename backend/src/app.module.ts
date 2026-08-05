import { Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { PatientsModule } from './patients/patients.module';
import { AdminModule } from './admin/admin.module';
import { AssessmentsModule } from './assessments/assessments.module';
import { PlansModule } from './plans/plans.module';
import { FoodsModule } from './foods/foods.module';
import { EncountersModule } from './encounters/encounters.module';

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
    AssessmentsModule,
    PlansModule,
    FoodsModule,
    EncountersModule,
  ],
  controllers: [
    AppController,
    HealthController,
  ],
  providers: [
    AppService,
    // Registered here (not only in main.ts's bootstrap) so it's also active in e2e tests,
    // which build the app via Test.createTestingModule and never call bootstrap().
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    },
  ],
})
export class AppModule { }
