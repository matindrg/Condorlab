import { z } from 'zod';
import { StudentGrade } from './enums';
import { toEnglishDigits } from './digits';

export const LoginSchema = z.object({
  email: z.string().trim().email({ message: 'نشانی ایمیل نامعتبر است.' }),
  password: z.string().min(8, { message: 'رمز عبور باید حداقل ۸ نویسه باشد.' }),
});

export const RegisterSchema = z
  .object({
    firstName: z.string().trim().min(2, { message: 'نام باید حداقل ۲ حرف باشد.' }),
    lastName: z.string().trim().min(2, { message: 'نام خانوادگی باید حداقل ۲ حرف باشد.' }),
    email: z.string().trim().email({ message: 'نشانی ایمیل معتبر نیست.' }),
    password: z.string().min(8, { message: 'رمز عبور باید حداقل ۸ نویسه باشد.' }),
    confirmPassword: z.string(),
    grade: z
      .preprocess(
        (val) => (val ? toEnglishDigits(val as string) : undefined),
        z.nativeEnum(StudentGrade).optional(),
      )
      .optional(),
    termsAccepted: z.literal(true, {
      errorMap: () => ({ message: 'پذیرش قوانین آزمون و شرایط استفاده الزامی است.' }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'تکرار رمز عبور با رمز وارد شده مطابقت ندارد.',
    path: ['confirmPassword'],
  });

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const ApplyCouponSchema = z.object({
  code: z.preprocess(
    (val) => toEnglishDigits(val as string).trim().toUpperCase(),
    z.string().min(3, { message: 'کد تخفیف باید حداقل ۳ نویسه باشد.' }),
  ),
  examId: z.string().min(1, { message: 'شناسه آزمون الزامی است.' }),
});

export const CompleteProfileSchema = z.object({
  phoneNumber: z.preprocess(
    (val) => toEnglishDigits(val as string).replace(/\s+/g, ''),
    z.string().regex(/^(\+98|0)?9\d{9}$/, { message: 'شماره تماس باید با ۰۹ شروع شده و ۱۱ رقم باشد.' }),
  ),
  city: z
    .string()
    .trim()
    .min(2, { message: 'نام شهر الزامی است.' })
    .refine((val) => !/[a-zA-Z]/.test(val), {
      message: 'نام شهر نمی‌تواند به زبان انگلیسی وارد شود.',
    }),
  school: z
    .string()
    .trim()
    .min(2, { message: 'نام مدرسه الزامی است.' })
    .refine((val) => !/[a-zA-Z]/.test(val), {
      message: 'نام مدرسه نمی‌تواند به زبان انگلیسی وارد شود.',
    }),
  grade: z.preprocess(
    (val) => (val ? toEnglishDigits(val as string) : undefined),
    z.nativeEnum(StudentGrade, {
      errorMap: () => ({ message: 'انتخاب پایه تحصیلی الزامی است.' }),
    }),
  ),
});

export type ApplyCouponInput = z.infer<typeof ApplyCouponSchema>;
export type CompleteProfileInput = z.infer<typeof CompleteProfileSchema>;
