export default function ConnectorCard({
  label,
  description,
  badge,
  meta = [],
  icon,
  toneClass = "",
  active = false,
  onClick,
}) {
  return (
    <button
      type="button"
      className={active ? "connector-card selected" : "connector-card"}
      onClick={onClick}
    >
      <div className="connector-card-top">
        <span className={toneClass ? `connector-icon ${toneClass}` : "connector-icon"}>
          {icon}
        </span>
        <span className="connector-badge">{badge}</span>
      </div>
      <strong>{label}</strong>
      <p>{description}</p>
      <div className="connector-card-foot">
        {meta.map((item) => (
          <span key={`${label}-${item}`}>{item}</span>
        ))}
      </div>
    </button>
  );
}
