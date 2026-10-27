import {
  UserRole,
  UserStatus,
  StudentGrade,
  ExamStatus,
  AccessType,
  QuestionTopic,
  TicketStatus,
  QuestionType,
} from './enums';

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
  category?: string;
  labels?: string[];
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
  isCapacityFull?: boolean;
  remainingSeats?: number;
  isEnrolled?: boolean;
}

export interface StatementItem {
  id: string;
  label: string; // 'الف', 'ب', 'ج', 'د', 'هـ'
  text: string;
  correctValue?: boolean;
}

export interface QuestionData {
  id: number | string;
  questionNumber: number;
  type: QuestionType | 'mcq4' | 'mcq5' | 'stage2_statements' | 'numeric';
  stem: string;
  options?: string[];
  statements?: StatementItem[];
  minRange?: number;
  maxRange?: number;
  correctOption?: number;
  correctStatements?: Record<number, boolean>;
  correctNumber?: number;
  subject?: string;
  topic?: string;
  campbellVolume?: number;
  campbellChapter?: number;
  weight?: number;
  negativePenalty?: number;
  pdfPage?: number;
  explanation?: string;
}

export interface QuestionMetadata {
  id: string;
  number: number;
  topic: QuestionTopic;
  campbellVolume: number;
  campbellChapter: number;
  scoreWeight: number;
  negativePenalty: number;
  hasMultipleCorrect: boolean;
}

export interface OMRAnswerItem {
  questionNumber: number;
  selectedOption?: number | null; // 1, 2, 3, 4, 5
  selectedStatements?: Record<number, boolean | null> | null; // For stage 2 statements: { 1: true, 2: false, ... }
  numericValue?: number | null; // For numeric questions
  isFlagged: boolean;
  answeredAt?: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  isCurrentUser: boolean;
  grade: string; // Persian ordinal e.g. "پایه دهم"
  city: string;
  school: string;
  rawScore: number;
  maxScore: number;
  percentage: number;
  submittedAt: string;
}

export interface LeaderboardResponse {
  examId: string;
  examSlug: string;
  examTitle: string;
  totalOfficialParticipants: number;
  keyVersionNumber: number;
  entries: LeaderboardEntry[];
  currentUserEntry?: LeaderboardEntry | null;
  generatedAt: string;
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
  alreadyPurchased?: boolean;
}

export interface CouponValidationResult {
  valid: boolean;
  discountPercent?: number;
  discountAmount?: number;
  isHunterCoupon?: boolean;
  remainingUses?: number;
  message: string;
}
