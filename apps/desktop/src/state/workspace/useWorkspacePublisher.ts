import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  AuthState,
  PageID,
  PublisherSkillSummary,
  PublisherSubmissionDetail
} from "../../domain/p1";
import { p1Client } from "../../services/p1Client";
import { upsertPublisherSkillSummary } from "../p1WorkspaceHelpers";
import type { HandleRemoteError, RequireAuthenticatedAction } from "./workspaceTypes";

export function useWorkspacePublisherState() {
  const [publisherSkills, setPublisherSkills] = useState<PublisherSkillSummary[]>([]);
  const [selectedPublisherSubmissionID, setSelectedPublisherSubmissionID] = useState<string | null>(null);
  const [selectedPublisherSubmission, setSelectedPublisherSubmission] = useState<PublisherSubmissionDetail | null>(null);

  const resetPublisherState = useCallback(() => {
    setPublisherSkills([]);
    setSelectedPublisherSubmission(null);
    setSelectedPublisherSubmissionID(null);
  }, []);

  return {
    publisherSkills,
    resetPublisherState,
    selectedPublisherSubmission,
    selectedPublisherSubmissionID,
    setPublisherSkills,
    setSelectedPublisherSubmission,
    setSelectedPublisherSubmissionID
  };
}

export function useWorkspacePublisherActions(input: {
  activePage: PageID;
  authState: AuthState;
  handleRemoteError: HandleRemoteError;
  requireAuthenticatedAction: RequireAuthenticatedAction;
  selectedPublisherSubmissionID: string | null;
  setPublisherSkills: Dispatch<SetStateAction<PublisherSkillSummary[]>>;
  setSelectedPublisherSubmission: Dispatch<SetStateAction<PublisherSubmissionDetail | null>>;
  setSelectedPublisherSubmissionID: Dispatch<SetStateAction<string | null>>;
}) {
  const {
    activePage,
    authState,
    handleRemoteError,
    requireAuthenticatedAction,
    selectedPublisherSubmissionID,
    setPublisherSkills,
    setSelectedPublisherSubmission,
    setSelectedPublisherSubmissionID
  } = input;

  const refreshPublisherData = useCallback(async () => {
    const nextPublisherSkills = await p1Client.listPublisherSkills();
    setPublisherSkills(nextPublisherSkills);
    setSelectedPublisherSubmissionID((current) => {
      if (current && nextPublisherSkills.some((skill) => skill.latestSubmissionID === current)) {
        return current;
      }
      return nextPublisherSkills.find((skill) => !!skill.latestSubmissionID)?.latestSubmissionID ?? null;
    });
  }, [setPublisherSkills, setSelectedPublisherSubmissionID]);

  useEffect(() => {
    if (authState !== "authenticated" || activePage !== "publisher" || !selectedPublisherSubmissionID) return;
    void p1Client
      .getPublisherSubmission(selectedPublisherSubmissionID)
      .then(setSelectedPublisherSubmission)
      .catch((error) => void handleRemoteError(error));
  }, [activePage, authState, handleRemoteError, selectedPublisherSubmissionID, setSelectedPublisherSubmission]);

  useEffect(() => {
    if (!selectedPublisherSubmissionID) {
      setSelectedPublisherSubmission(null);
    }
  }, [selectedPublisherSubmissionID, setSelectedPublisherSubmission]);

  const submitPublisherSubmission = useCallback(
    async (formData: FormData) => {
      requireAuthenticatedAction("publisher", async () => {
        const submission = await p1Client.submitPublisherSubmission(formData);
        setSelectedPublisherSubmission(submission);
        setSelectedPublisherSubmissionID(submission.submissionID);
        setPublisherSkills((current) => upsertPublisherSkillSummary(current, submission));
        await refreshPublisherData();
      });
    },
    [refreshPublisherData, requireAuthenticatedAction, setPublisherSkills, setSelectedPublisherSubmission, setSelectedPublisherSubmissionID]
  );

  const withdrawPublisherSubmission = useCallback(
    async (submissionID: string) => {
      requireAuthenticatedAction("publisher", async () => {
        const submission = await p1Client.withdrawPublisherSubmission(submissionID);
        setSelectedPublisherSubmission(submission);
        setSelectedPublisherSubmissionID(submission.submissionID);
        setPublisherSkills((current) => upsertPublisherSkillSummary(current, submission));
        await refreshPublisherData();
      });
    },
    [refreshPublisherData, requireAuthenticatedAction, setPublisherSkills, setSelectedPublisherSubmission, setSelectedPublisherSubmissionID]
  );

  const delistPublisherSkill = useCallback(
    async (skillID: string) => {
      requireAuthenticatedAction("publisher", async () => {
        setPublisherSkills(await p1Client.delistPublisherSkill(skillID));
      });
    },
    [requireAuthenticatedAction, setPublisherSkills]
  );

  const relistPublisherSkill = useCallback(
    async (skillID: string) => {
      requireAuthenticatedAction("publisher", async () => {
        setPublisherSkills(await p1Client.relistPublisherSkill(skillID));
      });
    },
    [requireAuthenticatedAction, setPublisherSkills]
  );

  const archivePublisherSkill = useCallback(
    async (skillID: string) => {
      requireAuthenticatedAction("publisher", async () => {
        setPublisherSkills(await p1Client.archivePublisherSkill(skillID));
      });
    },
    [requireAuthenticatedAction, setPublisherSkills]
  );

  const listPublisherSubmissionFiles = useCallback(async (submissionID: string) => {
    return p1Client.listPublisherSubmissionFiles(submissionID);
  }, []);

  const getPublisherSubmissionFileContent = useCallback(async (submissionID: string, relativePath: string) => {
    return p1Client.getPublisherSubmissionFileContent(submissionID, relativePath);
  }, []);

  return {
    archivePublisherSkill,
    delistPublisherSkill,
    getPublisherSubmissionFileContent,
    listPublisherSubmissionFiles,
    refreshPublisherData,
    relistPublisherSkill,
    submitPublisherSubmission,
    withdrawPublisherSubmission
  };
}
