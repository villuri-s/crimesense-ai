function parseAllowedOrigins(value) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function buildCorsOptions() {
  const allowedOrigins = parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS);
  const allowAll = allowedOrigins.length === 0 || allowedOrigins.includes("*");

  if (allowAll) {
    return {
      origin: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-Workspace-Id"],
    };
  }

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, allowedOrigins.includes(origin));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Workspace-Id"],
  };
}
