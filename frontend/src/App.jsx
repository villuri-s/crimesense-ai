import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Database,
  FileText,
  RefreshCw,
  Search,
  Server,
  Shield,
  Sparkles,
  Upload,
  Workflow,
} from "lucide-react";
import AppLayout from "./components/layout/AppLayout";
import TopNavigation from "./components/layout/TopNavigation";
import WorkspaceSidebar from "./components/layout/WorkspaceSidebar";
import KPICards from "./components/KPICards";
import CrimeMap from "./components/CrimeMap";
import CrimeAnalytics from "./components/CrimeAnalytics";
import ChartView from "./components/ChartView";
import PoliceDashboard from "./components/dashboard/PoliceDashboard";
import ConnectorCard from "./components/shared/ConnectorCard";
import ExportMenu from "./components/shared/ExportMenu";
import QuestionHistory from "./components/shared/QuestionHistory";
import SlideDrawer from "./components/shared/SlideDrawer";
import AnalysisTabs from "./components/workspace/AnalysisTabs";
import BusinessImpactCard from "./components/workspace/BusinessImpactCard";
import ChartCard from "./components/workspace/ChartCard";
import ChatPanel from "./components/workspace/ChatPanel";
import ExecutiveCard from "./components/workspace/ExecutiveCard";
import RecommendationCard from "./components/workspace/RecommendationCard";
import RootCauseTree from "./components/workspace/RootCauseTree";
import {
  fetchDatasetStatus,
  ingestSource,
  testConnector,
  requestRootCause,
  resetDataset,
  sendQuery,
  uploadFile,
} from "./services/api";
import {
  buildConnectorPayload,
  buildConnectorRun,
  buildStagedDataset,
  createInitialConnectorForms,
  getConnectorById,
  validateConnectorForm,
} from "./data/connectors";
import { DATA_SOURCE_CATALOG } from "./data/sourceCatalog";
import "./styles.css";
import "./styles-animations.css";

const NAV_SECTIONS = [
  {
    label: "Crime Intelligence",
    items: [
      { id: "dashboard", label: "Dashboard", hint: "Crime KPIs", icon: BarChart3 },
      { id: "crime-analytics", label: "Crime Analytics", hint: "Trend analysis", icon: Activity },
      { id: "crime-map", label: "Crime Hotspots", hint: "Geographic view", icon: AlertTriangle },
    ],
  },
  {
    label: "Investigation & Prediction",
    items: [
      { id: "investigation", label: "Investigation Assistant", hint: "Case recommendations", icon: Workflow },
      { id: "hotspot-prediction", label: "Hotspot Prediction", hint: "Future crime areas", icon: AlertTriangle },
    ],
  },
  {
    label: "Analysis & Reports",
    items: [
      { id: "report-generator", label: "Report Generator", hint: "Export briefings", icon: FileText },
    ],
  },
  {
    label: "Operations",
    items: [
      { id: "patrol-optimization", label: "Patrol Optimization", hint: "Deployment plan", icon: AlertTriangle },
      { id: "data-sources", label: "Upload Data", hint: "Import datasets", icon: Database },
    ],
  },
];

const PAGE_META = {
  dashboard: {
    title: "Crime Intelligence Dashboard",
    description:
      "Real-time crime statistics, KPI monitoring, and hotspot analysis for Karnataka State Police.",
  },
  "crime-analytics": {
    title: "Crime Analytics",
    description:
      "Analyze crime trends, patterns, and statistics across districts and crime categories.",
  },
  "crime-map": {
    title: "Crime Hotspot Map",
    description:
      "Interactive geographic visualization of crime incidents and high-risk areas across Karnataka.",
  },
  investigation: {
    title: "Investigation Assistant",
    description:
      "AI-powered recommendations for case investigation, suspect tracking, and evidence analysis.",
  },
  "hotspot-prediction": {
    title: "Crime Hotspot Prediction",
    description:
      "Predictive analytics to forecast crime hotspots and optimize police deployment.",
  },
  "report-generator": {
    title: "Report Generator",
    description:
      "Generate PDF, Excel, and PowerPoint reports for commissioners and investigation teams.",
  },
  "patrol-optimization": {
    title: "Patrol Optimization",
    description:
      "Optimize police patrol routes and deployment based on crime prediction and risk analysis.",
  },
  "data-sources": {
    title: "Data Upload & Management",
    description:
      "Upload crime datasets, FIR PDFs, charge sheets, investigation reports, and other investigative documents.",
  },
};

const SOURCE_ICON_MAP = {
  sqlserver: Server,
  mysql: Database,
  postgresql: Database,
  sqlite: Database,
  splunk: Search,
  elasticsearch: Search,
  csv: Upload,
  excel: Upload,
  json: Upload,
};

const ANALYSIS_TAB_ITEMS = [
  { id: "overview", label: "Overview" },
  { id: "charts", label: "Charts" },
  { id: "tables", label: "Tables" },
  { id: "filters", label: "Filters" },
  { id: "compare", label: "Compare" },
  { id: "actions", label: "Explain & Export" },
];

function formatTimestamp(dateLike) {
  if (!dateLike) {
    return "Just now";
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(dateLike));
  } catch {
    return "Just now";
  }
}

function formatMetric(value) {
  if (typeof value === "string") {
    return value;
  }

  if (!Number.isFinite(value)) {
    return "-";
  }

  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }

  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }

  if (Math.abs(value) >= 100) {
    return value.toFixed(0);
  }

  return value.toFixed(1);
}

function getNumericSeries(data = []) {
  return data
    .map((item) => Number(item?.value ?? item?.count))
    .filter((item) => Number.isFinite(item));
}

function buildWorkspaceSnapshot(dataset, { status, detail, isLive = false }) {
  const timestamp = new Date().toISOString();
  const sourceLabel = dataset?.source?.label || dataset?.domain || "Workspace Dataset";

  return {
    id: `${sourceLabel}-${Date.now()}`,
    dataset,
    label: sourceLabel,
    status,
    detail,
    isLive,
    timestamp,
    timestampLabel: formatTimestamp(timestamp),
  };
}

function buildDashboardKpis(workspace, response, alertCount, connectorRuns) {
  const numericSeries = getNumericSeries(response?.data);
  const peak = numericSeries.length ? Math.max(...numericSeries) : null;
  const average = numericSeries.length
    ? numericSeries.reduce((sum, value) => sum + value, 0) / numericSeries.length
    : null;

  return [
    {
      title: "Rows in Scope",
      value: formatMetric(workspace?.summary?.rowCount || 0),
      subtitle: workspace?.source?.kindLabel || workspace?.domain || "Enterprise Analytics",
      tone: "blue",
      icon: <Database size={18} />,
      trend: workspace?.staging ? "Preview Mode" : "Active Dataset",
    },
    {
      title: "Signal Groups",
      value: formatMetric(response?.data?.length || 0),
      subtitle: response?.title || "Awaiting first analysis",
      tone: "green",
      icon: <Activity size={18} />,
      trend: response ? "Fresh Result" : "No Result Yet",
    },
    {
      title: "Peak Metric",
      value: formatMetric(peak),
      subtitle: average ? `Average ${formatMetric(average)}` : "Ask a question to compute trends",
      tone: "amber",
      icon: <Shield size={18} />,
      trend: peak ? "Peak Identified" : "Needs Analysis",
    },
    {
      title: "Risk Signals",
      value: formatMetric(alertCount),
      subtitle: `${connectorRuns.length} ingestion runs tracked`,
      tone: "slate",
      icon: <AlertTriangle size={18} />,
      trend: alertCount ? "Attention Needed" : "Stable Surface",
    },
  ];
}

function flattenRecommendations(summaryCards = []) {
  return summaryCards
    .filter((card) => card.type === "recommendation")
    .map((card) => card.text);
}

function summarizeDataset(workspace) {
  if (!workspace) {
    return "No dataset loaded";
  }

  return `${workspace?.summary?.rowCount || 0} rows • ${workspace?.summary?.fieldCount || 0} fields`;
}

function buildComparisonMetrics(data = []) {
  const points = data
    .map((item) => ({
      label: item?.name || "Segment",
      value: Number(item?.value ?? item?.count),
    }))
    .filter((item) => Number.isFinite(item.value));

  if (!points.length) {
    return [];
  }

  const sorted = [...points].sort((a, b) => b.value - a.value);
  const highest = sorted[0];
  const lowest = sorted[sorted.length - 1];
  const average =
    points.reduce((sum, item) => sum + item.value, 0) / points.length;

  return [
    {
      label: "Top Segment",
      value: highest.label,
      meta: formatMetric(highest.value),
    },
    {
      label: "Lowest Segment",
      value: lowest.label,
      meta: formatMetric(lowest.value),
    },
    {
      label: "Average Value",
      value: formatMetric(average),
      meta: `${points.length} segments compared`,
    },
    {
      label: "Spread",
      value: formatMetric(highest.value - lowest.value),
      meta: `${highest.label} vs ${lowest.label}`,
    },
  ];
}

function pickValue(record, aliases = []) {
  if (!record || typeof record !== "object") {
    return "";
  }

  for (const alias of aliases) {
    const value = record[alias];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
}

function normalizeLabel(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function toDateLabel(value) {
  if (!value) {
    return "Unknown";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return normalizeLabel(value);
  }

  return parsed.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function extractWorkspaceRows(workspace) {
  const candidates = [];
  const queue = [workspace];

  while (queue.length) {
    const current = queue.shift();

    if (!current || typeof current !== "object") {
      continue;
    }

    if (Array.isArray(current)) {
      current.forEach((item) => queue.push(item));
      continue;
    }

    const nestedKeys = ["rows", "records", "data", "firs", "cases", "incidents", "items", "entities"];
    nestedKeys.forEach((key) => {
      if (Array.isArray(current[key])) {
        candidates.push(current[key]);
      }
    });

    Object.values(current).forEach((value) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        queue.push(value);
      }
    });
  }

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.some((item) => item && typeof item === "object")) {
      const sample = candidate.find((item) => item && typeof item === "object");
      const sampleText = JSON.stringify(sample || {}).toLowerCase();
      const relevant = ["district", "crime", "fir", "status", "victim", "suspect", "witness", "vehicle", "phone", "bank", "gps", "location", "category", "summary", "notes"];

      if (relevant.some((keyword) => sampleText.includes(keyword))) {
        return candidate.filter((item) => item && typeof item === "object");
      }
    }
  }

  return [];
}

function normalizeWorkspaceRows(workspace) {
  const rawRows = extractWorkspaceRows(workspace);

  return rawRows.map((row, index) => {
    const record = row && typeof row === "object" ? row : {};
    const firNumber = normalizeLabel(
      pickValue(record, ["firNumber", "fir_id", "fir_no", "caseNumber", "case_no", "caseId", "case_id", "incidentId", "incident_id", "id", "call_id", "record_id", "uuid"])
    );
    const dateValue = normalizeLabel(
      pickValue(record, ["date", "start_time", "end_time", "incidentDate", "reportedAt", "createdAt", "timestamp", "occurredAt"])
    );
    const district = normalizeLabel(
      pickValue(record, ["district", "districtName", "area", "locationDistrict", "region", "state", "city", "zone"])
    );
    const crimeType = normalizeLabel(
      pickValue(record, ["crimeType", "crime", "crime_type", "category", "offenseType", "offense_type", "incidentType", "call_type", "eventType", "event_type", "activity", "activityType"])
    );
    const status = normalizeLabel(
      pickValue(record, ["status", "caseStatus", "firStatus", "outcome", "state", "call_status"])
    );
    const victim = normalizeLabel(
      pickValue(record, ["victim", "victimName", "victimNameFull", "callee", "recipient", "target"])
    );
    const suspect = normalizeLabel(
      pickValue(record, ["suspect", "suspectid", "suspectId", "suspectName", "accused", "accusedName", "caller", "source", "agent"])
    );
    const witness = normalizeLabel(
      pickValue(record, ["witness", "witnessName", "witnesses", "observer"])
    );
    const vehicle = normalizeLabel(
      pickValue(record, ["vehicle", "vehicleNumber", "vehicleType", "cell_tower_id", "tower", "antenna", "base_station"])
    );
    const phone = normalizeLabel(
      pickValue(record, ["phone", "mobile", "phoneNumber", "caller", "callee", "caller_id", "callee_id", "contactNumber", "phone_number"])
    );
    const bankAccount = normalizeLabel(
      pickValue(record, ["bankAccount", "bank_account", "accountNumber", "cost_usd", "price", "fare", "charge"])
    );
    const address = normalizeLabel(
      pickValue(record, ["address", "location", "place", "site"])
    );
    const policeStation = normalizeLabel(
      pickValue(record, ["policeStation", "police_station", "station", "precinct"])
    );
    const latitude = normalizeLabel(
      pickValue(record, ["latitude", "lat", "gps_latitude", "y"])
    );
    const longitude = normalizeLabel(
      pickValue(record, ["longitude", "lng", "lon", "gps_longitude", "x"])
    );
    const gps = normalizeLabel(
      pickValue(record, ["gps", "gpsCoordinates", "coordinates", "latitude", "longitude"])
    );
    const notes = normalizeLabel(
      pickValue(record, ["notes", "summary", "description", "details", "remarks", "network_type", "plan_type"])
    );
    const severity = normalizeLabel(
      pickValue(record, ["severity", "riskLevel", "priority", "risk", "network_type", "plan_type"])
    );
    const amount = normalizeLabel(
      pickValue(record, ["amount", "value", "loss", "estimatedLoss", "cost_usd", "duration_sec", "duration"])
    );

    return {
      id: firNumber || `record-${index + 1}`,
      firNumber: firNumber || `FIR-${index + 1}`,
      date: dateValue,
      district: district || "Unknown",
      crimeType: crimeType || "Unspecified",
      status: status || "Unknown",
      victim,
      suspect,
      witness,
      vehicle,
      phone,
      bankAccount,
      address,
      policeStation,
      latitude,
      longitude,
      gps,
      notes,
      severity,
      amount,
      source: record,
    };
  });
}

function getTopCounts(rows = [], field, topN = 3) {
  const counts = rows.reduce((acc, row) => {
    const value = normalizeLabel(row?.[field]);
    if (!value) {
      return acc;
    }
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([label, count]) => ({ label, count }));
}

function buildDatasetSummary(rows = []) {
  if (!rows.length) {
    return "No matching records found";
  }

  const statusCounts = rows.reduce((acc, row) => {
    const status = normalizeLabel(row.status) || "Unknown";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const completedCount = Object.entries(statusCounts).reduce(
    (sum, [status, count]) =>
      /completed|resolved|success|ok/i.test(status) ? sum + count : sum,
    0
  );
  const failedCount = Object.entries(statusCounts).reduce(
    (sum, [status, count]) =>
      /failed|dropped|error|cancelled/i.test(status) ? sum + count : sum,
    0
  );
  const activeCount = Object.entries(statusCounts).reduce(
    (sum, [status, count]) =>
      /pending|open|active|in progress/i.test(status) ? sum + count : sum,
    0
  );

  const topRegion = getTopCounts(rows, "district", 1)[0]?.label || "Unknown";
  const topCallType = getTopCounts(rows, "crimeType", 1)[0]?.label || "Unknown";

  return `Across ${rows.length} records, ${completedCount} completed, ${failedCount} failed or dropped, and ${activeCount} remain active. Top region is ${topRegion} and most common call type is ${topCallType}.`;
}

function answerDatasetQuestion(question, rows = []) {
  const cleaned = String(question || "").trim().toLowerCase();

  if (!rows.length) {
    return { title: "No matching records found", answer: "No matching records found", data: [] };
  }

  const topRegions = getTopCounts(rows, "district", 3);
  const topCallTypes = getTopCounts(rows, "crimeType", 3);
  const topCallers = getTopCounts(rows, "suspect", 3);
  const topStatuses = getTopCounts(rows, "status", 3);
  const topTowers = getTopCounts(rows, "vehicle", 3);

  const summary = buildDatasetSummary(rows);

  if (cleaned.includes("summarize") || cleaned.includes("overview") || cleaned.includes("dataset")) {
    return {
      title: "Dataset summary",
      answer: summary,
      data: rows.slice(0, 5),
    };
  }

  if (cleaned.includes("failed") || cleaned.includes("dropped") || cleaned.includes("error")) {
    const failedRows = rows.filter((row) => /failed|dropped|error|cancelled/i.test(row.status));
    return {
      title: "Failed connections",
      answer: failedRows.length
        ? `There are ${failedRows.length} failed or dropped records, mostly in ${topRegions[0]?.label || "Unknown"}.`
        : "No matching records found",
      data: failedRows,
    };
  }

  if (cleaned.includes("completed") || cleaned.includes("successful")) {
    const completedRows = rows.filter((row) => /completed|resolved|success|ok/i.test(row.status));
    return {
      title: "Completed calls",
      answer: completedRows.length
        ? `There are ${completedRows.length} completed records, with ${topCallTypes[0]?.count || 0} ${topCallTypes[0]?.label || "calls"}.`
        : "No matching records found",
      data: completedRows,
    };
  }

  if (cleaned.includes("top caller") || cleaned.includes("most active caller") || (cleaned.includes("caller") && cleaned.includes("most"))) {
    return {
      title: "Top caller",
      answer: topCallers.length
        ? `The top caller is ${topCallers[0].label} with ${topCallers[0].count} records.`
        : "No matching records found",
      data: rows.filter((row) => row.suspect === topCallers[0]?.label),
    };
  }

  if (cleaned.includes("region") && cleaned.includes("most")) {
    return {
      title: "Top region",
      answer: topRegions.length
        ? `The busiest region is ${topRegions[0].label} with ${topRegions[0].count} records.`
        : "No matching records found",
      data: rows.filter((row) => row.district === topRegions[0]?.label),
    };
  }

  if (cleaned.includes("call type") || cleaned.includes("most common")) {
    return {
      title: "Most common call type",
      answer: topCallTypes.length
        ? `The most common call type is ${topCallTypes[0].label} with ${topCallTypes[0].count} records.`
        : "No matching records found",
      data: rows.filter((row) => row.crimeType === topCallTypes[0]?.label),
    };
  }

  if (cleaned.includes("tower") || cleaned.includes("cell tower")) {
    return {
      title: "Top cell tower",
      answer: topTowers.length
        ? `The most frequently referenced tower is ${topTowers[0].label} with ${topTowers[0].count} associated records.`
        : "No matching records found",
      data: rows.filter((row) => row.vehicle === topTowers[0]?.label),
    };
  }

  if (cleaned.includes("longest") || cleaned.includes("duration")) {
    const sortedByDuration = [...rows]
      .filter((row) => Number(row.amount) || Number(row.duration_sec))
      .sort((a, b) => Number(b.duration_sec || b.amount || 0) - Number(a.duration_sec || a.amount || 0));
    const top = sortedByDuration[0];
    return {
      title: "Longest calls",
      answer: top
        ? `The longest record is ${top.firNumber || "unknown"} with ${top.duration_sec || top.amount || 0} seconds.`
        : "No matching records found",
      data: sortedByDuration.slice(0, 5),
    };
  }

  if (cleaned.includes("cost") || cleaned.includes("expensive")) {
    const sortedByCost = [...rows]
      .filter((row) => Number(row.amount))
      .sort((a, b) => Number(b.amount) - Number(a.amount));
    const top = sortedByCost[0];
    return {
      title: "High cost records",
      answer: top
        ? `The highest cost record is ${top.firNumber || "unknown"} at ${top.amount}.`
        : "No matching records found",
      data: sortedByCost.slice(0, 5),
    };
  }

  if (cleaned.includes("commissioner") || cleaned.includes("briefing")) {
    return {
      title: "Executive briefing",
      answer: `Executive briefing: ${summary}`,
      data: rows.slice(0, 6),
    };
  }

  return {
    title: "Analysis result",
    answer: summary,
    data: rows.slice(0, 6),
  };
}

function buildHotspotModel(rows = []) {
  const districtCounts = rows.reduce((acc, row) => {
    acc[row.district] = (acc[row.district] || 0) + 1;
    return acc;
  }, {});

  const trend = rows.reduce((acc, row) => {
    const month = row.date ? new Date(row.date).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "Unknown";
    acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {});

  const ranked = Object.entries(districtCounts).map(([district, count]) => ({ district, count, risk: Math.min(100, 55 + count * 3) })).sort((a, b) => b.count - a.count);
  const topArea = ranked[0] || { district: "Unknown", count: 0, risk: 0 };
  const predictedNextMonth = Math.max(1, Math.round(topArea.count + (topArea.count > 3 ? 3 : 1)));

  return {
    ranked,
    topArea,
    predictedNextMonth,
    trend,
  };
}

function buildPatrolPlan(rows = []) {
  if (!rows.length) {
    return {
      districts: [],
      schedule: [],
      recommendations: ["No matching records found"],
      summary: "No matching records found",
    };
  }

  const byDistrict = rows.reduce((acc, row) => {
    const district = row.district || "Unknown";
    acc[district] = (acc[district] || 0) + 1;
    return acc;
  }, {});

  const byType = rows.reduce((acc, row) => {
    const type = row.crimeType || "Unspecified";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const districts = Object.entries(byDistrict)
    .map(([district, count]) => {
      const severityWeight = /violent|robbery|murder|assault|theft/i.test(String(rows.find((row) => row.district === district)?.crimeType || "")) ? 18 : 12;
      const densityScore = Math.min(100, Math.round(count * 5 + severityWeight));
      const priority = densityScore >= 80 ? "High" : densityScore >= 55 ? "Medium" : "Low";
      const officers = Math.max(2, Math.ceil(densityScore / 25));
      const timing = priority === "High" ? "19:00-23:00" : priority === "Medium" ? "16:00-20:00" : "10:00-14:00";
      return {
        district,
        count,
        densityScore,
        priority,
        officers,
        timing,
      };
    })
    .sort((left, right) => right.count - left.count)
    .slice(0, 10);

  const topDistrict = districts[0] || { district: "Unknown", densityScore: 0 };
  const topCrimeType = Object.entries(byType).sort((left, right) => right[1] - left[1])[0]?.[0] || "Unspecified";
  const recommendations = [
    `${topDistrict.district} should receive the first patrol wave because it has the highest incident density in the active dataset.`,
    `Focus patrols on ${topCrimeType} activity windows between ${topDistrict.timing || "the evening shift"}.`,
    `Deploy ${topDistrict.officers || 2} officers to the highest-priority district and rotate coverage using the schedule below.`,
  ];

  const schedule = districts.slice(0, 6).map((district) => ({
    district: district.district,
    priority: district.priority,
    densityScore: district.densityScore,
    officers: district.officers,
    timing: district.timing,
  }));

  return {
    districts,
    schedule,
    recommendations,
    summary: `${districts.length} districts ranked from the uploaded crime data with ${topDistrict.district} as the current priority district.`,
  };
}

function buildReportModel(rows = [], reportType = "daily") {
  if (!rows.length) {
    return {
      cards: [],
      trendData: [],
      hotspotData: [],
      comparisonData: [],
      recommendations: ["No matching records found"],
      summary: "No matching records found",
    };
  }

  const byDistrict = rows.reduce((acc, row) => {
    const district = row.district || "Unknown";
    acc[district] = (acc[district] || 0) + 1;
    return acc;
  }, {});

  const byType = rows.reduce((acc, row) => {
    const type = row.crimeType || "Unspecified";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const trendData = Object.entries(
    reportType === "district"
      ? byDistrict
      : reportType === "crime-type"
        ? byType
        : rows.reduce((acc, row) => {
            const bucket = reportType === "weekly"
              ? `W${Math.min(52, Math.max(1, Math.ceil(new Date(row.date || Date.now()).getDate() / 7)))}`
              : reportType === "monthly"
                ? new Date(row.date || Date.now()).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                : new Date(row.date || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric" });
            acc[bucket] = (acc[bucket] || 0) + 1;
            return acc;
          }, {})
  ).map(([name, value]) => ({ name, value }));

  const hotspotData = Object.entries(byDistrict)
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 8);

  const comparisonData = Object.entries(byType)
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 6);

  const topDistrict = hotspotData[0] || { name: "Unknown", value: 0 };
  const topCrimeType = comparisonData[0] || { name: "Unspecified", value: 0 };
  const totalDistricts = Object.keys(byDistrict).length;
  const totalCrimeTypes = Object.keys(byType).length;

  const cards = [
    { title: "Records", value: rows.length, subtitle: `${reportType} view` },
    { title: "Districts", value: totalDistricts, subtitle: "Active coverage" },
    { title: "Crime Types", value: totalCrimeTypes, subtitle: "Variance detected" },
    { title: "Priority Area", value: topDistrict.name, subtitle: `${topDistrict.value} records` },
  ];

  const recommendations = [
    `${topDistrict.name} should receive the highest deployment attention based on the current uploaded dataset.`,
    `Investigate ${topCrimeType.name} activity in the highest-volume districts to reduce recurrence.`,
    `Use the generated summary as the basis for the next operational briefing.`,
  ];

  const summary = `The ${reportType} report shows ${rows.length} records across ${totalDistricts} districts and ${totalCrimeTypes} crime types. ${topDistrict.name} is the busiest area and ${topCrimeType.name} dominates the current trend.`;

  return {
    cards,
    trendData,
    hotspotData,
    comparisonData,
    recommendations,
    summary,
    reportType,
    topDistrict,
    topCrimeType,
  };
}

export default function App() {
  const [activeView, setActiveView] = useState("dashboard");
  const [analysisTab, setAnalysisTab] = useState("overview");
  const [selectedChat, setSelectedChat] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [datasetLoading, setDatasetLoading] = useState(true);
  const [datasetError, setDatasetError] = useState("");
  const [workspaceNotice, setWorkspaceNotice] = useState(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [connectorForms, setConnectorForms] = useState(() =>
    createInitialConnectorForms()
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [connectorStatus, setConnectorStatus] = useState("idle");
  const [connectorRuns, setConnectorRuns] = useState([]);
  const [workspaceCatalog, setWorkspaceCatalog] = useState([]);
  const [workspaceHistories, setWorkspaceHistories] = useState({});
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("");
  const [liveWorkspaceId, setLiveWorkspaceId] = useState("");
  const [rootCauseAnalysis, setRootCauseAnalysis] = useState(null);
  const [rootCauseLoading, setRootCauseLoading] = useState(false);
  const [rootCauseError, setRootCauseError] = useState("");
  const [sourceDrawer, setSourceDrawer] = useState(null);
  const [detailDrawer, setDetailDrawer] = useState(null);
  const [uploadProgress, setUploadProgress] = useState("");
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [reportType, setReportType] = useState("daily");
  const [investigationInput, setInvestigationInput] = useState("");
  const [investigationAnswer, setInvestigationAnswer] = useState(null);
  const fileInputRef = useRef(null);
  const fileInputRefs = useRef({});

  const activeWorkspaceSnapshot =
    workspaceCatalog.find((item) => item.id === activeWorkspaceId) ||
    workspaceCatalog[0] ||
    null;
  const activeWorkspace = activeWorkspaceSnapshot?.dataset || null;
  const history = workspaceHistories[activeWorkspaceId] || [];
  const activeChat = selectedChat || history[history.length - 1] || null;
  const activeResponse = activeChat?.response || null;
  const activeChatKey = activeChat
    ? `${activeChat.question}::${activeResponse?.title || ""}::${activeChat.timestamp}`
    : "";
  const copilot = activeResponse?.copilot || null;
  const summaryCards = activeResponse?.cards || [];
  const responseAlerts = activeResponse?.dataset?.alerts?.slice(0, 4) || [];
  const rootCauseConfig = activeResponse?.rootCause || null;
  const canQuery =
    Boolean(activeWorkspace) &&
    !activeWorkspace?.staging &&
    activeWorkspaceId === liveWorkspaceId;
  const queryDisabledReason = activeWorkspace?.staging
    ? activeWorkspace.staging.description
    : activeWorkspaceId && activeWorkspaceId !== liveWorkspaceId
      ? "This dataset snapshot is not the backend's active workspace. Reconnect it from Data Connectors to run live analysis."
      : "";
  const recentQuestions = history
    .slice()
    .reverse()
    .map((item) => ({
      ...item,
      timestampLabel: formatTimestamp(item.timestamp),
    }));
  const savedAnalyses = history
    .slice()
    .reverse()
    .map((item) => ({
      id: `${item.question}-${item.timestamp}`,
      title: item.response?.title || item.question,
      description: item.response?.answer || "Analysis saved in the workspace history.",
      timestampLabel: formatTimestamp(item.timestamp),
    }));
  const pinnedDashboards = [
    {
      id: "workspace-overview",
      title: "Workspace Overview",
      subtitle: activeWorkspaceSnapshot?.label || "Awaiting source",
      status: activeWorkspace?.staging ? "Preview mode" : "Pinned",
    },
    {
      id: "executive-insight",
      title: activeResponse?.title || "Executive Insight Board",
      subtitle: copilot?.executiveSummary || "Pin an AI analysis to keep it here.",
      status: activeResponse ? "Pinned" : "Ready to pin",
    },
  ];
  const dashboardKpis = buildDashboardKpis(
    activeWorkspace,
    activeResponse,
    responseAlerts.length,
    connectorRuns
  );
  const workspaceMode = activeWorkspace?.staging
    ? "Preview"
    : activeWorkspaceId === liveWorkspaceId
      ? "Live"
      : "Snapshot";
  const workspaceFreshness =
    activeWorkspace?.ingestion?.freshness || "On demand";
  const pageMeta = PAGE_META[activeView];
  const selectedSource = sourceDrawer
    ? DATA_SOURCE_CATALOG.find((item) => item.id === sourceDrawer.id) || null
    : null;
  const selectedConnector = selectedSource?.connectorId
    ? getConnectorById(selectedSource.connectorId)
    : null;
  const selectedConnectorForm = selectedConnector
    ? connectorForms[selectedConnector.id] || {}
    : {};
  const datasetOptions = workspaceCatalog.map((snapshot) => ({
    id: snapshot.id,
    label: snapshot.label,
    meta: `${snapshot.status} • ${snapshot.timestampLabel}`,
  }));
  const analysisFields = activeWorkspace?.summary?.fields || [];
  const comparisonMetrics = buildComparisonMetrics(activeResponse?.data);
  const evidencePath = rootCauseAnalysis?.path || [];
  const workspaceRows = useMemo(() => normalizeWorkspaceRows(activeWorkspace), [activeWorkspace]);
  const firRows = useMemo(() => workspaceRows.filter((row) => row.firNumber || row.crimeType || row.status), [workspaceRows]);
  const patrolPlan = useMemo(() => buildPatrolPlan(firRows), [firRows]);
  const reportModel = useMemo(() => buildReportModel(firRows, reportType), [firRows, reportType]);

  const registerWorkspace = (dataset, metadata) => {
    const snapshot = buildWorkspaceSnapshot(dataset, metadata);

    setWorkspaceCatalog((previous) => [snapshot, ...previous].slice(0, 8));
    setWorkspaceHistories((previous) => ({
      ...previous,
      [snapshot.id]: previous[snapshot.id] || [],
    }));
    setActiveWorkspaceId(snapshot.id);
    setSelectedChat(null);

    if (metadata.isLive) {
      setLiveWorkspaceId(snapshot.id);
    }

    return snapshot;
  };

  useEffect(() => {
    const loadDataset = async () => {
      setDatasetLoading(true);
      setDatasetError("");

      try {
        const response = await fetchDatasetStatus();

        if (response) {
          registerWorkspace(response, {
            status: "Active workspace",
            detail: `${response.domain || "Enterprise Analytics"} workspace`,
            isLive: true,
          });
        }
      } catch (error) {
        setDatasetError(error.message || "Could not load dataset status.");
      } finally {
        setDatasetLoading(false);
      }
    };

    loadDataset();
  }, []);

  useEffect(() => {
    setRootCauseAnalysis(null);
    setRootCauseError("");
    setRootCauseLoading(false);
    setAnalysisTab("overview");
  }, [activeChatKey]);

  const pushConnectorRun = (run) => {
    setConnectorRuns((previous) => [run, ...previous].slice(0, 6));
  };

  const handleSelectQuestion = (item, nextView = "analysis") => {
    setSelectedChat(item);
    setActiveView(nextView);
  };

  const handleSwitchDataset = (workspaceId) => {
    setActiveWorkspaceId(workspaceId);
    setSelectedChat(null);
    setQueryError("");
  };

  const handleAskQuestion = async (question) => {
    if (!canQuery) {
      return;
    }

    setQueryLoading(true);
    setSelectedChat(null);
    setQueryError("");

    try {
      const response = await sendQuery(question);
      const timestamp = new Date().toISOString();
      const newItem = {
        question,
        response,
        timestamp,
      };

      setWorkspaceHistories((previous) => ({
        ...previous,
        [activeWorkspaceId]: [...(previous[activeWorkspaceId] || []), newItem],
      }));
    } catch (error) {
      setQueryError(error.message || "We could not reach the API right now.");
    } finally {
      setQueryLoading(false);
    }
  };

  const handleRootCause = async () => {
    if (!activeChat?.question || !rootCauseConfig?.request?.plan) {
      return;
    }

    setRootCauseLoading(true);
    setRootCauseError("");

    try {
      const response = await requestRootCause({
        question: activeChat.question,
        basePlan: rootCauseConfig.request.plan,
        path: rootCauseAnalysis?.path || [],
      });

      setRootCauseAnalysis(response);
    } catch (error) {
      setRootCauseError(
        error.message || "We could not generate a root cause analysis right now."
      );
    } finally {
      setRootCauseLoading(false);
    }
  };

  const handleOpenChartDetails = (title = activeResponse?.title || "Chart Details") => {
    setDetailDrawer({ title });
  };

  const handleWorkspaceAction = (actionId) => {
    const copy =
      actionId === "share"
        ? "Share action is ready for wiring to your preferred destination."
        : `${actionId.toUpperCase()} export can be connected without changing the analytics logic.`;

    setWorkspaceNotice({
      tone: "info",
      text: copy,
    });
  };

  const handleConnectorFieldChange = (connectorId, fieldName, value) => {
    setConnectorForms((previous) => ({
      ...previous,
      [connectorId]: {
        ...previous[connectorId],
        [fieldName]: value,
      },
    }));
  };

  const handleResetDataset = async () => {
    setUploading(true);
    setDatasetError("");
    setWorkspaceNotice(null);

    try {
      const response = await resetDataset();

      if (response?.dataset) {
        registerWorkspace(response.dataset, {
          status: "Loaded",
          detail: "Demo workspace restored",
          isLive: true,
        });
      }

      setWorkspaceNotice({
        tone: "success",
        text: "The demo dataset is active again.",
      });
      setSourceDrawer(null);
      setActiveView("dashboard");
    } catch (error) {
      setDatasetError(error.message || "Could not reset the dataset.");
    } finally {
      setUploading(false);
    }
  };

  const handleUploadSelection = async (event, uploadCard) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setUploading(true);
    setUploadProgress(`Uploading ${file.name}...`);
    setUploadError("");
    setDatasetError("");
    setUploadResult(null);
    setWorkspaceNotice(null);

    try {
      const response = await uploadFile(file);
      setUploadProgress("Processing dataset...");

      if (response?.dataset) {
        registerWorkspace(response.dataset, {
          status: "Uploaded",
          detail: `${file.name} ingested into workspace`,
          isLive: true,
        });

        const rowCount = response.dataset.summary?.rowCount ?? response.dataset.rows?.length ?? 0;
        const fieldCount = response.dataset.summary?.fields?.length ?? response.dataset.summary?.fieldCount ?? 0;

        setUploadResult({
          filename: file.name,
          rowCount,
          columnCount: fieldCount,
          format: uploadCard?.label || file.name.split(".").pop()?.toUpperCase() || "File",
        });
      }

      setWorkspaceNotice({
        tone: "success",
        text: `${file.name} was uploaded successfully and the dataset has been refreshed.`,
      });
    } catch (error) {
      setUploadError(error.message || "Could not upload the selected file.");
      setWorkspaceNotice({
        tone: "error",
        text: error.message || "Could not upload the selected file.",
      });
    } finally {
      event.target.value = "";
      setUploading(false);
      setUploadProgress("");
    }
  };

  const handleStartIngestion = async (connectorId) => {
    const connector = getConnectorById(connectorId);
    const form = connectorForms[connectorId] || {};
    const validationError = validateConnectorForm(connector, form);

    if (validationError) {
      setWorkspaceNotice({
        tone: "warning",
        text: validationError,
      });
      return;
    }

    setIngesting(true);
    setDatasetError("");
    setWorkspaceNotice(null);

    const payload = buildConnectorPayload(connector, form);
    try {
      // Step 1: test connector connection
      setConnectorStatus("connecting");
      const testPayload = { ...payload };
      await testConnector(testPayload);
      setConnectorStatus("connected");

      // Step 2: ingest data
      setConnectorStatus("importing");
      const ingestResponse = await ingestSource(payload);

      if (!ingestResponse?.dataset) {
        throw new Error(ingestResponse?.message || "Connector ingestion did not return a dataset.");
      }

      // success
      setConnectorStatus("imported");
      registerWorkspace(ingestResponse.dataset, {
        status: "Live sync",
        detail: `${connector.label} connected to workspace`,
        isLive: true,
      });
      pushConnectorRun(buildConnectorRun(connector, form, "live"));

      const importedCount = ingestResponse.dataset?.summary?.rowCount || 0;

      setWorkspaceNotice({
        tone: "success",
        text: `Successfully imported ${importedCount} records from Splunk.`,
      });

      setConnectorStatus("ready");
      setSourceDrawer(null);
      setActiveView("dashboard");
    } catch (error) {
      setConnectorStatus("idle");
      setWorkspaceNotice({
        tone: "error",
        text: error.message || "Connector ingestion failed.",
      });
    } finally {
      setIngesting(false);
    }
  };

  const renderNoAnalysisState = (title, body) => (
    <div className="workspace-empty-state panel compact-panel">
      <div className="section-kicker">Workspace Ready</div>
      <h3>{title}</h3>
      <p className="panel-copy">{body}</p>
      <div className="prompt-row">
        {(activeWorkspace?.quickPrompts || []).slice(0, 3).map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="prompt-chip"
            onClick={() => {
              setActiveView("ai-chat");
              handleAskQuestion(prompt);
            }}
            disabled={queryLoading || !canQuery}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );

  const renderDashboardView = () => {
    return <PoliceDashboard rows={workspaceRows} />;
  };

  const renderAnalysisTabContent = () => {
    if (!activeResponse) {
      return null;
    }

    if (analysisTab === "charts") {
      return (
        <div className="analysis-chart-grid analysis-chart-single">
          <ChartCard
            response={activeResponse}
            title={activeResponse.title}
            onOpenDetails={() => handleOpenChartDetails(activeResponse.title)}
            onExplain={() => handleOpenChartDetails(activeResponse.title)}
            onExport={() => handleWorkspaceAction("csv")}
            onShare={() => handleWorkspaceAction("share")}
            showDrillDown={false}
          />
        </div>
      );
    }

    if (analysisTab === "tables") {
      return (
        <div className="analysis-table-grid">
          <div className="analysis-table-panel">
            <ChartView
              type="table"
              insightType="table"
              title="Underlying Table"
              data={activeResponse.data}
              onOpen={() => handleOpenChartDetails("Underlying Table")}
              onExport={() => handleWorkspaceAction("csv")}
              onShare={() => handleWorkspaceAction("share")}
              showExplain={false}
              showDrillDown={false}
            />
          </div>

          <div className="sidebar-card compact-sidebar-card">
            <div className="section-kicker">Schema View</div>
            <h4>Available fields</h4>
            {analysisFields.length ? (
              <div className="field-chip-row">
                {analysisFields.map((field) => (
                  <span key={field.field} className={`field-chip kind-${field.kind}`}>
                    {field.label}
                  </span>
                ))}
              </div>
            ) : (
              <p className="copilot-copy">
                Field metadata will appear here when the dataset schema is available.
              </p>
            )}
          </div>
        </div>
      );
    }

    if (analysisTab === "filters") {
      return (
        <div className="analysis-filter-grid">
          <div className="sidebar-card compact-sidebar-card">
            <div className="section-kicker">Filter Dimensions</div>
            <h4>Slice the active result</h4>
            {analysisFields.length ? (
              <div className="field-chip-row">
                {analysisFields.map((field) => (
                  <span key={field.field} className={`field-chip kind-${field.kind}`}>
                    {field.label}
                  </span>
                ))}
              </div>
            ) : (
              <p className="copilot-copy">
                This dataset does not expose schema fields for filter design yet.
              </p>
            )}
          </div>

          <div className="sidebar-card compact-sidebar-card">
            <div className="section-kicker">Suggested Scopes</div>
            <h4>Start with common pivots</h4>
            <div className="scope-list">
              <div className="scope-list-item">
                <strong>Dimensions</strong>
                <p>
                  {(analysisFields
                    .filter((field) => field.kind === "dimension")
                    .slice(0, 3)
                    .map((field) => field.label)
                    .join(", ")) || "No dimensional fields detected"}
                </p>
              </div>
              <div className="scope-list-item">
                <strong>Measures</strong>
                <p>
                  {(analysisFields
                    .filter((field) => field.kind === "number")
                    .slice(0, 3)
                    .map((field) => field.label)
                    .join(", ")) || "No numeric measures detected"}
                </p>
              </div>
              <div className="scope-list-item">
                <strong>Time Pivots</strong>
                <p>
                  {(analysisFields
                    .filter((field) => field.kind === "date")
                    .slice(0, 3)
                    .map((field) => field.label)
                    .join(", ")) || "No date fields detected"}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (analysisTab === "compare") {
      return (
        <div className="analysis-compare-grid">
          <div className="analysis-stat-grid">
            {comparisonMetrics.length ? (
              comparisonMetrics.map((metric) => (
                <div key={metric.label} className="comparison-stat-card">
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <small>{metric.meta}</small>
                </div>
              ))
            ) : (
              <div className="empty-state">
                Comparison cards will appear once the result contains numeric segments.
              </div>
            )}
          </div>

          <ChartCard
            response={activeResponse}
            title={`Compare ${activeResponse.title}`}
            onOpenDetails={() => handleOpenChartDetails(activeResponse.title)}
            onExplain={() => handleOpenChartDetails(activeResponse.title)}
            onExport={() => handleWorkspaceAction("csv")}
            onShare={() => handleWorkspaceAction("share")}
            showDrillDown={false}
          />
        </div>
      );
    }

    if (analysisTab === "actions") {
      return (
        <div className="analysis-action-grid">
          <div className="sidebar-card compact-sidebar-card">
            <div className="section-kicker">Explain</div>
            <h4>Interpret the current visualization</h4>
            <p className="copilot-copy">
              {activeResponse.answer ||
                "The explanation panel will summarize the current result here."}
            </p>
            <div className="card-action-row">
              <button
                type="button"
                className="secondary-action"
                onClick={() => handleOpenChartDetails(activeResponse.title)}
              >
                <Sparkles size={16} />
                Open Explanation
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={() => setAnalysisTab("compare")}
              >
                <BarChart3 size={16} />
                Compare Segments
              </button>
            </div>
          </div>

          <div className="sidebar-card compact-sidebar-card">
            <div className="section-kicker">Export Visualization</div>
            <h4>Move this view into a workflow</h4>
            <p className="copilot-copy">
              Export or share the current analytical view without switching into the executive report workspace.
            </p>
            <div className="card-action-row">
              <button
                type="button"
                className="secondary-action"
                onClick={() => handleWorkspaceAction("csv")}
              >
                <ArrowRight size={16} />
                Export Data
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={() => handleWorkspaceAction("share")}
              >
                <FileText size={16} />
                Share View
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="analysis-overview-grid">
        <ChartCard
          response={activeResponse}
          title={activeResponse.title}
          onOpenDetails={() => handleOpenChartDetails(activeResponse.title)}
          onExplain={() => handleOpenChartDetails(activeResponse.title)}
          onExport={() => handleWorkspaceAction("csv")}
          onShare={() => handleWorkspaceAction("share")}
          showDrillDown={false}
        />
        <div className="analysis-table-panel">
          <ChartView
            type="table"
            insightType="table"
            title="Underlying Table"
            data={activeResponse.data}
            onOpen={() => handleOpenChartDetails("Underlying Table")}
            onExport={() => handleWorkspaceAction("csv")}
            onShare={() => handleWorkspaceAction("share")}
            showExplain={false}
            showDrillDown={false}
          />
        </div>
      </div>
    );
  };

  const renderAnalysisView = () => {
    if (!activeResponse) {
      return renderNoAnalysisState(
        "Analysis tabs activate once a question is answered",
        "This workspace is reserved for exploration only: charts, tables, filters, comparisons, and explain/export actions appear here after a query runs."
      );
    }

    return (
      <div className="workspace-view analysis-view analysis-view-full">
        <div className="analysis-main-column">
          <section className="panel compact-panel">
            <div className="panel-header-row compact-panel-header">
              <div>
                <div className="section-kicker">Explore Surface</div>
                <h3>{activeResponse.title}</h3>
              </div>
              <div className="export-menu">
                <button
                  type="button"
                  className="chart-toolbar-button"
                  onClick={() => handleOpenChartDetails(activeResponse.title)}
                >
                  <Sparkles size={14} />
                  Explain
                </button>
                <button
                  type="button"
                  className="chart-toolbar-button"
                  onClick={() => setAnalysisTab("compare")}
                >
                  <BarChart3 size={14} />
                  Compare
                </button>
                <button
                  type="button"
                  className="chart-toolbar-button"
                  onClick={() => handleWorkspaceAction("csv")}
                >
                  <ArrowRight size={14} />
                  Export Viz
                </button>
              </div>
            </div>
            <AnalysisTabs
              tabs={ANALYSIS_TAB_ITEMS}
              activeTab={analysisTab}
              onChange={setAnalysisTab}
            />
            <div className="analysis-tab-panel">{renderAnalysisTabContent()}</div>
          </section>
        </div>
      </div>
    );
  };

  const renderRootCauseView = () => {
    if (!activeResponse) {
      return renderNoAnalysisState(
        "Root cause explorer is ready for the next answered question",
        "Ask a question first, then use this workspace to trace hierarchy, breadcrumbs, and evidence paths behind the result."
      );
    }

    const note =
      rootCauseError ||
      (!rootCauseAnalysis && "Start the first drill-down to trace the strongest contributing factor.") ||
      (!rootCauseAnalysis?.canDrillDown && rootCauseAnalysis?.exhaustedReason) ||
      "";

    return (
      <div className="workspace-view root-cause-view root-cause-view-full">
        <section className="panel root-cause-main-panel compact-panel">
          <div className="root-cause-header">
            <div>
              <div className="section-kicker">Why Explorer</div>
              <h3>Drill Through the Causal Path</h3>
            </div>

            <button
              type="button"
              className="secondary-action root-cause-trigger"
              onClick={handleRootCause}
              disabled={rootCauseLoading || !rootCauseConfig?.available}
            >
              {rootCauseLoading ? "Analyzing..." : rootCauseAnalysis ? "Why Again?" : "Why?"}
            </button>
          </div>

          <p className="root-cause-summary">
            {rootCauseAnalysis?.summary ||
              rootCauseConfig?.summary ||
              "Move through the hierarchy from the broad result into the most concentrated causal segment."}
          </p>

          {note ? (
            <div className={rootCauseError ? "root-cause-note error" : "root-cause-note"}>
              {note}
            </div>
          ) : null}

          {evidencePath.length ? (
            <div className="root-cause-evidence-grid">
              <RootCauseTree path={evidencePath} />

              <div className="root-cause-evidence-column">
                <div className="sidebar-card compact-sidebar-card">
                  <div className="section-kicker">Evidence Path</div>
                  <h4>Trace the scoped contributors</h4>
                  <div className="evidence-step-list">
                    {evidencePath.map((node, index) => (
                      <div
                        key={`${node.fieldLabel || node.label}-${index}`}
                        className="evidence-step"
                      >
                        <span className="evidence-step-index">{index + 1}</span>
                        <div>
                          <strong>{node.fieldLabel || "Segment"}</strong>
                          <p>
                            {node.label}
                            {node.metricDisplayValue ? ` • ${node.metricDisplayValue}` : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {rootCauseAnalysis?.breakdown?.data?.length ? (
                  <div className="root-cause-breakdown-panel">
                    <ChartView
                      type={rootCauseAnalysis.breakdown.type}
                      insightType={rootCauseAnalysis.breakdown.type}
                      title={rootCauseAnalysis.breakdown.title}
                      data={rootCauseAnalysis.breakdown.data}
                      onOpen={() => handleOpenChartDetails(rootCauseAnalysis.breakdown.title)}
                      onExport={() => handleWorkspaceAction("csv")}
                      onShare={() => handleWorkspaceAction("share")}
                      showExplain={false}
                      showDrillDown={false}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              Root cause levels will appear here once the AI drill-down starts.
            </div>
          )}
        </section>
      </div>
    );
  };

  const renderReportsView = () => {
    if (!activeResponse) {
      return renderNoAnalysisState(
        "Executive reports compile from the active analysis",
        "The report page is isolated from raw connector setup and drill-down UI. Ask a question first, then come here for summary, impact, recommendations, confidence, and exports."
      );
    }

    return (
      <div className="workspace-view reports-view">
        <div className="reports-grid">
          <ExecutiveCard>{copilot?.executiveSummary || activeResponse.answer}</ExecutiveCard>
          <BusinessImpactCard>
            {copilot?.businessImpact || "Business impact is not available for this response yet."}
          </BusinessImpactCard>
          <RecommendationCard
            items={
              copilot?.recommendedActions?.length
                ? copilot.recommendedActions
                : flattenRecommendations(summaryCards)
            }
          />
          <div className="sidebar-card compact-sidebar-card">
            <div className="section-kicker">AI Confidence</div>
            <h4>Delivery Confidence</h4>
            <div className="confidence-pill">AI Confidence: 94%</div>
            <p className="copilot-copy">
              This workspace keeps the final narrative, business impact, and recommendations separate from raw analysis panels so report consumers only see the decision-ready surface.
            </p>
          </div>
        </div>

        <section className="panel reports-actions-panel compact-panel">
          <div className="panel-header-row compact-panel-header">
            <div>
              <div className="section-kicker">Export Actions</div>
              <h3>Download or share the report package</h3>
            </div>
          </div>
          <ExportMenu onAction={handleWorkspaceAction} />
        </section>
      </div>
    );
  };

  const renderDataSourcesView = () => {
    const uploadCards = [
      {
        id: "pdf",
        label: "PDF",
        accept: ".pdf",
        description: "Upload FIRs, Charge Sheets, Witness Statements and Investigation Reports.",
        iconLabel: "PDF",
      },
      {
        id: "word",
        label: "Word",
        accept: ".doc,.docx",
        description: "Upload investigation notes, witness statements and legal documents.",
        iconLabel: "DOC",
      },
      {
        id: "excel",
        label: "Excel",
        accept: ".xls,.xlsx",
        description: "Upload structured crime records, police reports and investigation spreadsheets.",
        iconLabel: "XLS",
      },
      {
        id: "csv",
        label: "CSV",
        accept: ".csv",
        description: "Upload crime datasets, suspect lists, GPS logs and evidence metadata.",
        iconLabel: "CSV",
      },
      {
        id: "json",
        label: "JSON",
        accept: ".json",
        description: "Upload exported police systems, API responses and structured investigation data.",
        iconLabel: "JSON",
      },
    ];

    return (
      <div className="workspace-view data-sources-view">
        <section className="panel compact-panel">
          <div className="panel-header-row compact-panel-header">
            <div>
              <div className="section-kicker">Upload Data</div>
              <h3>Import an investigation file into the active workspace</h3>
            </div>
          </div>

          <div className="connector-grid data-source-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {uploadCards.map((card) => (
              <div key={card.id}>
                <input
                  ref={(element) => {
                    fileInputRefs.current[card.id] = element;
                  }}
                  type="file"
                  accept={card.accept}
                  className="hidden-input"
                  onChange={(event) => handleUploadSelection(event, card)}
                />
                <ConnectorCard
                  label={card.label}
                  description={card.description}
                  badge=""
                  active={false}
                  icon={<span className="connector-icon" style={{ fontWeight: 700 }}>{card.iconLabel}</span>}
                  toneClass="tone-file"
                  meta={[]}
                  onClick={() => fileInputRefs.current[card.id]?.click()}
                />
              </div>
            ))}
          </div>
        </section>

        <div className="data-source-secondary-grid">
          <section className="panel compact-panel">
            <div className="section-kicker">Upload Progress</div>
            {uploading ? (
              <div className="empty-state">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <RefreshCw size={16} className="spin" />
                  <span>{uploadProgress || "Uploading file..."}</span>
                </div>
              </div>
            ) : uploadResult ? (
              <div className="ingestion-run-list">
                <div className="ingestion-run-item">
                  <div className="ingestion-run-head">
                    <strong>{uploadResult.filename}</strong>
                    <span className="run-status success">Uploaded</span>
                  </div>
                  <p>{uploadResult.format} • {uploadResult.rowCount} rows • {uploadResult.columnCount} columns</p>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                Select a file type above to import a new dataset into the workspace.
              </div>
            )}
            {uploadError ? <p className="panel-copy" style={{ color: "#fda4af", marginTop: "12px" }}>{uploadError}</p> : null}
          </section>

          <section className="panel compact-panel">
            <div className="section-kicker">Current Dataset</div>
            {activeWorkspace?.summary?.fields?.length ? (
              <div>
                <p className="panel-copy" style={{ marginBottom: "12px" }}>
                  {activeWorkspace.summary.rowCount || 0} rows • {activeWorkspace.summary.fields.length} columns
                </p>
                <div className="field-chip-row">
                  {activeWorkspace.summary.fields.map((field) => (
                    <span key={field.field} className={`field-chip kind-${field.kind}`}>
                      {field.label}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                The workspace will show detected fields here after a file is uploaded.
              </div>
            )}
          </section>
        </div>
      </div>
    );
  };

  const renderHistoryView = () => {
    return (
      <div className="workspace-view history-view">
        <div className="history-grid">
          <section className="panel history-card-panel compact-panel">
            <div className="section-kicker">Uploaded Datasets</div>
            <div className="history-record-list">
              {workspaceCatalog.length ? (
                workspaceCatalog.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={item.id === activeWorkspaceId ? "history-record-item analysis-record-button selected" : "history-record-item analysis-record-button"}
                    onClick={() => handleSwitchDataset(item.id)}
                  >
                    <strong>{item.label}</strong>
                    <p>{item.detail}</p>
                    <div className="ingestion-run-meta">
                      <span>{item.status}</span>
                      <span>{item.timestampLabel}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="history-empty">Dataset activity will appear here.</div>
              )}
            </div>
          </section>

          <section className="panel history-card-panel compact-panel">
            <div className="section-kicker">Recent Questions</div>
            <QuestionHistory
              items={recentQuestions}
              onSelect={(item) => handleSelectQuestion(item, "ai-chat")}
              emptyMessage="Your recent questions will appear here."
            />
          </section>

          <section className="panel history-card-panel compact-panel">
            <div className="section-kicker">Saved Analyses</div>
            <div className="history-record-list">
              {savedAnalyses.length ? (
                savedAnalyses.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="history-record-item analysis-record-button"
                    onClick={() => {
                      const matched = history.find(
                        (entry) => `${entry.question}-${entry.timestamp}` === item.id
                      );

                      if (matched) {
                        handleSelectQuestion(matched, "analysis");
                      }
                    }}
                  >
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                    <div className="ingestion-run-meta">
                      <span>{item.timestampLabel}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="history-empty">Saved analyses will appear here.</div>
              )}
            </div>
          </section>

          <section className="panel history-card-panel compact-panel">
            <div className="section-kicker">Pinned Dashboards</div>
            <div className="history-record-list">
              {pinnedDashboards.map((item) => (
                <div key={item.id} className="history-record-item">
                  <strong>{item.title}</strong>
                  <p>{item.subtitle}</p>
                  <div className="ingestion-run-meta">
                    <span>{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  };

  const downloadExport = (kind, payload) => {
    const safeTitle = (payload?.title || "dataset-report").replace(/[^a-z0-9]+/gi, "-").toLowerCase();

    if (kind === "pdf") {
      const reportWindow = window.open("", "_blank", "width=900,height=700");
      if (reportWindow) {
        reportWindow.document.write(`<!DOCTYPE html><html><head><title>${payload.title}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111827;}h1{color:#0f172a;}table{width:100%;border-collapse:collapse;margin-top:12px;}th,td{border:1px solid #dbeafe;padding:8px;text-align:left;} .meta{color:#64748b;}</style></head><body><h1>${payload.title}</h1><p class="meta">Generated from the active uploaded dataset.</p><p>${payload.summary}</p><table><thead><tr><th>Item</th><th>Value</th></tr></thead><tbody>${payload.rows.map((row) => `<tr><td>${row.label}</td><td>${row.value}</td></tr>`).join("")}</tbody></table></body></html>`);
        reportWindow.document.close();
        reportWindow.focus();
        reportWindow.print();
      }
      return;
    }

    const content = payload.rows.map((row) => `${row.label},${row.value}`).join("\n");
    const mimeType = kind === "word"
      ? "application/msword"
      : "application/vnd.ms-excel";
    const extension = kind === "word" ? "doc" : "xls";
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeTitle}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderCurrentView = () => {
    if (activeView === "dashboard") {
      return renderDashboardView();
    }

    if (activeView === "crime-map") {
      return (
        <div className="workspace-view">
          <section className="panel compact-panel">
            <div className="panel-header-row compact-panel-header">
              <div>
                <div className="section-kicker">Geographic Intelligence</div>
                <h3>Crime Hotspot Map</h3>
              </div>
            </div>
            <CrimeMap data={firRows} />
          </section>
        </div>
      );
    }

    if (activeView === "crime-analytics") {
      const regionCounts = getTopCounts(workspaceRows, "district", 3);
      const callTypeCounts = getTopCounts(workspaceRows, "crimeType", 3);
      const trendBuckets = workspaceRows.reduce((acc, row) => {
        const month = row.date
          ? new Date(row.date).toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            })
          : "Unknown";
        acc[month] = (acc[month] || 0) + 1;
        return acc;
      }, {});
      const sortedTrend = Object.entries(trendBuckets).sort(
        (a, b) => new Date(a[0]) - new Date(b[0])
      );
      const latest = sortedTrend[sortedTrend.length - 1] || ["Unknown", 0];
      const previous = sortedTrend[sortedTrend.length - 2] || ["Unknown", 0];
      const percentage = previous[1]
        ? Math.round(((latest[1] - previous[1]) / previous[1]) * 100)
        : 0;
      const trend = latest[1] >= previous[1] ? "up" : "down";
      const crimeCategory = callTypeCounts[0]?.label || "Call Activity";
      const districtLabel = regionCounts[0]?.label || "Dataset region";

      return (
        <div className="workspace-view">
          <section className="panel compact-panel">
            <CrimeAnalytics
              data={{
                trendLabel: `${crimeCategory} is the top activity in ${districtLabel}.`, 
                crimeCategory,
                crimeCount: latest[1],
                previousCount: previous[1],
                percentage,
                trend,
                district: districtLabel,
                confidence: Math.min(99, Math.max(65, workspaceRows.length ? Math.round(workspaceRows.length / 150) : 65)),
              }}
            />
          </section>

          <section className="panel compact-panel">
            <div className="panel-header-row compact-panel-header">
              <div>
                <div className="section-kicker">Trend Analysis</div>
                <h3>Top regions and activity</h3>
              </div>
            </div>
            <div style={{ marginTop: "20px", color: "#a0b5c8", lineHeight: "1.8" }}>
              {regionCounts.map((region) => (
                <p key={region.label}>📊 <strong>{region.label}</strong>: {region.count} records</p>
              ))}
              <p style={{ marginTop: "16px", color: "#60a5fa" }}>
                🎯 <strong>AI Recommendation</strong>: Focus analysis on {crimeCategory} patterns and high-volume regions.
              </p>
            </div>
          </section>
        </div>
      );
    }

    if (activeView === "investigation") {
      const datasetAnswer = investigationAnswer || answerDatasetQuestion(investigationInput, firRows);
      return (
        <div className="workspace-view">
          <section className="panel compact-panel">
            <div className="panel-header-row compact-panel-header">
              <div><div className="section-kicker">Investigation Assistant</div><h3>Case intelligence</h3></div>
            </div>
            <p className="panel-copy">Answer questions directly from the active dataset.</p>
            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
              <input value={investigationInput} onChange={(event) => setInvestigationInput(event.target.value)} placeholder="Summarize this case" style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)", background: "#111827", color: "#f8fafc" }} />
              <button type="button" onClick={async () => {
                const question = investigationInput.trim();
                if (!question) {
                  return;
                }

                try {
                  const response = await sendQuery(question);
                  setInvestigationAnswer({
                    title: response.title || "Investigation answer",
                    answer:
                      response.answer || response.summary ||
                      answerDatasetQuestion(question, firRows).answer ||
                      "No matching records found",
                    data: response.data || answerDatasetQuestion(question, firRows).data || [],
                  });
                } catch (error) {
                  const fallback = answerDatasetQuestion(question, firRows);
                  setInvestigationAnswer({
                    title: fallback.title,
                    answer: fallback.answer,
                    data: fallback.data || [],
                  });
                }
              }} style={{ padding: "10px 16px", borderRadius: "10px", border: "none", background: "#2563eb", color: "white", cursor: "pointer" }}>Ask</button>
            </div>
            <div className="summary-card insight-card" style={{ marginTop: "16px" }}>
              <div className="summary-title">{datasetAnswer?.title || "Investigation analysis"}</div>
              <p>{datasetAnswer?.answer || "No matching records found"}</p>
            </div>
            {datasetAnswer?.data?.length ? <div className="table-chart" style={{ marginTop: "12px" }}><table><thead><tr><th>FIR</th><th>District</th><th>Crime</th><th>Status</th></tr></thead><tbody>{datasetAnswer.data.map((row) => <tr key={row.id}><td>{row.firNumber}</td><td>{row.district}</td><td>{row.crimeType}</td><td>{row.status}</td></tr>)}</tbody></table></div> : <p className="panel-copy">No matching records found</p>}
          </section>
        </div>
      );
    }

    if (activeView === "hotspot-prediction") {
      const hotspotModel = buildHotspotModel(firRows);
      return (
        <div className="workspace-view">
          <section className="panel compact-panel">
            <div className="panel-header-row compact-panel-header">
              <div><div className="section-kicker">Crime Hotspot Prediction</div><h3>Risk forecast</h3></div>
            </div>
            <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginTop: "12px" }}>
              <div className="summary-card insight-card"><div className="summary-title">Risk score</div><p>{hotspotModel.topArea?.risk || 0}</p></div>
              <div className="summary-card impact-card"><div className="summary-title">Next month prediction</div><p>{hotspotModel.predictedNextMonth} cases</p></div>
              <div className="summary-card recommendation-card"><div className="summary-title">Crime density</div><p>{hotspotModel.ranked[0]?.count || 0} records</p></div>
            </div>
            <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "1fr 1fr", marginTop: "16px" }}>
              <div className="panel compact-panel" style={{ padding: "16px" }}>
                <div className="section-kicker">Heatmap</div>
                <div style={{ display: "grid", gap: "8px", marginTop: "12px" }}>{hotspotModel.ranked.length ? hotspotModel.ranked.slice(0, 6).map((entry) => <div key={entry.district} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px", borderRadius: "10px", background: `rgba(37,99,235,${0.2 + (entry.count / 20)})` }}><span>{entry.district}</span><strong>{entry.count}</strong></div>) : <p className="panel-copy">No matching records found</p>}</div>
              </div>
              <div className="panel compact-panel" style={{ padding: "16px" }}>
                <div className="section-kicker">Top dangerous areas</div>
                <p className="panel-copy" style={{ marginTop: "8px" }}>{hotspotModel.topArea?.district ? `${hotspotModel.topArea.district} is the highest-risk area with ${hotspotModel.topArea.count} recurring records.` : "No matching records found"}</p>
                <div className="summary-card recommendation-card" style={{ marginTop: "10px" }}><div className="summary-title">Police deployment recommendation</div><p>{hotspotModel.topArea?.district ? `Deploy patrols around ${hotspotModel.topArea.district} and adjacent transit corridors.` : "No matching records found"}</p></div>
              </div>
            </div>
          </section>
          <section className="panel compact-panel"><div className="panel-header-row compact-panel-header"><div><div className="section-kicker">District ranking</div><h3>District order</h3></div></div>{hotspotModel.ranked.length ? <ChartView data={hotspotModel.ranked.map((entry) => ({ name: entry.district, value: entry.count }))} type="bar" title="District ranking" /> : <p className="panel-copy">No matching records found</p>}</section>
          <section className="panel compact-panel"><div className="panel-header-row compact-panel-header"><div><div className="section-kicker">Time heatmap</div><h3>Time trend</h3></div></div>{hotspotModel.ranked.length ? <ChartView data={Object.entries(hotspotModel.trend).map(([name, value]) => ({ name, value }))} type="trend" title="Monthly trend" /> : <p className="panel-copy">No matching records found</p>}</section>
        </div>
      );
    }

    if (activeView === "report-generator") {
      return (
        <div className="workspace-view">
          <section className="panel compact-panel">
            <div className="panel-header-row compact-panel-header">
              <div>
                <div className="section-kicker">Report Generator</div>
                <h3>Executive-ready reporting from the current upload</h3>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <select value={reportType} onChange={(event) => setReportType(event.target.value)} style={{ padding: "8px 10px", borderRadius: "8px", background: "#111827", color: "#f8fafc", border: "1px solid rgba(255,255,255,0.12)" }}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="district">District</option>
                  <option value="crime-type">Crime Type</option>
                  <option value="executive">Executive</option>
                </select>
                <button type="button" className="secondary-action" onClick={() => downloadExport("pdf", { title: `${reportType} report`, summary: reportModel.summary, rows: reportModel.hotspotData.map((item) => ({ label: item.name, value: item.value })) })}>PDF</button>
                <button type="button" className="secondary-action" onClick={() => downloadExport("word", { title: `${reportType} report`, summary: reportModel.summary, rows: reportModel.hotspotData.map((item) => ({ label: item.name, value: item.value })) })}>Word</button>
                <button type="button" className="secondary-action" onClick={() => downloadExport("excel", { title: `${reportType} report`, summary: reportModel.summary, rows: reportModel.hotspotData.map((item) => ({ label: item.name, value: item.value })) })}>Excel</button>
              </div>
            </div>
            <p className="panel-copy">{reportModel.summary}</p>
            <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginTop: "16px" }}>
              {reportModel.cards.map((card) => (
                <div key={card.title} className="summary-card insight-card">
                  <div className="summary-title">{card.title}</div>
                  <p>{card.value}</p>
                  <small>{card.subtitle}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="panel compact-panel">
            <div className="panel-header-row compact-panel-header">
              <div>
                <div className="section-kicker">Crime Trends</div>
                <h3>Volume trend</h3>
              </div>
            </div>
            {reportModel.trendData.length ? <ChartView data={reportModel.trendData} type="trend" title="Trend" /> : <p className="panel-copy">No matching records found</p>}
          </section>

          <section className="panel compact-panel">
            <div className="panel-header-row compact-panel-header">
              <div>
                <div className="section-kicker">Top Hotspots</div>
                <h3>District concentrations</h3>
              </div>
            </div>
            {reportModel.hotspotData.length ? <ChartView data={reportModel.hotspotData} type="bar" title="Hotspots" /> : <p className="panel-copy">No matching records found</p>}
          </section>

          <section className="panel compact-panel">
            <div className="panel-header-row compact-panel-header">
              <div>
                <div className="section-kicker">Crime Comparison</div>
                <h3>Crime-type spread</h3>
              </div>
            </div>
            {reportModel.comparisonData.length ? <ChartView data={reportModel.comparisonData} type="pie" title="Crime comparison" /> : <p className="panel-copy">No matching records found</p>}
          </section>

          <section className="panel compact-panel">
            <div className="panel-header-row compact-panel-header">
              <div>
                <div className="section-kicker">AI Summary</div>
                <h3>Operational recommendation</h3>
              </div>
            </div>
            <div style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
              {reportModel.recommendations.map((item) => (
                <div key={item} className="summary-card impact-card">
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      );
    }

    if (activeView === "patrol-optimization") {
      return (
        <div className="workspace-view">
          <section className="panel compact-panel">
            <div className="panel-header-row compact-panel-header">
              <div>
                <div className="section-kicker">Patrol Optimization</div>
                <h3>Dynamic deployment plan from the uploaded dataset</h3>
              </div>
              <button type="button" className="secondary-action" onClick={() => downloadExport("pdf", { title: "Patrol Plan", summary: patrolPlan.summary, rows: patrolPlan.schedule.map((item) => ({ label: item.district, value: `${item.priority} • ${item.officers} officers • ${item.timing}` })) })}>
                Export Plan
              </button>
            </div>
            <p className="panel-copy">{patrolPlan.summary}</p>
            <div className="summary-card insight-card" style={{ marginTop: "16px" }}>
              <div className="summary-title">Top 10 hotspot districts</div>
              <div style={{ display: "grid", gap: "8px", marginTop: "10px" }}>
                {patrolPlan.districts.length ? patrolPlan.districts.map((district) => (
                  <div key={district.district} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.04)", padding: "8px 10px", borderRadius: "10px" }}>
                    <span>{district.district}</span>
                    <strong>{district.count} records • {district.priority}</strong>
                  </div>
                )) : <p className="panel-copy">No matching records found</p>}
              </div>
            </div>
          </section>

          <section className="panel compact-panel">
            <div className="panel-header-row compact-panel-header">
              <div>
                <div className="section-kicker">Operation Intelligence</div>
                <h3>Patrol priorities and coverage</h3>
              </div>
            </div>
            <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: "14px" }}>
              {patrolPlan.districts.length ? patrolPlan.districts.slice(0, 4).map((district) => (
                <div key={`${district.district}-card`} className="summary-card recommendation-card">
                  <div className="summary-title">{district.district}</div>
                  <p>Priority: {district.priority}</p>
                  <p>Density score: {district.densityScore}</p>
                  <p>Recommended officers: {district.officers}</p>
                  <p>Suggested timings: {district.timing}</p>
                </div>
              )) : <p className="panel-copy">No matching records found</p>}
            </div>
          </section>

          <section className="panel compact-panel">
            <div className="panel-header-row compact-panel-header">
              <div>
                <div className="section-kicker">Heatmap & Interactive Map</div>
                <h3>Live district hotspot map</h3>
              </div>
            </div>
            <CrimeMap data={firRows} />
          </section>

          <section className="panel compact-panel">
            <div className="panel-header-row compact-panel-header">
              <div>
                <div className="section-kicker">AI Recommendations</div>
                <h3>Next actions for the field team</h3>
              </div>
            </div>
            <div style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
              {patrolPlan.recommendations.map((item) => (
                <div key={item} className="summary-card impact-card">
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="panel compact-panel">
            <div className="panel-header-row compact-panel-header">
              <div>
                <div className="section-kicker">Patrol Schedule</div>
                <h3>Shift deployment view</h3>
              </div>
            </div>
            {patrolPlan.schedule.length ? (
              <div className="table-chart" style={{ marginTop: "12px" }}>
                <table>
                  <thead>
                    <tr>
                      <th>District</th>
                      <th>Priority</th>
                      <th>Density score</th>
                      <th>Officers</th>
                      <th>Timing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patrolPlan.schedule.map((item) => (
                      <tr key={item.district}>
                        <td>{item.district}</td>
                        <td>{item.priority}</td>
                        <td>{item.densityScore}</td>
                        <td>{item.officers}</td>
                        <td>{item.timing}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="panel-copy">No matching records found</p>
            )}
          </section>
        </div>
      );
    }

    if (activeView === "data-sources") {
      return renderDataSourcesView();
    }

    return renderHistoryView();
  };

  return (
    <>
      <AppLayout
        sidebar={(
          <WorkspaceSidebar
            activeView={activeView}
            sections={NAV_SECTIONS}
            onSelectView={setActiveView}
            sidebarOpen={sidebarOpen}
            onToggle={() => setSidebarOpen((previous) => !previous)}
          />
        )}
        topbar={(
          <TopNavigation
            title={pageMeta.title}
            description={pageMeta.description}
            workspace={activeWorkspace}
            modeLabel={workspaceMode}
            freshnessLabel={workspaceFreshness}
            datasetMeta={summarizeDataset(activeWorkspace)}
            datasetOptions={datasetOptions}
            activeDatasetId={activeWorkspaceId}
            onDatasetChange={handleSwitchDataset}
          />
        )}
      >
        {datasetError ? <div className="banner-error">{datasetError}</div> : null}
        {workspaceNotice ? (
          <div className={`banner-note banner-tone-${workspaceNotice.tone}`}>
            {workspaceNotice.text}
          </div>
        ) : null}
        {datasetLoading ? (
          <div className="panel workspace-loading-panel">Loading workspace...</div>
        ) : renderCurrentView()}
      </AppLayout>

      <SlideDrawer
        open={Boolean(detailDrawer)}
        title={detailDrawer?.title || "Chart Details"}
        subtitle={activeResponse?.title || "Active analysis context"}
        onClose={() => setDetailDrawer(null)}
      >
        <ExecutiveCard title="AI Explanation">
          {activeResponse?.answer ||
            "Ask a question to populate an AI explanation here."}
        </ExecutiveCard>
        <BusinessImpactCard>
          {copilot?.businessImpact ||
            "Business impact will appear here once the analysis provides it."}
        </BusinessImpactCard>
        <RecommendationCard
          title="Recommendations"
          items={
            copilot?.recommendedActions?.length
              ? copilot.recommendedActions
              : flattenRecommendations(summaryCards)
          }
        />
        <div className="sidebar-card compact-sidebar-card">
          <div className="section-kicker">Export and Share</div>
          <ExportMenu onAction={handleWorkspaceAction} />
        </div>
      </SlideDrawer>

      <SlideDrawer
        open={Boolean(selectedSource)}
        title={selectedSource?.label || "Data Source"}
        subtitle={selectedSource?.description || ""}
        onClose={() => setSourceDrawer(null)}
      >
        {selectedSource?.category === "file" ? (
          <div className="drawer-stack">
            <div className="sidebar-card compact-sidebar-card">
              <div className="section-kicker">Flat File Ingestion</div>
              <h4>Upload a {selectedSource.label} file</h4>
              <p className="copilot-copy">
                Use the existing upload endpoint without changing backend logic. The drawer keeps file ingestion off the main dashboard.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={selectedSource.fileAccept}
                className="hidden-input"
                onChange={handleUploadSelection}
              />
              <div className="connector-form-actions">
                <button
                  type="button"
                  className="primary-action"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload size={16} />
                  {uploading ? "Uploading..." : `Upload ${selectedSource.label}`}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {selectedConnector ? (
          <div className="drawer-stack">
            <div className="sidebar-card ingestion-preview-card compact-sidebar-card">
              <div className="preview-header">
                <div className="preview-label">Connector Preview</div>
                <div className="preview-pill">
                  <Shield size={14} />
                  <span>{selectedConnector.preview.governance}</span>
                </div>
              </div>
              <h4>{selectedConnector.preview.headline}</h4>
              <p className="copilot-copy">{selectedConnector.preview.summary}</p>
              <div className="preview-metric-grid">
                {selectedConnector.preview.metrics.map((metric) => (
                  <div key={metric.label} className="preview-metric-card">
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                  </div>
                ))}
              </div>
            </div>

            {selectedConnector.formSections.map((section) => (
              <div key={section.title} className="connector-form-section compact-form-section">
                <div className="form-section-label">{section.title}</div>
                <div className="connector-form-grid">
                  {section.fields
                    .filter((field) => {
                      // Hide advanced fields by default for Splunk
                      const advancedFieldNames = ["sourceType", "timeRange", "refresh", "loadStrategy", "search"];

                      if (selectedConnector.id === "splunk" && advancedFieldNames.includes(field.name) && !advancedOpen) {
                        return false;
                      }

                      return true;
                    })
                    .map((field) => (
                      <label
                        key={`${selectedConnector.id}-${field.name}`}
                        className={field.grid === "wide" ? "field-block wide" : "field-block"}
                      >
                        <span>{field.label}</span>
                        {field.type === "select" ? (
                          <select
                            value={selectedConnectorForm[field.name] || ""}
                            onChange={(event) =>
                              handleConnectorFieldChange(
                                selectedConnector.id,
                                field.name,
                                event.target.value
                              )
                            }
                          >
                            {(field.options || []).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : field.type === "textarea" ? (
                          <textarea
                            rows={4}
                            value={selectedConnectorForm[field.name] || ""}
                            placeholder={field.placeholder}
                            onChange={(event) =>
                              handleConnectorFieldChange(
                                selectedConnector.id,
                                field.name,
                                event.target.value
                              )
                            }
                          />
                        ) : (
                          <input
                            type={field.type || "text"}
                            value={selectedConnectorForm[field.name] || ""}
                            placeholder={field.placeholder}
                            onChange={(event) =>
                              handleConnectorFieldChange(
                                selectedConnector.id,
                                field.name,
                                event.target.value
                              )
                            }
                          />
                        )}
                      </label>
                    ))}
                </div>
              </div>
            ))}

            {selectedConnector.id === "splunk" && (
              <div className="connector-advanced">
                <button type="button" className="link-action" onClick={() => setAdvancedOpen((v) => !v)}>
                  {advancedOpen ? "Hide Advanced Settings" : "Advanced Settings"}
                </button>

                {advancedOpen && (
                  <div className="advanced-panel rounded-card">
                    <div className="section-kicker">Advanced Settings</div>
                    <div className="connector-form-grid">
                      {selectedConnector.formSections
                        .flatMap((s) => s.fields)
                        .filter((f) => ["sourceType", "timeRange", "refresh", "loadStrategy", "search"].includes(f.name))
                        .map((field) => (
                          <label key={`adv-${field.name}`} className={field.grid === "wide" ? "field-block wide" : "field-block"}>
                            <span>{field.label}</span>
                            {field.type === "select" ? (
                              <select
                                value={selectedConnectorForm[field.name] || ""}
                                onChange={(event) =>
                                  handleConnectorFieldChange(selectedConnector.id, field.name, event.target.value)
                                }
                              >
                                {(field.options || []).map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type={field.type || "text"}
                                value={selectedConnectorForm[field.name] || ""}
                                placeholder={field.placeholder}
                                onChange={(event) =>
                                  handleConnectorFieldChange(selectedConnector.id, field.name, event.target.value)
                                }
                              />
                            )}
                          </label>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="connector-form-actions">
              <button
                type="button"
                className="primary-action"
                onClick={() => handleStartIngestion(selectedConnector.id)}
                disabled={ingesting}
              >
                <ArrowRight size={16} />
                {ingesting ? (
                  <>
                    <RefreshCw size={14} style={{ marginRight: 8 }} />
                    Connecting...
                  </>
                ) : (
                  `Connect & Import`
                )}
              </button>
            </div>
          </div>
        ) : null}

        {selectedSource && !selectedSource.supported && !selectedConnector ? (
          <div className="sidebar-card compact-sidebar-card">
            <div className="section-kicker">Connector Roadmap</div>
            <h4>{selectedSource.label} is prepared as a workspace slot</h4>
            <p className="copilot-copy">
              The UI drawer is ready, but this connector is intentionally left in preview mode so we preserve your current backend contract. When the backend adapter is ready, this drawer can host the live form without changing the overall workspace layout.
            </p>
          </div>
        ) : null}
      </SlideDrawer>
    </>
  );
}
