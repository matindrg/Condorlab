import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('exams')
  async getExams() {
    const exams = await this.adminService.getExams();
    return { success: true, data: exams };
  }

  @Post('exams')
  async createExam(@Body() body: any) {
    const res = await this.adminService.createExam(body);
    return res;
  }

  @Put('exams/:id')
  async updateExam(@Param('id') id: string, @Body() body: any) {
    const res = await this.adminService.updateExam(id, body);
    return res;
  }

  @Delete('exams/:id')
  async deleteExam(@Param('id') id: string) {
    const res = await this.adminService.deleteExam(id);
    return res;
  }

  @Get('exams/:id/questions')
  async getQuestions(@Param('id') id: string) {
    const questions = this.adminService.getQuestions(id);
    return { success: true, data: questions };
  }

  @Post('exams/:id/questions')
  async saveQuestion(@Param('id') id: string, @Body() body: any) {
    const res = this.adminService.saveQuestion(id, body);
    return res;
  }

  @Delete('exams/:id/questions/:qNum')
  async deleteQuestion(
    @Param('id') id: string,
    @Param('qNum') qNum: string,
  ) {
    const res = this.adminService.deleteQuestion(id, Number(qNum));
    return res;
  }

  @Get('products')
  async getProducts() {
    const products = await this.adminService.getProducts();
    return { success: true, data: products };
  }

  @Put('products/:id')
  async updateProduct(@Param('id') id: string, @Body() body: { price: number; isActive?: boolean }) {
    const res = await this.adminService.updateProductPrice(id, body.price, body.isActive);
    return res;
  }

  @Get('users')
  async getUsers() {
    const users = await this.adminService.getUsers();
    return { success: true, data: users };
  }

  @Post('attempts/reset')
  @HttpCode(HttpStatus.OK)
  async resetAttempt(@Body() body: { userId?: string; examId?: string }) {
    const res = await this.adminService.resetAttempt(body.userId, body.examId);
    return res;
  }
}
