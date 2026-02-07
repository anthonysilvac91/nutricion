import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'nutri@demo.cl' })
  email: string;

  @ApiProperty({ example: '123456' })
  password: string;
}