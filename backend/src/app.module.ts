import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { PatientsModule } from './patients/patients.module';




@Module({
  imports: [
    PrismaModule,
    AuthModule,
    PatientsModule,
  ],
  controllers: [
    AppController,
    HealthController,
  ],
  providers: [
    AppService,
  ],
})
export class AppModule {}
