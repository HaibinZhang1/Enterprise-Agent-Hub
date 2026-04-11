"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const p1_contracts_1 = require("../common/p1-contracts");
const p1_seed_1 = require("../database/p1-seed");
let NotificationsService = class NotificationsService {
    readIDs = new Set(p1_seed_1.p1Notifications.filter((notification) => notification.read).map((notification) => notification.notificationID));
    list(query) {
        const page = positiveInt(query.page, 1);
        const pageSize = positiveInt(query.pageSize, 20, 100);
        const items = p1_seed_1.p1Notifications
            .map((notification) => ({ ...notification, read: this.readIDs.has(notification.notificationID) }))
            .filter((notification) => query.unreadOnly !== 'true' || !notification.read);
        const start = (page - 1) * pageSize;
        return (0, p1_contracts_1.pageOf)(items.slice(start, start + pageSize), page, pageSize, items.length);
    }
    markRead(request) {
        if (request.all) {
            for (const notification of p1_seed_1.p1Notifications) {
                this.readIDs.add(notification.notificationID);
            }
        }
        else {
            for (const notificationID of request.notificationIDs ?? []) {
                this.readIDs.add(notificationID);
            }
        }
        return {
            unreadNotificationCount: p1_seed_1.p1Notifications.filter((notification) => !this.readIDs.has(notification.notificationID)).length,
        };
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)()
], NotificationsService);
function positiveInt(value, fallback, max = 100) {
    const parsed = Number.parseInt(value ?? '', 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }
    return Math.min(parsed, max);
}
