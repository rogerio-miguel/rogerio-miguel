#!/usr/bin/env node
/**
 * Gera os heatmaps de contribuições (dark + light) usados no README,
 * substituindo o widget de terceiros (gitskins.com) por dados reais
 * lidos diretamente da API GraphQL do GitHub.
 *
 * Uso:
 *   GH_USERNAME=rogerio-miguel GH_TOKEN=<PAT com escopo read:user> node scripts/generate-heatmap.mjs
 *
 * Saída:
 *   assets/contributions-dark.svg
 *   assets/contributions-light.svg
 */

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FONT, BASE_THEME, TITLE_BAR_H, terminalChrome } from "./lib/theme.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "assets");

const USERNAME = process.env.GH_USERNAME || "rogerio-miguel";
const TOKEN = process.env.GH_TOKEN;

const QUERY = `
  query ($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              weekday
              contributionCount
            }
          }
        }
      }
    }
  }
`;

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const WEEKDAY_LABELS = { 1: "Seg", 3: "Qua", 5: "Sex" };

const THEMES = {
  dark: { ...BASE_THEME.dark, levels: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"] },
  light: { ...BASE_THEME.light, levels: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"] },
};

async function fetchCalendar() {
  if (!TOKEN) {
    throw new Error(
      "Faltou GH_TOKEN (personal access token classic com escopo 'read:user')."
    );
  }

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

  return json.data.user.contributionsCollection.contributionCalendar;
}

function levelFor(count, max) {
  if (count <= 0 || max <= 0) return 0;
  const ratio = count / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

function monthLabels(weeks) {
  const labels = [];
  let lastMonth = -1;
  weeks.forEach((week, col) => {
    const firstDay = week.contributionDays[0];
    if (!firstDay) return;
    const month = new Date(`${firstDay.date}T00:00:00Z`).getUTCMonth();
    if (month !== lastMonth) {
      labels.push({ col, label: MONTHS[month] });
      lastMonth = month;
    }
  });
  return labels;
}

function renderSVG(calendar, theme, username) {
  const cell = 11;
  const gap = 3;
  const pitch = cell + gap;

  const weeks = calendar.weeks;
  const allDays = weeks.flatMap((w) => w.contributionDays);
  const max = Math.max(1, ...allDays.map((d) => d.contributionCount));

  const padX = 16;
  const weekdayColW = 26;
  const titleBarH = TITLE_BAR_H;
  const monthLabelH = 18;
  const gridH = 7 * pitch - gap;
  const footerH = 34;

  const gridX = padX + weekdayColW;
  const gridY = titleBarH + monthLabelH;
  const gridW = weeks.length * pitch - gap;

  const width = gridX + gridW + padX;
  const height = gridY + gridH + footerH;

  const months = monthLabels(weeks);

  const cells = weeks
    .map((week, col) =>
      week.contributionDays
        .map((day) => {
          const x = gridX + col * pitch;
          const y = gridY + day.weekday * pitch;
          const lvl = levelFor(day.contributionCount, max);
          const label = `${day.contributionCount} contribuições em ${day.date}`;
          return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2.5" fill="${theme.levels[lvl]}"><title>${label}</title></rect>`;
        })
        .join("")
    )
    .join("");

  const monthText = months
    .map(
      ({ col, label }) =>
        `<text x="${gridX + col * pitch}" y="${titleBarH + 13}" font-family="${FONT}" font-size="10" fill="${theme.mute}">${label}</text>`
    )
    .join("");

  const weekdayText = Object.entries(WEEKDAY_LABELS)
    .map(
      ([weekday, label]) =>
        `<text x="${padX}" y="${gridY + Number(weekday) * pitch + cell - 2}" font-family="${FONT}" font-size="9" fill="${theme.mute}">${label}</text>`
    )
    .join("");

  const legendSize = 10;
  const legendGap = 3;
  const legendLabelW = 28; // largura reservada para "Less" / "More"
  const legendLabelGap = 6;
  const squaresW = theme.levels.length * legendSize + (theme.levels.length - 1) * legendGap;
  const legendW = legendLabelW + legendLabelGap + squaresW + legendLabelGap + legendLabelW;
  const legendStartX = width - padX - legendW;
  const legendY = gridY + gridH + footerH / 2 - legendSize / 2;
  const squaresStartX = legendStartX + legendLabelW + legendLabelGap;
  const legendSquares = theme.levels
    .map(
      (color, i) =>
        `<rect x="${squaresStartX + i * (legendSize + legendGap)}" y="${legendY}" width="${legendSize}" height="${legendSize}" rx="2" fill="${color}"/>`
    )
    .join("");
  const legendMoreX = squaresStartX + squaresW + legendLabelGap;

  const total = calendar.totalContributions;
  const chrome = terminalChrome(width, theme, `${username}@github: ~$ ./contributions.sh`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${total} contribuições de ${username} no último ano">
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="11" fill="${theme.bg}" stroke="${theme.border}"/>${chrome.svg}
  <g>${monthText}</g>
  <g>${weekdayText}</g>
  <g>${cells}</g>
  <text x="${padX}" y="${height - footerH / 2 + 4}" font-family="${FONT}" font-size="13" fill="${theme.mute}">${total} contribuições no último ano</text>
  <text x="${legendStartX}" y="${legendY + legendSize - 1}" font-family="${FONT}" font-size="10" fill="${theme.mute}">Less</text>
  ${legendSquares}
  <text x="${legendMoreX}" y="${legendY + legendSize - 1}" font-family="${FONT}" font-size="10" fill="${theme.mute}">More</text>
</svg>`;
}

async function main() {
  const calendar = await fetchCalendar();

  await writeFile(join(OUT_DIR, "contributions-dark.svg"), renderSVG(calendar, THEMES.dark, USERNAME));
  await writeFile(join(OUT_DIR, "contributions-light.svg"), renderSVG(calendar, THEMES.light, USERNAME));

  console.log(`OK: ${calendar.totalContributions} contribuições no último ano — SVGs escritos em ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
