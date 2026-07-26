import { useState } from "react";
import MessageBubble from "../MessageBubble";
import QuestionHistory from "../shared/QuestionHistory";

export default function ChatPanel({
  history = [],
  activeChat,
  activeResponse,
  quickPrompts = [],
  datasetSource,
  canQuery = true,
  queryDisabledReason = "",
  loading = false,
  error = "",
  onAskQuestion,
  onSelectChat,
  connectorStatus = "idle",
}) {
  const [input, setInput] = useState("");
  const recentPrompts = history.slice(-6).reverse();

  const submitQuestion = (overrideQuestion) => {
    const question = String(overrideQuestion ?? input).trim();

    if (!question || !canQuery) {
      return;
    }

    onAskQuestion?.(question);
    setInput("");
  };

  return (
    <div className="chat-workspace">
      <div className="chat-primary">
        <section className="query-stage chat-composer-panel">
          <div className="chat-intro">
            <div>
              <div className="section-kicker">AI Chat</div>
              <h2>Ask, refine, and compare answers without leaving the workspace</h2>
            </div>
            <div className="chat-context">
              <span className="context-pill muted">
                {datasetSource?.label || "Sales demo dataset"}
              </span>
            </div>
          </div>

          <div className="input-row">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                canQuery
                  ? "Ask your data in natural language..."
                  : "Live analysis unlocks after the connector sync is materialized..."
              }
              onKeyDown={(event) =>
                event.key === "Enter" && !loading && submitQuestion()
              }
              disabled={!canQuery}
            />
            <button
              type="button"
              onClick={() => submitQuestion()}
              disabled={loading || !canQuery}
            >
              {canQuery
                ? loading
                  ? "Asking..."
                  : "Ask AI"
                : connectorStatus === "connecting"
                ? "● Connecting..."
                : connectorStatus === "connected"
                ? "✓ Connected"
                : connectorStatus === "importing"
                ? "⬇ Importing Data..."
                : connectorStatus === "imported"
                ? "✓ Dataset Imported"
                : connectorStatus === "ready"
                ? "✓ Ready for AI Analysis"
                : "Waiting for Sync"}
            </button>
          </div>

          {!canQuery && queryDisabledReason ? (
            <div className="workspace-note">{queryDisabledReason}</div>
          ) : null}
        </section>

        <section className="panel conversation-panel">
          <div className="panel-header-row">
            <div>
              <div className="section-kicker">Conversation History</div>
              <h3>Question and answer thread</h3>
            </div>
          </div>

          <div className="conversation-stream">
            {history.length === 0 && !error ? (
              <div className="empty-state">
                Ask for trends, risks, repeated incidents, ownership gaps, or a quick executive summary.
              </div>
            ) : null}

            {error ? <div className="empty-state error-state">{error}</div> : null}

            {history.map((item) => {
              const isSelected =
                activeChat &&
                item.question === activeChat.question &&
                item.timestamp === activeChat.timestamp;

              return (
                <button
                  key={`${item.question}-${item.timestamp}`}
                  type="button"
                  className={isSelected ? "conversation-thread-card selected" : "conversation-thread-card"}
                  onClick={() => onSelectChat?.(item)}
                >
                  <MessageBubble text={item.question} sender="user" />
                  <MessageBubble
                    text={item.response?.answer || "Your analysis is ready."}
                    sender="ai"
                  />
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <aside className="chat-secondary">
        <section className="sidebar-card answer-preview-card">
          <div className="section-kicker">Latest Answer</div>
          <h4>{activeResponse?.title || "Answers appear here after a question"}</h4>
          <p className="copilot-copy">
            {activeResponse?.answer ||
              "This workspace stays focused on asking questions. Charts and structured reporting appear in Analysis and Reports after a query runs."}
          </p>
          {activeResponse?.data?.length ? (
            <div className="ingestion-run-meta chat-answer-meta">
              <span>{activeResponse.data.length} plotted groups</span>
              <span>{history.length} questions asked</span>
              <span>Open Analysis for charts</span>
            </div>
          ) : null}
        </section>

        <section className="sidebar-card">
          <div className="section-kicker">Suggested Questions</div>
          <div className="prompt-row stacked-prompts">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="prompt-chip"
                onClick={() => submitQuestion(prompt)}
                disabled={loading || !canQuery}
              >
                {prompt}
              </button>
            ))}
          </div>
        </section>

        <section className="sidebar-card">
          <div className="section-kicker">Recent Questions</div>
          <QuestionHistory
            items={recentPrompts}
            onSelect={onSelectChat}
            emptyMessage="Recent questions will appear here."
          />
        </section>
      </aside>
    </div>
  );
}
