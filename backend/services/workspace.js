export const DEFAULT_WORKSPACE_ID = "shared";

export function normalizeWorkspaceId(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);

  return normalized || DEFAULT_WORKSPACE_ID;
}
