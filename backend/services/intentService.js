import { findMentionedFields, getMetricFields, normalizeToken } from "./schemaService.js";

const CHART_PATTERNS = [
  { pattern: /\b(line|trend|timeline)\b/i, chart: "trend" },
  { pattern: /\b(area)\b/i, chart: "area" },
  { pattern: /\b(bar|column)\b/i, chart: "bar" },
  { pattern: /\b(pie|donut|doughnut)\b/i, chart: "pie" },
  { pattern: /\b(scatter|bubble)\b/i, chart: "scatter" },
  { pattern: /\b(radar|spider)\b/i, chart: "radar" },
  { pattern: /\b(table|grid|list)\b/i, chart: "table" },
];

const ROOT_CAUSE_PATTERN = /\b(root cause|why|reason|driver|cause|what drove)\b/i;
const SUMMARY_PATTERN = /\b(summary|summari[sz]e|overview|snapshot|recap)\b/i;
const TREND_PATTERN = /\b(trend|over time|timeline|daily|weekly|monthly|quarterly|yearly)\b/i;
const COMPARISON_PATTERN = /\b(compare|comparison|versus|vs\.?|against|difference between)\b/i;
const FILTER_PATTERN = /\b(show|list|find|which|who|employees|records|rows|where|with|in)\b/i;
const LOOKUP_PATTERN =
  /\b(?:what(?:'s| is)|which|who is|show|tell me|give me)\b.*\b(?:of|for)\b|\b\w[\w .&-]*'s\b/i;
const AGGREGATION_PATTERN = /\b(total|sum|average|avg|mean|count|maximum|max|minimum|min|highest|lowest|median)\b/i;
const TOP_PATTERN = /\b(top|highest|largest|best|most)\b/i;
const BOTTOM_PATTERN = /\b(bottom|lowest|smallest|least|worst)\b/i;
const CHART_REQUEST_PATTERN = /\b(chart|graph|visuali[sz]e|plot|dashboard)\b/i;

function extractRequestedChart(question) {
  for (const candidate of CHART_PATTERNS) {
    if (candidate.pattern.test(question)) {
      return candidate.chart;
    }
  }

  return null;
}

function extractRequestedLimit(question) {
  const match = String(question || "").match(/\b(top|bottom)\s+(\d{1,2})\b/i);

  if (!match) {
    return null;
  }

  const value = Number(match[2]);
  return Number.isFinite(value) ? Math.max(1, Math.min(Math.trunc(value), 25)) : null;
}

function looksLikeLookup(question, schema) {
  if (!LOOKUP_PATTERN.test(question)) {
    return false;
  }

  const mentionedFields = findMentionedFields(question, schema);
  return mentionedFields.length > 0;
}

function pickLookupIntent(question, schema) {
  const metricFields = new Set(getMetricFields(schema).map((field) => field.field));
  const mentionedFields = findMentionedFields(question, schema);
  const mentionedMetric = mentionedFields.find((field) => metricFields.has(field.field));

  return mentionedMetric ? "column_lookup" : "row_lookup";
}

export function detectIntent(question, schema) {
  const text = String(question || "").trim();
  const normalized = normalizeToken(text);
  const requestedChart = extractRequestedChart(text);
  const requestedLimit = extractRequestedLimit(text);
  const wantsTop = TOP_PATTERN.test(text);
  const wantsBottom = BOTTOM_PATTERN.test(text);
  const flags = {
    asksRootCause: ROOT_CAUSE_PATTERN.test(text),
    asksSummary: SUMMARY_PATTERN.test(text),
    asksTrend: TREND_PATTERN.test(text),
    asksComparison: COMPARISON_PATTERN.test(text),
    asksAggregation: AGGREGATION_PATTERN.test(text),
    asksFilter: FILTER_PATTERN.test(text),
    asksLookup: looksLikeLookup(text, schema),
    asksChart: requestedChart !== null || CHART_REQUEST_PATTERN.test(text),
    wantsTop,
    wantsBottom,
  };

  let type = "summary";

  if (flags.asksRootCause) {
    type = "root_cause";
  } else if (flags.asksSummary) {
    type = "summary";
  } else if (flags.asksTrend) {
    type = "trend";
  } else if (flags.asksComparison) {
    type = "comparison";
  } else if ((wantsTop || wantsBottom) && (requestedLimit || 0) > 1) {
    type = wantsBottom ? "bottom_n" : "top_n";
  } else if (flags.asksAggregation || wantsTop || wantsBottom) {
    type = "aggregation";
  } else if (flags.asksLookup) {
    type = pickLookupIntent(text, schema);
  } else if (flags.asksChart) {
    type = "chart_generation";
  } else if (flags.asksFilter || normalized.includes("all ")) {
    type = "filter";
  }

  return {
    type,
    requestedChart: requestedChart || "auto",
    requestedLimit,
    flags,
    normalizedQuestion: normalized,
  };
}
