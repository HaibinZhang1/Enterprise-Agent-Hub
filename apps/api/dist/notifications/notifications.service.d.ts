import { NotificationDto, PageResponse } from '../common/p1-contracts';
export interface NotificationsQuery {
    unreadOnly?: string;
    page?: string;
    pageSize?: string;
}
export interface MarkReadRequest {
    notificationIDs?: string[];
    all?: boolean;
}
export declare class NotificationsService {
    private readonly readIDs;
    list(query: NotificationsQuery): PageResponse<NotificationDto>;
    markRead(request: MarkReadRequest): {
        unreadNotificationCount: number;
    };
}
