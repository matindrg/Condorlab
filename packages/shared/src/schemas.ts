import { z } from 'zod';
import { StudentGrade } from './enums';

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
    grade: z.nativeEnum(StudentGrade, {
      errorMap: () => ({ message: 'لطفاً پایه تحصیلی مجاز (نهم تا یازدهم) را انتخاب فرمایید.' }),
    }),
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
