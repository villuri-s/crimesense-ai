import { getWorkspaceId } from "./workspace";

const DEFAULT_BASE_URL = "http://localhost:5000";

function resolveBaseUrl() {
  const runtimeBaseUrl = String(
    globalThis.__INSIGHTIQ_RUNTIME_CONFIG__?.apiBaseUrl || ""
  ).trim();

  return (runtimeBaseUrl || import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL).replace(
    /\/$/,
    ""
  );
}

const BASE_URL = resolveBaseUrl();

const parseJsonSafely = async (response) => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const requestJson = async (path, options = {}) => {
  try {
    const headers = new Headers(options.headers || {});
    headers.set("X-Workspace-Id", getWorkspaceId());

    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    });

    const data = await parseJsonSafely(res);

    if (!res.ok) {
      throw new Error(
        data?.message ||
          data?.error ||
          `Request failed with status ${res.status}.`
      );
    }

    return data;
  } catch (err) {
    console.error("API error:", err);
    throw err;
  }
};

export const sendQuery = async (query) =>
  requestJson("/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question: query }),
  });

export const requestRootCause = async ({ question, basePlan, path = [] }) =>
  requestJson("/query/root-cause", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question,
      basePlan,
      path,
    }),
  });

export const uploadFile = async (file) => {
  try {
    const formData = new FormData();
    formData.append("file", file);

    return await requestJson("/upload", {
      method: "POST",
      body: formData,
    });
  } catch (err) {
    console.error("Upload error:", err);
    throw err;
  }
};

export const fetchDatasetStatus = async () => requestJson("/dataset/status");

export const ingestSource = async (payload) =>
  requestJson("/connectors/ingest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const testConnector = async (payload) =>
  requestJson("/connectors/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const resetDataset = async () =>
  requestJson("/dataset/reset", {
    method: "POST",
  });
