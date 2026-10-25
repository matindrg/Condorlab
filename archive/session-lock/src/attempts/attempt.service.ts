import { AppError, ErrorCodes } from '../errors';
import type { Attempt, AttemptRepository } from './attempt.repository';

export class AttemptService {
  constructor(private readonly repository: AttemptRepository) {}

  async getActiveForUser(attemptId: string, userId: string): Promise<Attempt> {
    const attempt = await this.repository.findById(attemptId);
    if (!attempt || attempt.userId !== userId) {
      // 404 for both missing and foreign attempts to avoid resource enumeration.
      throw new AppError(404, ErrorCodes.ATTEMPT_NOT_FOUND, 'تلاش آزمون پیدا نشد.');
    }
    if (attempt.status === 'submitted') {
      throw new AppError(409, ErrorCodes.ATTEMPT_SUBMITTED, 'این تلاش قبلاً ارسال شده است.');
    }
    if (attempt.status === 'expired' || attempt.expiresAt.getTime() <= Date.now()) {
      throw new AppError(409, ErrorCodes.ATTEMPT_EXPIRED, 'مهلت این تلاش به پایان رسیده است.');
    }
    return attempt;
  }

  async getForSubmit(
    attemptId: string,
    userId: string,
  ): Promise<{ attempt: Attempt; alreadySubmitted: boolean }> {
    const attempt = await this.repository.findById(attemptId);
    if (!attempt || attempt.userId !== userId) {
      throw new AppError(404, ErrorCodes.ATTEMPT_NOT_FOUND, 'تلاش آزمون پیدا نشد.');
    }
    if (attempt.status === 'submitted') {
      return { attempt, alreadySubmitted: true };
    }
    if (attempt.status === 'expired' || attempt.expiresAt.getTime() <= Date.now()) {
      throw new AppError(409, ErrorCodes.ATTEMPT_EXPIRED, 'مهلت این تلاش به پایان رسیده است.');
    }
    return { attempt, alreadySubmitted: false };
  }

  async markSubmitted(attemptId: string): Promise<void> {
    await this.repository.markSubmitted(attemptId, new Date());
  }
}
