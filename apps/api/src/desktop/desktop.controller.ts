import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { P1AuthenticatedRequest, P1AuthGuard } from '../auth/p1-auth.guard';
import { BootstrapResponse, DesktopService, LocalEventsRequest, LocalEventsResponse } from './desktop.service';

@Controller('desktop')
@UseGuards(P1AuthGuard)
export class DesktopController {
  constructor(private readonly desktopService: DesktopService) {}

  @Get('bootstrap')
  bootstrap(@Req() request: P1AuthenticatedRequest): Promise<BootstrapResponse> {
    return this.desktopService.bootstrap(request.p1UserID ?? '');
  }

  @Post('local-events')
  localEvents(@Req() request: P1AuthenticatedRequest, @Body() body: LocalEventsRequest): Promise<LocalEventsResponse> {
    return this.desktopService.acceptLocalEvents(request.p1UserID ?? '', body);
  }
}
