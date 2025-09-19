import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateAdminDto {
  @ApiProperty({ example: 'John' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;

  @ApiProperty({ example: 'admin@example.com' })
  email: string;

  @ApiProperty({ example: 'StrongP@ssw0rd!' })
  password: string;
}

export class LoginDto {
  @ApiProperty({ example: 'admin@example.com' })
  email: string;

  @ApiProperty({ example: 'securePassword123' })
  password: string;
}

export class UpdateUserDto extends PartialType(CreateAdminDto) {
  @ApiProperty({ example: 'super-admin', required: false })
  role?: string;
}

export class RequestResetDto {
  @ApiProperty({ example: 'admin@example.com' })
  email: string;
}

export class VerifyResetDto {
  @ApiProperty({ example: 'admin@example.com' })
  email: string;

  @ApiProperty({ example: '123456' })
  code: string;

  @ApiProperty({ example: 'NewStr0ngP@ss' })
  newPassword: string;
}

export class UpdatePasswordDto {
  @ApiProperty({ example: 'admin@example.com' })
  email: string;

  @ApiProperty({ example: 'OldP@ssw0rd' })
  oldPassword: string;

  @ApiProperty({ example: 'NewP@ssword123!' })
  newPassword: string;
}
