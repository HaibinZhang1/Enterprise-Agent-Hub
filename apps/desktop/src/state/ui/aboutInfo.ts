export const ENTERPRISE_AGENT_HUB_GITHUB_URL = "https://github.com/HaibinZhang1/EnterpriseAgentHub";

export function connectedServiceURL(input: {
  connectionStatus: string;
  apiBaseURL: string;
}): string | null {
  const trimmed = input.apiBaseURL.trim();
  if (input.connectionStatus !== "connected" || !trimmed) {
    return null;
  }
  return trimmed;
}
