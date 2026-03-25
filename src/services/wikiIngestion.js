const WIKI_API = "https://en.wikipedia.org/w/api.php";
const MAX_BRIDGES = 25;
const MIN_HUB_SCORE = 2;
const MAX_EXTRACT_CHARS = 6000;

// Articles to skip: too generic to be meaningful graph nodes
const SKIP_RE = [
  /^\d{4}(s)?$/,
  /^List of /i,
  /\(disambiguation\)/i,
  /^Wikipedia:/,
  /^Template:/,
  /^Help:/,
  /^Portal:/,
  /^File:/,
  /^Category:/,
];

// Citation infrastructure: academic databases, bibliographic identifiers, and
// publisher/indexing services that appear as outlinks via Wikipedia's citation
// templates. These are logistical nodes, not intellectual concepts.
const CITATION_ACADEMIC_INFRA = new Set([
  "Semantic Scholar",
  "Google Scholar",
  "JSTOR",
  "OCLC",
  "WorldCat",
  "PubMed",
  "PubMed Central",
  "arXiv",
  "DOI",
  "Digital object identifier",
  "ISBN",
  "ISSN",
  "LCCN",
  "CrossRef",
  "Scopus",
  "Web of Science",
  "ProQuest",
  "EBSCOhost",
  "ResearchGate",
  "PhilPapers",
  "SSRN",
  "Academia.edu",
  "Wayback Machine",
  "Internet Archive",
  "Project MUSE",
  "HathiTrust",
  "OpenLibrary",
  "Bibliothèque nationale de France",
  "Library of Congress",
  "British Library",
  "Doctoral advisor",
  "Bachelor's degree",
  "Master's degree",
  "Undergraduate degree",
  "Graduate degree",
  "Postgraduate education",
  "Postgraduate degree",
  "Master of Business Administration",
  "Bachelor of Arts",
  "Bachelor of Science",
  "Master of Arts",
  "Master of Science",
  "Doctor of Philosophy",
  "Doctor of Medicine",
  "Doctor of Education",
  "Doctor of Engineering",
]);

const CITATION_INFRA_LOWER = new Set(
  [...CITATION_ACADEMIC_INFRA].map((t) => t.toLowerCase())
);

function isRelevant(title) {
  return (
    !SKIP_RE.some((re) => re.test(title)) &&
    !CITATION_INFRA_LOWER.has(title.toLowerCase())
  );
}

async function wikiGet(params) {
  const url = new URL(WIKI_API);
  Object.entries({ ...params, format: "json", origin: "*" }).forEach(([k, v]) =>
    url.searchParams.set(k, v)
  );
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wikipedia API ${res.status}`);
  return res.json();
}

function normaliseInput(raw) {
  if (raw.includes("wikipedia.org/wiki/")) {
    const m = raw.match(/\/wiki\/([^#?]+)/);
    if (!m) return null;
    return decodeURIComponent(m[1]).replace(/_/g, " ");
  }
  return raw.trim() || null;
}

async function fetchArticle(title) {
  const data = await wikiGet({
    action: "query",
    prop: "extracts|info|categories",
    titles: title,
    redirects: "1",
    explaintext: "1",
    exsectionformat: "plain",
    inprop: "url",
    cllimit: "50",
    clshow: "!hidden",
  });

  const pages = Object.values(data.query?.pages || {});
  const page = pages[0];
  if (!page || page.missing !== undefined) return null;

  const categories = (page.categories || [])
    .map((c) => c.title.replace(/^Category:/, ""))
    .filter((c) => !/Wikipedia|Articles|Pages|CS1|Use |All |Good |Featured/.test(c));

  return {
    id: page.title.replace(/\s+/g, "_"),
    title: page.title,
    extract: (page.extract || "").slice(0, MAX_EXTRACT_CHARS),
    url: page.fullurl,
    categories,
  };
}

async function fetchOutlinks(title) {
  const data = await wikiGet({
    action: "query",
    prop: "links",
    titles: title,
    pllimit: "500",
    plnamespace: "0",
    redirects: "1",
  });
  const pages = Object.values(data.query?.pages || {});
  return (pages[0]?.links || []).map((l) => l.title);
}

/**
 * Discover a knowledge graph seeded from the provided Wikipedia article titles/URLs.
 *
 * Pipeline:
 *   1. Resolve & fetch seed articles (full extract + categories)
 *   2. Fetch outlinks for each seed (up to 500 per article)
 *   3. Score intermediate nodes by how many seeds link to them (hub score)
 *   4. Take up to MAX_BRIDGES bridges with hub score >= MIN_HUB_SCORE
 *   5. Fetch bridge articles + their outlinks
 *   6. Build undirected edge set from links between any two nodes in our set
 *
 * @param {string[]} rawInputs  Wikipedia titles or URLs
 * @param {Function} onProgress  callback({ step, message, progress: 0-100 })
 * @returns {Promise<{ nodes, edges }>}
 */
export async function discoverGraph(rawInputs, onProgress) {
  const titles = rawInputs.map(normaliseInput).filter(Boolean);
  if (titles.length === 0) throw new Error("No valid inputs.");

  // ── 1. Seed articles ────────────────────────────────────────────────────────
  onProgress({ step: "seeds", message: "Resolving seed articles…", progress: 5 });

  const seedArticles = (
    await Promise.all(titles.map((t) => fetchArticle(t).catch(() => null)))
  )
    .filter(Boolean)
    .map((a) => ({ ...a, isSeed: true, hubScore: null }));

  if (seedArticles.length === 0) {
    throw new Error("No Wikipedia articles found. Check your titles/URLs.");
  }

  // ── 2. Outlinks for seeds ────────────────────────────────────────────────────
  onProgress({
    step: "outlinks",
    message: `Fetching outlinks from ${seedArticles.length} seed articles…`,
    progress: 20,
  });

  const seedOutlinks = await Promise.all(
    seedArticles.map((a) => fetchOutlinks(a.title))
  );

  // ── 3. Score bridge candidates ───────────────────────────────────────────────
  onProgress({ step: "scoring", message: "Scoring bridge concepts…", progress: 40 });

  const seedTitles = new Set(seedArticles.map((a) => a.title));
  const hubScores = {};

  seedOutlinks.forEach((outlinks) => {
    outlinks
      .filter((t) => isRelevant(t) && !seedTitles.has(t))
      .forEach((t) => {
        hubScores[t] = (hubScores[t] || 0) + 1;
      });
  });

  let bridgeCandidates = Object.entries(hubScores)
    .sort(([, a], [, b]) => b - a)
    .filter(([, s]) => s >= MIN_HUB_SCORE)
    .slice(0, MAX_BRIDGES);

  // Fallback: if not enough bridges meet the threshold, take top N anyway
  if (bridgeCandidates.length < 5) {
    bridgeCandidates = Object.entries(hubScores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, MAX_BRIDGES);
  }

  // ── 4. Fetch bridge articles ─────────────────────────────────────────────────
  onProgress({
    step: "bridges",
    message: `Fetching ${bridgeCandidates.length} bridge articles…`,
    progress: 55,
  });

  const bridgeArticles = (
    await Promise.all(
      bridgeCandidates.map(([title, hubScore]) =>
        fetchArticle(title)
          .then((a) => (a ? { ...a, isSeed: false, hubScore } : null))
          .catch(() => null)
      )
    )
  ).filter(Boolean);

  // ── 5. Outlinks for bridges (needed to find inter-bridge edges) ──────────────
  onProgress({ step: "bridgeLinks", message: "Building edge graph…", progress: 72 });

  const bridgeOutlinks = await Promise.all(
    bridgeArticles.map((a) => fetchOutlinks(a.title))
  );

  // ── 6. Build graph ───────────────────────────────────────────────────────────
  const allNodes = [...seedArticles, ...bridgeArticles];
  const allTitles = new Set(allNodes.map((n) => n.title));
  const titleToId = Object.fromEntries(allNodes.map((n) => [n.title, n.id]));

  const allOutlinks = [...seedOutlinks, ...bridgeOutlinks];
  const edgeSet = new Set();
  const edges = [];

  allNodes.forEach((node, i) => {
    (allOutlinks[i] || []).forEach((targetTitle) => {
      if (allTitles.has(targetTitle) && targetTitle !== node.title) {
        const key = [node.id, titleToId[targetTitle]].sort().join("|||");
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push({ source: node.id, target: titleToId[targetTitle] });
        }
      }
    });
  });

  onProgress({ step: "done", message: "Graph built", progress: 88 });

  return { nodes: allNodes, edges };
}
