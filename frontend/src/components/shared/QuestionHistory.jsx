export default function QuestionHistory({
  items = [],
  onSelect,
  emptyMessage = "Questions will appear here once you start exploring.",
}) {
  if (!items.length) {
    return <div className="history-empty">{emptyMessage}</div>;
  }

  return (
    <div className="question-history-list">
      {items.map((item) => (
        <button
          key={`${item.question}-${item.timestamp}`}
          type="button"
          className="question-history-item"
          onClick={() => onSelect?.(item)}
        >
          <strong>{item.question}</strong>
          <small>{item.timestampLabel}</small>
        </button>
      ))}
    </div>
  );
}
