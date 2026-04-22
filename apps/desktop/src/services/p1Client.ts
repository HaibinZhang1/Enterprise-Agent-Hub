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
import { createAdminClient } from "./p1Client/admin.ts";
import { createAuthClient } from "./p1Client/auth.ts";
import { P1ApiError } from "./p1Client/core.ts";
import { createDesktopSyncClient } from "./p1Client/desktopSync.ts";
import { createMarketClient } from "./p1Client/market.ts";
import { createNotificationsClient } from "./p1Client/notifications.ts";
import { createPublisherClient } from "./p1Client/publisher.ts";
import { createReviewClient } from "./p1Client/review.ts";
import { buildSkillListQuery, downloadAuthenticatedFile, isApiError, isPermissionError, isUnauthenticatedError } from "./p1Client/shared.ts";

export { P1ApiError } from "./p1Client/core.ts";
export { buildSkillListQuery, downloadAuthenticatedFile, isApiError, isPermissionError, isUnauthenticatedError } from "./p1Client/shared.ts";

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
}

export const p1Client: P1Client = {
  ...createAuthClient(),
  ...createMarketClient(),
  ...createNotificationsClient(),
  ...createDesktopSyncClient(),
  ...createAdminClient(),
  ...createPublisherClient(),
  ...createReviewClient(),
};
