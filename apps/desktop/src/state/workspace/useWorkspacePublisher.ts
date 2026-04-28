import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  AuthState,
  MarketFilters,
  PageID,
  PublisherSkillSummary,
  PublisherSubmissionDetail,
  SkillLeaderboardsResponse,
  SkillSummary
} from "../../domain/p1";
import { p1Client } from "../../services/p1Client";
import { removeSkillFromLeaderboards, upsertPublisherSkillSummary } from "../p1WorkspaceHelpers";
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
  remoteMarketFilters: MarketFilters;
  requireAuthenticatedAction: RequireAuthenticatedAction;
  selectedPublisherSubmissionID: string | null;
  setLeaderboards: Dispatch<SetStateAction<SkillLeaderboardsResponse | null>>;
  setPublisherSkills: Dispatch<SetStateAction<PublisherSkillSummary[]>>;
  setSelectedSkillID: Dispatch<SetStateAction<string>>;
  setSelectedPublisherSubmission: Dispatch<SetStateAction<PublisherSubmissionDetail | null>>;
  setSelectedPublisherSubmissionID: Dispatch<SetStateAction<string | null>>;
  setSkills: Dispatch<SetStateAction<SkillSummary[]>>;
}) {
  const {
    activePage,
    authState,
    handleRemoteError,
    remoteMarketFilters,
    requireAuthenticatedAction,
    selectedPublisherSubmissionID,
    setLeaderboards,
    setPublisherSkills,
    setSelectedSkillID,
    setSelectedPublisherSubmission,
    setSelectedPublisherSubmissionID,
    setSkills
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

  const performPublisherSubmission = useCallback(
    async (formData: FormData) => {
      const submission = await p1Client.submitPublisherSubmission(formData);
      setSelectedPublisherSubmission(submission);
      setSelectedPublisherSubmissionID(submission.submissionID);
      setPublisherSkills((current) => upsertPublisherSkillSummary(current, submission));
      await refreshPublisherData();
    },
    [refreshPublisherData, setPublisherSkills, setSelectedPublisherSubmission, setSelectedPublisherSubmissionID]
  );

  const submitPublisherSubmission = useCallback(
    async (formData: FormData) => {
      if (authState !== "authenticated") {
        requireAuthenticatedAction("publisher", () => performPublisherSubmission(formData));
        return false;
      }
      try {
        await performPublisherSubmission(formData);
        return true;
      } catch (error) {
        await handleRemoteError(error, { reopenLogin: true });
        return false;
      }
    },
    [authState, handleRemoteError, performPublisherSubmission, requireAuthenticatedAction]
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
        setSkills((current) => current.filter((skill) => skill.skillID !== skillID));
        setLeaderboards((current) => removeSkillFromLeaderboards(current, skillID));
        setSelectedSkillID((current) => (current === skillID ? "" : current));
      });
    },
    [requireAuthenticatedAction, setLeaderboards, setPublisherSkills, setSelectedSkillID, setSkills]
  );

  const relistPublisherSkill = useCallback(
    async (skillID: string) => {
      requireAuthenticatedAction("publisher", async () => {
        setPublisherSkills(await p1Client.relistPublisherSkill(skillID));
        const [remoteSkills, nextLeaderboards] = await Promise.all([
          p1Client.listSkills(remoteMarketFilters),
          p1Client.listSkillLeaderboards()
        ]);
        setSkills(remoteSkills);
        setLeaderboards(nextLeaderboards);
      });
    },
    [remoteMarketFilters, requireAuthenticatedAction, setLeaderboards, setPublisherSkills, setSkills]
  );

  const archivePublisherSkill = useCallback(
    async (skillID: string) => {
      requireAuthenticatedAction("publisher", async () => {
        setPublisherSkills(await p1Client.archivePublisherSkill(skillID));
        setSkills((current) => current.filter((skill) => skill.skillID !== skillID));
        setLeaderboards((current) => removeSkillFromLeaderboards(current, skillID));
        setSelectedSkillID((current) => (current === skillID ? "" : current));
      });
    },
    [requireAuthenticatedAction, setLeaderboards, setPublisherSkills, setSelectedSkillID, setSkills]
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
