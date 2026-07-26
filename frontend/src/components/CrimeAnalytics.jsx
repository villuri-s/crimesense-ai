import { TrendingUp, AlertCircle, BarChart3 } from "lucide-react";
import "./CrimeAnalytics.css";

export default function CrimeAnalytics({ data = {} }) {
  const {
    trendLabel = "Top call type volume has increased in the latest period.",
    crimeCategory = "Top activity",
    crimeCount = 78,
    previousCount = 64,
    percentage = 22,
    trend = "up",
    district = "Top region",
    confidence = 94,
  } = data;

  const trendIcon = trend === "up"
    ? <TrendingUp size={18} color="#ef4444" />
    : <TrendingUp size={18} color="#10b981" style={{ transform: "rotate(180deg)" }} />;

  const trendColor = trend === "up" ? "#ef4444" : "#10b981";
  const trendText = trend === "up" ? "INCREASING" : "DECREASING";

  return (
    <div className="crime-analytics-container">
      <div className="analytics-header">
        <div className="analytics-title">
          <h3>{crimeCategory} Analysis</h3>
          <p className="analytics-subtitle">{district}</p>
        </div>
        <div className="analytics-meta">
          <div className="confidence-badge">
            <span>🤖 AI Confidence</span>
            <strong>{confidence}%</strong>
          </div>
        </div>
      </div>

      <div className="analytics-grid">
        <div className="analytics-card primary-card">
          <div className="card-header">
            <span className="card-label">Current Period Count</span>
            <span className={`trend-badge trend-${trend}`}>{trendText}</span>
          </div>
          <div className="card-value">
            <span className="large-number">{crimeCount}</span>
            <div className="card-subtitle">
              {trendIcon}
              <span style={{ color: trendColor }}>
                {trend === "up" ? "+" : ""}{percentage}% from {previousCount}
              </span>
            </div>
          </div>
        </div>

        <div className="analytics-card insight-card">
          <div className="card-header">
            <span className="card-label">🔍 AI Insight</span>
          </div>
          <p className="insight-text">
            {trendLabel}
          </p>
          <div className="insight-meta">
            <span>✓ Pattern Detected</span>
            <span>→ Actionable Trend</span>
          </div>
        </div>

        <div className="analytics-card recommendation-card">
          <div className="card-header">
            <span className="card-label">📋 Recommendation</span>
          </div>
          <ul className="recommendation-list">
            <li>Monitor high-volume activity clusters.</li>
            <li>Investigate records with repeated sources or towers.</li>
            <li>Review anomalous status patterns for failures.</li>
            <li>Validate regional load and resource allocation.</li>
          </ul>
        </div>
      </div>

      <div className="analytics-footer">
        <div className="footer-item">
          <span className="footer-label">Data Quality</span>
          <div className="quality-bar">
            <div className="quality-fill" style={{ width: "92%" }}></div>
          </div>
          <span className="quality-percent">92%</span>
        </div>
        <div className="footer-item">
          <span className="footer-label">Latest Update</span>
          <span className="update-time">Live dataset</span>
        </div>
        <div className="footer-item">
          <span className="footer-label">Data Points</span>
          <span className="data-count">{crimeCount} records</span>
        </div>
      </div>
    </div>
  );
}
