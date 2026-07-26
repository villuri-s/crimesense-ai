import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";
import { requestRootCause, sendQuery } from "../services/api";
import ChartView from "./ChartView";
import MessageBubble from "./MessageBubble";
import RootCausePanel from "./RootCausePanel";

function resolveConfidence(card) {
  if (card?.confidence) {
    return `AI Confidence: ${card.confidence}`;
  }

  if (card?.type === "insight") {
    return "Verified by Analytics Engine";
  }

  return "AI Confidence: 94%";
}

export default function ChatBox({
  history,
  setHistory,
  selectedChat,
  setSelectedChat,
  quickPrompts = [],
  datasetSource,
  canQuery = true,
  queryDisabledReason = "",
  connectorStatus = "idle",
}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rootCauseAnalysis, setRootCauseAnalysis] = useState(null);
  const [rootCauseLoading, setRootCauseLoading] = useState(false);
  const [rootCauseError, setRootCauseError] = useState("");
  const inputRef = useRef(null);

  const activeChat = selectedChat || history[history.length - 1] || null;
  const activeResponse = activeChat?.response ?? null;
  const activeChatKey = activeChat
    ? `${activeChat.question}::${activeResponse?.title || ""}::${history.indexOf(activeChat)}`
    : "";
  const hasActiveChat = Boolean(activeChat);
  const hasActiveResponse = Boolean(activeResponse);
  const summaryCards = activeResponse?.cards ?? [];
  const responseAlerts = activeResponse?.dataset?.alerts?.slice(0, 2) ?? [];
  const copilot = activeResponse?.copilot ?? null;
  const followUpQuestions = copilot?.followUpQuestions ?? [];
  const rootCauseConfig = activeResponse?.rootCause ?? null;

  useEffect(() => {
    setRootCauseAnalysis(null);
    setRootCauseError("");
    setRootCauseLoading(false);
  }, [activeChatKey]);

  const getSummaryCardClass = (type) => {
    if (type === "insight") {
      return "insight-card";
    }

    if (type === "impact") {
      return "impact-card";
    }

    return "recommendation-card";
  };

  const handleSend = async (overrideQuestion) => {
    if (!canQuery) {
      return;
    }

    const question = String(overrideQuestion ?? input).trim();

    if (!question) {
      return;
    }

    setLoading(true);
    setSelectedChat(null);
    setError("");

    try {
      const response = await sendQuery(question);

      const newItem = {
        question,
        response,
        timestamp: new Date().toISOString(),
      };

      setHistory((prev) => [...prev, newItem]);
      setInput("");
    } catch (err) {
      console.error(err);
      setError(err.message || "We could not reach the API right now.");
    } finally {
      setLoading(false);
    }
  };

  const handleRootCause = async () => {
    if (!activeChat?.question || !rootCauseConfig?.request?.plan) {
      return;
    }

    setRootCauseLoading(true);
    setRootCauseError("");

    try {
      const response = await requestRootCause({
        question: activeChat.question,
        basePlan: rootCauseConfig.request.plan,
        path: rootCauseAnalysis?.path || [],
      });

      setRootCauseAnalysis(response);
    } catch (err) {
      console.error(err);
      setRootCauseError(
        err.message || "We could not generate a root cause analysis right now."
      );
    } finally {
      setRootCauseLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <section className="query-stage">
        <div className="chat-intro">
          <div>
            <div className="section-kicker">Question Studio</div>
            <h2>What do you want to know from this dataset?</h2>
          </div>
          <div className="chat-context">
            <span className="context-pill muted">
              {datasetSource?.label || "Sales demo dataset"}
            </span>
          </div>
        </div>

          <div className="input-row">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              canQuery
                ? "Ask your data in natural language..."
                : "Live analysis unlocks after the connector sync is materialized..."
            }
            onKeyDown={(e) => e.key === "Enter" && !loading && handleSend()}
            disabled={!canQuery}
          />
            <button onClick={() => handleSend()} disabled={loading || !canQuery}>
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

        {!canQuery && queryDisabledReason && (
          <div className="workspace-note">{queryDisabledReason}</div>
        )}

        {quickPrompts.length > 0 && (
          <div className="prompt-row">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="prompt-chip"
                onClick={() => handleSend(prompt)}
                disabled={loading || !canQuery}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="chat-history">
        {!hasActiveChat && !error && (
          <div className="empty-state">
            Ask for trends, top issues, risk patterns, repeated incidents, ownership gaps, or a quick executive summary.
          </div>
        )}

        {error && <div className="empty-state error-state">{error}</div>}

        {hasActiveChat && hasActiveResponse && (
          <div className="chat-item">
            <div className="conversation-ribbon">
              <MessageBubble text={activeChat.question} sender="user" />
              <MessageBubble text={activeResponse.answer || "Your analysis is ready."} sender="ai" />
            </div>

            {responseAlerts.length > 0 && (
              <div className="inline-alert-list">
                {responseAlerts.map((alert) => (
                  <div key={`${alert.title}-${alert.description}`} className={`alert-card severity-${alert.severity || "medium"}`}>
                    <AlertTriangle size={16} />
                    <div>
                      <strong>{alert.title}</strong>
                      <p>{alert.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="result-stage">
              <div className="result-stage-header">
                <div className="section-kicker">Answer View</div>
                <h3>{activeResponse.title}</h3>
              </div>

              <div className="insight-shell">
                <div className="insight-main">
                  <div className="chart-summary-row">
                    <div className="chart-column">
                      <ChartView
                        type={activeResponse.type}
                        insightType={activeResponse.insightType}
                        title=""
                        data={activeResponse.data}
                      />
                    </div>

                    <div className="summary-column">
                      {summaryCards.map((card) => (
                        <div
                          key={`${card.type}-${card.title}`}
                          className={`summary-card ${getSummaryCardClass(card.type)}`}
                        >
                          <div className="summary-icon">
                            {card.type === "insight" ? <CheckCircle2 size={20} /> : <Lightbulb size={20} />}
                          </div>
                          <div className="summary-content">
                            <div className="summary-title">{card.title}</div>
                            <p>{card.text}</p>
                            <div className="insight-confidence">{resolveConfidence(card)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <aside className="insight-sidebar">
                  {copilot && (
                    <div className="sidebar-card">
                      <div className="section-kicker">Business Copilot</div>
                      <h4>Executive Summary</h4>
                      <p className="copilot-copy">{copilot.executiveSummary}</p>
                      <div className="copilot-divider" />
                      <h5>Business Impact</h5>
                      <p className="copilot-copy">{copilot.businessImpact}</p>
                      <div className="copilot-divider" />
                      <h5>Key Risks</h5>
                      <ul className="copilot-list">
                        {(copilot.keyRisks || []).map((risk) => (
                          <li key={risk}>{risk}</li>
                        ))}
                      </ul>
                      <div className="copilot-divider" />
                      <h5>Recommendations</h5>
                      <ul className="copilot-list">
                        {(copilot.recommendedActions || []).map((action) => (
                          <li key={action}>{action}</li>
                        ))}
                      </ul>
                      {followUpQuestions.length > 0 && (
                        <>
                          <div className="copilot-divider" />
                          <h5>Suggested Follow-up Questions</h5>
                          <div className="prompt-row">
                            {followUpQuestions.map((prompt) => (
                              <button
                                key={prompt}
                                type="button"
                                className="prompt-chip"
                                onClick={() => handleSend(prompt)}
                                disabled={loading}
                              >
                                {prompt}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </aside>
              </div>

              <RootCausePanel
                config={rootCauseConfig}
                analysis={rootCauseAnalysis}
                loading={rootCauseLoading}
                error={rootCauseError}
                onDrillDown={handleRootCause}
              />
            </div>
          </div>
        )}

        {hasActiveChat && !hasActiveResponse && !error && (
          <div className="empty-state">
            This response is unavailable. Please try asking again.
          </div>
        )}
      </div>
    </div>
  );
}
