import type { LocalNotification } from "../../domain/p1.ts";
import type { InstalledListFilter } from "./installedSkillsTypes.ts";

export type DesktopNotificationKind = "review_progress" | "skill_update" | "app_update";

export interface AppUpdateState {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  summary: string;
  highlights: string[];
  occurredAt: string;
  unread: boolean;
  releaseURL: string | null;
  actionLabel: "去更新" | "查看更新";
}

export interface DesktopNotificationItem {
  notificationID: string;
  kind: DesktopNotificationKind;
  title: string;
  summary: string;
  occurredAt: string;
  unread: boolean;
  relatedSkillID: string | null;
  rawNotificationID: string | null;
  rawType: string | null;
  source: LocalNotification["source"] | "app_update";
}

export interface DesktopNotificationLookup {
  publisherSubmissions: Array<{ submissionID: string | null; skillID: string }>;
  reviews: Array<{ reviewID: string; skillID: string }>;
}

export type DesktopNotificationAction =
  | { kind: "app_update" }
  | { kind: "my_installed"; installedFilter: InstalledListFilter; skillID: string | null }
  | { kind: "publisher"; skillID: string | null; submissionID: string | null }
  | { kind: "review"; reviewID: string | null; skillID: string | null };

const REVIEW_TYPE_KEYWORDS = [
  "in_review",
  "pending_review",
  "review_approved",
  "review_passed",
  "review_progress",
  "review_rejected",
  "returned_for_changes",
  "submitted_for_review"
];

const REVIEW_TEXT_KEYWORDS = [
  "已进入审核",
  "审核通过",
  "审核拒绝",
  "被退回修改",
  "退回修改",
  "待管理员审核",
  "进入审核",
  "under review",
  "review approved",
  "review rejected",
  "returned for changes"
];

const ADMIN_REVIEW_TASK_KEYWORDS = [
  "你有新的待审核任务",
  "新的待审核任务",
  "待审核任务",
  "审核任务",
  "review task",
  "pending review task"
];

const REVIEW_ID_PATTERN = /\b(?:rv|review)[-_][a-z0-9-]+\b/i;
const SUBMISSION_ID_PATTERN = /\b(?:sub|submission)[-_][a-z0-9-]+\b/i;

function includesKeyword(input: string, keywords: string[]) {
  return keywords.some((keyword) => input.includes(keyword.toLocaleLowerCase()));
}

function notificationText(notification: Pick<LocalNotification, "title" | "summary" | "type">) {
  return `${notification.title} ${notification.summary} ${String(notification.type)}`.toLocaleLowerCase();
}

function isReviewProgressNotification(notification: LocalNotification) {
  const type = String(notification.type).toLocaleLowerCase();
  if (REVIEW_TYPE_KEYWORDS.some((keyword) => type.includes(keyword))) {
    return true;
  }
  return includesKeyword(notificationText(notification), REVIEW_TEXT_KEYWORDS) || includesKeyword(notificationText(notification), ADMIN_REVIEW_TASK_KEYWORDS);
}

function isAdminReviewTask(notification: DesktopNotificationItem) {
  return includesKeyword(`${notification.title} ${notification.summary} ${notification.rawType ?? ""}`.toLocaleLowerCase(), ADMIN_REVIEW_TASK_KEYWORDS);
}

function matchReferenceID(input: string, pattern: RegExp) {
  const match = input.match(pattern);
  return match?.[0] ?? null;
}

function createAppUpdateNotification(appUpdate: AppUpdateState): DesktopNotificationItem | null {
  if (!appUpdate.available) return null;
  return {
    notificationID: `app_update_${appUpdate.latestVersion}`,
    kind: "app_update",
    title: `桌面客户端可更新到 ${appUpdate.latestVersion}`,
    summary: appUpdate.summary,
    occurredAt: appUpdate.occurredAt,
    unread: appUpdate.unread,
    relatedSkillID: null,
    rawNotificationID: null,
    rawType: "app_update",
    source: "app_update"
  };
}

function mapRawNotification(notification: LocalNotification): DesktopNotificationItem | null {
  if (notification.type === "skill_update_available") {
    return {
      notificationID: notification.notificationID,
      kind: "skill_update",
      title: notification.title,
      summary: notification.summary,
      occurredAt: notification.occurredAt,
      unread: notification.unread,
      relatedSkillID: notification.relatedSkillID,
      rawNotificationID: notification.notificationID,
      rawType: String(notification.type),
      source: notification.source
    };
  }

  if (!isReviewProgressNotification(notification)) {
    return null;
  }

  return {
    notificationID: notification.notificationID,
    kind: "review_progress",
    title: notification.title,
    summary: notification.summary,
    occurredAt: notification.occurredAt,
    unread: notification.unread,
    relatedSkillID: notification.relatedSkillID,
    rawNotificationID: notification.notificationID,
    rawType: String(notification.type),
    source: notification.source
  };
}

export function deriveDesktopNotifications(input: {
  appUpdate: AppUpdateState;
  notifications: LocalNotification[];
}): DesktopNotificationItem[] {
  const next = input.notifications
    .map(mapRawNotification)
    .filter((item): item is DesktopNotificationItem => item !== null);
  const appUpdateNotification = createAppUpdateNotification(input.appUpdate);
  if (appUpdateNotification) {
    next.push(appUpdateNotification);
  }
  return next
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, 20);
}

export function notificationBadgeLabel(unreadCount: number) {
  if (unreadCount <= 0) return null;
  if (unreadCount >= 10) return "9+";
  return String(unreadCount);
}

export function resolveDesktopNotificationAction(
  notification: DesktopNotificationItem,
  lookup: DesktopNotificationLookup
): DesktopNotificationAction {
  if (notification.kind === "skill_update") {
    return {
      kind: "my_installed",
      installedFilter: "updates",
      skillID: notification.relatedSkillID
    };
  }

  if (notification.kind === "app_update") {
    return { kind: "app_update" };
  }

  if (isAdminReviewTask(notification)) {
    const reviewHint = matchReferenceID(`${notification.title} ${notification.summary}`, REVIEW_ID_PATTERN);
    const matchedReview =
      lookup.reviews.find((review) => review.reviewID === reviewHint) ??
      lookup.reviews.find((review) => review.skillID === notification.relatedSkillID);
    return {
      kind: "review",
      reviewID: matchedReview?.reviewID ?? reviewHint,
      skillID: matchedReview?.skillID ?? notification.relatedSkillID
    };
  }

  const submissionHint = matchReferenceID(`${notification.title} ${notification.summary}`, SUBMISSION_ID_PATTERN);
  const matchedSubmission =
    lookup.publisherSubmissions.find((submission) => submission.submissionID === submissionHint) ??
    lookup.publisherSubmissions.find((submission) => submission.skillID === notification.relatedSkillID);
  return {
    kind: "publisher",
    submissionID: matchedSubmission?.submissionID ?? submissionHint,
    skillID: matchedSubmission?.skillID ?? notification.relatedSkillID
  };
}
