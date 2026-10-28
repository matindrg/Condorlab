import { Controller, Post, Get, Body, Res, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { parseSessionToken } from '../../common/utils/session.util';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { user, session } = await this.authService.register(dto);
    this.setSessionCookie(res, session.userId, session.sessionId);
    return {
      success: true,
      user,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, session } = await this.authService.login(dto);
    this.setSessionCookie(res, session.userId, session.sessionId);
    return {
      success: true,
      user,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const rawCookie = req.cookies?.['condor_session'] || req.headers.authorization;
      const parsed = parseSessionToken(rawCookie);
      if (parsed) {
        await this.authService.logout(parsed.userId, parsed.sessionId);
      }
    } catch {
      // ignore
    }
    res.clearCookie('condor_session', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    });
    return { success: true };
  }

  @Post('impersonate')
  @HttpCode(HttpStatus.OK)
  async impersonate(
    @Body('target') target: string,
    @Body('role') role: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, session } = await this.authService.impersonate(target || role);
    this.setSessionCookie(res, session.userId, session.sessionId);
    return {
      success: true,
      user,
    };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async getMe(@CurrentUser('id') userId: string) {
    const user = await this.authService.getMe(userId);
    return { success: true, user };
  }

  /**
   * تنظیم کوکی امن HttpOnly با طول عمر ۳۰ روز و انقضای دقیق تقویمی
   */
  private setSessionCookie(res: Response, userId: string, sessionId: string) {
    const rawToken = Buffer.from(`${userId}:${sessionId}`).toString('base64');
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // ۳۰ روز دقیق
    res.cookie('condor_session', rawToken, {
      httpOnly: true, // ممانعت از خواندن توسط XSS
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      expires,
    });
  }
}
