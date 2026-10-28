'use client';

import * as React from 'react';
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BookOpen,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Save,
  X,
  FileText,
  Hash,
  AlertCircle,
} from 'lucide-react';
import { toast } from '@/components/ui/toast';

interface StatementItem {
  id: string;
  label: string; // 'الف', 'ب', 'ج', 'د', 'هـ'
  text: string;
  correctValue?: boolean;
}

interface ExamQuestion {
  id: number;
  questionNumber: number;
  type?: 'mcq4' | 'mcq5' | 'stage2_statements' | 'numeric';
  topic: string;
  stem: string;
  options?: string[];
  statements?: StatementItem[];
  correctOption?: number;
  correctStatements?: Record<number, boolean>;
  correctNumber?: number;
  weight?: number;
  explanation?: string;
}

export default function AdminQuestionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const examIdOrSlug = resolvedParams.id;
  const router = useRouter();

  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  // استیت‌های مودال افزودن/ویرایش سوال
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<ExamQuestion | null>(null);

  const [qType, setQType] = useState<'mcq4' | 'mcq5' | 'stage2_statements' | 'numeric'>('mcq4');
  const [qNumber, setQNumber] = useState<number>(1);
  const [topic, setTopic] = useState('');
  const [stem, setStem] = useState('');
  const [explanation, setExplanation] = useState('');

  // استیت‌های ۴ یا ۵ گزینه‌ای
  const [options, setOptions] = useState<string[]>(['', '', '', '']);
  const [correctOption, setCorrectOption] = useState<number>(1);

  // استیت‌های مرحله ۲ (۵ گزاره صحیح/غلط)
  const [statements, setStatements] = useState<StatementItem[]>([
    { id: '1', label: 'الف', text: '', correctValue: true },
    { id: '2', label: 'ب', text: '', correctValue: false },
    { id: '3', label: 'ج', text: '', correctValue: true },
    { id: '4', label: 'د', text: '', correctValue: false },
    { id: '5', label: 'هـ', text: '', correctValue: true },
  ]);

  // استیت عددی مرحله ۲ (۰ تا ۹۹)
  const [correctNumber, setCorrectNumber] = useState<number>(0);

  const [submitting, setSubmitting] = useState(false);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/exams/${examIdOrSlug}/questions`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setQuestions(json.data);
        }
      }
    } catch {
      toast.error('خطا در دریافت لیست سؤالات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (examIdOrSlug) {
      fetchQuestions();
    }
  }, [examIdOrSlug]);

  const handleOpenCreate = () => {
    setEditingQuestion(null);
    setQNumber(questions.length + 1);
    setQType('mcq4');
    setTopic('مبحث جدید');
    setStem('');
    setExplanation('');
    setOptions(['', '', '', '']);
    setCorrectOption(1);
    setStatements([
      { id: '1', label: 'الف', text: '', correctValue: true },
      { id: '2', label: 'ب', text: '', correctValue: false },
      { id: '3', label: 'ج', text: '', correctValue: true },
      { id: '4', label: 'د', text: '', correctValue: false },
      { id: '5', label: 'هـ', text: '', correctValue: true },
    ]);
    setCorrectNumber(0);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (q: ExamQuestion) => {
    setEditingQuestion(q);
    setQNumber(q.questionNumber);
    setQType(q.type || 'mcq4');
    setTopic(q.topic || '');
    setStem(q.stem || '');
    setExplanation(q.explanation || '');

    if (q.options && q.options.length > 0) {
      setOptions([...q.options]);
      setCorrectOption(q.correctOption || 1);
    } else {
      setOptions(['', '', '', '']);
      setCorrectOption(1);
    }

    if (q.statements && q.statements.length > 0) {
      setStatements([...q.statements]);
    } else {
      setStatements([
        { id: '1', label: 'الف', text: '', correctValue: true },
        { id: '2', label: 'ب', text: '', correctValue: false },
        { id: '3', label: 'ج', text: '', correctValue: true },
        { id: '4', label: 'د', text: '', correctValue: false },
        { id: '5', label: 'هـ', text: '', correctValue: true },
      ]);
    }

    setCorrectNumber(q.correctNumber || 0);
    setIsModalOpen(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload: Partial<ExamQuestion> = {
        questionNumber: qNumber,
        type: qType,
        topic,
        stem,
        explanation,
      };

      if (qType === 'mcq4' || qType === 'mcq5') {
        payload.options = options.slice(0, qType === 'mcq5' ? 5 : 4);
        payload.correctOption = correctOption;
      } else if (qType === 'stage2_statements') {
        payload.statements = statements;
      } else if (qType === 'numeric') {
        payload.correctNumber = correctNumber;
      }

      const res = await fetch(`/api/admin/exams/${examIdOrSlug}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('سؤال با موفقیت در بانک سؤالات ثبت شد.');
        setIsModalOpen(false);
        fetchQuestions();
      } else {
        toast.error(data.message || 'خطا در ثبت سؤال');
      }
    } catch {
      toast.error('خطای شبکه در ثبت سؤال.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (questionNum: number) => {
    if (!confirm(`آیا از حذف سؤال شماره ${questionNum} اطمینان دارید؟`)) return;

    try {
      const res = await fetch(`/api/admin/exams/${examIdOrSlug}/questions/${questionNum}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success(`سؤال شماره ${questionNum} حذف شد.`);
        fetchQuestions();
      }
    } catch {
      toast.error('خطا در حذف سؤال.');
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* هدر صفحه مدیریت سؤالات */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
            <Link href="/admin/exams" className="hover:text-white transition-colors">
              مدیریت آزمون‌ها
            </Link>
            <span>/</span>
            <span className="text-[#FFCC00] font-bold font-mono">{examIdOrSlug}</span>
            <span>/</span>
            <span>بانک سؤالات</span>
          </div>
          <h1 className="text-2xl font-black text-white">مدیریت بانک سؤالات آزمون</h1>
          <p className="text-xs text-gray-400 mt-1">
            مشاهده، افزودن و ویرایش سؤالات تستی ۴ و ۵ گزینه‌ای، گزاره‌های تحلیلی مرحله دوم (ص / غ) و مسائل محاسباتی عددی
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/exams"
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-xs transition-colors border border-white/10 flex items-center gap-1.5"
          >
            <ArrowRight className="w-4 h-4" />
            <span>بازگشت به آزمون‌ها</span>
          </Link>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 rounded-xl bg-[#FFCC00] hover:bg-[#FFD633] text-black font-black text-xs transition-all shadow-md flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>افزودن سؤال جدید</span>
          </button>
        </div>
      </div>

      {/* لیست سؤالات آزمون */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-gray-500 bg-[#14161C] rounded-3xl border border-white/5">
            در حال بارگذاری سؤالات آزمون...
          </div>
        ) : questions.length === 0 ? (
          <div className="p-12 text-center text-gray-500 bg-[#14161C] rounded-3xl border border-white/5 space-y-3">
            <BookOpen className="w-10 h-10 mx-auto text-gray-600" />
            <h3 className="text-sm font-bold text-white">هنوز سؤالی برای این آزمون ثبت نشده است</h3>
            <p className="text-xs text-gray-400">برای شروع، روی دکمه «افزودن سؤال جدید» کلیک کنید.</p>
          </div>
        ) : (
          questions.map((q) => {
            const isStage2Stmts = q.type === 'stage2_statements' || (q.statements && q.statements.length > 0);
            const isNumeric = q.type === 'numeric' || q.correctNumber !== undefined;

            return (
              <div
                key={q.questionNumber}
                className="p-5 rounded-3xl bg-[#14161C] border border-white/5 hover:border-white/15 transition-all space-y-4"
              >
                {/* سرتیتر سؤال */}
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="w-8 h-8 rounded-xl bg-[#FFCC00] text-black font-black text-sm flex items-center justify-center shadow-md">
                      #{q.questionNumber}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-white/5 text-gray-300 text-xs font-bold border border-white/10">
                      {q.topic || 'مبحث عمومی'}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${
                        isStage2Stmts
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : isNumeric
                          ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                          : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}
                    >
                      {isStage2Stmts
                        ? '۵ گزاره‌ای تحلیلی (ص / غ)'
                        : isNumeric
                        ? 'محاسباتی عددی (۰ تا ۹۹)'
                        : 'چهارگزینه‌ای (MCQ)'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(q)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                      title="ویرایش سؤال"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(q.questionNumber)}
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                      title="حذف سؤال"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* صورت سؤال (Stem) */}
                <div className="text-sm font-medium text-white leading-relaxed whitespace-pre-wrap">
                  {q.stem}
                </div>

                {/* گزینه‌ها یا گزاره‌ها بر اساس نوع */}
                {isStage2Stmts ? (
                  /* گزاره‌های ۵‌تایی مرحله دوم (ص / غ) طبق قاعده ۵ */
                  <div className="space-y-2 pt-2">
                    <div className="text-[11px] font-bold text-amber-400">گزاره‌های تحلیلی (صحیح / غلط):</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {(q.statements || []).map((stmt, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-bold text-[#FFCC00]">({stmt.label})</span>
                            <span className="text-gray-200 truncate">{stmt.text}</span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] shrink-0 border ${
                              stmt.correctValue
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                            }`}
                          >
                            {stmt.correctValue ? 'ص (صحیح)' : 'غ (غلط)'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : isNumeric ? (
                  /* پاسخ عددی ۰ تا ۹۹ */
                  <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-xs flex items-center gap-3">
                    <Hash className="w-4 h-4 text-purple-400" />
                    <span>کلید پاسخ عددی مجاز:</span>
                    <strong className="text-white font-mono text-sm bg-purple-500/20 px-2 py-0.5 rounded-md border border-purple-500/30">
                      {q.correctNumber ?? 0}
                    </strong>
                    <span className="text-gray-400 text-[10px]">(دامنه‌ی مجاز ۰ تا ۹۹)</span>
                  </div>
                ) : (
                  /* گزینه‌های تستی ۴ یا ۵ گزینه‌ای */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2">
                    {(q.options || []).map((opt, optIdx) => {
                      const isCorrect = q.correctOption === optIdx + 1;
                      return (
                        <div
                          key={optIdx}
                          className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-colors ${
                            isCorrect
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                              : 'bg-white/[0.02] border-white/5 text-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-mono font-bold text-[#FFCC00]">[{optIdx + 1}]</span>
                            <span className="truncate">{opt}</span>
                          </div>
                          {isCorrect && (
                            <span className="text-[10px] font-bold text-emerald-400 shrink-0 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              کلید صحیح
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* مودال ایجاد یا ویرایش سؤال */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14161C] border border-white/10 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <h2 className="text-base font-bold text-white">
                {editingQuestion ? `ویرایش سؤال شماره ${qNumber}` : 'افزودن سؤال جدید به بانک آزمون'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1.5 font-bold">شماره سؤال:</label>
                  <input
                    type="number"
                    value={qNumber}
                    onChange={(e) => setQNumber(Number(e.target.value))}
                    min={1}
                    required
                    className="w-full bg-[#181A20] border border-white/10 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-[#FFCC00]/60"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-gray-400 mb-1.5 font-bold">نوع قالب سؤال:</label>
                  <select
                    value={qType}
                    onChange={(e) => setQType(e.target.value as any)}
                    className="w-full bg-[#181A20] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#FFCC00]/60"
                  >
                    <option value="mcq4">چهارگزینه‌ای استاندارد (MCQ 4)</option>
                    <option value="mcq5">پنج‌گزینه‌ای مرحله اول المپیاد (MCQ 5)</option>
                    <option value="stage2_statements">گزاره‌های ۵‌تایی مرحله دوم (صحیح / غلط)</option>
                    <option value="numeric">کوتاه‌پاسخ عددی مرحله دوم (۰ تا ۹۹)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 mb-1.5 font-bold">مبحث و سرفصل علمی:</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="مثال: غشای سلولی، فتوسنتز، ژنتیک مندلی"
                  required
                  className="w-full bg-[#181A20] border border-white/10 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#FFCC00]/60"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1.5 font-bold">متن کامل صورت سؤال (Stem):</label>
                <textarea
                  value={stem}
                  onChange={(e) => setStem(e.target.value)}
                  rows={4}
                  placeholder="متن سناریوی زیست‌شناسی و صورت سؤال را اینجا وارد کنید..."
                  required
                  className="w-full bg-[#181A20] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#FFCC00]/60 leading-relaxed"
                />
              </div>

              {/* فرم گزینه‌های ۴ یا ۵ گزینه‌ای */}
              {(qType === 'mcq4' || qType === 'mcq5') && (
                <div className="space-y-3 pt-2 border-t border-white/5">
                  <div className="text-gray-400 font-bold">گزینه‌ها و کلید صحیح:</div>
                  {[0, 1, 2, 3, ...(qType === 'mcq5' ? [4] : [])].map((idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="font-mono font-bold text-gray-400 w-6">[{idx + 1}]</span>
                      <input
                        type="text"
                        value={options[idx] || ''}
                        onChange={(e) => {
                          const newOpts = [...options];
                          newOpts[idx] = e.target.value;
                          setOptions(newOpts);
                        }}
                        placeholder={`متن گزینه ${idx + 1}...`}
                        required
                        className="flex-1 bg-[#181A20] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#FFCC00]/60"
                      />
                      <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer shrink-0">
                        <input
                          type="radio"
                          name="correctOptionRadio"
                          checked={correctOption === idx + 1}
                          onChange={() => setCorrectOption(idx + 1)}
                          className="accent-[#FFCC00]"
                        />
                        <span>کلید صحیح</span>
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {/* فرم گزاره‌های ۵‌تایی مرحله دوم (ص / غ) */}
              {qType === 'stage2_statements' && (
                <div className="space-y-3 pt-2 border-t border-white/5">
                  <div className="text-amber-400 font-bold">
                    متن و ارزش کلید گزاره‌های ۵‌تایی (الزاماً صحیح / غلط):
                  </div>
                  {statements.map((stmt, idx) => (
                    <div key={idx} className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-bold text-[#FFCC00]">گزاره ({stmt.label}):</span>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-1.5 text-emerald-400 font-bold cursor-pointer">
                            <input
                              type="radio"
                              name={`stmt_${idx}`}
                              checked={stmt.correctValue === true}
                              onChange={() => {
                                const newStmts = [...statements];
                                newStmts[idx].correctValue = true;
                                setStatements(newStmts);
                              }}
                              className="accent-emerald-500"
                            />
                            <span>ص (صحیح)</span>
                          </label>
                          <label className="flex items-center gap-1.5 text-rose-400 font-bold cursor-pointer">
                            <input
                              type="radio"
                              name={`stmt_${idx}`}
                              checked={stmt.correctValue === false}
                              onChange={() => {
                                const newStmts = [...statements];
                                newStmts[idx].correctValue = false;
                                setStatements(newStmts);
                              }}
                              className="accent-rose-500"
                            />
                            <span>غ (غلط)</span>
                          </label>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={stmt.text}
                        onChange={(e) => {
                          const newStmts = [...statements];
                          newStmts[idx].text = e.target.value;
                          setStatements(newStmts);
                        }}
                        placeholder={`متن گزاره ${stmt.label}...`}
                        required
                        className="w-full bg-[#181A20] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#FFCC00]/60"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* فرم پاسخ کوتاه عددی ۰ تا ۹۹ */}
              {qType === 'numeric' && (
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <label className="block text-purple-400 font-bold">کلید عددی پاسخ (۰ تا ۹۹):</label>
                  <input
                    type="number"
                    value={correctNumber}
                    onChange={(e) => setCorrectNumber(Math.max(0, Math.min(99, Number(e.target.value))))}
                    min={0}
                    max={99}
                    required
                    className="w-32 bg-[#181A20] border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-center text-base font-bold focus:outline-none focus:border-purple-400"
                  />
                  <p className="text-[11px] text-gray-500">
                    طبق استاندارد مصوب PRD ۵٫۳٫۴، پاسخ مسائل محاسباتی مرحله دوم عددی صحیح بین ۰ تا ۹۹ است.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-gray-400 mb-1.5 font-bold">پاسخنامه تشریحی و تحلیل آموزشی (اختیاری):</label>
                <textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  rows={3}
                  placeholder="تحلیل علمی و ارجاع به جلد و فصل بیولوژی کمپبل..."
                  className="w-full bg-[#181A20] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#FFCC00]/60 leading-relaxed"
                />
              </div>

              <div className="pt-3 border-t border-white/5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-bold transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-[#FFCC00] hover:bg-[#FFD633] text-black font-black transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{submitting ? 'در حال ثبت...' : 'ذخیره سؤال'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
