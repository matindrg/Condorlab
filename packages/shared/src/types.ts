import { UserRole, UserStatus, StudentGrade, ExamStatus, AccessType, QuestionTopic, TicketStatus } from './enums';

export interface UserSummary {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  fullName: string;
  grade?: StudentGrade;
  telegramChatId?: number;
  telegramUsername?: string;
  createdAt: string;
}

export interface ExamSummary {
  id: string;
  slug: string;
  title: string;
  campbellVolumes: number[];
  status: ExamStatus;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  totalQuestions: number;
  price: number;
  capacity?: number;
  isCapacityVisible: boolean;
  officialEnrolledCount: number;
}

export interface QuestionMetadata {
  id: string;
  number: number;
  topic: QuestionTopic;
  campbellVolume: number;
  campbellChapter: number;
  scoreWeight: number;
  negativePenalty: number; // e.g. 0.3333
  hasMultipleCorrect: boolean;
}

export interface OMRAnswerItem {
  questionNumber: number;
  selectedOption: number | null; // 1, 2, 3, 4, or null
  isFlagged: boolean;
  answeredAt?: string;
}

export interface ExamAttemptState {
  attemptId: string;
  examId: string;
  userId: string;
  accessType: AccessType;
  startedAt: string;
  remainingSeconds: number;
  answers: Record<number, OMRAnswerItem>;
  syncStatus: 'synced' | 'pending' | 'offline_error';
  takeoverCount: number;
  maxTakeoversAllowed: number;
}

export interface ReportCardSummary {
  attemptId: string;
  examTitle: string;
  scorePercentage: number;
  officialRank?: number;
  totalParticipants?: number;
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  keyVersion: string;
  topicBreakdown: Array<{
    topic: QuestionTopic;
    campbellVolume: number;
    campbellChapter: number;
    percentage: number;
    correct: number;
    total: number;
    status: 'strong' | 'moderate' | 'weak';
  }>;
}

export interface CheckoutPreview {
  exam: ExamSummary;
  accessType: AccessType;
  totalPrice: number;
  discountAmount: number;
  payableAmount: number;
  couponCode?: string;
  isHunterCoupon?: boolean;
  isProfileComplete: boolean;
  missingProfileFields: string[];
}

export interface CouponValidationResult {
  valid: boolean;
  discountPercent?: number;
  discountAmount?: number;
  isHunterCoupon?: boolean;
  remainingUses?: number;
  message: string;
}
