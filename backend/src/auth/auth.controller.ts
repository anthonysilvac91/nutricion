import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtGuard } from './jwt.guard';

@ApiTags('Auth')
@Controller('auth') // BASE ROUTE: /auth
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // POST /auth/login
  @ApiOperation({ summary: 'Login: devuelve JWT' })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  // POST /auth/register
  @ApiOperation({ summary: 'Registro: crea nutricionista y devuelve JWT' })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.email, dto.password);
  }

  // GET /auth/me
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Usuario autenticado (requiere Bearer token)' })
  @UseGuards(JwtGuard)
  @Get('me')
  me(@Req() req: any) {
    return this.auth.me(req.user.sub);
  }
}
