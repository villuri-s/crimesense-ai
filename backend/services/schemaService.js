import { buildDatasetContext } from "./analytics.js";

const FIELD_HINTS = {
  name: ["name", "employee", "employee name", "person", "staff", "associate", "caller", "user"],
  department: ["department", "dept", "division", "function", "business unit", "team"],
  team: ["team", "squad", "group", "support team"],
  region: ["region", "country", "market", "territory", "location", "geo", "geography"],
  status: ["status", "state", "ticket status", "resolution status"],
  priority: ["priority", "severity", "urgency", "impact"],
  application: ["application", "app", "service", "system", "platform"],
  project: ["project", "program", "initiative", "epic"],
  revenue: ["revenue", "sales", "amount", "income", "turnover", "gmv"],
  salary: ["salary", "pay", "wage", "compensation"],
  profit: ["profit", "margin", "earnings"],
  budget: ["budget", "allocated budget", "planned budget"],
  spend: ["spend", "cost", "expense", "actual cost"],
  incident_count: ["incident", "ticket", "case", "incident count", "ticket count"],
  alert_count: ["alert", "security alert", "event count"],
  downtime_hours: ["downtime", "outage", "downtime hours"],
  performance_score: ["performance", "score", "performance score"],
};

const COMMON_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "by",
  "for",
  "from",
  "how",
  "in",
  "is",
  "of",
  "on",
  "show",
  "tell",
  "the",
  "to",
  "what",
  "which",
  "who",
  "with",
]);

export function normalizeToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function humanize(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function tokenize(value) {
  return normalizeToken(value)
    .split(" ")
    .filter(Boolean);
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildFieldAliases(field) {
  const aliases = new Set([
    normalizeToken(field?.field),
    normalizeToken(field?.label),
  ]);

  const configuredAliases = FIELD_HINTS[field?.field] || [];

  for (const alias of configuredAliases) {
    aliases.add(normalizeToken(alias));
  }

  return [...aliases].filter(Boolean);
}

function buildQuestionPhrases(question) {
  const tokens = tokenize(question);
  const phrases = new Set([normalizeToken(question)]);

  for (let size = 1; size <= Math.min(tokens.length, 4); size += 1) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      const phrase = tokens.slice(index, index + size).join(" ");
      if (phrase) {
        phrases.add(phrase);
      }
    }
  }

  return [...phrases].filter(Boolean);
}

function levenshteinDistance(left, right) {
  const a = normalizeToken(left);
  const b = normalizeToken(right);

  if (!a) {
    return b.length;
  }

  if (!b) {
    return a.length;
  }

  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i += 1) {
    matrix[i][0] = i;
  }

  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function similarityScore(left, right) {
  const a = normalizeToken(left);
  const b = normalizeToken(right);

  if (!a || !b) {
    return 0;
  }

  if (a === b) {
    return 1;
  }

  const distance = levenshteinDistance(a, b);
  return 1 - distance / Math.max(a.length, b.length, 1);
}

function buildFieldValueSet(rows, field, maxValues = 750) {
  const values = new Map();

  for (const row of rows) {
    const rawValue = row?.[field];

    if (rawValue === undefined || rawValue === null || rawValue === "") {
      continue;
    }

    const label = String(rawValue).trim();
    const token = normalizeToken(label);

    if (!token || values.has(token)) {
      continue;
    }

    values.set(token, label);

    if (values.size >= maxValues) {
      break;
    }
  }

  return [...values.values()];
}

function scoreShortValueMatch(question, value) {
  const rawQuestion = String(question || "");
  const rawValue = String(value || "").trim();

  if (!rawValue || rawValue.length > 3) {
    return 0;
  }

  const exactPattern = new RegExp(`\\b${escapeRegExp(rawValue)}\\b`, "i");
  return exactPattern.test(rawQuestion) ? 0.95 : 0;
}

function scoreValueAgainstQuestion(question, phrases, value) {
  const normalizedQuestion = normalizeToken(question);
  const normalizedValue = normalizeToken(value);

  if (!normalizedQuestion || !normalizedValue) {
    return 0;
  }

  const shortScore = scoreShortValueMatch(question, value);

  if (shortScore) {
    return shortScore;
  }

  if (normalizedQuestion.includes(normalizedValue)) {
    return 1;
  }

  const valueTokens = tokenize(value);
  const questionTokens = tokenize(question);
  const overlappingTokens = valueTokens.filter((token) => questionTokens.includes(token));

  if (valueTokens.length && overlappingTokens.length === valueTokens.length) {
    return 0.88;
  }

  if (valueTokens.length && overlappingTokens.length > 0) {
    return 0.68 + 0.18 * (overlappingTokens.length / valueTokens.length);
  }

  let bestPhraseScore = 0;

  for (const phrase of phrases) {
    bestPhraseScore = Math.max(bestPhraseScore, similarityScore(phrase, normalizedValue));
  }

  return bestPhraseScore;
}

export function buildSchemaService(rows) {
  return buildDatasetContext(rows);
}

export function getFieldMetadata(schema, fieldName) {
  return (schema?.fields || []).find((field) => field.field === fieldName) || null;
}

export function getFieldsByKind(schema, kinds = []) {
  const allowedKinds = Array.isArray(kinds) ? kinds : [kinds];
  return (schema?.fields || []).filter((field) => allowedKinds.includes(field.kind));
}

export function getDimensionFields(schema) {
  return getFieldsByKind(schema, ["dimension", "date"]);
}

export function getMetricFields(schema) {
  return getFieldsByKind(schema, ["number"]);
}

export function findMentionedFields(question, schema, options = {}) {
  const allowedKinds = options.kind
    ? Array.isArray(options.kind)
      ? options.kind
      : [options.kind]
    : null;
  const allowedFields = new Set(options.fields || []);
  const normalizedQuestion = normalizeToken(question);
  const matches = [];

  for (const field of schema?.fields || []) {
    if (allowedKinds && !allowedKinds.includes(field.kind)) {
      continue;
    }

    if (allowedFields.size > 0 && !allowedFields.has(field.field)) {
      continue;
    }

    const aliases = buildFieldAliases(field);
    let score = 0;

    for (const alias of aliases) {
      if (!alias) {
        continue;
      }

      const pattern = new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i");

      if (pattern.test(normalizedQuestion)) {
        score = Math.max(score, alias.split(" ").length + alias.length / 100);
      }
    }

    if (score > 0) {
      matches.push({
        field: field.field,
        label: field.label,
        kind: field.kind,
        score,
      });
    }
  }

  return matches.sort((left, right) => right.score - left.score);
}

export function findFieldByHint(question, schema, options = {}) {
  return findMentionedFields(question, schema, options)[0] || null;
}

export function isLookupFriendlyField(field) {
  return field?.kind === "dimension" && !/date/i.test(field?.field || "");
}

export function findFieldValueMatches(question, rows, fieldName, options = {}) {
  const phrases = buildQuestionPhrases(question);
  const matches = [];
  const values = buildFieldValueSet(rows, fieldName, options.maxValues || 750);

  for (const value of values) {
    const score = scoreValueAgainstQuestion(question, phrases, value);

    if (score >= (options.threshold || 0.72)) {
      matches.push({
        field: fieldName,
        value,
        score: Number(score.toFixed(3)),
      });
    }
  }

  return matches.sort((left, right) => right.score - left.score);
}

export function findBestEntityMatch(question, rows, schema, options = {}) {
  const excludedFields = new Set(options.excludeFields || []);
  const preferredFields = new Set(options.preferredFields || []);
  let bestMatch = null;

  for (const field of getDimensionFields(schema)) {
    if (excludedFields.has(field.field) || !isLookupFriendlyField(field)) {
      continue;
    }

    const matches = findFieldValueMatches(question, rows, field.field, {
      threshold: preferredFields.has(field.field) ? 0.62 : 0.72,
      maxValues: options.maxValues || 750,
    });
    const candidate = matches[0];

    if (!candidate) {
      continue;
    }

    const preferredBoost = preferredFields.has(field.field) ? 0.08 : 0;
    const scoredCandidate = {
      ...candidate,
      fieldLabel: field.label,
      kind: field.kind,
      score: Number((candidate.score + preferredBoost).toFixed(3)),
    };

    if (!bestMatch || scoredCandidate.score > bestMatch.score) {
      bestMatch = scoredCandidate;
    }
  }

  return bestMatch;
}

export function findFieldValuesFromSegments(segments, rows, fieldName) {
  return segments
    .map((segment) => findFieldValueMatches(segment, rows, fieldName, {
      threshold: 0.62,
      maxValues: 750,
    })[0])
    .filter(Boolean);
}

export function listAllowedNarrativeEntities(result) {
  const entities = new Set();
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  const chartData = Array.isArray(result?.chartData) ? result.chartData : [];

  for (const row of rows) {
    for (const value of Object.values(row || {})) {
      if (typeof value === "string" && value.trim()) {
        entities.add(value.trim());
      }
    }
  }

  for (const point of chartData) {
    if (typeof point?.name === "string" && point.name.trim()) {
      entities.add(point.name.trim());
    }
  }

  return [...entities];
}

export function listQuestionKeywords(question) {
  return tokenize(question).filter((token) => token && !COMMON_WORDS.has(token));
}
