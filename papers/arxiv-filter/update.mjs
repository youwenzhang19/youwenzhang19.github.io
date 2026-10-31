#!/usr/bin/env node
/**
 * Weekly static rebuild for papers/arxiv-filter/
 * Fetches arXiv API per author, filters Rovelli (phil-sci), groups by
 * arXiv week ending Friday 14:00 America/New_York, writes papers.json + index.html.
 *
 * Usage: npm run update
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const API = "https://export.arxiv.org/api/query";

const PHIL_KEEP = [
  /\bphilosoph/i,
  /\binterpretat/i,
  /\brelational\b/i,
  /\bRQM\b/,
  /\breality\b/i,
  /\bepistem/i,
  /\bontology\b/i,
  /\bontological\b/i,
  /\bmetaphys/i,
  /\bempiricism\b/i,
  /\bconstructive empiricism\b/i,
  /\bscientific realism\b/i,
  /\banti-?realism\b/i,
  /\bnature of time\b/i,
  /\barrow of time\b/i,
  /\bthermal time\b/i,
  /\btime(?:'s)? (?:problem|nature|reality)\b/i,
  /\bquantum mechanics\b/i,
  /\bmeasurement problem\b/i,
  /\bobserver\b/i,
  /\bperspectiv/i,
  /\binformation(?:al)? (?:nature|view|interpretation)\b/i,
  /\bmeaning of\b/i,
  /\bwhat is\b/i,
  /\bfoundations?\b/i,
  /\bhist-ph\b/i,
  /\bphilosophy of (?:science|physics|time|quantum)\b/i,
];
const HIST_PH = /\bphysics\.hist-ph\b/i;
const PHIL_DROP = [
  /\bloop quantum gravity\b/i,
  /\bLQG\b/,
  /\bspin[- ]foam/i,
  /\bAshtekar\b/i,
  /\bImmirzi\b/i,
  /\bHolst\b/i,
  /\bBarbero[- ]Immirzi\b/i,
  /\bquantum geometry\b/i,
  /\bspin[- ]network/i,
  /\bHamiltonian constraint\b/i,
  /\bADM\b/,
  /\bWheeler[- ]DeWitt\b/i,
  /\bcanonical quantization\b/i,
  /\bblack hole entropy\b/i,
  /\bhorizon thermodynamics\b/i,
  /\bgraviton\b/i,
  /\bamplitude\b/i,
  /\bpath integral\b/i,
  /\bcovariance\b/i,
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textOf(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = block.match(re);
  if (!m) return "";
  return m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function attrOf(block, tag, attr) {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]+)"[^>]*/?>`, "i");
  const m = block.match(re);
  return m ? m[1] : "";
}

function allAttrs(block, tag, attr) {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]+)"[^>]*/?>`, "gi");
  const out = [];
  let m;
  while ((m = re.exec(block))) out.push(m[1]);
  return out;
}

function arxivIdFrom(idUrl) {
  const m =
    idUrl.match(/arxiv\.org\/abs\/(.+)$/i) ||
    idUrl.match(/\/(\d{4}\.\d{4,5}(v\d+)?)$/);
  if (m) return m[1].replace(/v\d+$/, "");
  const parts = idUrl.split("/");
  return (parts[parts.length - 1] || idUrl).replace(/v\d+$/, "");
}

function parseEntries(xml) {
  const chunks = xml.split(/<entry>/i).slice(1);
  return chunks
    .map((chunk) => {
      const block = chunk.split(/<\/entry>/i)[0];
      const id = textOf(block, "id");
      if (!id) return null;
      const title = textOf(block, "title");
      const summary = textOf(block, "summary");
      const published = textOf(block, "published");
      const updated = textOf(block, "updated");
      const authors = [];
      const authorBlocks = block.split(/<author>/i).slice(1);
      for (const ab of authorBlocks) {
        const name = textOf(ab.split(/<\/author>/i)[0], "name");
        if (name) authors.push(name);
      }
      const categories = [
        ...allAttrs(block, "category", "term"),
        ...allAttrs(block, "arxiv:primary_category", "term"),
      ];
      const arxivId = arxivIdFrom(id);
      return {
        arxivId,
        title,
        abstract: summary,
        authors,
        categories: [...new Set(categories)],
        published,
        updated,
        absUrl: `https://arxiv.org/abs/${arxivId}`,
      };
    })
    .filter(Boolean);
}

function totalResults(xml) {
  const m = xml.match(/<opensearch:totalResults>(\d+)<\/opensearch:totalResults>/i);
  return m ? Number(m[1]) : null;
}

function philSciKeep(paper) {
  const blob = [paper.title, paper.abstract, paper.categories.join(" ")].join(
    "\n"
  );
  if (paper.categories.some((c) => HIST_PH.test(c))) return true;
  if (PHIL_KEEP.some((re) => re.test(blob))) return true;
  const tech = PHIL_DROP.some((re) => re.test(blob));
  if (
    !tech &&
    /\b(time|reality|quantum|relational|world|experience|agency)\b/i.test(
      paper.title
    )
  ) {
    return true;
  }
  return false;
}

function applyFilter(author, papers) {
  if (author.filter === "phil-sci") return papers.filter(philSciKeep);
  return papers;
}

/** Build arXiv API / site search_query for an author. */
function authorSearchQuery(author) {
  const au = `au:"${author.query || author.name}"`;
  if (author.field === "astrophysics" || author.cat === "astro-ph*") {
    return `${au} AND cat:astro-ph*`;
  }
  return au;
}

/** Parts for America/New_York wall time. */
function etParts(date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const map = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    weekday: map.weekday, // Sun Mon Tue ...
  };
}

/**
 * arXiv week ends Friday 14:00 ET.
 * Label = that Friday as MM/DD/YYYY (gp style).
 * Interval: (prev Friday 14:00 ET, this Friday 14:00 ET].
 */
function weekFridayLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";

  const etFull = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const map = {};
  for (const p of etFull.formatToParts(d)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const weekdayIndex = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[
    map.weekday
  ];
  const hour = Number(map.hour);
  const minute = Number(map.minute);
  const second = Number(map.second);

  // Find this calendar week's Friday (ET) by walking from the ET calendar day.
  let probe = new Date(Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day), 16, 0, 0));
  for (let i = 0; i < 8; i++) {
    const p = etParts(probe);
    const wi = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday];
    if (wi === 5) break;
    probe = new Date(probe.getTime() + (wi < 5 ? 5 - wi : wi === 6 ? -1 : 0) * 86400000);
  }

  const pastThisFridayCutoff =
    weekdayIndex > 5 ||
    (weekdayIndex === 5 &&
      (hour > 14 || (hour === 14 && (minute > 0 || second > 0))));

  if (pastThisFridayCutoff) {
    probe = new Date(probe.getTime() + 7 * 86400000);
  }

  const fri = etParts(probe);
  return `${String(fri.month).padStart(2, "0")}/${String(fri.day).padStart(2, "0")}/${fri.year}`;
}

function labelSortKey(label) {
  // MM/DD/YYYY → YYYYMMDD
  const m = label.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return 0;
  return Number(`${m[3]}${m[1]}${m[2]}`);
}

async function fetchAuthor(author, cfg) {
  const pageSize = cfg.pageSize || 100;
  const maxPages = cfg.maxPagesPerAuthor || 30;
  const delay = cfg.requestDelayMs || 400;
  const all = [];
  let start = 0;
  let total = null;

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      search_query: authorSearchQuery(author),
      sortBy: "submittedDate",
      sortOrder: "descending",
      start: String(start),
      max_results: String(pageSize),
    });
    const url = `${API}?${params}`;
    process.stderr.write(`  ${author.name} [${authorSearchQuery(author)}] start=${start} … `);
    const res = await fetch(url, {
      headers: { "User-Agent": "youwenzhang19-arxiv-filter-weekly/1.0" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${author.name}`);
    const xml = await res.text();
    if (total == null) total = totalResults(xml);
    const entries = parseEntries(xml);
    process.stderr.write(`${entries.length} (total≈${total ?? "?"})\n`);
    all.push(...entries);
    start += pageSize;
    if (entries.length < pageSize) break;
    if (total != null && start >= total) break;
    await sleep(delay);
  }
  return applyFilter(author, all);
}

function mergePapers(authorPapers) {
  const map = new Map();
  for (const { author, papers } of authorPapers) {
    for (const p of papers) {
      const prev = map.get(p.arxivId);
      if (prev) {
        if (!prev.matchedWatchAuthors.includes(author.name)) {
          prev.matchedWatchAuthors.push(author.name);
          prev.matchedShortNames.push(author.shortName || author.name);
        }
      } else {
        map.set(p.arxivId, {
          ...p,
          matchedWatchAuthors: [author.name],
          matchedShortNames: [author.shortName || author.name],
        });
      }
    }
  }
  return Array.from(map.values());
}

function groupByWeek(papers) {
  const groups = new Map();
  for (const p of papers) {
    const label = weekFridayLabel(p.published);
    const list = groups.get(label) ?? [];
    list.push(p);
    groups.set(label, list);
  }
  const ordered = Array.from(groups.entries()).sort(
    (a, b) => labelSortKey(b[0]) - labelSortKey(a[0])
  );
  for (const [, list] of ordered) {
    list.sort(
      (a, b) => new Date(b.published).getTime() - new Date(a.published).getTime()
    );
  }
  return ordered.map(([label, items]) => ({ label, items }));
}

function arxivAuthorSearchUrl(author) {
  return `https://arxiv.org/search/?query=${encodeURIComponent(authorSearchQuery(author))}&searchtype=all&source=header`;
}

function renderAuthorLinks(authors) {
  const astro = authors.filter((a) => a.field === "astrophysics");
  const phil = authors.filter((a) => a.field === "philosophy-of-science");
  const link = (a) =>
    `<a href="${escapeHtml(arxivAuthorSearchUrl(a))}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(a.name)}">${escapeHtml(a.shortName || a.name)}</a>`;
  const row = (list) => list.map(link).join(" · ");
  const parts = [];
  if (astro.length) parts.push(`<div class="author-row"><span class="author-field">Astro</span> ${row(astro)}</div>`);
  if (phil.length) parts.push(`<div class="author-row"><span class="author-field">Phil-sci</span> ${row(phil)}</div>`);
  return parts.join("\n    ");
}

function renderHtml({ weeks, meta, authors }) {
  const body = weeks
    .map(({ label, items }) => {
      const lines = items
        .map((p) => {
          const short = escapeHtml(p.matchedShortNames.join(", "));
          const title = escapeHtml(p.title);
          const href = escapeHtml(p.absUrl);
          return `    <div class="cal-item">- <a href="${href}" target="_blank" rel="noopener noreferrer">${title}</a>: ${short}</div>`;
        })
        .join("\n");
      return `  <p class="section-label day-label">${escapeHtml(label)} =====================================</p>\n  <div class="cal-items">\n${lines}\n  </div>`;
    })
    .join("\n\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Subsribed New Arxiv Submissions</title>
  <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
  <link rel="stylesheet" href="../../css/site.css" />
  <style>
    .page-header { text-align: center; margin: 0 0 12px; }
    .page-header h1 {
      color: var(--sky);
      margin: 0 0 10px;
      font-size: 28px;
      font-weight: 400;
    }
    .author-links {
      text-align: left;
      max-width: 52rem;
      margin: 0 auto 12px;
      line-height: 1.6;
    }
    .author-row { margin: 2px 0; }
    .author-field {
      color: var(--mute);
      margin-right: 6px;
    }
    .day-label { margin: 20px 0 8px; }
    .cal-items { margin: 0 0 8px; }
    .cal-item { margin: 2px 0; }
  </style>
</head>
<body>
  <header class="page-header">
    <h1>Subsribed New Arxiv Submissions</h1>
    <nav class="author-links" aria-label="Watch authors on arXiv">
    ${renderAuthorLinks(authors)}
    </nav>
  </header>
<p>Back to <a href="../index.html">Papers</a> · <a href="../../index.html">homepage</a></p>

${body || "  <p>(empty)</p>"}

  <hr class="rule thin" />
  <p>Back to <a href="../index.html">Papers</a> · <a href="../../index.html">homepage</a></p>
</body>
</html>
`;
}

async function writeOutputs({ weeks, merged, cfg, builtAt }) {
  const dates = weeks.map((w) => w.label);
  const weekRange =
    dates.length === 0
      ? "(none)"
      : dates.length === 1
        ? dates[0]
        : `${dates[dates.length - 1]} → ${dates[0]}`;

  const payload = {
    builtAt,
    weekBoundary:
      "Friday 14:00 America/New_York (EDT=UTC-4 → Fri 18:00 UTC / Sat 02:00 Asia/Shanghai; EST=UTC-5 → Fri 19:00 UTC / Sat 03:00 Asia/Shanghai)",
    paperCount: merged.length,
    weekCount: weeks.length,
    weekRange,
    authors: cfg.authors.map((a) => ({
      name: a.name,
      shortName: a.shortName,
      field: a.field,
      query: a.query,
      filter: a.filter || null,
    })),
    weeks: weeks.map(({ label, items }) => ({
      label,
      papers: items.map((p) => ({
        title: p.title,
        absUrl: p.absUrl,
        arxivId: p.arxivId,
        published: p.published,
        matchedWatchAuthors: p.matchedWatchAuthors,
        matchedShortNames: p.matchedShortNames,
      })),
    })),
  };

  await fs.writeFile(
    path.join(ROOT, "papers.json"),
    JSON.stringify(payload, null, 2) + "\n"
  );
  await fs.writeFile(
    path.join(ROOT, "index.html"),
    renderHtml({
      weeks,
      authors: cfg.authors,
    })
  );
  await fs.writeFile(path.join(ROOT, ".nojekyll"), "");
  process.stderr.write(
    `Wrote papers.json + index.html · ${merged.length} papers · ${weeks.length} weeks · ${weekRange}\n`
  );
}

/** Rebuild HTML/JSON from existing papers.json (no API). Remap shortNames from authors.json. */
async function renderOnly() {
  const cfg = JSON.parse(await fs.readFile(path.join(ROOT, "authors.json"), "utf8"));
  const data = JSON.parse(await fs.readFile(path.join(ROOT, "papers.json"), "utf8"));
  const shortByName = new Map(
    cfg.authors.map((a) => [a.name, a.shortName || a.name])
  );
  const weeks = (data.weeks || []).map((w) => ({
    label: w.label,
    items: (w.papers || []).map((p) => {
      const names = p.matchedWatchAuthors || [];
      const shorts = names.map((n) => shortByName.get(n) || n);
      return {
        ...p,
        matchedWatchAuthors: names,
        matchedShortNames: shorts.length ? shorts : p.matchedShortNames || [],
      };
    }),
  }));
  const merged = weeks.flatMap((w) => w.items);
  await writeOutputs({
    weeks,
    merged,
    cfg,
    builtAt: data.builtAt || new Date().toISOString(),
  });
}

async function main() {
  if (process.argv.includes("--html-only")) {
    await renderOnly();
    return;
  }

  const cfgPath = path.join(ROOT, "authors.json");
  const cfg = JSON.parse(await fs.readFile(cfgPath, "utf8"));
  const authorPapers = [];

  process.stderr.write(`Fetching ${cfg.authors.length} authors from arXiv…\n`);
  for (const author of cfg.authors) {
    const papers = await fetchAuthor(author, cfg);
    process.stderr.write(`  → kept ${papers.length} for ${author.name}\n`);
    authorPapers.push({ author, papers });
    await sleep(cfg.requestDelayMs || 400);
  }

  const merged = mergePapers(authorPapers);
  const weeks = groupByWeek(merged);
  await writeOutputs({
    weeks,
    merged,
    cfg,
    builtAt: new Date().toISOString(),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
