import { ExamStatus, AccessType, ExamSummary, CheckoutPreview } from '@condorlab/shared';

export const INITIAL_CATALOG_EXAMS: ExamSummary[] = [
  {
    id: 'exm-campbell-p1',
    slug: 'campbell-vol1-vol2-pilot-1',
    title: 'شبیه‌ساز جامع جلد ۱ و ۲ بیولوژی کمپبل (پایلوت ۱)',
    campbellVolumes: [1, 2],
    status: ExamStatus.Published,
    startTime: '2026-10-30T10:00:00.000Z',
    endTime: '2026-10-31T18:00:00.000Z',
    durationMinutes: 120,
    totalQuestions: 60,
    price: 0,
    capacity: 500,
    isCapacityVisible: true,
    officialEnrolledCount: 382,
  },
  {
    id: 'exm-campbell-p2',
    slug: 'biology-olympiad-stage-1-pilot-2',
    title: 'آزمون شبیه‌ساز مرحله اول المپیاد زیست‌شناسی (پایلوت ۲)',
    campbellVolumes: [1, 2, 3, 4, 5],
    status: ExamStatus.Published,
    startTime: '2026-11-08T09:00:00.000Z',
    endTime: '2026-11-09T21:00:00.000Z',
    durationMinutes: 150,
    totalQuestions: 75,
    price: 180000,
    capacity: 200,
    isCapacityVisible: false,
    officialEnrolledCount: 84,
  },
  {
    id: 'exm-genetics-adv',
    slug: 'advanced-molecular-genetics',
    title: 'شبیه‌ساز تخصصی ژنتیک مولکولی و مهندسی ژنتیک (مرحله ۲)',
    campbellVolumes: [2],
    status: ExamStatus.Published,
    startTime: '2026-11-19T14:00:00.000Z',
    endTime: '2026-11-20T20:00:00.000Z',
    durationMinutes: 90,
    totalQuestions: 40,
    price: 220000,
    capacity: 150,
    isCapacityVisible: false,
    officialEnrolledCount: 42,
  },
];

export function getInitialExam(idOrSlug: string): ExamSummary {
  return (
    INITIAL_CATALOG_EXAMS.find((e) => e.id === idOrSlug || e.slug === idOrSlug) ||
    INITIAL_CATALOG_EXAMS[1]
  );
}

export function getInitialCheckoutPreview(examIdOrSlug: string): CheckoutPreview {
  const exam = getInitialExam(examIdOrSlug);
  return {
    exam,
    accessType: AccessType.Official,
    totalPrice: exam.price,
    discountAmount: 0,
    payableAmount: exam.price,
    isProfileComplete: false,
    missingProfileFields: ['phoneNumber', 'city', 'school', 'grade'],
  };
}
