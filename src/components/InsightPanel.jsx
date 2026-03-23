import { useState } from "react";

const COMMUNITY_COLORS = [
  "#78B4D4", "#D4A878", "#A878D4", "#78D4A8",
  "#D47878", "#D4D478", "#78D4D4", "#D478A8",
  "#88B478", "#B49878",
];

function communityColor(c) {
  return COMMUNITY_COLORS[c % COMMUNITY_COLORS.length];
}

const S = {
  panel: {
    width: 320,
    borderLeft: "1px solid #1E2330",
    background: "#0F1119",
    padding: "18px 16px",
    overflowY: "auto",
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: 18,
    fontFamily: "Georgia, serif",
  },
  section: { display: "flex", flexDirection: "column", gap: 8 },
  heading: {
    fontSize: 10,
    color: "#4A5470",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    borderBottom: "1px solid #1A1E2A",
    paddingBottom: 6,
  },
  communityCard: (c) => ({
    padding: "10px 11px",
    borderRadius: 5,
    background: "#0C0E15",
    borderLeft: `3px solid ${communityColor(c)}`,
  }),
  communityLabel: (c) => ({
    fontSize: 12,
    fontWeight: "bold",
    color: communityColor(c),
    marginBottom: 4,
  }),
  communityExpl: {
    fontSize: 11,
    color: "#6878A0",
    lineHeight: 1.7,
  },
  bridgeCard: {
    padding: "10px 11px",
    borderRadius: 5,
    background: "#0C0E15",
    border: "1px solid #2A3050",
  },
  bridgeTitle: { fontSize: 12, color: "#CDD0E5", fontWeight: "bold", marginBottom: 4 },
  bridgeExpl: { fontSize: 11, color: "#6878A0", lineHeight: 1.7 },
  suggestionCard: {
    padding: "10px 11px",
    borderRadius: 5,
    background: "#0C0E15",
    border: "1px solid #1A1E2A",
    cursor: "pointer",
    transition: "border-color 0.15s",
  },
  suggTitle: { fontSize: 12, color: "#A8C0D8", marginBottom: 3 },
  suggReason: { fontSize: 11, color: "#4A5878", lineHeight: 1.6 },
  copied: { fontSize: 10, color: "#78B4D4", marginTop: 4, fontStyle: "italic" },
  nodeCard: {
    padding: "12px 13px",
    borderRadius: 6,
    background: "#0C0E15",
    border: "1px solid #2A3050",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  nodeTitle: { fontSize: 14, fontWeight: "bold", color: "#E8EAF0" },
  nodeMeta: { fontSize: 10, color: "#4A5878" },
  nodeExtract: { fontSize: 11, color: "#6878A0", lineHeight: 1.75 },
  wikiLink: {
    fontSize: 10,
    color: "#3A5070",
    textDecoration: "none",
    borderBottom: "1px solid #2A3848",
    alignSelf: "flex-start",
  },
  spinner: {
    fontSize: 11,
    color: "#5A6890",
    fontStyle: "italic",
    lineHeight: 1.7,
    padding: "10px 0",
  },
};

function SuggestionCard({ title, reason }) {
  const [copied, setCopied] = useState(false);
  const handleClick = () => {
    navigator.clipboard.writeText(title).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div
      style={S.suggestionCard}
      onClick={handleClick}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3A5070")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1A1E2A")}
    >
      <div style={S.suggTitle}>{title}</div>
      <div style={S.suggReason}>{reason}</div>
      {copied && <div style={S.copied}>Copied to clipboard</div>}
    </div>
  );
}

export default function InsightPanel({
  selectedNode,
  edges,
  nodes,
  communities,
  normCentrality,
  insights,
  insightsLoading,
  insightsError,
}) {
  const nodeMap = Object.fromEntries((nodes || []).map((n) => [n.id, n]));

  const connectedIds = selectedNode
    ? new Set(
        edges
          .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
          .flatMap((e) => [e.source, e.target])
          .filter((id) => id !== selectedNode.id)
      )
    : null;

  const communityIndex = selectedNode ? communities[selectedNode.id] : null;
  const centralityPct = selectedNode
    ? Math.round((normCentrality[selectedNode.id] || 0) * 100)
    : null;

  return (
    <div style={S.panel}>
      {/* Selected node detail */}
      {selectedNode && (
        <div style={S.section}>
          <div style={S.heading}>Selected</div>
          <div style={S.nodeCard}>
            <div style={S.nodeTitle}>{selectedNode.title}</div>
            <div style={S.nodeMeta}>
              {selectedNode.isSeed ? "Seed · " : "Bridge · "}
              Community {communityIndex} · Centrality {centralityPct}%
            </div>
            {selectedNode.categories?.length > 0 && (
              <div style={{ ...S.nodeMeta, fontStyle: "italic" }}>
                {selectedNode.categories.slice(0, 3).join(" · ")}
              </div>
            )}
            {selectedNode.extract && (
              <div style={S.nodeExtract}>
                {selectedNode.extract.slice(0, 280)}
                {selectedNode.extract.length > 280 ? "…" : ""}
              </div>
            )}
            <a
              href={selectedNode.url}
              target="_blank"
              rel="noopener noreferrer"
              style={S.wikiLink}
            >
              Read on Wikipedia ↗
            </a>
          </div>

          {connectedIds && connectedIds.size > 0 && (
            <div>
              <div style={{ ...S.nodeMeta, marginBottom: 6 }}>
                {connectedIds.size} connection{connectedIds.size !== 1 ? "s" : ""}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {[...connectedIds].slice(0, 8).map((id) => {
                  const n = nodeMap[id];
                  if (!n) return null;
                  const c = communities[id];
                  return (
                    <div
                      key={id}
                      style={{
                        fontSize: 11,
                        color: "#7888A8",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: COMMUNITY_COLORS[c % COMMUNITY_COLORS.length],
                          flexShrink: 0,
                        }}
                      />
                      {n.title}
                    </div>
                  );
                })}
                {connectedIds.size > 8 && (
                  <div style={{ fontSize: 10, color: "#3A4460" }}>
                    +{connectedIds.size - 8} more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Claude insights */}
      {insightsLoading && (
        <div style={S.spinner}>Asking Claude to annotate the structure…</div>
      )}

      {insightsError && (
        <div
          style={{
            fontSize: 11,
            color: "#E07070",
            background: "#1A0E0E",
            border: "1px solid #E0707030",
            borderRadius: 5,
            padding: "10px 12px",
            lineHeight: 1.6,
          }}
        >
          Claude error: {insightsError}
        </div>
      )}

      {insights && (
        <>
          {/* Communities */}
          <div style={S.section}>
            <div style={S.heading}>Communities</div>
            {Object.entries(insights.communities || {}).map(([c, info]) => (
              <div key={c} style={S.communityCard(Number(c))}>
                <div style={S.communityLabel(Number(c))}>{info.label}</div>
                <div style={S.communityExpl}>{info.explanation}</div>
              </div>
            ))}
          </div>

          {/* Bridges */}
          {insights.bridges?.length > 0 && (
            <div style={S.section}>
              <div style={S.heading}>Bridge Nodes</div>
              {insights.bridges.map((b, i) => (
                <div key={i} style={S.bridgeCard}>
                  <div style={S.bridgeTitle}>{b.title}</div>
                  <div style={S.bridgeExpl}>{b.explanation}</div>
                </div>
              ))}
            </div>
          )}

          {/* Suggestions */}
          {insights.suggestions?.length > 0 && (
            <div style={S.section}>
              <div style={S.heading}>Suggested Expansions</div>
              <div style={{ fontSize: 10, color: "#3A4460", marginBottom: 2, fontStyle: "italic" }}>
                Click to copy title, then paste into a new search.
              </div>
              {insights.suggestions.map((s, i) => (
                <SuggestionCard key={i} title={s.title} reason={s.reason} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
