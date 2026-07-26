import "./loadEnv.js";
import { GoogleGenAI } from "@google/genai";

function getFallbackModel() {
  const configuredFallback = process.env.GEMINI_FALLBACK_MODEL;

  if (configuredFallback) {
    return configuredFallback.trim();
  }

  const legacyFallback = String(process.env.GEMINI_FALLBACK_MODELS || "")
    .split(",")[0]
    ?.trim();

  return legacyFallback || "gemini-2.0-flash";
}

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const DEFAULT_FALLBACK_MODEL = getFallbackModel();
const MAX_RETRIES_PER_MODEL = Math.min(
  2,
  Math.max(1, Number(process.env.GEMINI_MAX_RETRIES_PER_MODEL || 2))
);

const ANALYSIS_PLAN_SCHEMA = {
  type: "object",
  properties: {
    chartType: { type: "string" },
    requestedChart: { type: "string" },
    metricField: { type: "string" },
    aggregation: { type: "string" },
    groupBy: { type: ["string", "null"] },
    filters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          field: { type: "string" },
          operator: { type: "string" },
          value: {
            anyOf: [
              { type: "string" },
              { type: "number" },
              { type: "boolean" },
              {
                type: "array",
                items: {
                  anyOf: [
                    { type: "string" },
                    { type: "number" },
                    { type: "boolean" },
                  ],
                },
              },
            ],
          },
        },
        required: ["field", "operator", "value"],
      },
    },
    sortBy: { type: "string" },
    sortDirection: { type: "string" },
    limit: { type: "integer" },
    answerFocus: { type: "string" },
  },
  required: [
    "chartType",
    "requestedChart",
    "metricField",
    "aggregation",
    "groupBy",
    "filters",
    "sortBy",
    "sortDirection",
    "limit",
    "answerFocus",
  ],
};

const NARRATIVE_SCHEMA = {
  type: "object",
  properties: {
    chartTitle: { type: "string" },
    answer: { type: "string" },
    explanation: { type: "string" },
    recommendation: { type: "string" },
    executiveSummary: { type: "string" },
    businessImpact: { type: "string" },
    keyRisks: {
      type: "array",
      items: { type: "string" },
    },
    recommendedActions: {
      type: "array",
      items: { type: "string" },
    },
    followUpQuestions: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "chartTitle",
    "answer",
    "explanation",
    "recommendation",
    "executiveSummary",
    "businessImpact",
    "keyRisks",
    "recommendedActions",
    "followUpQuestions",
  ],
};

const ROOT_CAUSE_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    explanation: { type: "string" },
    summary: { type: "string" },
  },
  required: ["headline", "explanation", "summary"],
};

let client;

function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    const error = new Error("GEMINI_API_KEY is not configured on the backend.");
    error.statusCode = 503;
    throw error;
  }

  if (!client) {
    client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
  }

  return client;
}

function extractJson(text) {
  const content = String(text || "").trim();

  if (!content) {
    throw new Error("The Gemini response was empty.");
  }

  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("The Gemini response was not valid JSON.");
    }

    return JSON.parse(match[0]);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGeminiError(error) {
  const message = String(error?.message || error || "");
  return /503|unavailable|high demand|overloaded|temporarily/i.test(message);
}

function getCandidateModels() {
  return [...new Set([DEFAULT_MODEL, DEFAULT_FALLBACK_MODEL].filter(Boolean))];
}

function buildGeminiError(error, model, attempt) {
  const wrapped = new Error(
    `Gemini request failed for model "${model}" on attempt ${attempt}: ${
      error.message || error
    }`
  );
  wrapped.cause = error;
  return wrapped;
}

async function requestJson({
  systemInstruction,
  prompt,
  schema,
  temperature = 0.1,
}) {
  const candidateModels = getCandidateModels();
  const errors = [];

  for (const model of candidateModels) {
    for (let attempt = 1; attempt <= MAX_RETRIES_PER_MODEL; attempt += 1) {
      try {
        const response = await getClient().models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            temperature,
            responseMimeType: "application/json",
            responseJsonSchema: schema,
          },
        });

        return extractJson(response.text);
      } catch (error) {
        errors.push(buildGeminiError(error, model, attempt));

        if (!isRetryableGeminiError(error)) {
          throw errors[errors.length - 1];
        }

        if (attempt < MAX_RETRIES_PER_MODEL) {
          await sleep(600 * attempt);
          continue;
        }
      }
    }
  }

  const lastError = errors[errors.length - 1];
  const combinedMessage = errors.map((error) => error.message).join(" | ");
  const finalError = new Error(combinedMessage || "Gemini request failed.");
  finalError.cause = lastError;
  throw finalError;
}

export async function createAnalysisPlan({ question, datasetContext }) {
  const availableDimensions = (datasetContext?.dimensions || []).map((field) => field.field);
  const availableMetrics = (datasetContext?.metrics || []).map((field) => field.field);

  return requestJson({
    systemInstruction: [
      "You are an analytics planner for an AI dashboard.",
      "Decide the best chart and aggregation plan for the user's question.",
      "Honor the user's requested chart when they explicitly ask for one, as long as it is compatible with the data.",
      "If no chart is requested, choose the most suitable chart automatically.",
      "For ranking questions such as highest, lowest, top, best, worst, or bottom across grouped results, use sum aggregation with grouping unless the user explicitly asks for average or a single-record extreme.",
      "When the user asks to show or list matching records, prefer a table with raw aggregation.",
      "You may only use these chart types: trend, bar, pie, area, scatter, radar, geomap, table.",
      "You may only use fields that exist in the dataset context.",
      "Return JSON only."
    ].join(" "),
    prompt: JSON.stringify({
      question,
      datasetContext,
      requiredResponseShape: {
        chartType: "trend|bar|pie|area|scatter|radar|geomap|table",
        requestedChart: "explicit requested chart or auto",
        metricField: [...availableMetrics, "records"].join("|") || "records",
        aggregation: "sum|avg|min|max|count|raw",
        groupBy: availableDimensions.length ? `${availableDimensions.join("|")}|null` : "null",
        filters: [
          {
            field: "field name",
            operator: "equals|not_equals|contains|in|gt|gte|lt|lte",
            value: "single value or array"
          }
        ],
        sortBy: "name|value",
        sortDirection: "asc|desc",
        limit: 10,
        answerFocus: "short description of what the user wants to learn"
      }
    }),
    schema: ANALYSIS_PLAN_SCHEMA,
  });
}

export async function createNarrative({ question, plan, summary, chartData }) {
  return requestJson({
    systemInstruction: [
      "You are an analytics narrator for a dashboard.",
      "Use only the provided aggregated data and summary.",
      "Do not invent numbers, categories, trends, or filters.",
      "If the user asks for the highest, lowest, best, worst, top, or bottom result, answer that directly and explicitly name the segment and value.",
      "Return JSON only.",
      "Keep the answer concise but direct.",
      "Make explanation a user-facing insight sentence, not a generic restatement.",
      "Write executiveSummary as a 2-3 line business summary.",
      "Write businessImpact as a short business outcome statement.",
      "Return 2-3 grounded key risks, 2-3 recommended actions, and 3 follow-up questions.",
      "Every item must be grounded in the supplied plan, summary, and chart data."
    ].join(" "),
    prompt: JSON.stringify({
      question,
      plan,
      summary,
      chartData,
      requiredResponseShape: {
        chartTitle: "short chart title",
        answer: "direct answer to the user's question",
        explanation: "one concise insight grounded in the data",
        recommendation: "one actionable business recommendation",
        executiveSummary: "2-3 line executive summary",
        businessImpact: "short business impact statement",
        keyRisks: ["2-3 grounded business risks"],
        recommendedActions: ["2-3 specific actions"],
        followUpQuestions: ["3 suggested follow-up questions"]
      }
    }),
    schema: NARRATIVE_SCHEMA,
    temperature: 0.3,
  });
}

export async function createRootCauseNarrative({ question, analysis }) {
  return requestJson({
    systemInstruction: [
      "You explain deterministic root-cause drill-down results for an analytics workspace.",
      "Use only the supplied root-cause path, node metrics, shares, and breakdown data.",
      "Do not invent causes, hidden drivers, or operational details that are not present in the evidence.",
      "Avoid claiming certainty. Prefer phrases such as contributor, concentration, driver in this slice, or strongest lever.",
      "Keep the explanation concise, business-friendly, and grounded in the supplied numbers.",
      "Return JSON only."
    ].join(" "),
    prompt: JSON.stringify({
      question,
      analysis,
      requiredResponseShape: {
        headline: "short user-facing headline for the latest drill-down node",
        explanation: "2-3 sentence grounded explanation of why this node matters in the current path",
        summary: "one concise sentence summarizing the latest drill-down insight"
      }
    }),
    schema: ROOT_CAUSE_SCHEMA,
    temperature: 0.2,
  });
}
