import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateStage2QuestionScore,
  calculateNumericQuestionScore,
  calculateMCQ4QuestionScore,
  calculateStage1QuestionScore,
} from '../packages/shared/dist/index.js';
import {
  getQuestionsForExam,
  OFFLINE_RESILIENCE_1MIN_QUESTIONS,
} from '../apps/api/dist/modules/exam-room/exam-questions.mock.js';

describe('Exam Lifecycle & Stage 2 Compliance Tests', () => {
  it('Stage 2 questions: questions 1 to 30 must be stage2_statements and 31 to 40 numeric', () => {
    const questions = getQuestionsForExam('advanced-molecular-genetics');
    assert.equal(questions.length, 40);

    // بررسی بخش ۱ (گزاره‌ای ۳۰ سوال)
    for (let i = 1; i <= 30; i++) {
      const q = questions.find((item) => item.questionNumber === i);
      assert.ok(q, `Question ${i} should exist`);
      assert.equal(q.type, 'stage2_statements');
      assert.equal(q.statements.length, 5);
      assert.match(q.stem, /صحت یا غلط بودن/);
    }

    // بررسی بخش ۲ (مسائل محاسباتی ۱۰ سوال)
    for (let i = 31; i <= 40; i++) {
      const q = questions.find((item) => item.questionNumber === i);
      assert.ok(q, `Question ${i} should exist`);
      assert.equal(q.type, 'numeric');
      assert.ok(q.correctNumber >= 0 && q.correctNumber <= 99);
      assert.ok(q.stem && q.stem.length > 20);
    }
  });

  it('Stage 2 official Olympiad formula scoring for 5 statements', () => {
    // همه درست
    const full = calculateStage2QuestionScore(
      { 1: true, 2: false, 3: true, 4: false, 5: false },
      { 1: true, 2: false, 3: true, 4: false, 5: false },
      1
    );
    assert.equal(full.score, 1.0);
    assert.equal(full.correctCount, 5);
    assert.equal(full.wrongCount, 0);

    // ۳ درست و ۲ غلط: (0.4 - 0.2) * 1 = 0.2
    const partial = calculateStage2QuestionScore(
      { 1: true, 2: true, 3: true, 4: true, 5: false },
      { 1: true, 2: false, 3: true, 4: false, 5: false },
      1
    );
    assert.equal(partial.correctCount, 3);
    assert.equal(partial.wrongCount, 2);
    assert.equal(Math.round(partial.score * 100) / 100, 0.2);

    // ۵ غلط: (0 - 0.5) * 1 = -0.5
    const allWrong = calculateStage2QuestionScore(
      { 1: false, 2: true, 3: false, 4: true, 5: true },
      { 1: true, 2: false, 3: true, 4: false, 5: false },
      1
    );
    assert.equal(allWrong.correctCount, 0);
    assert.equal(allWrong.wrongCount, 5);
    assert.equal(Math.round(allWrong.score * 100) / 100, -0.5);
  });

  it('Stage 2 numeric question scoring', () => {
    // پاسخ درست
    const correct = calculateNumericQuestionScore(42, 42, 2);
    assert.equal(correct.score, 2);
    assert.equal(correct.status, 'correct');

    // پاسخ غلط
    const wrong = calculateNumericQuestionScore(41, 42, 2);
    assert.equal(wrong.score, 0);
    assert.equal(wrong.status, 'wrong');

    // بی‌پاسخ
    const blank = calculateNumericQuestionScore(null, 42, 2);
    assert.equal(blank.score, 0);
    assert.equal(blank.status, 'blank');
  });

  it('1-Minute offline resilience test exam exists and has 5 questions', () => {
    const questions = getQuestionsForExam('offline-resilience-1min-test');
    assert.equal(questions.length, 5);
    assert.equal(questions[0].topic, 'پایداری شبکه و هارت‌بیت');
  });
});
