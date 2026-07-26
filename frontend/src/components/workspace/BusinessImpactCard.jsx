export default function BusinessImpactCard({ title = "Business Impact", children }) {
  return (
    <div className="sidebar-card business-impact-card">
      <div className="section-kicker">Business Impact</div>
      <h4>{title}</h4>
      <p className="copilot-copy">{children}</p>
    </div>
  );
}
