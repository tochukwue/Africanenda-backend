import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from './schemas/user.schema';
import {
  CreateAdminDto,
  RequestResetDto,
  UpdatePasswordDto,
  UpdateUserDto,
  VerifyResetDto,
} from './dto/user.dto';
import { sendEmail } from 'utils/utils.function';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService, // ✅ Inject JwtService
  ) {}

  // ✅ Create Admin
  async createAdmin(dto: CreateAdminDto): Promise<User> {
    const email = dto.email.toLowerCase();

    const exists = await this.userModel.findOne({ email });
    if (exists) throw new BadRequestException('Email already registered');

    const hashed = await bcrypt.hash(dto.password, 10);

    const admin = new this.userModel({
      ...dto,
      email, // always lowercase
      role: 'admin',
      password: hashed,
    });

    return admin.save();
  }

   async login(email: string, password: string) {
    const normalizedEmail = email.toLowerCase();
    const user = await this.userModel.findOne({ email: normalizedEmail });
    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    // ✅ Sign JWT
    const payload = { sub: user._id, email: user.email, role: user.role };
    const token = await this.jwtService.signAsync(payload);

    // remove sensitive data
    const { password: _, resetCode, ...userData } = user.toObject();

    return {
      message: 'Login successful',
      token,
      user: userData,
    };
  }

  // ✅ Request reset password (send code)
  async requestPasswordReset(dto: RequestResetDto) {
    const email = dto.email.toLowerCase();
    const user = await this.userModel.findOne({ email });
    if (!user) throw new NotFoundException('User not found');

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetCode = code;
    await user.save();

    await sendEmail(
      `<p>Your password reset code is <b>${code}</b></p>`,
      'Password Reset Code',
      [user.email],
    );

    return { message: 'Reset code sent to email' };
  }

  // ✅ Verify code & set new password
  async verifyResetPassword(dto: VerifyResetDto) {
    const email = dto.email.toLowerCase();
    const user = await this.userModel.findOne({ email });
    if (!user || user.resetCode !== dto.code) {
      throw new UnauthorizedException('Invalid code');
    }

    user.password = await bcrypt.hash(dto.newPassword, 10);
    user.resetCode = undefined;
    await user.save();

    return { message: 'Password updated successfully' };
  }

  // ✅ Update user
  async updateUser(id: string, dto: UpdateUserDto) {
    if (dto.email) dto.email = dto.email.toLowerCase();

    const user = await this.userModel.findByIdAndUpdate(id, dto, { new: true });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ✅ Fetch all admins with pagination
  async getAllAdmins(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const admins = await this.userModel
      .find({ role: 'admin' })
      .skip(skip)
      .limit(limit)
      .lean();
    const total = await this.userModel.countDocuments({ role: 'admin' });

    return {
      data: admins,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ✅ Delete admin
  async deleteAdmin(id: string) {
    const deleted = await this.userModel.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException('Admin not found');
    return { message: 'Admin deleted successfully' };
  }

  // ✅ Update password (compare old & new)
  async updatePassword(dto: UpdatePasswordDto) {
    const email = dto.email.toLowerCase();
    const user = await this.userModel.findOne({ email });
    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(dto.oldPassword, user.password);
    if (!valid) throw new UnauthorizedException('Old password is incorrect');

    user.password = await bcrypt.hash(dto.newPassword, 10);
    await user.save();

    return { message: 'Password updated successfully' };
  }

  async getAdminById(id: string) {
  const admin = await this.userModel.findOne({ _id: id, role: 'admin' }).lean();
  if (!admin) throw new NotFoundException('Admin not found');
  return admin;
}
}
