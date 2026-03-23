import { useState } from "react";

const S = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    background: "#0D0F14",
    fontFamily: "Georgia, serif",
    color: "#C8CEDD",
    padding: "24px",
  },
  card: {
    width: "100%",
    maxWidth: 520,
    background: "#0F1119",
    border: "1px solid #1E2330",
    borderRadius: 10,
    padding: "32px 28px",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  heading: { fontSize: 20, fontWeight: "bold", color: "#E8EAF0", letterSpacing: "0.04em" },
  sub: { fontSize: 12, color: "#4A5470", lineHeight: 1.7, marginTop: 6, fontStyle: "italic" },
  label: {
    fontSize: 10,
    color: "#4A5470",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  inputRow: { display: "flex", gap: 8, alignItems: "center" },
  input: {
    flex: 1,
    background: "#0C0E15",
    border: "1px solid #2A3050",
    borderRadius: 5,
    color: "#C8CEDD",
    fontSize: 12,
    padding: "8px 10px",
    fontFamily: "Georgia, serif",
    outline: "none",
  },
  removeBtn: {
    background: "none",
    border: "1px solid #2A3050",
    borderRadius: 4,
    color: "#4A5470",
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
    padding: "4px 8px",
    flexShrink: 0,
  },
  addBtn: {
    background: "none",
    border: "1px dashed #2A3050",
    borderRadius: 5,
    color: "#4A5470",
    cursor: "pointer",
    fontSize: 11,
    padding: "8px",
    fontFamily: "Georgia, serif",
    letterSpacing: "0.04em",
    textAlign: "left",
  },
  discoverBtn: (disabled) => ({
    padding: "11px 20px",
    borderRadius: 6,
    border: "1.5px solid #78B4D4",
    background: disabled ? "transparent" : "#78B4D422",
    color: disabled ? "#3A4460" : "#78B4D4",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    fontFamily: "Georgia, serif",
    letterSpacing: "0.04em",
  }),
  error: {
    fontSize: 11,
    color: "#E07070",
    background: "#1A0E0E",
    border: "1px solid #E0707030",
    borderRadius: 5,
    padding: "10px 12px",
    lineHeight: 1.6,
  },
  hint: { fontSize: 10, color: "#3A4460", lineHeight: 1.8, fontStyle: "italic" },
};

const EXAMPLES = [
  "Gilles Deleuze",
  "Frantz Fanon",
  "Donna Haraway",
  "W. E. B. Du Bois",
  "Hannah Arendt",
];

export default function SeedInput({ onDiscover, loading, error }) {
  const [inputs, setInputs] = useState(["", "", ""]);

  const set = (i, v) => setInputs((prev) => prev.map((x, j) => (j === i ? v : x)));
  const add = () => setInputs((p) => (p.length < 10 ? [...p, ""] : p));
  const remove = (i) => setInputs((p) => (p.length > 1 ? p.filter((_, j) => j !== i) : p));

  const valid = inputs.filter((v) => v.trim()).length >= 2;

  const handleSubmit = () => {
    if (!valid || loading) return;
    onDiscover(inputs.filter((v) => v.trim()));
  };

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <div>
          <div style={S.heading}>Wiki Graph Explorer</div>
          <div style={S.sub}>
            Enter Wikipedia article titles or URLs. The tool discovers how they connect
            through Wikipedia's link structure, surfaces bridge concepts, detects
            intellectual communities, and asks Claude to annotate what emerged.
          </div>
        </div>

        <div>
          <div style={S.label}>Seed Articles (min 2)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {inputs.map((val, i) => (
              <div key={i} style={S.inputRow}>
                <input
                  style={S.input}
                  value={val}
                  placeholder={i === 0 ? `e.g. ${EXAMPLES[i % EXAMPLES.length]}` : "Article title or Wikipedia URL"}
                  onChange={(e) => set(i, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                />
                <button style={S.removeBtn} onClick={() => remove(i)} title="Remove">
                  ×
                </button>
              </div>
            ))}
            {inputs.length < 10 && (
              <button style={S.addBtn} onClick={add}>
                + Add article
              </button>
            )}
          </div>
        </div>

        <button style={S.discoverBtn(!valid || loading)} disabled={!valid || loading} onClick={handleSubmit}>
          {loading ? "Discovering…" : "Discover Graph"}
        </button>

        {error && <div style={S.error}>{error}</div>}

        <div style={S.hint}>
          Examples: thinkers, concepts, movements, institutions — anything with a
          Wikipedia article. The bridge concepts linking your seeds are often the
          most revealing discoveries.
        </div>
      </div>
    </div>
  );
}
