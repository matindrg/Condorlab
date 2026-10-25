import { Injectable, BadRequestException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { CryptoUtil } from '../../common/utils/crypto.util';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { UserRole, UserStatus, StudentGrade, messagesFa } from '@condorlab/shared';

export interface SessionPayload {
  userId: string;
  role: UserRole;
  sessionId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * ثبت‌نام داوطلب با اعتبارسنجی پایه تحصیلی (ممنوعیت پایه دوازدهم)
   */
  async register(dto: RegisterDto): Promise<{ user: any; session: SessionPayload }> {
    const email = dto.email.trim().toLowerCase();

    // بررسی ممنوعیت پایه دوازدهم (قانون رسمی المپیاد زیست)
    if ((dto.grade as string) === '12') {
      throw new BadRequestException('ثبت‌نام برای پایه دوازدهم در المپیاد زیست‌شناسی مجاز نمی‌باشد.');
    }

    // بررسی عدم وجود ایمیل تکراری
    const existing = await this.prisma.client.identity.findFirst({
      where: {
        provider: 'EMAIL_PASSWORD',
        identifier: email,
      },
    });

    if (existing) {
      throw new ConflictException('حساب کاربری با این نشانی ایمیل قبلاً ثبت شده است.');
    }

    // هش امن رمز عبور
    const passwordHash = await CryptoUtil.hashPassword(dto.password);

    // ساخت کاربر، هویت و پروفایل در تراکنش دیتابیس
    const user = await this.prisma.client.user.create({
      data: {
        role: UserRole.Student,
        status: UserStatus.Active,
        identities: {
          create: {
            provider: 'EMAIL_PASSWORD',
            identifier: email,
            passwordHash,
            isVerified: false,
          },
        },
        profile: {
          create: {
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            grade: dto.grade || StudentGrade.Grade10,
            city: dto.city?.trim() || 'تهران',
            school: dto.school?.trim() || 'دبیرستان',
            phoneNumber: dto.phoneNumber?.trim(),
          },
        },
      },
      include: {
        profile: true,
      },
    });

    // صدور سشن و ثبت در ردیس (سقف ۲ دستگاه)
    const sessionId = CryptoUtil.generateSecureToken(24);
    await this.redis.registerSession(user.id, sessionId, 2);

    const session: SessionPayload = {
      userId: user.id,
      role: user.role as UserRole,
      sessionId,
    };

    return { user: this.sanitizeUser(user), session };
  }

  /**
   * ورود با ایمیل و رمز عبور
   */
  async login(dto: LoginDto): Promise<{ user: any; session: SessionPayload }> {
    const email = dto.email.trim().toLowerCase();

    const identity = await this.prisma.client.identity.findFirst({
      where: {
        provider: 'EMAIL_PASSWORD',
        identifier: email,
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!identity || !identity.passwordHash) {
      throw new UnauthorizedException(messagesFa.auth.invalidCredentials);
    }

    // بررسی تطابق رمز عبور
    const isValid = await CryptoUtil.verifyPassword(dto.password, identity.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException(messagesFa.auth.invalidCredentials);
    }

    const user = identity.user;

    // بررسی وضعیت حساب کاربری
    if (user.status === UserStatus.Suspended || user.status === UserStatus.Restricted) {
      throw new UnauthorizedException('حساب کاربری شما مسدود یا محدود شده است.');
    }

    // صدور سشن جدید و اعمال قاعده FIFO (حداکثر ۲ نشست هم‌زمان)
    const sessionId = CryptoUtil.generateSecureToken(24);
    await this.redis.registerSession(user.id, sessionId, 2);

    const session: SessionPayload = {
      userId: user.id,
      role: user.role as UserRole,
      sessionId,
    };

    return { user: this.sanitizeUser(user), session };
  }

  /**
   * خروج از حساب و ابطال سشن در ردیس
   */
  async logout(userId: string, sessionId: string): Promise<void> {
    await this.redis.removeSession(userId, sessionId);
  }

  /**
   * دریافت مشخصات کاربر احراز هویت شده
   */
  async getMe(userId: string): Promise<any> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new UnauthorizedException('کاربر یافت نشد.');
    }

    return this.sanitizeUser(user);
  }

  private sanitizeUser(user: any) {
    const { deletedAt, ...cleanUser } = user;
    return cleanUser;
  }
}
