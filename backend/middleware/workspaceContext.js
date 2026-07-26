import { normalizeWorkspaceId } from "../services/workspace.js";

export function attachWorkspaceContext(req, res, next) {
  const rawWorkspaceId =
    req.get("x-workspace-id") ||
    req.query?.workspaceId ||
    req.body?.workspaceId;
  const workspaceId = normalizeWorkspaceId(rawWorkspaceId);

  req.workspaceId = workspaceId;
  res.setHeader("X-Workspace-Id", workspaceId);

  next();
}
