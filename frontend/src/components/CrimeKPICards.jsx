import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, AlertCircle, Shield } from "lucide-react";
import "./CrimeKPICards.css";

function AnimatedCounter({ value, label, trend, unit = "", alertLevel = "normal" }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const stepValue = value / steps;
    let currentStep = 0;

    const interval = setInterval(() => {
      if (currentStep < steps) {
        currentStep++;
        setDisplayValue(Math.floor(stepValue * currentStep));
      } else {
        setDisplayValue(value);
        clearInterval(interval);
      }
    }, duration / steps);

    return () => clearInterval(interval);
  }, [value]);

  const trendIcon = trend > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />;
  const trendColor = trend > 0 ? "#ef4444" : "#22c55e";
  const alertIcon = alertLevel === "high" ? <AlertCircle size={16} /> : null;

  const cardClass = `kpi-card kpi-card-${alertLevel}`;

  return (
    <div className={cardClass}>
      <div className="kpi-header">
        <h3 className="kpi-label">{label}</h3>
        {alertIcon && <span className="kpi-alert">{alertIcon}</span>}
      </div>
      <div className="kpi-value-container">
        <span className="kpi-value">
          {displayValue.toLocaleString()}{unit}
        </span>
        {trend !== undefined && (
          <span className="kpi-trend" style={{ color: trendColor }}>
            {trendIcon}
            <span>{Math.abs(trend)}%</span>
          </span>
        )}
      </div>
      <div className="kpi-bar">
        <div className="kpi-fill"></div>
      </div>
    </div>
  );
}

export default function CrimeKPICards({ data = {} }) {
  const {
    totalRecords = 0,
    completedCalls = 0,
    failedCalls = 0,
    dataCalls = 0,
    voiceCalls = 0,
    smsCalls = 0,
    regions = 0,
    highCostRecords = 0,
  } = data;

  return (
    <div className="crime-kpi-grid">
      <AnimatedCounter
        value={totalRecords}
        label="Total Records"
        trend={totalRecords ? 10 : 0}
        alertLevel="high"
      />
      <AnimatedCounter
        value={completedCalls}
        label="Completed Records"
        trend={completedCalls ? 5 : 0}
        alertLevel="normal"
      />
      <AnimatedCounter
        value={failedCalls}
        label="Failed Records"
        trend={failedCalls ? -5 : 0}
        alertLevel={failedCalls > 0 ? "high" : "normal"}
      />
      <AnimatedCounter
        value={dataCalls}
        label="Data Sessions"
        trend={dataCalls ? 4 : 0}
        alertLevel="normal"
      />
      <AnimatedCounter
        value={voiceCalls}
        label="Voice Sessions"
        trend={voiceCalls ? 2 : 0}
        alertLevel="normal"
      />
      <AnimatedCounter
        value={smsCalls}
        label="SMS Sessions"
        trend={smsCalls ? 1 : 0}
        alertLevel="normal"
      />
      <AnimatedCounter
        value={regions}
        label="Regions"
        trend={regions ? 8 : 0}
        alertLevel="normal"
      />
      <AnimatedCounter
        value={highCostRecords}
        label="High Cost Records"
        trend={highCostRecords ? 6 : 0}
        alertLevel={highCostRecords > 0 ? "high" : "normal"}
      />
    </div>
  );
}
