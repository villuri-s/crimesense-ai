export default function MessageBubble({ text, sender = "ai" }) {
  const bubbleClass = `message-bubble ${sender === "user" ? "user" : "ai"}`;
  const badgeLabel = sender === "user" ? "You" : "AI";

  return (
    <div className={bubbleClass}>
      <span className="bubble-badge">{badgeLabel}</span>
      <span>{text}</span>
    </div>
  );
}
