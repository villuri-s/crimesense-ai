import express from "express";
import { getActiveDataset, runQuery } from "../services/db.js";
import {
  applyPlan,
  buildDatasetContext,
  buildFallbackNarrativeResponse,
  buildNoDataResponse,
  buildResponse,
  sanitizePlan,
} from "../services/analytics.js";
import {
  createAnalysisPlan,
  createNarrative,
  createRootCauseNarrative,
} from "../services/gemini.js";
import { buildDatasetStatus } from "../services/monitoring.js";
import {
  buildRootCauseAnalysis,
  buildRootCauseConfig,
} from "../services/rootCause.js";
import {
  buildLookupAnswer,
  buildLookupNotFoundAnswer,
  executeLookupQuery,
} from "../services/lookupService.js";
import { humanize } from "../services/schemaService.js";

const router = express.Router();

router.post("/root-cause", async (req, res) => {
  const question = String(req.body?.question || "").trim();
  const basePlan = req.body?.basePlan;
  const path = Array.isArray(req.body?.path) ? req.body.path : [];

  if (!question) {
    return res.status(400).json({
      message: "Question is required for root cause analysis.",
    });
  }

  if (!basePlan || typeof basePlan !== "object") {
    return res.status(400).json({
      message: "The base analysis context is required for root cause analysis.",
    });
  }

  try {
    const data = await runQuery(req.workspaceId);

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        message: "There is no dataset available for root cause analysis.",
      });
    }

    const datasetContext = buildDatasetContext(data);
    const analysis = buildRootCauseAnalysis({
      data,
      question,
      basePlan,
      datasetContext,
      path,
    });

    if (!analysis.currentNode) {
      return res.json({
        ...analysis,
        available: false,
        exhaustedReason:
          analysis.exhaustedReason ||
          "No root-cause drill-down path is available for this result.",
      });
    }

    try {
      const narrative = await createRootCauseNarrative({
        question,
        analysis,
      });
      const lastIndex = analysis.path.length - 1;

      if (lastIndex >= 0) {
        analysis.path[lastIndex] = {
          ...analysis.path[lastIndex],
          headline:
            String(narrative.headline || "").trim() ||
            analysis.path[lastIndex].headline,
          explanation:
            String(narrative.explanation || "").trim() ||
            analysis.path[lastIndex].explanation,
        };
        analysis.currentNode = analysis.path[lastIndex];
      }

      if (String(narrative.summary || "").trim()) {
        analysis.summary = String(narrative.summary).trim();
      }
    } catch (narrativeError) {
      console.warn("Root cause narrative fallback used:", narrativeError.message);
    }

    analysis.rootNode = analysis.path[0] || null;

    return res.json(analysis);
  } catch (error) {
    console.error("Root cause route error:", error);

    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to generate a root cause analysis.",
    });
  }
});

router.post("/", async (req, res) => {
  const question = String(req.body?.question || "").trim();

  if (!question) {
    return res.status(400).json({
      message: "Question is required.",
    });
  }

  try {
    const data = await runQuery(req.workspaceId);
    const { source } = getActiveDataset(req.workspaceId);

    if (!Array.isArray(data) || data.length === 0) {
      return res.json({
        type: "table",
        insightType: "table",
        requestedChart: "auto",
        title: "No Data Available",
        answer: "There is no data available for analysis right now.",
        data: [],
        explanation: "The dataset is empty.",
        recommendation: "Upload or connect a dataset before asking analytical questions.",
        cards: [
          { title: "Insight", text: "The dataset is empty.", type: "insight" },
          { title: "Recommendation", text: "Upload or connect a dataset before asking analytical questions.", type: "recommendation" }
        ],
        meta: {
          mode: "fallback",
        },
        rootCause: {
          available: false,
          buttonLabel: "Root Cause Analysis",
          summary: "Upload or connect a dataset before using root cause analysis.",
        },
      });
    }

    const datasetContext = buildDatasetContext(data);
    const datasetStatus = buildDatasetStatus({
      rows: data,
      source,
      datasetContext,
    });
    const lookupResult = executeLookupQuery({
      question,
      rows: data,
      schema: datasetContext,
    });

    if (lookupResult) {
      console.info("[query.lookup]", {
        detectedIntent: lookupResult.intent,
        matchedEmployee: lookupResult.matchedEmployee,
        matchedColumn: lookupResult.matchedColumn,
        retrievedValue: lookupResult.retrievedValue,
        llmUsed: lookupResult.llmUsed,
        confidence: lookupResult.confidence,
      });

      const answer =
        lookupResult.status === "success"
          ? buildLookupAnswer(lookupResult)
          : buildLookupNotFoundAnswer(lookupResult.entityText);
      const explanation =
        lookupResult.status === "success"
          ? `Detected a dataset lookup, matched ${lookupResult.matchedEmployee} with ${(lookupResult.confidence * 100).toFixed(0)}% confidence, and returned the stored ${humanize(lookupResult.matchedColumn).toLowerCase()} value without using Gemini.`
          : `Detected a dataset lookup but no employee name matched "${lookupResult.entityText}" above the 80% confidence threshold. Gemini was not used.`;
      const businessImpact =
        lookupResult.status === "success"
          ? "This response was retrieved directly from the uploaded dataset, so the answer is grounded in the active source of truth."
          : "No grounded employee record was found in the active dataset, so the backend returned a deterministic miss instead of inventing a value.";
      const recommendation =
        lookupResult.status === "success"
          ? `Ask for another field such as ${lookupResult.matchedEmployee}'s email, region, or salary if you need more context.`
          : "Check the employee spelling or ask for the full employee list to confirm the available records.";

      return res.json({
        type: "table",
        insightType: "table",
        requestedChart: "table",
        title:
          lookupResult.status === "success"
            ? `${humanize(lookupResult.matchedColumn)} for ${lookupResult.matchedEmployee}`
            : "Lookup Result",
        answer,
        data:
          lookupResult.status === "success"
            ? [lookupResult.row]
            : [],
        explanation,
        recommendation,
        cards: [
          { title: "Executive Summary", text: answer, type: "insight" },
          { title: "Business Impact", text: businessImpact, type: "impact" },
          { title: "Recommended Action", text: recommendation, type: "recommendation" },
        ],
        copilot: {
          executiveSummary: answer,
          businessImpact,
          keyRisks:
            lookupResult.status === "success"
              ? [
                  "Lookup accuracy depends on the uploaded employee dataset being current.",
                ]
              : [
                  "A spelling mismatch or missing employee row may block the lookup result.",
                ],
          recommendedActions: [recommendation],
          followUpQuestions:
            lookupResult.status === "success"
              ? [
                  `What is ${lookupResult.matchedEmployee}'s salary?`,
                  `What is ${lookupResult.matchedEmployee}'s email?`,
                ]
              : [
                  "Show all employees in the dataset.",
                  "What fields are available in this dataset?",
                ],
        },
        meta: {
          mode: "dataset-lookup",
          intentType: lookupResult.intent,
          matchedEmployee: lookupResult.matchedEmployee,
          matchedColumn: lookupResult.matchedColumn,
          confidence: lookupResult.confidence,
          llmUsed: lookupResult.llmUsed,
        },
        dataset: {
          source: datasetStatus.source,
          domain: datasetStatus.domain,
          alerts: datasetStatus.alerts,
        },
        rootCause: {
          available: false,
          buttonLabel: "Root Cause Analysis",
          summary: "Root cause drill-down is not available for direct record lookups.",
        },
      });
    }
    let plan;
    let mode = "fallback";

    try {
      const rawPlan = await createAnalysisPlan({
        question,
        datasetContext,
      });

      plan = sanitizePlan(rawPlan, question, datasetContext);
      mode = "ai";
    } catch (planError) {
      console.warn("AI planning fallback used:", planError.message);
      plan = sanitizePlan({}, question, datasetContext);
    }

    const { filteredRows, chartData, summary } = applyPlan(data, plan, datasetContext);

    if (!filteredRows.length || !chartData.length) {
      const noDataResponse = buildNoDataResponse(plan);
      noDataResponse.rootCause = {
        available: false,
        buttonLabel: "Root Cause Analysis",
        summary: "Broaden the question or adjust the filters before drilling into root causes.",
      };

      return res.json(noDataResponse);
    }

    let narrative = buildFallbackNarrativeResponse(question, plan, summary);

    if (mode === "ai") {
      try {
        narrative = await createNarrative({
          question,
          plan,
          summary,
          chartData: chartData.slice(0, 12),
        });
      } catch (narrativeError) {
        console.warn("AI narrative fallback used:", narrativeError.message);
        mode = "fallback";
      }
    }

    const response = buildResponse({
      plan,
      chartData,
      narrative,
      summary,
      mode,
    });

    response.dataset = {
      source: datasetStatus.source,
      domain: datasetStatus.domain,
      alerts: datasetStatus.alerts,
    };
    response.rootCause = buildRootCauseConfig({
      question,
      plan,
      datasetContext,
    });

    return res.json(response);
  } catch (error) {
    console.error("Query route error:", error);

    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to generate an AI-driven response.",
    });
  }
});

export default router;
