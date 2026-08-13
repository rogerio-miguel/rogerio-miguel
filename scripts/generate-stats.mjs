#!/usr/bin/env node
/**
 * Gera o card "GitHub Stats" (dark + light) a partir de dados reais da API
 * GraphQL + REST do GitHub — repositórios próprios (incluindo privados), stars,
 * total de commits (Search API, histórico completo), total de PRs (totalCount,
 * histórico completo) e linguagens por bytes.
 * Nome/cargo vêm do mesmo hero.config.json usado pela hero section.
 *
 * Uso:
 *   GH_USERNAME=rogerio-miguel GH_TOKEN=<PAT com escopos read:user + repo> node scripts/generate-stats.mjs
 *
 * Saída:
 *   assets/stats-dark.svg
 *   assets/stats-light.svg
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FONT, BASE_THEME, TITLE_BAR_H, terminalChrome, charW } from "./lib/theme.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "assets");
const HERO_CONFIG_PATH = join(__dirname, "..", "hero.config.json");

const USERNAME = process.env.GH_USERNAME || "rogerio-miguel";
const TOKEN = process.env.GH_TOKEN;

const QUERY = `
  query ($login: String!) {
    user(login: $login) {
      repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
        totalCount
        nodes {
          stargazerCount
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            edges { size node { name color } }
          }
        }
      }
      pullRequests(first: 1) {
        totalCount
      }
    }
  }
`;

async function fetchGraphQL() {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": USERNAME,
    },
    body: JSON.stringify({ query: QUERY, variables: { login: USERNAME } }),
  });

  if (!res.ok) {
    throw new Error(`GitHub API respondeu ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(`Erro GraphQL: ${JSON.stringify(json.errors)}`);
  }

  return json.data.user;
}

// Total de commits ao longo de toda a conta (não só o último ano), igual ao
// que o github-readme-stats faz com include_all_commits=true: usa a Search
// API de commits, que indexa o histórico inteiro do autor.
async function fetchTotalCommits() {
  const res = await fetch(`https://api.github.com/search/commits?q=${encodeURIComponent(`author:${USERNAME}`)}`, {
    headers: {
      Authorization: `bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": USERNAME,
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub Search API (commits) respondeu ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  return json.total_count;
}

async function fetchStats() {
  if (!TOKEN) {
    throw new Error("Faltou GH_TOKEN (personal access token classic com escopo 'read:user').");
  }

  const [user, totalCommits] = await Promise.all([fetchGraphQL(), fetchTotalCommits()]);
  return { ...user, totalCommits };
}

function aggregateLanguages(repos) {
  const totals = new Map(); // name -> { size, color }
  for (const repo of repos) {
    for (const edge of repo.languages.edges) {
      const key = edge.node.name;
      const prev = totals.get(key) || { size: 0, color: edge.node.color || "#8b949e" };
      prev.size += edge.size;
      totals.set(key, prev);
    }
  }
  return [...totals.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.size - a.size);
}

function renderSVG(data, hero, theme) {
  const width = 860;
  const padX = 34;

  const repos = data.repositories.nodes;
  const totalStars = repos.reduce((sum, r) => sum + r.stargazerCount, 0);
  const languages = aggregateLanguages(repos);
  const totalCommits = data.totalCommits;
  const totalPRs = data.pullRequests.totalCount;

  const rows = [
    ["Name", hero.name],
    ["Role", hero.role],
    ["Stars", String(totalStars)],
    ["Repos", String(data.repositories.totalCount)],
    ["Total Commits", String(totalCommits)],
    ["Total PRs", String(totalPRs)],
  ];

  const colX = padX;
  const headerY = TITLE_BAR_H + 38;
  const header =
    `<text x="${colX}" y="${headerY}" font-family="${FONT}" font-size="15" font-weight="800" fill="${theme.link}">${USERNAME}</text>` +
    `<text x="${colX + USERNAME.length * charW(15)}" y="${headerY}" font-family="${FONT}" font-size="15" fill="${theme.mute}">@github</text>` +
    `<text x="${colX}" y="${headerY + 18}" font-family="${FONT}" font-size="15" fill="${theme.mute}">──────────────────────────────</text>`;

  const rowStartY = headerY + 42;
  const rowGap = 25;
  const rowsSVG = rows
    .map(
      ([label, value], i) =>
        `<text x="${colX}" y="${rowStartY + i * rowGap}" font-family="${FONT}" font-size="14.5" font-weight="700" fill="${theme.link}">${label}</text>` +
        `<text x="${colX + 140}" y="${rowStartY + i * rowGap}" font-family="${FONT}" font-size="14.5" fill="${theme.text}">${value}</text>`
    )
    .join("");

  const rowsBottom = rowStartY + (rows.length - 1) * rowGap;
  const barY = rowsBottom + 34;

  // barra de linguagens (top 5 + "Outras"), proporcional aos bytes
  const top = languages.slice(0, 5);
  const restSize = languages.slice(5).reduce((s, l) => s + l.size, 0);
  const bars = restSize > 0 ? [...top, { name: "Outras", size: restSize, color: theme.border }] : top;
  const totalSize = bars.reduce((s, l) => s + l.size, 0) || 1;

  const barW = width - padX * 2;
  const barH = 12;
  let bx = padX;
  const barSegments = bars
    .map((lang) => {
      const w = (lang.size / totalSize) * barW;
      const seg = `<rect x="${bx.toFixed(2)}" y="${barY}" width="${w.toFixed(2)}" height="${barH}" fill="${lang.color}"><title>${lang.name} ${((lang.size / totalSize) * 100).toFixed(1)}%</title></rect>`;
      bx += w;
      return seg;
    })
    .join("");
  const barClipId = "stats-bar-clip";

  const legendY = barY + barH + 22;
  const legendGap = 6;
  let lx = padX;
  const legendItems = bars
    .map((lang) => {
      const pct = ((lang.size / totalSize) * 100).toFixed(1);
      const label = `${lang.name} ${pct}%`;
      const w = 16 + label.length * charW(11.5);
      const svg =
        `<circle cx="${lx + 5}" cy="${legendY - 4}" r="5" fill="${lang.color}"/>` +
        `<text x="${lx + 16}" y="${legendY}" font-family="${FONT}" font-size="11.5" fill="${theme.mute}">${label}</text>`;
      lx += w + legendGap;
      return svg;
    })
    .join("");

  const height = legendY + 24;
  const chrome = terminalChrome(width, theme, `${USERNAME}@github: ~$ neofetch`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Estatísticas de ${USERNAME} no GitHub">
  <defs>
    <clipPath id="${barClipId}"><rect x="${padX}" y="${barY}" width="${barW}" height="${barH}" rx="6"/></clipPath>
  </defs>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="11" fill="${theme.bg}" stroke="${theme.border}"/>${chrome.svg}
  ${header}
  ${rowsSVG}
  <g clip-path="url(#${barClipId})">${barSegments}</g>
  ${legendItems}
</svg>`;
}

async function main() {
  const [data, heroRaw] = await Promise.all([fetchStats(), readFile(HERO_CONFIG_PATH, "utf8")]);
  const hero = JSON.parse(heroRaw);

  await writeFile(join(OUT_DIR, "stats-dark.svg"), renderSVG(data, hero, BASE_THEME.dark));
  await writeFile(join(OUT_DIR, "stats-light.svg"), renderSVG(data, hero, BASE_THEME.light));

  console.log(`OK: stats geradas — SVGs escritos em ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
