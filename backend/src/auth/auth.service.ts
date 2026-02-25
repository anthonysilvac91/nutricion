// Gating & SaaS Auth Service
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionStatus, UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) { }

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const payload = { sub: user.id, email: user.email, role: user.role };
    const access_token = await this.jwt.signAsync(payload);

    return {
      access_token,
      user: { id: user.id, email: user.email, role: user.role },
      subscriptionStatus: user.subscriptionStatus,
      trialEndsAt: user.trialEndsAt,
    };
  }

  async me(userId: string) {
    let user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, createdAt: true, subscriptionStatus: true, trialEndsAt: true },
    });

    if (!user) throw new UnauthorizedException('User not found');

    const now = new Date();
    let { subscriptionStatus, trialEndsAt } = user;
    let daysLeft = 0;
    let canRead = true;
    let canWrite = true;

    if (trialEndsAt) {
      daysLeft = Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }

    if (subscriptionStatus === SubscriptionStatus.BLOCKED) {
      canRead = false;
      canWrite = false;
    } else if (subscriptionStatus === SubscriptionStatus.EXPIRED) {
      canWrite = false;
    } else if (subscriptionStatus === SubscriptionStatus.TRIALING) {
      if (trialEndsAt && trialEndsAt <= now) {
        // Trial expired, update status
        user = await this.prisma.user.update({
          where: { id: userId },
          data: { subscriptionStatus: SubscriptionStatus.EXPIRED },
          select: { id: true, email: true, role: true, createdAt: true, subscriptionStatus: true, trialEndsAt: true }
        });
        subscriptionStatus = SubscriptionStatus.EXPIRED;
        canWrite = false;
        daysLeft = 0;
      }
    }

    return {
      ...user,
      daysLeft,
      canRead,
      canWrite,
    };
  }

  async register(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const exists = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (exists) throw new BadRequestException('Email already in use');

    const passwordHash = await bcrypt.hash(password, 10);
    const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // +30 days

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role: UserRole.NUTRITIONIST,
        subscriptionStatus: SubscriptionStatus.TRIALING,
        trialEndsAt,
      },
    });

    const payload = { sub: user.id, email: user.email, role: user.role };
    const access_token = await this.jwt.signAsync(payload);

    return {
      access_token,
      user: { id: user.id, email: user.email, role: user.role },
      subscriptionStatus: user.subscriptionStatus,
      trialEndsAt: user.trialEndsAt,
    };
  }
}
