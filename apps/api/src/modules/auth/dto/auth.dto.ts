import { StudentGrade } from '@condorlab/shared';

export interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  grade?: StudentGrade;
  city?: string;
  school?: string;
  phoneNumber?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}
