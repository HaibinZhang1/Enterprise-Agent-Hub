import { ConnectionStatus, LocalEventDto, NotificationType, UserSummary } from '../common/p1-contracts';
export interface BootstrapResponse {
    user: UserSummary;
    connection: {
        status: ConnectionStatus;
        serverTime: string;
        apiVersion: string;
    };
    features: {
        p1Desktop: true;
        publishSkill: false;
        reviewWorkbench: false;
        adminManage: false;
        mcpManage: false;
        pluginManage: false;
    };
    counts: {
        installedCount: number;
        updateAvailableCount: number;
        unreadNotificationCount: number;
    };
    navigation: string[];
}
export interface LocalEventsRequest {
    deviceID?: string;
    events?: LocalEventDto[];
}
export interface LocalEventsResponse {
    acceptedEventIDs: string[];
    rejectedEvents: Array<{
        eventID?: string;
        code: string;
        message: string;
    }>;
    serverStateChanged: boolean;
    remoteNotices: Array<{
        skillID?: string;
        noticeType: NotificationType;
        message: string;
    }>;
}
export declare class DesktopService {
    private readonly acceptedEvents;
    bootstrap(): BootstrapResponse;
    acceptLocalEvents(request: LocalEventsRequest): LocalEventsResponse;
}
