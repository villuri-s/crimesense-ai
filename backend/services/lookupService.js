import { findFieldByHint, getDimensionFields, getMetricFields, humanize, normalizeToken } from "./schemaService.js";

const LOOKUP_KEYWORDS = /\b(who|what is|what's|salary|department|email|employee|revenue|bonus|region)\b/i;
const LOOKUP_COLUMN_HINTS = {
  department: ["department", "dept", "team", "function"],
  salary: ["salary", "pay", "compensation", "wage"],
  bonus: ["bonus", "incentive"],
  email: ["email", "mail", "e-mail"],
  region: ["region", "location", "country", "market", "territory"],
  revenue: ["revenue", "sales", "amount", "income"],
  name: ["name", "employee", "person", "staff"],
};

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

function similarity(left, right) {
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

function extractLookupEntity(question) {
  const text = String(question || "").trim();
  const possessive = text.match(
    /(?:what(?:'s| is)\s+|show\s+|tell me\s+|give me\s+)?(.+?)'s\s+(.+?)(?:\?|$)/i
  );

  if (possessive) {
    return possessive[1].trim();
  }

  const ofMatch = text.match(
    /(?:what(?:'s| is)\s+|show\s+|tell me\s+|give me\s+)?(.+?)\s+of\s+(.+?)(?:\?|$)/i
  );

  if (ofMatch) {
    return ofMatch[2].trim();
  }

  const forMatch = text.match(
    /(?:what(?:'s| is)\s+|show\s+|tell me\s+|give me\s+)?(.+?)\s+for\s+(.+?)(?:\?|$)/i
  );

  if (forMatch) {
    return forMatch[2].trim();
  }

  return null;
}

function findNameField(schema) {
  const dimensions = getDimensionFields(schema);
  const explicitName = dimensions.find((field) => field.field === "name");

  if (explicitName) {
    return explicitName.field;
  }

  return (
    dimensions.find((field) => /\b(name|employee|person|staff)\b/i.test(field.field))?.field ||
    null
  );
}

function resolveLookupColumn(question, schema) {
  const metricFields = new Set(getMetricFields(schema).map((field) => field.field));

  for (const [canonicalField, aliases] of Object.entries(LOOKUP_COLUMN_HINTS)) {
    if (aliases.some((alias) => new RegExp(`\\b${normalizeToken(alias)}\\b`, "i").test(normalizeToken(question)))) {
      const direct =
        findFieldByHint(canonicalField, schema)?.field ||
        findFieldByHint(aliases.join(" "), schema)?.field;

      if (direct) {
        return direct;
      }
    }
  }

  const hintedField = findFieldByHint(question, schema);
  return hintedField?.field || (metricFields.has("salary") ? "salary" : null);
}

function scoreNameCandidate(query, candidate) {
  const normalizedQuery = normalizeToken(query);
  const normalizedCandidate = normalizeToken(candidate);

  if (!normalizedQuery || !normalizedCandidate) {
    return 0;
  }

  if (normalizedCandidate === normalizedQuery) {
    return 1;
  }

  if (normalizedCandidate.startsWith(normalizedQuery)) {
    return Math.max(0.9, normalizedQuery.length / normalizedCandidate.length);
  }

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const candidateTokens = normalizedCandidate.split(" ").filter(Boolean);
  let bestScore = similarity(normalizedQuery, normalizedCandidate);

  for (const queryToken of queryTokens) {
    for (const candidateToken of candidateTokens) {
      bestScore = Math.max(bestScore, similarity(queryToken, candidateToken));

      if (candidateToken.startsWith(queryToken) || queryToken.startsWith(candidateToken)) {
        bestScore = Math.max(
          bestScore,
          Math.min(queryToken.length, candidateToken.length) /
            Math.max(queryToken.length, candidateToken.length)
        );
      }
    }
  }

  return Number(bestScore.toFixed(3));
}

function matchEmployeeByName(entityText, rows, nameField, threshold = 0.8) {
  let bestMatch = null;

  for (const row of rows) {
    const candidate = String(row?.[nameField] || "").trim();

    if (!candidate) {
      continue;
    }

    const score = scoreNameCandidate(entityText, candidate);

    if (score < threshold) {
      continue;
    }

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = {
        row,
        matchedName: candidate,
        score,
      };
    }
  }

  return bestMatch;
}

export function detectLookupIntent(question, schema) {
  const columnField = resolveLookupColumn(question, schema);
  const entityText = extractLookupEntity(question);

  return {
    isLookup:
      LOOKUP_KEYWORDS.test(String(question || "")) &&
      Boolean(columnField) &&
      Boolean(entityText),
    entityText,
    columnField,
  };
}

export function executeLookupQuery({ question, rows, schema }) {
  const detection = detectLookupIntent(question, schema);

  if (!detection.isLookup) {
    return null;
  }

  const nameField = findNameField(schema);

  if (!nameField) {
    return {
      status: "not_found",
      intent: "data_lookup",
      entityText: detection.entityText,
      matchedEmployee: null,
      matchedColumn: detection.columnField,
      retrievedValue: null,
      confidence: 0,
      llmUsed: "NO",
    };
  }

  const match = matchEmployeeByName(detection.entityText, rows, nameField, 0.8);

  if (!match) {
    return {
      status: "not_found",
      intent: "data_lookup",
      entityText: detection.entityText,
      matchedEmployee: null,
      matchedColumn: detection.columnField,
      retrievedValue: null,
      confidence: 0,
      llmUsed: "NO",
    };
  }

  return {
    status: "success",
    intent: "data_lookup",
    entityText: detection.entityText,
    matchedEmployee: match.matchedName,
    matchedColumn: detection.columnField,
    retrievedValue: match.row?.[detection.columnField] ?? null,
    confidence: match.score,
    row: match.row,
    llmUsed: "NO",
  };
}

export function buildLookupAnswer(lookupResult) {
  if (!lookupResult || lookupResult.status !== "success") {
    return null;
  }

  const employee = lookupResult.matchedEmployee;
  const value = lookupResult.retrievedValue;
  const field = lookupResult.matchedColumn;
  const columnLabel = humanize(field).toLowerCase();

  if (field === "department") {
    return `${employee} works in the ${value} department.`;
  }

  if (field === "email") {
    return `${employee}'s email is ${value}.`;
  }

  if (field === "region") {
    return `${employee} is in the ${value} region.`;
  }

  return `${employee}'s ${columnLabel} is ${value}.`;
}

export function buildLookupNotFoundAnswer(entityText) {
  return `No employee matching '${entityText}' was found.`;
}
