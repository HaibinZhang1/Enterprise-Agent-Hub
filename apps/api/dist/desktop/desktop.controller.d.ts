import { BootstrapResponse, DesktopService, LocalEventsRequest, LocalEventsResponse } from './desktop.service';
export declare class DesktopController {
    private readonly desktopService;
    constructor(desktopService: DesktopService);
    bootstrap(): BootstrapResponse;
    localEvents(body: LocalEventsRequest): LocalEventsResponse;
}
