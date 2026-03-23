import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

// Community colour palette — works on dark backgrounds
const COMMUNITY_COLORS = [
  "#78B4D4", // blue
  "#D4A878", // amber
  "#A878D4", // purple
  "#78D4A8", // teal
  "#D47878", // coral
  "#D4D478", // yellow
  "#78D4D4", // cyan
  "#D478A8", // pink
  "#88B478", // sage
  "#B49878", // tan
];

function communityColor(c) {
  return COMMUNITY_COLORS[c % COMMUNITY_COLORS.length];
}

function nodeRadius(node, normCentrality) {
  const base = node.isSeed ? 13 : 8;
  const bonus = (normCentrality[node.id] || 0) * 9;
  return base + bonus;
}

export default function GraphCanvas({
  nodes,
  edges,
  communities,
  normCentrality,
  communityLabels,
  onNodeClick,
  selectedId,
}) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ width: 900, height: 650 });

  useEffect(() => {
    const observe = () => {
      if (containerRef.current) {
        setDims({
          width: containerRef.current.clientWidth || 900,
          height: Math.max(550, window.innerHeight - 52),
        });
      }
    };
    observe();
    window.addEventListener("resize", observe);
    return () => window.removeEventListener("resize", observe);
  }, []);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;
    const { width, height } = dims;

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current).attr("width", width).attr("height", height);
    svg.append("rect").attr("width", width).attr("height", height).attr("fill", "#0D0F14");

    // Glow filter
    const defs = svg.append("defs");
    const glow = defs.append("filter").attr("id", "glow");
    glow.append("feGaussianBlur").attr("stdDeviation", "2.5").attr("result", "blur");
    const fm = glow.append("feMerge");
    fm.append("feMergeNode").attr("in", "blur");
    fm.append("feMergeNode").attr("in", "SourceGraphic");

    // Seed ring marker
    const seedGlow = defs.append("filter").attr("id", "seed-glow");
    seedGlow.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "blur");
    const sfm = seedGlow.append("feMerge");
    sfm.append("feMergeNode").attr("in", "blur");
    sfm.append("feMergeNode").attr("in", "SourceGraphic");

    const g = svg.append("g");
    const zoom = d3
      .zoom()
      .scaleExtent([0.15, 4])
      .on("zoom", (e) => g.attr("transform", e.transform));
    svg.call(zoom);
    svg.on("click.deselect", () => onNodeClick(null));

    const nodesData = nodes.map((n) => ({ ...n }));
    const nodeById = Object.fromEntries(nodesData.map((n) => [n.id, n]));

    const edgesData = edges
      .map((e) => ({ source: nodeById[e.source], target: nodeById[e.target] }))
      .filter((e) => e.source && e.target);

    const simulation = d3
      .forceSimulation(nodesData)
      .force(
        "link",
        d3.forceLink(edgesData).id((d) => d.id).distance(120).strength(0.25)
      )
      .force("charge", d3.forceManyBody().strength(-320))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3.forceCollide().radius((d) => nodeRadius(d, normCentrality) + 6)
      );

    // Edges
    const linkSel = g
      .append("g")
      .selectAll("line")
      .data(edgesData)
      .enter()
      .append("line")
      .attr("class", "edge")
      .attr("data-src", (d) => d.source.id)
      .attr("data-tgt", (d) => d.target.id)
      .attr("stroke", "#3A4468")
      .attr("stroke-width", 1.2)
      .attr("stroke-opacity", 0.4);

    // Nodes
    const nodeSel = g
      .append("g")
      .selectAll("g.nd")
      .data(nodesData)
      .enter()
      .append("g")
      .attr("class", "nd")
      .attr("data-nid", (d) => d.id)
      .style("cursor", "pointer");

    // Seed outer ring
    nodeSel
      .filter((d) => d.isSeed)
      .append("circle")
      .attr("r", (d) => nodeRadius(d, normCentrality) + 4)
      .attr("fill", "none")
      .attr("stroke", (d) => communityColor(communities[d.id] ?? 0))
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.5)
      .attr("filter", "url(#seed-glow)");

    // Main circle
    nodeSel
      .append("circle")
      .attr("r", (d) => nodeRadius(d, normCentrality))
      .attr("fill", (d) => communityColor(communities[d.id] ?? 0))
      .attr("stroke", "#0D0F14")
      .attr("stroke-width", 2)
      .attr("filter", "url(#glow)");

    // Label
    nodeSel
      .append("text")
      .text((d) => {
        // Shorten long titles for display
        const label = d.title.length > 22 ? d.title.slice(0, 20) + "…" : d.title;
        return label;
      })
      .attr("x", (d) => nodeRadius(d, normCentrality) + 4)
      .attr("y", 4)
      .attr("font-size", "11px")
      .attr("font-family", "Georgia, serif")
      .attr("fill", "#B0B8CC")
      .attr("pointer-events", "none");

    let dragging = false;
    const drag = d3
      .drag()
      .on("start", (event, d) => {
        dragging = false;
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        dragging = true;
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodeSel.call(drag);
    nodeSel.on("click", function (event, d) {
      event.stopPropagation();
      if (dragging) { dragging = false; return; }
      onNodeClick(d.id === selectedId ? null : d.id);
    });

    simulation.on("tick", () => {
      linkSel
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);
      nodeSel.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => simulation.stop();
  }, [dims, nodes, edges, communities, normCentrality]);

  // Selection highlight (separate effect — no simulation restart)
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    if (!selectedId) {
      svg.selectAll(".edge").attr("stroke-opacity", 0.4);
      svg.selectAll(".nd circle").attr("opacity", 1);
      svg.selectAll(".nd text").attr("opacity", 1);
      return;
    }
    const connected = new Set([selectedId]);
    edges.forEach(({ source, target }) => {
      if (source === selectedId) connected.add(target);
      if (target === selectedId) connected.add(source);
    });
    svg.selectAll(".edge").attr("stroke-opacity", function () {
      const s = this.getAttribute("data-src");
      const t = this.getAttribute("data-tgt");
      return s === selectedId || t === selectedId ? 0.9 : 0.04;
    });
    svg.selectAll(".nd").each(function () {
      const nid = this.getAttribute("data-nid");
      const active = connected.has(nid);
      d3.select(this).selectAll("circle").attr("opacity", active ? 1 : 0.08);
      d3.select(this).select("text").attr("opacity", active ? 1 : 0.08);
    });
  }, [selectedId, edges]);

  // Community legend
  const uniqueCommunities = [...new Set(Object.values(communities))].sort(
    (a, b) => a - b
  );

  return (
    <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
      <svg ref={svgRef} style={{ display: "block" }} />

      {/* Community legend */}
      <div
        style={{
          position: "absolute",
          bottom: 14,
          left: 14,
          background: "#0D0F14E8",
          border: "1px solid #1E2330",
          borderRadius: 6,
          padding: "10px 14px",
          maxWidth: 220,
        }}
      >
        <div
          style={{
            fontSize: 9,
            color: "#3A4460",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: 7,
          }}
        >
          Communities
        </div>
        {uniqueCommunities.map((c) => (
          <div
            key={c}
            style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 5 }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: communityColor(c),
                flexShrink: 0,
                marginTop: 2,
              }}
            />
            <span style={{ fontSize: 10, color: "#7888A8", lineHeight: 1.4 }}>
              {communityLabels?.[c]?.label || `Cluster ${c}`}
            </span>
          </div>
        ))}
        <div style={{ marginTop: 8, fontSize: 9, color: "#2A3450", lineHeight: 1.6 }}>
          Ring = seed · Size = centrality
        </div>
      </div>
    </div>
  );
}
