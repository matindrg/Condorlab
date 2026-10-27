import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { parseSessionToken } from '../utils/session.util';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // خواندن توکن از کوکی HttpOnly یا هدر Authorization
    const rawSession = request.cookies?.condor_session || request.headers.authorization;

    if (!rawSession) {
      throw new UnauthorizedException('لطفاً ابتدا وارد حساب کاربری خود شوید.');
    }

    try {
      const parsed = parseSessionToken(rawSession);
      if (!parsed) {
        throw new UnauthorizedException('نشست نامعتبر است.');
      }

      const { userId, sessionId } = parsed;

      // بررسی اعتبار سشن در ردیس (قاعده اخراج FIFO برای حداکثر ۲ دستگاه)
      const isValid = await this.redis.isSessionValid(userId, sessionId);
      if (!isValid) {
        throw new UnauthorizedException('نشست شما به دلیل ورود از دستگاه جدید یا انقضا خاتمه یافته است.');
      }

      request.user = {
        id: userId,
        sessionId,
      };

      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException('خطا در احراز هویت نشست.');
    }
  }
}
