import type {
  AdminSkill,
  AdminUser,
  BootstrapContext,
  DepartmentNode,
  DownloadTicket,
  LocalEvent,
  LocalNotification,
  MarketFilters,
  PackageFileContent,
  PublisherSkillSummary,
  PublisherSubmissionDetail,
  ReviewDetail,
  ReviewItem,
  SkillLeaderboardsResponse,
  SkillSummary
} from "../domain/p1.ts";
import { P1_API_ROUTES } from "@enterprise-agent-hub/shared-contracts";
import { createAdminClient } from "./p1Client/admin.ts";
import { createAuthClient } from "./p1Client/auth.ts";
import { P1ApiError } from "./p1Client/core.ts";
import {
  CLIENT_UPDATE_ROUTES,
  createClientUpdatesClient,
  type ClientUpdateCheckInput,
  type ClientUpdateCheckResponse,
  type ClientUpdateDownloadTicket,
  type ClientUpdateEventInput,
  type ClientUpdateStatus
} from "./p1Client/clientUpdates.ts";
import { createDesktopSyncClient } from "./p1Client/desktopSync.ts";
import { createMarketClient } from "./p1Client/market.ts";
import { createNotificationsClient } from "./p1Client/notifications.ts";
import { createPublisherClient } from "./p1Client/publisher.ts";
import { createReviewClient } from "./p1Client/review.ts";
import { buildSkillListQuery, downloadAuthenticatedFile, isApiError, isPermissionError, isUnauthenticatedError } from "./p1Client/shared.ts";

export { P1ApiError } from "./p1Client/core.ts";
export {
  CLIENT_UPDATE_ROUTES,
  type ClientUpdateCheckInput,
  type ClientUpdateCheckResponse,
  type ClientUpdateDownloadTicket,
  type ClientUpdateEventInput,
  type ClientUpdateStatus
} from "./p1Client/clientUpdates.ts";
export { buildSkillListQuery, downloadAuthenticatedFile, isApiError, isPermissionError, isUnauthenticatedError } from "./p1Client/shared.ts";

export const REMOTE_WRITE_BLOCK_MESSAGE = "当前客户端版本过低，请先升级后继续。";
export const REMOTE_WRITE_ALLOWLIST = [
  P1_API_ROUTES.authLogin,
  P1_API_ROUTES.authLogout,
  P1_API_ROUTES.desktopBootstrap,
  CLIENT_UPDATE_ROUTES.check,
  CLIENT_UPDATE_ROUTES.downloadTicket,
  CLIENT_UPDATE_ROUTES.events,
  P1_API_ROUTES.notificationsMarkRead
] as const;

type RemoteWriteGuardStatus = Extract<ClientUpdateStatus, "mandatory_update" | "unsupported_version"> | null;

let remoteWriteGuardStatus: RemoteWriteGuardStatus = null;

export function setRemoteWriteGuardStatus(status: RemoteWriteGuardStatus): void {
  remoteWriteGuardStatus = status;
}

export function clearRemoteWriteGuardStatus(): void {
  remoteWriteGuardStatus = null;
}

export function getRemoteWriteGuardStatus(): RemoteWriteGuardStatus {
  return remoteWriteGuardStatus;
}

function isAllowlistedRemoteWrite(routeTemplate: string): boolean {
  return (REMOTE_WRITE_ALLOWLIST as readonly string[]).includes(routeTemplate);
}

function guardRemoteWrite<Args extends unknown[], Result>(
  routeTemplate: string,
  callback: (...args: Args) => Promise<Result>
): (...args: Args) => Promise<Result> {
  return async (...args: Args) => {
    if (remoteWriteGuardStatus && !isAllowlistedRemoteWrite(routeTemplate)) {
      throw new P1ApiError({
        status: 409,
        code: "client_update_required",
        message: REMOTE_WRITE_BLOCK_MESSAGE,
        retryable: false
      });
    }
    return callback(...args);
  };
}

export interface P1Client {
  hasStoredSession(): boolean;
  clearStoredSession(): void;
  currentAPIBase(): string;
  login(input: { phoneNumber: string; password: string; serverURL: string }): Promise<BootstrapContext>;
  logout(): Promise<void>;
  changeOwnPassword(input: { currentPassword: string; nextPassword: string }): Promise<void>;
  bootstrap(): Promise<BootstrapContext>;
  listSkills(filters: MarketFilters): Promise<SkillSummary[]>;
  listSkillLeaderboards(): Promise<SkillLeaderboardsResponse>;
  getSkill(skillID: string): Promise<SkillSummary>;
  downloadTicket(skill: SkillSummary, purpose: "install" | "update"): Promise<DownloadTicket>;
  star(skillID: string, starred: boolean): Promise<{ skillID: string; starred: boolean; starCount: number }>;
  listNotifications(unreadOnly?: boolean): Promise<LocalNotification[]>;
  markNotificationsRead(notificationIDs: string[] | "all"): Promise<{ unreadNotificationCount: number }>;
  syncLocalEvents(events: LocalEvent[]): Promise<{ acceptedEventIDs: string[]; rejectedEvents: LocalEvent[]; serverStateChanged: boolean }>;
  listDepartments(): Promise<DepartmentNode[]>;
  createDepartment(input: { parentDepartmentID: string; name: string }): Promise<DepartmentNode[]>;
  updateDepartment(departmentID: string, input: { name: string }): Promise<DepartmentNode[]>;
  deleteDepartment(departmentID: string): Promise<void>;
  listAdminUsers(): Promise<AdminUser[]>;
  createAdminUser(input: { username: string; phoneNumber: string; password: string; departmentID: string; role: "normal_user" | "admin"; adminLevel: number | null }): Promise<AdminUser[]>;
  updateAdminUser(phoneNumber: string, input: { username?: string; phoneNumber?: string; departmentID?: string; role?: "normal_user" | "admin"; adminLevel?: number | null }): Promise<AdminUser[]>;
  changeAdminUserPassword(phoneNumber: string, password: string): Promise<AdminUser[]>;
  freezeAdminUser(phoneNumber: string): Promise<AdminUser[]>;
  unfreezeAdminUser(phoneNumber: string): Promise<AdminUser[]>;
  deleteAdminUser(phoneNumber: string): Promise<void>;
  listAdminSkills(): Promise<AdminSkill[]>;
  delistAdminSkill(skillID: string): Promise<AdminSkill[]>;
  relistAdminSkill(skillID: string): Promise<AdminSkill[]>;
  archiveAdminSkill(skillID: string): Promise<void>;
  listPublisherSkills(): Promise<PublisherSkillSummary[]>;
  delistPublisherSkill(skillID: string): Promise<PublisherSkillSummary[]>;
  relistPublisherSkill(skillID: string): Promise<PublisherSkillSummary[]>;
  archivePublisherSkill(skillID: string): Promise<PublisherSkillSummary[]>;
  getPublisherSubmission(submissionID: string): Promise<PublisherSubmissionDetail>;
  listPublisherSubmissionFiles(submissionID: string): Promise<PublisherSubmissionDetail["packageFiles"]>;
  getPublisherSubmissionFileContent(submissionID: string, relativePath: string): Promise<PackageFileContent>;
  submitPublisherSubmission(formData: FormData): Promise<PublisherSubmissionDetail>;
  withdrawPublisherSubmission(submissionID: string): Promise<PublisherSubmissionDetail>;
  listReviews(): Promise<ReviewItem[]>;
  getReview(reviewID: string): Promise<ReviewDetail>;
  listReviewFiles(reviewID: string): Promise<ReviewDetail["packageFiles"]>;
  getReviewFileContent(reviewID: string, relativePath: string): Promise<PackageFileContent>;
  claimReview(reviewID: string): Promise<ReviewDetail>;
  passPrecheck(reviewID: string, comment: string): Promise<ReviewDetail>;
  approveReview(reviewID: string, comment: string): Promise<ReviewDetail>;
  returnReview(reviewID: string, comment: string): Promise<ReviewDetail>;
  rejectReview(reviewID: string, comment: string): Promise<ReviewDetail>;
  checkClientUpdate(input: ClientUpdateCheckInput): Promise<ClientUpdateCheckResponse>;
  requestClientUpdateDownloadTicket(releaseID: string): Promise<ClientUpdateDownloadTicket>;
  reportClientUpdateEvent(input: ClientUpdateEventInput): Promise<{ ok: true }>;
}

const authClient = createAuthClient();
const marketClient = createMarketClient();
const notificationsClient = createNotificationsClient();
const desktopSyncClient = createDesktopSyncClient();
const adminClient = createAdminClient();
const publisherClient = createPublisherClient();
const reviewClient = createReviewClient();
const clientUpdatesClient = createClientUpdatesClient();

export const p1Client: P1Client = {
  hasStoredSession: authClient.hasStoredSession,
  clearStoredSession: authClient.clearStoredSession,
  currentAPIBase: authClient.currentAPIBase,
  login: guardRemoteWrite(P1_API_ROUTES.authLogin, authClient.login),
  logout: guardRemoteWrite(P1_API_ROUTES.authLogout, authClient.logout),
  changeOwnPassword: guardRemoteWrite(P1_API_ROUTES.authChangePassword, authClient.changeOwnPassword),
  bootstrap: authClient.bootstrap,
  listSkills: marketClient.listSkills,
  listSkillLeaderboards: marketClient.listSkillLeaderboards,
  getSkill: marketClient.getSkill,
  downloadTicket: guardRemoteWrite(P1_API_ROUTES.skillDownloadTicket, marketClient.downloadTicket),
  star: guardRemoteWrite(P1_API_ROUTES.skillStar, marketClient.star),
  listNotifications: notificationsClient.listNotifications,
  markNotificationsRead: guardRemoteWrite(P1_API_ROUTES.notificationsMarkRead, notificationsClient.markNotificationsRead),
  syncLocalEvents: guardRemoteWrite(P1_API_ROUTES.desktopLocalEvents, desktopSyncClient.syncLocalEvents),
  listDepartments: adminClient.listDepartments,
  createDepartment: guardRemoteWrite(P1_API_ROUTES.adminDepartments, adminClient.createDepartment),
  updateDepartment: guardRemoteWrite(P1_API_ROUTES.adminDepartmentDetail, adminClient.updateDepartment),
  deleteDepartment: guardRemoteWrite(P1_API_ROUTES.adminDepartmentDetail, adminClient.deleteDepartment),
  listAdminUsers: adminClient.listAdminUsers,
  createAdminUser: guardRemoteWrite(P1_API_ROUTES.adminUsers, adminClient.createAdminUser),
  updateAdminUser: guardRemoteWrite(P1_API_ROUTES.adminUserDetail, adminClient.updateAdminUser),
  changeAdminUserPassword: guardRemoteWrite(P1_API_ROUTES.adminUserPassword, adminClient.changeAdminUserPassword),
  freezeAdminUser: guardRemoteWrite(P1_API_ROUTES.adminUserFreeze, adminClient.freezeAdminUser),
  unfreezeAdminUser: guardRemoteWrite(P1_API_ROUTES.adminUserUnfreeze, adminClient.unfreezeAdminUser),
  deleteAdminUser: guardRemoteWrite(P1_API_ROUTES.adminUserDetail, adminClient.deleteAdminUser),
  listAdminSkills: adminClient.listAdminSkills,
  delistAdminSkill: guardRemoteWrite(P1_API_ROUTES.adminSkillDelist, adminClient.delistAdminSkill),
  relistAdminSkill: guardRemoteWrite(P1_API_ROUTES.adminSkillRelist, adminClient.relistAdminSkill),
  archiveAdminSkill: guardRemoteWrite(P1_API_ROUTES.adminSkillArchive, adminClient.archiveAdminSkill),
  listPublisherSkills: publisherClient.listPublisherSkills,
  delistPublisherSkill: guardRemoteWrite(P1_API_ROUTES.publisherSkillDelist, publisherClient.delistPublisherSkill),
  relistPublisherSkill: guardRemoteWrite(P1_API_ROUTES.publisherSkillRelist, publisherClient.relistPublisherSkill),
  archivePublisherSkill: guardRemoteWrite(P1_API_ROUTES.publisherSkillArchive, publisherClient.archivePublisherSkill),
  getPublisherSubmission: publisherClient.getPublisherSubmission,
  listPublisherSubmissionFiles: publisherClient.listPublisherSubmissionFiles,
  getPublisherSubmissionFileContent: publisherClient.getPublisherSubmissionFileContent,
  submitPublisherSubmission: guardRemoteWrite(P1_API_ROUTES.publisherSubmissions, publisherClient.submitPublisherSubmission),
  withdrawPublisherSubmission: guardRemoteWrite(P1_API_ROUTES.publisherSubmissionWithdraw, publisherClient.withdrawPublisherSubmission),
  listReviews: reviewClient.listReviews,
  getReview: reviewClient.getReview,
  listReviewFiles: reviewClient.listReviewFiles,
  getReviewFileContent: reviewClient.getReviewFileContent,
  claimReview: guardRemoteWrite(P1_API_ROUTES.adminReviewClaim, reviewClient.claimReview),
  passPrecheck: guardRemoteWrite(P1_API_ROUTES.adminReviewPassPrecheck, reviewClient.passPrecheck),
  approveReview: guardRemoteWrite(P1_API_ROUTES.adminReviewApprove, reviewClient.approveReview),
  returnReview: guardRemoteWrite(P1_API_ROUTES.adminReviewReturn, reviewClient.returnReview),
  rejectReview: guardRemoteWrite(P1_API_ROUTES.adminReviewReject, reviewClient.rejectReview),
  checkClientUpdate: clientUpdatesClient.checkClientUpdate,
  requestClientUpdateDownloadTicket: guardRemoteWrite(
    CLIENT_UPDATE_ROUTES.downloadTicket,
    clientUpdatesClient.requestClientUpdateDownloadTicket
  ),
  reportClientUpdateEvent: guardRemoteWrite(CLIENT_UPDATE_ROUTES.events, clientUpdatesClient.reportClientUpdateEvent)
};
