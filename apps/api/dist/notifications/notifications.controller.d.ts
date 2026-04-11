import { NotificationDto, PageResponse } from '../common/p1-contracts';
import { MarkReadRequest, NotificationsQuery, NotificationsService } from './notifications.service';
export declare class NotificationsController {
    private readonly notificationsService;
    constructor(notificationsService: NotificationsService);
    list(query: NotificationsQuery): PageResponse<NotificationDto>;
    markRead(body: MarkReadRequest): {
        unreadNotificationCount: number;
    };
}
