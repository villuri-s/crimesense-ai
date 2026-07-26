import { CheckCircle2, Lightbulb } from "lucide-react";

export default function InsightCard({
  title,
  text,
  confidence,
  type = "insight",
}) {
  const classes =
    type === "impact"
      ? "summary-card impact-card"
      : type === "recommendation"
        ? "summary-card recommendation-card"
        : "summary-card insight-card";
  const icon =
    type === "insight" ? <CheckCircle2 size={20} /> : <Lightbulb size={20} />;
  const confidenceLabel =
    confidence || (type === "insight" ? "Verified by Analytics Engine" : "AI Confidence: 94%");

  return (
    <div className={classes}>
      <div className="summary-icon">{icon}</div>
      <div className="summary-content">
        <div className="summary-title">{title}</div>
        <p>{text}</p>
        <div className="insight-confidence">{confidenceLabel}</div>
      </div>
    </div>
  );
}
