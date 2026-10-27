/**
 * ماژول نمره‌دهی مصوب المپیاد زیست‌شناسی کندرلب (مطابق دقیق PRD بخش ۵٫۳٫۴ و ۵٫۳٫۱۶)
 */

export interface Stage2ScoreResult {
  score: number;
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  isAllBlank: boolean;
}

export interface SingleChoiceScoreResult {
  score: number;
  status: 'correct' | 'wrong' | 'blank';
}

/**
 * فرمول نمره‌دهی سؤالات گزاره‌ای مرحله دوم (مصوب PRD ۵٫۳٫۴):
 * هر سؤال ۵ گزاره دارد و داوطلب برای هر گزاره مستقلاً «درست» یا «غلط» را انتخاب می‌کند.
 * وزن سؤال: Question_Weight (پیش‌فرض ۱)
 * سهم امتیاز پایه بر اساس تعداد گزاره‌های درست به‌ترتیب ۵/۴/۳/۲/۰–۱ برابر ۱/۰٫۶/۰٫۴/۰٫۲/۰ است:
 * برای هر گزاره‌ی غلط ۰٫۱ نمره از نمره‌ی سؤال کم می‌شود:
 * Statement_Score = (Base_By_Correct_Count − 0.1 × Wrong_Count) × Question_Weight
 * گزاره‌ی بی‌پاسخ نه در شمارش گزاره‌های درست می‌آید و نه جریمه می‌گیرد.
 * اگر همه‌ی گزاره‌ها بی‌پاسخ باشند، نمره‌ی سؤال صفر است.
 * نمره‌ی منفی مجاز است (مثلاً برای ۵ غلط: -0.5 × Weight).
 */
export function calculateStage2QuestionScore(
  userStatements: Record<number, boolean | null> | undefined | null,
  keyStatements: Record<number, boolean>,
  weight = 1,
  removedStatements: number[] = [],
  dualAnswerStatements: number[] = [],
): Stage2ScoreResult {
  const removedSet = new Set(removedStatements);
  const dualSet = new Set(dualAnswerStatements);

  let activeTotal = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let blankCount = 0;

  for (let i = 1; i <= 5; i++) {
    if (removedSet.has(i)) {
      continue;
    }
    activeTotal++;

    const userVal = userStatements ? userStatements[i] : null;
    const expected = keyStatements[i];

    if (userVal === undefined || userVal === null) {
      blankCount++;
    } else if (dualSet.has(i) || userVal === expected) {
      // دوپاسخه یا تطابق با کلید
      correctCount++;
    } else {
      wrongCount++;
    }
  }

  // اگر تمام گزاره‌های فعال بی‌پاسخ باشند، نمره صفر است
  if (blankCount === activeTotal || activeTotal === 0) {
    return {
      score: 0,
      correctCount: 0,
      wrongCount: 0,
      blankCount: activeTotal,
      isAllBlank: true,
    };
  }

  let score = 0;

  // اگر هیچ گزاره‌ای حذف نشده باشد (فرم ۵ تایی استاندارد مرحله دو)
  if (activeTotal === 5) {
    let baseScore = 0;
    if (correctCount === 5) {
      baseScore = 1.0;
    } else if (correctCount === 4) {
      baseScore = 0.6;
    } else if (correctCount === 3) {
      baseScore = 0.4;
    } else if (correctCount === 2) {
      baseScore = 0.2;
    } else {
      baseScore = 0.0;
    }
    score = (baseScore - 0.1 * wrongCount) * weight;
  } else {
    // فرمول اصلاح‌شده در صورت حذف گزاره (الگوی ۲ در PRD ۵٫۳٫۱۶):
    // Modified_Score = MAX(-Weight, (Correct / Remaining − 0.1 × Wrong) × Weight)
    const rawRatio = (correctCount / activeTotal) - 0.1 * wrongCount;
    score = Math.max(-weight, rawRatio * weight);
  }

  return {
    score: Math.round(score * 1000) / 1000,
    correctCount,
    wrongCount,
    blankCount,
    isAllBlank: false,
  };
}

/**
 * فرمول نمره‌دهی چندگزینه‌ای مرحله اول المپیاد (مصوب PRD ۵٫۳٫۴):
 * پنج گزینه با یک پاسخ صحیح.
 * پاسخ صحیح +1، پاسخ غلط −0.25 و بی‌پاسخی 0، ضربدر وزن سؤال.
 * نمره منفی مجاز است. بی‌پاسخی هیچ جریمه‌ای ندارد.
 */
export function calculateStage1QuestionScore(
  selectedOption: number | null | undefined,
  correctOption: number,
  weight = 1,
  negativePenalty = 0.25,
): SingleChoiceScoreResult {
  if (selectedOption === null || selectedOption === undefined || selectedOption <= 0) {
    return { score: 0, status: 'blank' };
  }
  if (selectedOption === correctOption) {
    return { score: Math.round(1.0 * weight * 1000) / 1000, status: 'correct' };
  }
  return { score: Math.round(-negativePenalty * weight * 1000) / 1000, status: 'wrong' };
}

/**
 * فرمول نمره‌دهی ۴ گزینه‌ای استاندارد:
 * چهار گزینه با یک پاسخ صحیح.
 * پاسخ صحیح +1، پاسخ غلط منفی (پیش‌فرض ۰٫۲۵ یا ۰٫۳۳)، بی‌پاسخ ۰.
 */
export function calculateMCQ4QuestionScore(
  selectedOption: number | null | undefined,
  correctOption: number,
  weight = 1,
  negativePenalty = 0.25,
): SingleChoiceScoreResult {
  if (selectedOption === null || selectedOption === undefined || selectedOption <= 0) {
    return { score: 0, status: 'blank' };
  }
  if (selectedOption === correctOption) {
    return { score: Math.round(1.0 * weight * 1000) / 1000, status: 'correct' };
  }
  return { score: Math.round(-negativePenalty * weight * 1000) / 1000, status: 'wrong' };
}

/**
 * فرمول نمره‌دهی عددی کوتاه‌پاسخ (مصوب PRD ۵٫۳٫۴):
 * پاسخ عددی ۲ رقمی (۰ تا ۹۹).
 * پاسخ درست: نمره کامل وزن سوال؛ پاسخ غلط: صفر بدون جریمه منفی.
 */
export function calculateNumericQuestionScore(
  numericValue: number | null | undefined,
  correctNumber: number,
  weight = 1,
): SingleChoiceScoreResult {
  if (numericValue === null || numericValue === undefined) {
    return { score: 0, status: 'blank' };
  }
  if (Number(numericValue) === Number(correctNumber)) {
    return { score: Math.round(1.0 * weight * 1000) / 1000, status: 'correct' };
  }
  return { score: 0, status: 'wrong' };
}
