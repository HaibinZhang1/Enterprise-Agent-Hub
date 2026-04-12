import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { P1AuthenticatedRequest, P1AuthGuard } from '../auth/p1-auth.guard';
import { NotificationDto, PageResponse } from '../common/p1-contracts';
import { MarkReadRequest, NotificationsQuery, NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(P1AuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@Req() request: P1AuthenticatedRequest, @Query() query: NotificationsQuery): Promise<PageResponse<NotificationDto>> {
    return this.notificationsService.list(request.p1UserID ?? '', query);
  }

  @Post('mark-read')
  markRead(@Req() request: P1AuthenticatedRequest, @Body() body: MarkReadRequest): Promise<{ unreadNotificationCount: number }> {
    return this.notificationsService.markRead(request.p1UserID ?? '', body);
  }
}
