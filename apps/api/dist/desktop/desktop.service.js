"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DesktopService = void 0;
const common_1 = require("@nestjs/common");
const p1_seed_1 = require("../database/p1-seed");
let DesktopService = class DesktopService {
    acceptedEvents = new Set();
    bootstrap() {
        return {
            user: p1_seed_1.p1User,
            connection: {
                status: 'connected',
                serverTime: new Date().toISOString(),
                apiVersion: 'p1.0',
            },
            features: {
                p1Desktop: true,
                publishSkill: false,
                reviewWorkbench: false,
                adminManage: false,
                mcpManage: false,
                pluginManage: false,
            },
            counts: {
                installedCount: 0,
                updateAvailableCount: 1,
                unreadNotificationCount: p1_seed_1.p1Notifications.filter((notification) => !notification.read).length,
            },
            navigation: ['home', 'market', 'my_installed', 'tools', 'projects', 'notifications', 'settings'],
        };
    }
    acceptLocalEvents(request) {
        const rejectedEvents = [];
        const acceptedEventIDs = [];
        if (!request.deviceID) {
            rejectedEvents.push({ code: 'device_required', message: 'deviceID is required' });
            return { acceptedEventIDs, rejectedEvents, serverStateChanged: false, remoteNotices: [] };
        }
        for (const event of request.events ?? []) {
            if (!event.eventID || !event.occurredAt || !event.result) {
                rejectedEvents.push({ eventID: event.eventID, code: 'invalid_event', message: 'eventID, occurredAt and result are required' });
                continue;
            }
            const idempotencyKey = `${request.deviceID}:${event.eventID}`;
            if (!this.acceptedEvents.has(idempotencyKey)) {
                this.acceptedEvents.add(idempotencyKey);
            }
            acceptedEventIDs.push(event.eventID);
        }
        return {
            acceptedEventIDs,
            rejectedEvents,
            serverStateChanged: acceptedEventIDs.length > 0,
            remoteNotices: acceptedEventIDs.length
                ? [
                    {
                        skillID: 'codex-review-helper',
                        noticeType: 'skill_update_available',
                        message: '该 Skill 有新版本可更新',
                    },
                ]
                : [],
        };
    }
};
exports.DesktopService = DesktopService;
exports.DesktopService = DesktopService = __decorate([
    (0, common_1.Injectable)()
], DesktopService);
