import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  AdminSkill,
  AdminUser,
  AuthState,
  ClientUpdateReleaseSummary,
  DepartmentNode,
  PageID,
  ReviewDetail,
  ReviewItem
} from "../../domain/p1";
import { p1Client } from "../../services/p1Client";
import { findDepartment } from "../p1WorkspaceHelpers";
import type { HandleRemoteError, RequireAuthenticatedAction } from "./workspaceTypes";

export function useWorkspaceAdminReviewState() {
  const [departments, setDepartments] = useState<DepartmentNode[]>([]);
  const [selectedDepartmentID, setSelectedDepartmentID] = useState<string | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminSkills, setAdminSkills] = useState<AdminSkill[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [clientUpdateReleases, setClientUpdateReleases] = useState<ClientUpdateReleaseSummary[]>([]);
  const [selectedReviewID, setSelectedReviewID] = useState<string | null>(null);
  const [selectedReview, setSelectedReview] = useState<ReviewDetail | null>(null);

  const resetAdminReviewState = useCallback(() => {
    setDepartments([]);
    setAdminUsers([]);
    setAdminSkills([]);
    setReviews([]);
    setClientUpdateReleases([]);
    setSelectedReview(null);
    setSelectedReviewID(null);
    setSelectedDepartmentID(null);
  }, []);

  return {
    adminSkills,
    adminUsers,
    clientUpdateReleases,
    departments,
    resetAdminReviewState,
    reviews,
    selectedDepartmentID,
    selectedReview,
    selectedReviewID,
    setAdminSkills,
    setAdminUsers,
    setDepartments,
    setClientUpdateReleases,
    setReviews,
    setSelectedDepartmentID,
    setSelectedReview,
    setSelectedReviewID
  };
}

export function useWorkspaceAdminReviewActions(input: {
  activePage: PageID;
  authState: AuthState;
  handleRemoteError: HandleRemoteError;
  requireAuthenticatedAction: RequireAuthenticatedAction;
  selectedReviewID: string | null;
  setAdminSkills: Dispatch<SetStateAction<AdminSkill[]>>;
  setAdminUsers: Dispatch<SetStateAction<AdminUser[]>>;
  setClientUpdateReleases: Dispatch<SetStateAction<ClientUpdateReleaseSummary[]>>;
  setDepartments: Dispatch<SetStateAction<DepartmentNode[]>>;
  setReviews: Dispatch<SetStateAction<ReviewItem[]>>;
  setSelectedDepartmentID: Dispatch<SetStateAction<string | null>>;
  setSelectedReview: Dispatch<SetStateAction<ReviewDetail | null>>;
  setSelectedReviewID: Dispatch<SetStateAction<string | null>>;
}) {
  const {
    activePage,
    authState,
    handleRemoteError,
    requireAuthenticatedAction,
    selectedReviewID,
    setAdminSkills,
    setAdminUsers,
    setClientUpdateReleases,
    setDepartments,
    setReviews,
    setSelectedDepartmentID,
    setSelectedReview,
    setSelectedReviewID
  } = input;

  const refreshManageData = useCallback(async () => {
    const [nextDepartments, nextUsers, nextSkills] = await Promise.all([
      p1Client.listDepartments(),
      p1Client.listAdminUsers(),
      p1Client.listAdminSkills()
    ]);
    setDepartments(nextDepartments);
    setAdminUsers(nextUsers);
    setAdminSkills(nextSkills);
    setSelectedDepartmentID((current) => (findDepartment(nextDepartments, current) ? current : nextDepartments[0]?.departmentID ?? null));
  }, [setAdminSkills, setAdminUsers, setDepartments, setSelectedDepartmentID]);

  const refreshReviews = useCallback(async () => {
    const nextReviews = await p1Client.listReviews();
    setReviews(nextReviews);
    setSelectedReviewID((current) => (nextReviews.some((review) => review.reviewID === current) ? current : nextReviews[0]?.reviewID ?? null));
  }, [setReviews, setSelectedReviewID]);

  const refreshClientUpdateReleases = useCallback(async () => {
    setClientUpdateReleases(await p1Client.listAdminClientUpdateReleases());
  }, [setClientUpdateReleases]);

  useEffect(() => {
    if (authState !== "authenticated" || activePage !== "review" || !selectedReviewID) return;
    void p1Client
      .getReview(selectedReviewID)
      .then(setSelectedReview)
      .catch((error) => void handleRemoteError(error));
  }, [activePage, authState, handleRemoteError, selectedReviewID, setSelectedReview]);

  const createDepartment = useCallback(
    async (parentDepartmentID: string, name: string) => {
      requireAuthenticatedAction("admin_departments", async () => {
        const nextDepartments = await p1Client.createDepartment({ parentDepartmentID, name });
        setDepartments(nextDepartments);
        setSelectedDepartmentID(parentDepartmentID);
      });
    },
    [requireAuthenticatedAction, setDepartments, setSelectedDepartmentID]
  );

  const updateDepartment = useCallback(
    async (departmentID: string, name: string) => {
      requireAuthenticatedAction("admin_departments", async () => {
        await p1Client.updateDepartment(departmentID, { name });
        await refreshManageData();
      });
    },
    [refreshManageData, requireAuthenticatedAction]
  );

  const deleteDepartment = useCallback(
    async (departmentID: string) => {
      requireAuthenticatedAction("admin_departments", async () => {
        await p1Client.deleteDepartment(departmentID);
        await refreshManageData();
      });
    },
    [refreshManageData, requireAuthenticatedAction]
  );

  const createAdminUser = useCallback(
    async (input: { username: string; phoneNumber: string; departmentID: string; role: "normal_user" | "admin"; adminLevel: number | null }) => {
      requireAuthenticatedAction("admin_users", async () => {
        setAdminUsers(await p1Client.createAdminUser(input));
      });
    },
    [requireAuthenticatedAction, setAdminUsers]
  );

  const updateAdminUser = useCallback(
    async (phoneNumber: string, input: { username?: string; phoneNumber?: string; departmentID?: string; role?: "normal_user" | "admin"; adminLevel?: number | null }) => {
      requireAuthenticatedAction("admin_users", async () => {
        setAdminUsers(await p1Client.updateAdminUser(phoneNumber, input));
      });
    },
    [requireAuthenticatedAction, setAdminUsers]
  );

  const changeAdminUserPassword = useCallback(
    async (phoneNumber: string, password: string) => {
      requireAuthenticatedAction("admin_users", async () => {
        setAdminUsers(await p1Client.changeAdminUserPassword(phoneNumber, password));
      });
    },
    [requireAuthenticatedAction, setAdminUsers]
  );

  const freezeAdminUser = useCallback(
    async (phoneNumber: string) => {
      requireAuthenticatedAction("admin_users", async () => {
        setAdminUsers(await p1Client.freezeAdminUser(phoneNumber));
      });
    },
    [requireAuthenticatedAction, setAdminUsers]
  );

  const unfreezeAdminUser = useCallback(
    async (phoneNumber: string) => {
      requireAuthenticatedAction("admin_users", async () => {
        setAdminUsers(await p1Client.unfreezeAdminUser(phoneNumber));
      });
    },
    [requireAuthenticatedAction, setAdminUsers]
  );

  const deleteAdminUser = useCallback(
    async (phoneNumber: string) => {
      requireAuthenticatedAction("admin_users", async () => {
        await p1Client.deleteAdminUser(phoneNumber);
        setAdminUsers((current) => current.filter((user) => user.phoneNumber !== phoneNumber));
      });
    },
    [requireAuthenticatedAction, setAdminUsers]
  );

  const delistAdminSkill = useCallback(
    async (skillID: string) => {
      requireAuthenticatedAction("admin_skills", async () => {
        setAdminSkills(await p1Client.delistAdminSkill(skillID));
      });
    },
    [requireAuthenticatedAction, setAdminSkills]
  );

  const relistAdminSkill = useCallback(
    async (skillID: string) => {
      requireAuthenticatedAction("admin_skills", async () => {
        setAdminSkills(await p1Client.relistAdminSkill(skillID));
      });
    },
    [requireAuthenticatedAction, setAdminSkills]
  );

  const archiveAdminSkill = useCallback(
    async (skillID: string) => {
      requireAuthenticatedAction("admin_skills", async () => {
        await p1Client.archiveAdminSkill(skillID);
        setAdminSkills((current) => current.filter((skill) => skill.skillID !== skillID));
      });
    },
    [requireAuthenticatedAction, setAdminSkills]
  );

  const pushClientUpdateExe = useCallback(
    async (input: { file: File; version: string }) => {
      if (authState !== "authenticated") {
        requireAuthenticatedAction(null, async () => {});
        return;
      }
      try {
        await p1Client.pushAdminClientUpdateExe(input);
        await refreshClientUpdateReleases();
      } catch (error) {
        await handleRemoteError(error, { reopenLogin: true });
        throw error;
      }
    },
    [authState, handleRemoteError, refreshClientUpdateReleases, requireAuthenticatedAction]
  );

  const pauseClientUpdateRelease = useCallback(
    async (releaseID: string) => {
      if (authState !== "authenticated") {
        requireAuthenticatedAction(null, async () => {});
        return;
      }
      try {
        await p1Client.pauseAdminClientUpdateRelease(releaseID);
        await refreshClientUpdateReleases();
      } catch (error) {
        await handleRemoteError(error, { reopenLogin: true });
        throw error;
      }
    },
    [authState, handleRemoteError, refreshClientUpdateReleases, requireAuthenticatedAction]
  );

  const claimReview = useCallback(
    async (reviewID: string) => {
      requireAuthenticatedAction("review", async () => {
        const detail = await p1Client.claimReview(reviewID);
        setSelectedReview(detail);
        setSelectedReviewID(detail.reviewID);
        await refreshReviews();
      });
    },
    [refreshReviews, requireAuthenticatedAction, setSelectedReview, setSelectedReviewID]
  );

  const passPrecheck = useCallback(
    async (reviewID: string, comment: string) => {
      requireAuthenticatedAction("review", async () => {
        const detail = await p1Client.passPrecheck(reviewID, comment);
        setSelectedReview(detail);
        setSelectedReviewID(detail.reviewID);
        await refreshReviews();
      });
    },
    [refreshReviews, requireAuthenticatedAction, setSelectedReview, setSelectedReviewID]
  );

  const approveReview = useCallback(
    async (reviewID: string, comment: string) => {
      requireAuthenticatedAction("review", async () => {
        const detail = await p1Client.approveReview(reviewID, comment);
        setSelectedReview(detail);
        setSelectedReviewID(detail.reviewID);
        await refreshReviews();
      });
    },
    [refreshReviews, requireAuthenticatedAction, setSelectedReview, setSelectedReviewID]
  );

  const returnReview = useCallback(
    async (reviewID: string, comment: string) => {
      requireAuthenticatedAction("review", async () => {
        const detail = await p1Client.returnReview(reviewID, comment);
        setSelectedReview(detail);
        setSelectedReviewID(detail.reviewID);
        await refreshReviews();
      });
    },
    [refreshReviews, requireAuthenticatedAction, setSelectedReview, setSelectedReviewID]
  );

  const rejectReview = useCallback(
    async (reviewID: string, comment: string) => {
      requireAuthenticatedAction("review", async () => {
        const detail = await p1Client.rejectReview(reviewID, comment);
        setSelectedReview(detail);
        setSelectedReviewID(detail.reviewID);
        await refreshReviews();
      });
    },
    [refreshReviews, requireAuthenticatedAction, setSelectedReview, setSelectedReviewID]
  );

  const listReviewFiles = useCallback(async (reviewID: string) => {
    return p1Client.listReviewFiles(reviewID);
  }, []);

  const getReviewFileContent = useCallback(async (reviewID: string, relativePath: string) => {
    return p1Client.getReviewFileContent(reviewID, relativePath);
  }, []);

  return {
    approveReview,
    archiveAdminSkill,
    claimReview,
    changeAdminUserPassword,
    createAdminUser,
    createDepartment,
    deleteAdminUser,
    deleteDepartment,
    delistAdminSkill,
    freezeAdminUser,
    getReviewFileContent,
    listReviewFiles,
    passPrecheck,
    pauseClientUpdateRelease,
    pushClientUpdateExe,
    refreshClientUpdateReleases,
    refreshManageData,
    refreshReviews,
    rejectReview,
    relistAdminSkill,
    returnReview,
    unfreezeAdminUser,
    updateAdminUser,
    updateDepartment
  };
}
