import type { PackageFileContent, ReviewDetail, ReviewItem } from "../../domain/p1.ts";
import { P1_API_ROUTES } from "@enterprise-agent-hub/shared-contracts";
import { requestJSON, routePath } from "./core.ts";

export function createReviewClient() {
  return {
    async listReviews(): Promise<ReviewItem[]> {
      return requestJSON<ReviewItem[]>(P1_API_ROUTES.adminReviews);
    },

    async getReview(reviewID: string): Promise<ReviewDetail> {
      return requestJSON<ReviewDetail>(routePath(P1_API_ROUTES.adminReviewDetail, { reviewID }));
    },

    async listReviewFiles(reviewID: string): Promise<ReviewDetail["packageFiles"]> {
      return requestJSON<ReviewDetail["packageFiles"]>(routePath(P1_API_ROUTES.adminReviewFiles, { reviewID }));
    },

    async getReviewFileContent(reviewID: string, relativePath: string): Promise<PackageFileContent> {
      return requestJSON<PackageFileContent>(`${routePath(P1_API_ROUTES.adminReviewFileContent, { reviewID })}?path=${encodeURIComponent(relativePath)}`);
    },

    async claimReview(reviewID: string): Promise<ReviewDetail> {
      return requestJSON<ReviewDetail>(routePath(P1_API_ROUTES.adminReviewClaim, { reviewID }), {
        method: "POST"
      });
    },

    async passPrecheck(reviewID: string, comment: string): Promise<ReviewDetail> {
      return requestJSON<ReviewDetail>(routePath(P1_API_ROUTES.adminReviewPassPrecheck, { reviewID }), {
        method: "POST",
        body: JSON.stringify({ comment })
      });
    },

    async approveReview(reviewID: string, comment: string): Promise<ReviewDetail> {
      return requestJSON<ReviewDetail>(routePath(P1_API_ROUTES.adminReviewApprove, { reviewID }), {
        method: "POST",
        body: JSON.stringify({ comment })
      });
    },

    async returnReview(reviewID: string, comment: string): Promise<ReviewDetail> {
      return requestJSON<ReviewDetail>(routePath(P1_API_ROUTES.adminReviewReturn, { reviewID }), {
        method: "POST",
        body: JSON.stringify({ comment })
      });
    },

    async rejectReview(reviewID: string, comment: string): Promise<ReviewDetail> {
      return requestJSON<ReviewDetail>(routePath(P1_API_ROUTES.adminReviewReject, { reviewID }), {
        method: "POST",
        body: JSON.stringify({ comment })
      });
    },
  };
}
