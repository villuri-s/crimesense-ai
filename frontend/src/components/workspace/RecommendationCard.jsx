export default function RecommendationCard({
  title = "Recommendations",
  items = [],
}) {
  return (
    <div className="sidebar-card recommendation-list-card">
      <div className="section-kicker">Recommended Actions</div>
      <h4>{title}</h4>
      <ul className="copilot-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
