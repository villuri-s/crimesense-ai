const fs = require("fs");
const path = require("path");
const http = require("http");
const { URL } = require("url");

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT) || 4173;
const DIST_DIR = path.join(__dirname, "dist");
const INDEX_FILE = path.join(DIST_DIR, "index.html");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function getContentType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function buildCacheControl(filePath) {
  if (filePath.includes(`${path.sep}assets${path.sep}`)) {
    return "public, max-age=31536000, immutable";
  }

  return "no-cache";
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-cache",
  });
  res.end(JSON.stringify(body));
}

function sendJavaScript(res, source) {
  res.writeHead(200, {
    "Content-Type": "application/javascript; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(source);
}

function sendFile(res, filePath, method, statusCode = 200) {
  const headers = {
    "Content-Type": getContentType(filePath),
    "Cache-Control": buildCacheControl(filePath),
  };

  res.writeHead(statusCode, headers);

  if (method === "HEAD") {
    res.end();
    return;
  }

  fs.createReadStream(filePath).pipe(res);
}

function resolveStaticFile(urlPath) {
  const decodedPath = decodeURIComponent(urlPath);
  const normalizedPath = path
    .normalize(decodedPath)
    .replace(/^(\.\.[/\\])+/, "")
    .replace(/^[/\\]+/, "");
  const requestedPath =
    !normalizedPath || normalizedPath === "." ? "index.html" : normalizedPath;
  const filePath = path.join(DIST_DIR, requestedPath);

  if (!filePath.startsWith(DIST_DIR)) {
    return null;
  }

  return filePath;
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (requestUrl.pathname === "/health") {
    sendJson(res, 200, {
      status: "ok",
      service: "insightiq-frontend",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (requestUrl.pathname === "/app-config.js") {
    sendJavaScript(
      res,
      `window.__INSIGHTIQ_RUNTIME_CONFIG__ = ${JSON.stringify({
        apiBaseUrl: String(
          process.env.INSIGHTIQ_API_BASE_URL ||
            process.env.VITE_API_BASE_URL ||
            ""
        ).trim(),
      })};`
    );
    return;
  }

  if (!fileExists(INDEX_FILE)) {
    sendJson(res, 503, {
      message:
        "The frontend build output is missing. Run `npm run build` before starting the App Service deployment.",
    });
    return;
  }

  const staticFile = resolveStaticFile(requestUrl.pathname);

  if (staticFile && fileExists(staticFile) && fs.statSync(staticFile).isFile()) {
    sendFile(res, staticFile, req.method || "GET");
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    sendFile(res, INDEX_FILE, req.method || "GET");
    return;
  }

  sendJson(res, 404, { message: "Not found." });
});

server.listen(PORT, HOST, () => {
  console.log(`InsightIQ frontend running on http://${HOST}:${PORT}`);
});
