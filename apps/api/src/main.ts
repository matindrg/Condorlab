import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

// پشتیبانی از سریال‌سازی فیلدهای BigInt (مانند telegramChatId) به رشته در خروجی‌های JSON
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());

  // تنظیم CORS برای اتصال به فرانت‌اند Next.js
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🦅 Condorlab API is running on http://localhost:${port}/api/v1`);
}

bootstrap();
