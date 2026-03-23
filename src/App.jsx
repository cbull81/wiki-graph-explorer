import { useState } from "react";
import SeedInput from "./components/SeedInput.jsx";
import GraphCanvas from "./components/GraphCanvas.jsx";
import InsightPanel from "./components/InsightPanel.jsx";
import { discoverGraph } from "./services/wikiIngestion.js";
import { computeBetweenness, detectCommunities, normalise } from "./utils/graphAnalysis.js";
import { analyseGraph } from "./services/claudeService.js";

const FONT = "Georgia, serif";

// Progress bar overlay shown during loading
function ProgressOverlay({ status }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0D0F14CC",
        zIndex: 10,
        fontFamily: FONT,
        gap: 14,
      }}
    >
      <div
        style={{
          width: 320,
          background: "#0F1119",
          border: "1px solid #1E2330",
          borderRadius: 8,
          padding: "24px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 13, color: "#E8EAF0" }}>{status.message}</div>
        <div
          style={{
            height: 3,
            background: "#1A1E2A",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${status.progress}%`,
              background: "#78B4D4",
              borderRadius: 2,
              transition: "width 0.4s ease",
            }}
          />
        </div>
        <div style={{ fontSize: 10, color: "#3A4460", fontStyle: "italic" }}>
          {status.progress < 88
            ? "Traversing Wikipedia's link graph…"
            : "Running graph analysis…"}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [phase, setPhase] = useState("seed"); // 'seed' | 'loading' | 'ready'
  const [loadStatus, setLoadStatus] = useState({ message: "", progress: 0 });
  const [loadError, setLoadError] = useState(null);

  // Graph data
  const [graph, setGraph] = useState(null); // { nodes, edges }
  const [analysis, setAnalysis] = useState(null); // { communities, centrality, normCentrality }

  // Claude insights
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState(null);

  // UI state
  const [selectedId, setSelectedId] = useState(null);

  const handleDiscover = async (seedInputs) => {
    setPhase("loading");
    setLoadError(null);
    setGraph(null);
    setAnalysis(null);
    setInsights(null);
    setSelectedId(null);

    try {
      // ── Wikipedia traversal ────────────────────────────────────────────────
      const { nodes, edges } = await discoverGraph(seedInputs, (s) => {
        setLoadStatus(s);
      });

      // ── Local graph analysis ───────────────────────────────────────────────
      setLoadStatus({ step: "analysis", message: "Detecting communities…", progress: 90 });
      const communities = detectCommunities(nodes, edges);
      const centrality = computeBetweenness(nodes, edges);
      const normCentrality = normalise(centrality);

      setGraph({ nodes, edges });
      setAnalysis({ communities, centrality, normCentrality });
      setPhase("ready");

      // ── Claude annotation (non-blocking) ───────────────────────────────────
      setInsightsLoading(true);
      setInsightsError(null);
      analyseGraph({ nodes, edges, communities, centrality })
        .then((result) => {
          setInsights(result);
          setInsightsLoading(false);
        })
        .catch((err) => {
          setInsightsError(err.message);
          setInsightsLoading(false);
        });
    } catch (err) {
      setLoadError(err.message);
      setPhase("seed");
    }
  };

  const handleReset = () => {
    setPhase("seed");
    setGraph(null);
    setAnalysis(null);
    setInsights(null);
    setSelectedId(null);
    setLoadError(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === "seed") {
    return <SeedInput onDiscover={handleDiscover} loading={false} error={loadError} />;
  }

  const selectedNode = selectedId
    ? (graph?.nodes || []).find((n) => n.id === selectedId)
    : null;

  const communityLabels = insights?.communities || null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#0D0F14",
        fontFamily: FONT,
        color: "#C8CEDD",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "10px 18px",
          borderBottom: "1px solid #1E2330",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
          gap: 12,
        }}
      >
        <div>
          <span style={{ fontSize: 13, fontWeight: "bold", color: "#E8EAF0", letterSpacing: "0.06em" }}>
            Wiki Graph Explorer
          </span>
          {graph && (
            <span style={{ fontSize: 10, color: "#4A5470", marginLeft: 14, fontStyle: "italic" }}>
              {graph.nodes.length} articles · {graph.edges.length} links ·{" "}
              {graph.nodes.filter((n) => n.isSeed).length} seeds ·{" "}
              {[...new Set(Object.values(analysis.communities))].length} communities
            </span>
          )}
        </div>
        <button
          onClick={handleReset}
          style={{
            background: "none",
            border: "1px solid #2E3448",
            borderRadius: 4,
            color: "#6878A0",
            cursor: "pointer",
            fontSize: 11,
            padding: "4px 12px",
            fontFamily: FONT,
          }}
        >
          ← New Search
        </button>
      </div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        {phase === "loading" && <ProgressOverlay status={loadStatus} />}

        {graph && analysis && (
          <>
            <GraphCanvas
              nodes={graph.nodes}
              edges={graph.edges}
              communities={analysis.communities}
              normCentrality={analysis.normCentrality}
              communityLabels={communityLabels}
              onNodeClick={setSelectedId}
              selectedId={selectedId}
            />
            <InsightPanel
              selectedNode={selectedNode}
              edges={graph.edges}
              nodes={graph.nodes}
              communities={analysis.communities}
              normCentrality={analysis.normCentrality}
              insights={insights}
              insightsLoading={insightsLoading}
              insightsError={insightsError}
            />
          </>
        )}
      </div>
    </div>
  );
}
