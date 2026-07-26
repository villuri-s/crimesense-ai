const WORKSPACE_STORAGE_KEY = "insightiq.workspaceId";

let inMemoryWorkspaceId;

function buildWorkspaceId() {
  if (globalThis.crypto?.randomUUID) {
    return `ws-${globalThis.crypto.randomUUID()}`;
  }

  return `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readPersistedWorkspaceId() {
  try {
    return globalThis.localStorage?.getItem(WORKSPACE_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function persistWorkspaceId(workspaceId) {
  try {
    globalThis.localStorage?.setItem(WORKSPACE_STORAGE_KEY, workspaceId);
  } catch {
    // localStorage may be unavailable; in-memory fallback keeps the current session working.
  }
}

export function getWorkspaceId() {
  if (inMemoryWorkspaceId) {
    return inMemoryWorkspaceId;
  }

  const persistedWorkspaceId = readPersistedWorkspaceId();

  if (persistedWorkspaceId) {
    inMemoryWorkspaceId = persistedWorkspaceId;
    return inMemoryWorkspaceId;
  }

  inMemoryWorkspaceId = buildWorkspaceId();
  persistWorkspaceId(inMemoryWorkspaceId);

  return inMemoryWorkspaceId;
}
