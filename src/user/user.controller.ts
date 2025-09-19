import { 
  Controller, Post, Body, Get, Query, Param, Put, Delete 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserService } from './user.service';
import { 
  CreateAdminDto, 
  LoginDto, 
  RequestResetDto, 
  UpdatePasswordDto, 
  UpdateUserDto, 
  VerifyResetDto 
} from './dto/user.dto';

@Controller('admin')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // 🔹 Create new admin
  @Post('create')
  @ApiTags('Admin Management')
  @ApiOperation({ summary: 'Create new admin account' })
  @ApiResponse({ status: 201, description: 'Admin created successfully' })
  @ApiResponse({ status: 400, description: 'Email already exists' })
  createAdmin(@Body() dto: CreateAdminDto) {
    return this.userService.createAdmin(dto);
  }

  // 🔹 Login
  @Post('login')
  @ApiTags('Authentication')
  @ApiOperation({ summary: 'Login and get JWT token' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto) {
    return this.userService.login(dto.email, dto.password);
  }

  // 🔹 Request password reset
  @Post('request-reset')
  @ApiTags('Password Reset')
  @ApiOperation({ summary: 'Send reset code to email' })
  @ApiResponse({ status: 200, description: 'Reset code sent successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  requestReset(@Body() dto: RequestResetDto) {
    return this.userService.requestPasswordReset(dto);
  }

  // 🔹 Verify reset code and set new password
  @Post('verify-reset')
  @ApiTags('Password Reset')
  @ApiOperation({ summary: 'Verify reset code & update password' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 401, description: 'Invalid reset code' })
  verifyReset(@Body() dto: VerifyResetDto) {
    return this.userService.verifyResetPassword(dto);
  }

  // 🔹 Update user profile
  @Put(':id')
  @ApiTags('Admin Management')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.userService.updateUser(id, dto);
  }

  // 🔹 Get all admins with pagination
@Get()
@ApiTags('Admin Management')
@ApiBearerAuth()
@ApiOperation({ summary: 'Get all admins (paginated)' })
@ApiResponse({ status: 200, description: 'Admins fetched successfully' })
@ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Page number (default: 1)' })
@ApiQuery({ name: 'limit', required: false, type: Number, example: 10, description: 'Number of records per page (default: 10)' })
getAllAdmins(@Query('page') page = 1, @Query('limit') limit = 10) {
  return this.userService.getAllAdmins(Number(page), Number(limit));
}

  // 🔹 Delete admin
  @Delete(':id')
  @ApiTags('Admin Management')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an admin' })
  @ApiResponse({ status: 200, description: 'Admin deleted successfully' })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  deleteAdmin(@Param('id') id: string) {
    return this.userService.deleteAdmin(id);
  }

  // 🔹 Update password with old password validation
  @Post('update-password')
  @ApiTags('Password Management')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update password (requires old password)' })
  @ApiResponse({ status: 200, description: 'Password updated successfully' })
  @ApiResponse({ status: 401, description: 'Old password incorrect' })
  @ApiResponse({ status: 404, description: 'User not found' })
  updatePassword(@Body() dto: UpdatePasswordDto) {
    return this.userService.updatePassword(dto);
  }
}
