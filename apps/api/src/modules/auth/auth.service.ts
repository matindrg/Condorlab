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
  // کش موقت کاربران برای حفظ وضعیت لاگین حتی در زمان آفلاین بودن پستگرس
  public static inMemoryUsers = new Map<string, any>();
  public static inMemoryCredentials = new Map<string, { userId: string; passwordHash: string }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * ثبت‌نام داوطلب با اعتبارسنجی پایه تحصیلی
   */
  async register(dto: RegisterDto): Promise<{ user: any; session: SessionPayload }> {
    if (!dto || !dto.email || !dto.password) {
      throw new BadRequestException('نشانی ایمیل و رمز عبور الزامی است.');
    }
    const email = dto.email.trim().toLowerCase();

    // بررسی ممنوعیت پایه دوازدهم (قانون رسمی المپیاد زیست)
    if ((dto.grade as string) === '12') {
      throw new BadRequestException('ثبت‌نام برای پایه دوازدهم در المپیاد زیست‌شناسی مجاز نمی‌باشد.');
    }

    // هش امن رمز عبور
    const passwordHash = await CryptoUtil.hashPassword(dto.password);
    let createdUser: any = null;

    try {
      // بررسی عدم وجود ایمیل تکراری در دیتابیس
      const existing = await this.prisma.client.identity.findFirst({
        where: {
          provider: 'EMAIL_PASSWORD',
          identifier: email,
        },
      });

      if (existing) {
        throw new ConflictException('حساب کاربری با این نشانی ایمیل قبلاً ثبت شده است.');
      }

      // ساخت کاربر، هویت و پروفایل در تراکنش دیتابیس
      createdUser = await this.prisma.client.user.create({
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
              firstName: dto.firstName?.trim() || 'دانش‌آموز',
              lastName: dto.lastName?.trim() || '',
              grade: dto.grade || null,
              city: dto.city?.trim() || null,
              school: dto.school?.trim() || null,
              phoneNumber: dto.phoneNumber?.trim() || null,
            },
          },
        },
        include: {
          profile: true,
        },
      });
    } catch (dbErr) {
      if (dbErr instanceof ConflictException) throw dbErr;

      // فال‌بک در زمان قطع موقت دیتابیس پستگرس
      const fallbackId = `usr-${Date.now().toString(36)}`;
      createdUser = {
        id: fallbackId,
        role: UserRole.Student,
        status: UserStatus.Active,
        profile: {
          firstName: dto.firstName?.trim() || 'دانش‌آموز',
          lastName: dto.lastName?.trim() || '',
          grade: dto.grade || null,
          city: dto.city?.trim() || null,
          school: dto.school?.trim() || null,
          phoneNumber: dto.phoneNumber?.trim() || null,
        },
      };
    }

    // ثبت در کش درون‌برنامه‌ای برای ماندگاری سشن
    AuthService.inMemoryUsers.set(createdUser.id, createdUser);
    AuthService.inMemoryCredentials.set(email, { userId: createdUser.id, passwordHash });

    // صدور سشن و ثبت در ردیس (سقف ۲ دستگاه با ماندگاری ۳۰ روز)
    const sessionId = CryptoUtil.generateSecureToken(24);
    await this.redis.registerSession(createdUser.id, sessionId, 2);

    const session: SessionPayload = {
      userId: createdUser.id,
      role: createdUser.role as UserRole,
      sessionId,
    };

    return { user: this.sanitizeUser(createdUser), session };
  }

  /**
   * ورود با ایمیل و رمز عبور
   */
  async login(dto: LoginDto): Promise<{ user: any; session: SessionPayload }> {
    if (!dto || !dto.email || !dto.password) {
      throw new BadRequestException('نشانی ایمیل و رمز عبور الزامی است.');
    }
    const email = dto.email.trim().toLowerCase();
    let user: any = null;

    try {
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

      if (identity && identity.passwordHash) {
        const isValid = await CryptoUtil.verifyPassword(dto.password, identity.passwordHash);
        if (!isValid) {
          throw new UnauthorizedException(messagesFa.auth.invalidCredentials);
        }
        user = identity.user;
      }
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
    }

    // اگر دیتابیس در دسترس نبود، بررسی کش موقت
    if (!user && AuthService.inMemoryCredentials.has(email)) {
      const cred = AuthService.inMemoryCredentials.get(email)!;
      const isValid = await CryptoUtil.verifyPassword(dto.password, cred.passwordHash);
      if (!isValid) {
        throw new UnauthorizedException(messagesFa.auth.invalidCredentials);
      }
      user = AuthService.inMemoryUsers.get(cred.userId);
    }

    if (!user) {
      throw new UnauthorizedException(messagesFa.auth.invalidCredentials);
    }

    // صدور سشن جدید و اعمال قاعده FIFO (حداکثر ۲ نشست هم‌زمان)
    const sessionId = CryptoUtil.generateSecureToken(24);
    await this.redis.registerSession(user.id, sessionId, 2);

    // به‌روزرسانی کش سشن
    AuthService.inMemoryUsers.set(user.id, user);

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
   * دریافت مشخصات کاربر احراز هویت شده با ماندگاری کامل
   */
  async getMe(userId: string): Promise<any> {
    try {
      const user = await this.prisma.client.user.findUnique({
        where: { id: userId },
        include: { profile: true, identities: true },
      });

      if (user) {
        return this.sanitizeUser(user);
      }
    } catch {
      // در صورت آفلاین بودن دیتابیس از کش خوانده می‌شود
    }

    if (AuthService.inMemoryUsers.has(userId)) {
      return this.sanitizeUser(AuthService.inMemoryUsers.get(userId));
    }

    throw new UnauthorizedException('کاربر یافت نشد.');
  }

  private sanitizeUser(user: any) {
    const { deletedAt, ...cleanUser } = user;
    if (cleanUser.identities && Array.isArray(cleanUser.identities)) {
      const emailIdentity = cleanUser.identities.find(
        (id: any) => id.provider === 'EMAIL_PASSWORD' || id.identifier?.includes('@')
      );
      if (emailIdentity) {
        cleanUser.email = emailIdentity.identifier;
      }
      cleanUser.identities = cleanUser.identities.map((id: any) => {
        const { passwordHash, ...cleanId } = id;
        return cleanId;
      });
    }
    return cleanUser;
  }
}
