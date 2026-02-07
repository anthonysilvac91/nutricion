import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'nuevo@demo.cl' })
  email: string;

  @ApiProperty({ example: '123456' })
  password: string;
}
