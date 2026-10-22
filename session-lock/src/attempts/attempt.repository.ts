/**
 * The lock service is deliberately independent of the attempt storage.
 * In production this interface is backed by SQL (Postgres/MySQL) and the
 * exam start flow creates the attempt record transactionally.
 */

export type AttemptStatus = 'in_progress' | 'submitted' | 'expired';

export interface Attempt {
  id: string;
  examId: string;
  userId: string;
  status: AttemptStatus;
  startedAt: Date;
  expiresAt: Date;
  submittedAt?: Date;
}

export interface AttemptRepository {
  findById(attemptId: string): Promise<Attempt | null>;
  markSubmitted(attemptId: string, at: Date): Promise<void>;
}

export class InMemoryAttemptRepository implements AttemptRepository {
  private readonly attempts = new Map<string, Attempt>();

  constructor(seed: Attempt[] = []) {
    for (const attempt of seed) {
      this.attempts.set(attempt.id, { ...attempt });
    }
  }

  async findById(attemptId: string): Promise<Attempt | null> {
    const attempt = this.attempts.get(attemptId);
    return attempt ? { ...attempt } : null;
  }

  async markSubmitted(attemptId: string, at: Date): Promise<void> {
    const attempt = this.attempts.get(attemptId);
    if (!attempt) return;
    attempt.status = 'submitted';
    attempt.submittedAt = at;
  }
}

export const DEMO_USER_ID = 'user_demo_1';
export const DEMO_EXAM_ID = 'exam_demo_1';
export const DEMO_ATTEMPT_ID = 'att_demo_1';

export function createDemoAttemptRepository(): AttemptRepository {
  return new InMemoryAttemptRepository([
    {
      id: DEMO_ATTEMPT_ID,
      examId: DEMO_EXAM_ID,
      userId: DEMO_USER_ID,
      status: 'in_progress',
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    },
  ]);
}
