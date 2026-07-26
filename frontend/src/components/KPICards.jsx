export default function KPICards({ cards = [] }) {
  if (!cards.length) {
    return null;
  }

  return (
    <div className="kpi-grid">
      {cards.map((card) => (
        <div key={card.title} className={`kpi-card kpi-tone-${card.tone || "blue"}`}>
          <span className="kpi-accent" aria-hidden="true" />
          <div className="kpi-top">
            <div className="kpi-icon">{card.icon}</div>
            <div className="kpi-trend">{card.trend || "▲ Stable"}</div>
          </div>
          <div className="kpi-body">
            <div className="kpi-title">{card.title}</div>
            <div className="kpi-metric-row">
              <div className="kpi-value">{card.value}</div>
              <div className="kpi-subtitle">{card.subtitle}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
