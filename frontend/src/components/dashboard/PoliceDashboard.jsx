import { useEffect, useMemo, useState } from "react";
import ChartView from "../ChartView";
import CrimeMap from "../CrimeMap";
import "./PoliceDashboard.css";

const STATUS_GROUPS = [
  { label: "Open", token: "open" },
  { label: "Closed", token: "closed" },
  { label: "Evidence Collected", token: "evidence collected" },
  { label: "Charge Sheet Filed", token: "charge sheet filed" },
  { label: "Under Investigation", token: "under investigation" },
];

const SEVERITY_GROUPS = [
  { label: "Critical", token: "critical" },
  { label: "High", token: "high" },
  { label: "Medium", token: "medium" },
  { label: "Low", token: "low" },
];

const FIELD_ALIASES = {
  firId: [
    "firNumber",
    "fir_id",
    "fir_no",
    "caseNumber",
    "case_no",
    "caseId",
    "case_id",
    "incidentId",
    "incident_id",
    "id",
    "record_id",
    "uuid",
  ],
  district: ["district", "districtName", "area", "locationDistrict", "region", "city", "zone"],
  crimeType: [
    "crimeType",
    "crime_type",
    "crime",
    "category",
    "offenseType",
    "offense_type",
    "incidentType",
    "eventType",
  ],
  status: ["status", "caseStatus", "firStatus", "outcome", "case_state"],
  severity: ["severity", "priority", "riskLevel", "risk_level"],
  evidenceType: ["evidenceType", "evidence_type", "evidence", "proof_type", "proofType"],
  aiRiskScore: ["aiRiskScore", "ai_risk_score", "riskScore", "risk_score", "ai_score", "aiScore"],
  suspectId: ["suspectId", "suspect_id", "suspectID", "suspectid", "accusedId", "accused_id"],
  policeStation: ["policeStation", "police_station", "station", "precinct"],
  latitude: ["latitude", "lat", "gps_latitude", "y"],
  longitude: ["longitude", "lng", "lon", "gps_longitude", "x"],
  date: ["date", "incidentDate", "reportedAt", "createdAt", "timestamp", "occurredAt", "start_time", "end_time"],
};

function normalizeLabel(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function normalizeToken(value) {
  return normalizeLabel(value)
    .toLowerCase()
    .replace(/\s+/g, " ");
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

function readValue(row, aliases = [], fallbackKeys = []) {
  const sourceValue = pickValue(row?.source, aliases);
  if (sourceValue !== "") {
    return sourceValue;
  }

  for (const key of fallbackKeys) {
    const fallbackValue = row?.[key];
    if (
      fallbackValue !== undefined &&
      fallbackValue !== null &&
      String(fallbackValue).trim() !== ""
    ) {
      return fallbackValue;
    }
  }

  return "";
}

function parseNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const cleaned = String(value ?? "")
    .replace(/,/g, "")
    .trim();

  if (!cleaned) {
    return null;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateSortValue(value, fallbackIndex) {
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.getTime();
  }

  return fallbackIndex;
}

function formatInteger(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function formatRiskScore(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }

  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

function countByField(rows = [], field) {
  const counts = rows.reduce((acc, row) => {
    const label = normalizeLabel(row?.[field]);
    if (!label) {
      return acc;
    }

    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value);
}

function collapseSeries(series = [], limit = 6) {
  if (series.length <= limit) {
    return series;
  }

  const visible = series.slice(0, limit - 1);
  const othersTotal = series
    .slice(limit - 1)
    .reduce((sum, item) => sum + Number(item?.value || 0), 0);

  return [...visible, { name: "Others", value: othersTotal }];
}

function buildCanonicalRows(rows = []) {
  return rows.map((row, index) => {
    const firId =
      normalizeLabel(readValue(row, FIELD_ALIASES.firId, ["firNumber", "id"])) ||
      row?.firNumber ||
      `FIR-${index + 1}`;
    const district = normalizeLabel(readValue(row, FIELD_ALIASES.district, ["district"]));
    const crimeType = normalizeLabel(readValue(row, FIELD_ALIASES.crimeType, ["crimeType"]));
    const status = normalizeLabel(readValue(row, FIELD_ALIASES.status, ["status"]));
    const severity = normalizeLabel(readValue(row, FIELD_ALIASES.severity, ["severity"]));
    const evidenceType = normalizeLabel(
      readValue(row, FIELD_ALIASES.evidenceType, ["evidenceType"])
    );
    const suspectId = normalizeLabel(readValue(row, FIELD_ALIASES.suspectId, ["suspectId"]));
    const policeStation = normalizeLabel(
      readValue(row, FIELD_ALIASES.policeStation, ["policeStation"])
    );
    const latitude = parseNumber(readValue(row, FIELD_ALIASES.latitude, ["latitude"]));
    const longitude = parseNumber(readValue(row, FIELD_ALIASES.longitude, ["longitude"]));
    const aiRiskScore = parseNumber(
      readValue(row, FIELD_ALIASES.aiRiskScore, ["aiRiskScore"])
    );
    const dateValue = normalizeLabel(readValue(row, FIELD_ALIASES.date, ["date"]));

    return {
      ...row,
      firId,
      district,
      crimeType,
      status,
      severity,
      evidenceType,
      suspectId,
      policeStation,
      latitude,
      longitude,
      aiRiskScore,
      dateValue,
      sortValue: parseDateSortValue(dateValue, index),
    };
  });
}

function createKpiItems(records = [], availability = {}) {
  const totalFirs = records.length;
  const underInvestigation = records.filter(
    (row) => normalizeToken(row.status) === "under investigation"
  ).length;
  const districtCount = new Set(
    records.map((row) => normalizeLabel(row.district)).filter(Boolean)
  ).size;
  const evidenceCount = new Set(
    records.map((row) => normalizeLabel(row.evidenceType)).filter(Boolean)
  ).size;

  return [
    {
      id: "total-firs",
      label: "Total FIRs",
      value: totalFirs,
      subtitle: "Total uploaded rows",
      tone: "primary",
    },
    availability.hasStatus
      ? {
          id: "under-investigation",
          label: "Under Investigation",
          value: underInvestigation,
          subtitle: "Live active investigations",
          tone: "accent",
        }
      : null,
    availability.hasDistrict
      ? {
          id: "districts",
          label: "Police Districts",
          value: districtCount,
          subtitle: "Unique districts covered",
          tone: "primary",
        }
      : null,
    availability.hasEvidenceType
      ? {
          id: "evidence-types",
          label: "Evidence Types",
          value: evidenceCount,
          subtitle: "Unique evidence categories",
          tone: "accent",
        }
      : null,
  ].filter(Boolean);
}

function buildInsights(records = [], availability = {}, hotspotSeries = [], crimeTypeSeries = []) {
  const insights = [];

  if (availability.hasDistrict && hotspotSeries.length) {
    const topDistrict = hotspotSeries[0];
    insights.push({
      id: "highest-crime-district",
      title: "Highest Crime District",
      value: topDistrict.name,
      meta: `${formatInteger(topDistrict.value)} cases`,
      tone: "danger",
    });
  }

  if (availability.hasCrimeType && crimeTypeSeries.length) {
    const topCrime = crimeTypeSeries[0];
    insights.push({
      id: "most-common-crime",
      title: "Most Common Crime",
      value: topCrime.name,
      meta: `${formatInteger(topCrime.value)} FIRs`,
      tone: "accent",
    });
  }

  if (availability.hasRisk) {
    const riskRows = records.filter((row) => Number.isFinite(row.aiRiskScore));
    if (riskRows.length) {
      const averageRisk =
        riskRows.reduce((sum, row) => sum + Number(row.aiRiskScore || 0), 0) /
        riskRows.length;
      const highestRiskCase = [...riskRows].sort(
        (left, right) =>
          Number(right.aiRiskScore || 0) - Number(left.aiRiskScore || 0) ||
          right.sortValue - left.sortValue
      )[0];

      insights.push({
        id: "average-ai-risk",
        title: "Average AI Risk Score",
        value: formatRiskScore(averageRisk),
        meta: `${riskRows.length} scored FIRs`,
        tone: "primary",
      });

      if (highestRiskCase) {
        const metaParts = [
          `${formatRiskScore(highestRiskCase.aiRiskScore)} AI risk`,
          highestRiskCase.district,
          highestRiskCase.status,
        ].filter(Boolean);

        insights.push({
          id: "highest-ai-risk-case",
          title: "Highest AI Risk Case",
          value: highestRiskCase.firId,
          meta: metaParts.join(" | "),
          tone: "danger",
        });
      }
    }
  }

  if (availability.hasEvidenceType) {
    const evidenceSeries = countByField(records, "evidenceType");
    if (evidenceSeries.length) {
      const topEvidence = evidenceSeries[0];
      insights.push({
        id: "common-evidence",
        title: "Most Common Evidence Type",
        value: topEvidence.name,
        meta: `${formatInteger(topEvidence.value)} linked FIRs`,
        tone: "success",
      });
    }
  }

  if (availability.hasSeverity) {
    const criticalCount = records.filter(
      (row) => normalizeToken(row.severity) === "critical"
    ).length;
    insights.push({
      id: "critical-crime-count",
      title: "Critical Crime Count",
      value: formatInteger(criticalCount),
      meta: "Severity marked Critical",
      tone: "danger",
    });
  }

  if (availability.hasSuspectId) {
    const suspectCounts = records.reduce((acc, row) => {
      const suspectId = normalizeLabel(row.suspectId);
      if (!suspectId) {
        return acc;
      }

      acc[suspectId] = (acc[suspectId] || 0) + 1;
      return acc;
    }, {});

    const repeated = Object.entries(suspectCounts).filter(([, count]) => count > 1);
    const repeatedCases = repeated.reduce((sum, [, count]) => sum + count, 0);

    insights.push({
      id: "repeat-suspects",
      title: "Repeat Suspects",
      value: formatInteger(repeated.length),
      meta: repeated.length
        ? `${formatInteger(repeatedCases)} FIRs share duplicate Suspect_ID values`
        : "No duplicate Suspect_ID values detected",
      tone: repeated.length ? "warning" : "primary",
    });
  }

  return insights;
}

function buildDashboardModel(rows = []) {
  const records = buildCanonicalRows(rows);
  const availability = {
    hasDistrict: records.some((row) => normalizeLabel(row.district)),
    hasCrimeType: records.some((row) => normalizeLabel(row.crimeType)),
    hasStatus: records.some((row) => normalizeLabel(row.status)),
    hasSeverity: records.some((row) => normalizeLabel(row.severity)),
    hasEvidenceType: records.some((row) => normalizeLabel(row.evidenceType)),
    hasRisk: records.some((row) => Number.isFinite(row.aiRiskScore)),
    hasSuspectId: records.some((row) => normalizeLabel(row.suspectId)),
    hasCoordinates: records.some(
      (row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude)
    ),
  };

  const hotspotSeries = availability.hasDistrict
    ? countByField(records, "district").slice(0, 5)
    : [];
  const crimeTypeSeries = availability.hasCrimeType
    ? collapseSeries(countByField(records, "crimeType"), 6)
    : [];
  const severitySeries = availability.hasSeverity
    ? SEVERITY_GROUPS.map((group) => ({
        name: group.label,
        value: records.filter((row) => normalizeToken(row.severity) === group.token).length,
      }))
    : [];
  const statusSeries = availability.hasStatus
    ? STATUS_GROUPS.map((group) => ({
        name: group.label,
        value: records.filter((row) => normalizeToken(row.status) === group.token).length,
      }))
    : [];

  const mapRows = availability.hasCoordinates
    ? records
        .filter(
          (row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude)
        )
        .map((row) => ({
          ...row,
          district: row.district || row.policeStation || row.firId,
        }))
    : [];

  const highRiskCases = availability.hasRisk
    ? records
        .filter((row) => Number(row.aiRiskScore) >= 80)
        .sort(
          (left, right) =>
            right.sortValue - left.sortValue ||
            Number(right.aiRiskScore || 0) - Number(left.aiRiskScore || 0)
        )
        .slice(0, 5)
    : [];

  return {
    kpiItems: createKpiItems(records, availability),
    hotspotSeries,
    crimeTypeSeries,
    severitySeries,
    statusSeries,
    insights: buildInsights(records, availability, hotspotSeries, crimeTypeSeries),
    highRiskCases,
    availability,
    mapRows,
  };
}

function AnimatedMetric({ value }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const numericTarget = Number(value || 0);
    const duration = 700;
    const steps = 24;
    const stepValue = numericTarget / steps;
    let frame = 0;

    const interval = setInterval(() => {
      frame += 1;

      if (frame >= steps) {
        setDisplayValue(numericTarget);
        clearInterval(interval);
        return;
      }

      setDisplayValue(Math.round(stepValue * frame));
    }, duration / steps);

    return () => clearInterval(interval);
  }, [value]);

  return <span>{formatInteger(displayValue)}</span>;
}

function HotspotRankingList({ hotspots = [] }) {
  return (
    <div className="police-hotspot-list">
      {hotspots.map((hotspot, index) => (
        <div key={hotspot.name} className="police-hotspot-item">
          <div className="police-hotspot-rank">{index + 1}</div>
          <div className="police-hotspot-copy">
            <strong>{hotspot.name}</strong>
            <span>{formatInteger(hotspot.value)} cases</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PoliceDashboard({ rows = [] }) {
  const dashboardModel = useMemo(() => buildDashboardModel(rows), [rows]);
  const repeatSuspectsInsight = dashboardModel.insights.find(
    (insight) => insight.id === "repeat-suspects"
  );
  const insightCards = dashboardModel.insights.filter(
    (insight) => insight.id !== "repeat-suspects"
  );

  return (
    <div className="workspace-view dashboard-view police-dashboard-shell">
      {dashboardModel.kpiItems.length ? (
        <div className="police-kpi-grid">
          {dashboardModel.kpiItems.map((item) => (
            <article
              key={item.id}
              className={`police-kpi-card police-kpi-card-${item.tone || "primary"}`}
            >
              <div className="police-kpi-label">{item.label}</div>
              <div className="police-kpi-value">
                <AnimatedMetric value={item.value} />
              </div>
              <div className="police-kpi-subtitle">{item.subtitle}</div>
            </article>
          ))}
        </div>
      ) : null}

      {dashboardModel.crimeTypeSeries.length ||
      dashboardModel.severitySeries.length ||
      dashboardModel.statusSeries.length ? (
        <div className="police-dashboard-chart-grid">
          {dashboardModel.crimeTypeSeries.length ? (
            <section className="panel compact-panel police-dashboard-panel">
              <div className="panel-header-row compact-panel-header">
                <div>
                  <div className="section-kicker">Crime Type Mix</div>
                  <h3>Crime Type Distribution</h3>
                </div>
              </div>
              <ChartView
                data={dashboardModel.crimeTypeSeries}
                type="pie"
                title="Crime type share"
                showExplain={false}
                showDrillDown={false}
                showExport={false}
                showShare={false}
              />
            </section>
          ) : null}

          {dashboardModel.severitySeries.length ? (
            <section className="panel compact-panel police-dashboard-panel">
              <div className="panel-header-row compact-panel-header">
                <div>
                  <div className="section-kicker">Severity Profile</div>
                  <h3>Severity Breakdown</h3>
                </div>
              </div>
              <ChartView
                data={dashboardModel.severitySeries}
                type="bar"
                title="Severity count"
                showExplain={false}
                showDrillDown={false}
                showExport={false}
                showShare={false}
              />
            </section>
          ) : null}

          {dashboardModel.statusSeries.length ? (
            <section className="panel compact-panel police-dashboard-panel">
              <div className="panel-header-row compact-panel-header">
                <div>
                  <div className="section-kicker">Case Flow</div>
                  <h3>Status Distribution</h3>
                </div>
              </div>
              <ChartView
                data={dashboardModel.statusSeries}
                type="pie"
                insightType="donut"
                title="Case status mix"
                showExplain={false}
                showDrillDown={false}
                showExport={false}
                showShare={false}
              />
            </section>
          ) : null}
        </div>
      ) : null}

      {dashboardModel.hotspotSeries.length || insightCards.length ? (
        <div className="police-dashboard-hero-grid">
          {dashboardModel.hotspotSeries.length ? (
            <section className="panel compact-panel police-dashboard-panel">
              <div className="panel-header-row compact-panel-header">
                <div>
                  <div className="section-kicker">Geographic Intelligence</div>
                  <h3>Crime Hotspot Analysis</h3>
                </div>
              </div>
              {dashboardModel.availability.hasCoordinates ? (
                <CrimeMap data={dashboardModel.mapRows} />
              ) : (
                <div className="police-ranking-only">
                  <HotspotRankingList hotspots={dashboardModel.hotspotSeries} />
                </div>
              )}
            </section>
          ) : null}

          {insightCards.length ? (
            <section className="panel compact-panel police-dashboard-panel">
              <div className="panel-header-row compact-panel-header">
                <div>
                  <div className="section-kicker">AI Insights</div>
                  <h3>Uploaded dataset findings</h3>
                </div>
              </div>
              <div className="police-insights-grid">
                {insightCards.map((insight) => (
                  <article
                    key={insight.id}
                    className={`police-insight-card police-insight-card-${insight.tone || "primary"}`}
                  >
                    <div className="police-insight-title">{insight.title}</div>
                    <div className="police-insight-value">{insight.value}</div>
                    <div className="police-insight-meta">{insight.meta}</div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      <div className="police-dashboard-secondary-grid">
        {dashboardModel.hotspotSeries.length ? (
          <section className="panel compact-panel police-dashboard-panel">
            <div className="panel-header-row compact-panel-header">
              <div>
                <div className="section-kicker">Hotspot Ranking</div>
                <h3>Top 5 Hotspot Districts</h3>
              </div>
            </div>
            <HotspotRankingList hotspots={dashboardModel.hotspotSeries.slice(0, 5)} />
          </section>
        ) : null}

        {repeatSuspectsInsight ? (
          <section className="panel compact-panel police-dashboard-panel">
            <div className="panel-header-row compact-panel-header">
              <div>
                <div className="section-kicker">Pattern Signals</div>
                <h3>Repeat Suspects</h3>
              </div>
            </div>
            <div className="police-repeat-suspects">
              <div className="police-insight-value">{repeatSuspectsInsight.value}</div>
              <div className="police-insight-meta">{repeatSuspectsInsight.meta}</div>
            </div>
          </section>
        ) : null}
      </div>

      {dashboardModel.availability.hasRisk ? (
        <section className="panel compact-panel police-dashboard-panel">
          <div className="panel-header-row compact-panel-header">
            <div>
              <div className="section-kicker">Recent Risk Alerts</div>
              <h3>Latest High Risk Cases</h3>
            </div>
          </div>
          {dashboardModel.highRiskCases.length ? (
            <div className="table-chart police-risk-table">
              <table>
                <thead>
                  <tr>
                    <th>FIR ID</th>
                    <th>District</th>
                    <th>Crime Type</th>
                    <th>Severity</th>
                    <th>AI Risk</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardModel.highRiskCases.map((row) => (
                    <tr key={`${row.firId}-${row.sortValue}`}>
                      <td>{row.firId}</td>
                      <td>{row.district || "-"}</td>
                      <td>{row.crimeType || "-"}</td>
                      <td>{row.severity || "-"}</td>
                      <td>{formatRiskScore(row.aiRiskScore)}</td>
                      <td>{row.status || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="police-info-note">
              No FIRs currently meet the AI risk threshold of 80 in the active uploaded dataset.
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
