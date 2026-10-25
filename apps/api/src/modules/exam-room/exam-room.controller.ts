import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ExamRoomService } from './exam-room.service';
import { TelemetryEvent } from './exam-lock.service';

interface HeartbeatBody {
  clientSeq?: number;
  answers?: Array<{
    questionNumber: number;
    selectedOption: number | null;
    isFlagged?: boolean;
    answeredAt?: number;
  }>;
  deviceId?: string;
}

interface SubmitBody {
  answers?: Array<{
    questionNumber: number;
    selectedOption: number | null;
    isFlagged?: boolean;
    answeredAt?: number;
  }>;
  deviceId?: string;
}

@Controller('exam-room')
@UseGuards(AuthGuard)
export class ExamRoomController {
  constructor(private readonly examRoomService: ExamRoomService) {}

  @Get(':identifier/init')
  async initRoom(
    @Param('identifier') identifier: string,
    @CurrentUser() user: any,
    @Headers('x-device-id') headerDeviceId?: string,
  ) {
    const deviceId =
      headerDeviceId ||
      (user?.sessionId ? `dev_${String(user.sessionId).slice(0, 8)}` : `dev_guest_${Date.now().toString(36)}`);
    return this.examRoomService.initRoom(identifier, user?.id || 'demo_user', user?.sessionId || 'sess_demo', deviceId);
  }

  @Get(':attemptId/lock')
  async getLockState(
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: any,
    @Headers('x-device-id') headerDeviceId?: string,
  ) {
    const deviceId =
      headerDeviceId ||
      (user?.sessionId ? `dev_${String(user.sessionId).slice(0, 8)}` : `dev_guest_${Date.now().toString(36)}`);
    return this.examRoomService.getLockState(attemptId, user?.id || 'demo_user', user?.sessionId || 'sess_demo', deviceId);
  }

  @Post(':attemptId/start')
  @HttpCode(HttpStatus.OK)
  async startExam(
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: any,
    @Headers('x-device-id') headerDeviceId?: string,
    @Body('deviceId') bodyDeviceId?: string,
  ) {
    const deviceId =
      bodyDeviceId ||
      headerDeviceId ||
      (user?.sessionId ? `dev_${String(user.sessionId).slice(0, 8)}` : `dev_guest_${Date.now().toString(36)}`);
    return this.examRoomService.startExam(attemptId, user?.id || 'demo_user', user?.sessionId || 'sess_demo', deviceId);
  }

  @Post(':attemptId/heartbeat')
  @HttpCode(HttpStatus.OK)
  async heartbeat(
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: any,
    @Body() body: HeartbeatBody,
    @Headers('x-device-id') headerDeviceId?: string,
  ) {
    const deviceId =
      body?.deviceId ||
      headerDeviceId ||
      (user?.sessionId ? `dev_${String(user.sessionId).slice(0, 8)}` : `dev_guest_${Date.now().toString(36)}`);
    return this.examRoomService.heartbeat(
      attemptId,
      user?.id || 'demo_user',
      user?.sessionId || 'sess_demo',
      deviceId,
      body?.clientSeq || 0,
      body?.answers || [],
    );
  }

  @Post(':attemptId/takeover')
  @HttpCode(HttpStatus.OK)
  async takeover(
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: any,
    @Headers('x-device-id') headerDeviceId?: string,
    @Body('deviceId') bodyDeviceId?: string,
  ) {
    const deviceId =
      bodyDeviceId ||
      headerDeviceId ||
      (user?.sessionId ? `dev_${String(user.sessionId).slice(0, 8)}` : `dev_guest_${Date.now().toString(36)}`);
    return this.examRoomService.takeover(attemptId, user?.id || 'demo_user', user?.sessionId || 'sess_demo', deviceId);
  }

  @Post(':attemptId/telemetry')
  @HttpCode(HttpStatus.OK)
  async recordTelemetry(
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: any,
    @Body() body: TelemetryEvent,
  ) {
    return this.examRoomService.recordTelemetry(attemptId, user?.id || 'demo_user', body);
  }

  @Post(':attemptId/submit')
  @HttpCode(HttpStatus.OK)
  async submitExam(
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: any,
    @Body() body: SubmitBody,
    @Headers('x-device-id') headerDeviceId?: string,
  ) {
    const deviceId =
      body?.deviceId ||
      headerDeviceId ||
      (user?.sessionId ? `dev_${String(user.sessionId).slice(0, 8)}` : `dev_guest_${Date.now().toString(36)}`);
    return this.examRoomService.submitExam(
      attemptId,
      user?.id || 'demo_user',
      user?.sessionId || 'sess_demo',
      deviceId,
      body?.answers || [],
    );
  }
}
