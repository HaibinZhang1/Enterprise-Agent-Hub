import type { PackageFileContent, PublisherSkillSummary, PublisherSubmissionDetail } from "../../domain/p1.ts";
import { P1_API_ROUTES } from "@enterprise-agent-hub/shared-contracts";
import { requestJSON, routePath } from "./core.ts";

export function createPublisherClient() {
  return {
    async listPublisherSkills(): Promise<PublisherSkillSummary[]> {
      return requestJSON<PublisherSkillSummary[]>(P1_API_ROUTES.publisherSkills);
    },

    async delistPublisherSkill(skillID: string): Promise<PublisherSkillSummary[]> {
      return requestJSON<PublisherSkillSummary[]>(routePath(P1_API_ROUTES.publisherSkillDelist, { skillID }), {
        method: "POST"
      });
    },

    async relistPublisherSkill(skillID: string): Promise<PublisherSkillSummary[]> {
      return requestJSON<PublisherSkillSummary[]>(routePath(P1_API_ROUTES.publisherSkillRelist, { skillID }), {
        method: "POST"
      });
    },

    async archivePublisherSkill(skillID: string): Promise<PublisherSkillSummary[]> {
      return requestJSON<PublisherSkillSummary[]>(routePath(P1_API_ROUTES.publisherSkillArchive, { skillID }), {
        method: "POST"
      });
    },

    async getPublisherSubmission(submissionID: string): Promise<PublisherSubmissionDetail> {
      return requestJSON<PublisherSubmissionDetail>(routePath(P1_API_ROUTES.publisherSubmissionDetail, { submissionID }));
    },

    async listPublisherSubmissionFiles(submissionID: string): Promise<PublisherSubmissionDetail["packageFiles"]> {
      return requestJSON<PublisherSubmissionDetail["packageFiles"]>(routePath(P1_API_ROUTES.publisherSubmissionFiles, { submissionID }));
    },

    async getPublisherSubmissionFileContent(submissionID: string, relativePath: string): Promise<PackageFileContent> {
      return requestJSON<PackageFileContent>(`${routePath(P1_API_ROUTES.publisherSubmissionFileContent, { submissionID })}?path=${encodeURIComponent(relativePath)}`);
    },

    async submitPublisherSubmission(formData: FormData): Promise<PublisherSubmissionDetail> {
      return requestJSON<PublisherSubmissionDetail>(P1_API_ROUTES.publisherSubmissions, {
        method: "POST",
        body: formData
      });
    },

    async withdrawPublisherSubmission(submissionID: string): Promise<PublisherSubmissionDetail> {
      return requestJSON<PublisherSubmissionDetail>(routePath(P1_API_ROUTES.publisherSubmissionWithdraw, { submissionID }), {
        method: "POST"
      });
    },
  };
}
