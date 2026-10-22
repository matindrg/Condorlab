import { useCallback, useEffect, useRef, useState } from 'react';
import { TakeoverModal } from './TakeoverModal';
import { useExamHeartbeat, type TakeoverInfo } from './useExamHeartbeat';

interface DemoQuestion {
  id: string;
  text: string;
  options: string[];
}

interface ExamPageProps {
  attemptId: string;
  questions: DemoQuestion[];
  getAccessToken: () => string | null;
}

/**
 * Minimal integration example. In the real app, replace the local `answers`
 * state with your answer-sheet store; the important part is that every answer
 * change calls `queueAnswer`, which persists to LocalStorage and syncs on the
 * next heartbeat.
 */
export function ExamPage({ attemptId, questions, getAccessToken }: ExamPageProps) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [takeoverOpen, setTakeoverOpen] = useState(false);
  const [takeoverInfo, setTakeoverInfo] = useState<TakeoverInfo | null>(null);
  const startRequested = useRef(false);

  const handleLockLost = useCallback(() => {
    // Redirect to the dashboard; the hook has already stopped the timer.
    window.location.assign('/dashboard');
  }, []);

  const {
    status,
    pendingCount,
    takeoverInfo: currentTakeoverInfo,
    isTakingOver,
    queueAnswer,
    startExam,
    takeover,
    retryNow,
  } = useExamHeartbeat({
    attemptId,
    getAccessToken,
    onLockLost: handleLockLost,
    onTakeoverRequired: (info) => {
      setTakeoverInfo(info);
      setTakeoverOpen(true);
    },
    onAuthError: () => window.location.assign('/login'),
  });

  useEffect(() => {
    if (startRequested.current) return;
    startRequested.current = true;
    void startExam();
  }, [startExam]);

  const selectAnswer = (questionId: string, optionIndex: number) => {
    setAnswers((previous) => ({ ...previous, [questionId]: optionIndex }));
    queueAnswer(questionId, optionIndex);
  };

  return (
    <main dir="rtl" style={{ fontFamily: 'Vazirmatn, IRANSans, Tahoma, sans-serif', padding: 16 }}>
      <header style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <strong>آزمون آزمایشی</strong>
        <span aria-live="polite">
          {status === 'active' && 'ذخیره‌سازی فعال'}
          {status === 'offline' && 'اتصال قطع است؛ پاسخ‌ها محلی ذخیره می‌شوند'}
          {status === 'lock_lost' && 'قفل آزمون از دست رفت'}
          {pendingCount > 0 && ` — ${pendingCount} پاسخ در صف`}
        </span>
      </header>

      {status === 'offline' && (
        <button type="button" onClick={retryNow} style={{ marginTop: 8 }}>
          تلاش مجدد اتصال
        </button>
      )}

      <ol>
        {questions.map((question, index) => (
          <li key={question.id} style={{ marginTop: 20 }}>
            <p>
              {index + 1}. {question.text}
            </p>
            {question.options.map((option, optionIndex) => (
              <label key={option} style={{ display: 'block', marginTop: 4 }}>
                <input
                  type="radio"
                  name={question.id}
                  checked={answers[question.id] === optionIndex}
                  onChange={() => selectAnswer(question.id, optionIndex)}
                />{' '}
                {option}
              </label>
            ))}
          </li>
        ))}
      </ol>

      <TakeoverModal
        open={takeoverOpen}
        info={currentTakeoverInfo ?? takeoverInfo}
        loading={isTakingOver}
        onConfirm={async () => {
          const ok = await takeover();
          if (ok) setTakeoverOpen(false);
        }}
        onCancel={() => window.location.assign('/dashboard')}
      />
    </main>
  );
}
