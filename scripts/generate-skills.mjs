#!/usr/bin/env node
/**
 * Gera a seção "Habilidades" (dark + light) a partir de skills.config.json.
 * Igual ao hero: edite o JSON e rode o script de novo — sem token, sem rede.
 *
 * Uso:
 *   node scripts/generate-skills.mjs
 *
 * Saída:
 *   assets/skills-dark.svg
 *   assets/skills-light.svg
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FONT, BASE_THEME, TITLE_BAR_H, terminalChrome, charW } from "./lib/theme.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "assets");
const CONFIG_PATH = join(__dirname, "..", "skills.config.json");

function escapeXML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function loadConfig() {
  const raw = await readFile(CONFIG_PATH, "utf8");
  const config = JSON.parse(raw);
  if (!config.username) throw new Error('skills.config.json: campo obrigatório ausente: "username"');
  config.categories = Array.isArray(config.categories) ? config.categories : [];
  return config;
}

const PILL_FONT_SIZE = 13;
const PILL_H = 24;
const PILL_PAD_X = 14;
const PILL_GAP_X = 8;
const PILL_GAP_Y = 10;
const LABEL_GAP = 22; // espaço entre o rótulo da categoria e a primeira linha de pills
const CATEGORY_GAP = 26; // espaço entre categorias

function layoutCategory(items, x0, xMax, yStart, theme) {
  let x = x0;
  let y = yStart;
  const pills = [];
  for (const item of items) {
    const w = item.length * charW(PILL_FONT_SIZE) + PILL_PAD_X * 2;
    if (x + w > xMax && x > x0) {
      x = x0;
      y += PILL_H + PILL_GAP_Y;
    }
    pills.push(
      `<rect x="${x.toFixed(2)}" y="${y}" width="${w.toFixed(2)}" height="${PILL_H}" rx="${PILL_H / 2}" fill="${theme.header}" stroke="${theme.border}"/>` +
        `<text x="${(x + w / 2).toFixed(2)}" y="${y + PILL_H / 2 + 4.5}" text-anchor="middle" font-family="${FONT}" font-size="${PILL_FONT_SIZE}" fill="${theme.text}">${escapeXML(item)}</text>`
    );
    x += w + PILL_GAP_X;
  }
  return { svg: pills.join(""), bottomY: y + PILL_H };
}

function renderSVG(config, theme) {
  const width = 860;
  const padX = 28;
  const xMax = width - padX;

  let y = TITLE_BAR_H + 40;
  const blocks = [];

  for (const category of config.categories) {
    const labelY = y;
    const label = `<text x="${padX}" y="${labelY}" font-family="${FONT}" font-size="13" font-weight="700" fill="${theme.accent}"># ${escapeXML(category.label)}</text>`;
    const { svg: pillsSVG, bottomY } = layoutCategory(category.items, padX, xMax, labelY + LABEL_GAP - PILL_H + 6, theme);
    blocks.push(label + pillsSVG);
    y = bottomY + CATEGORY_GAP;
  }

  const height = y - CATEGORY_GAP + 24;
  const chrome = terminalChrome(width, theme, `${config.username}@github: ~$ ls skills/`);
  const label = `Habilidades de ${config.username}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXML(label)}">
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="11" fill="${theme.bg}" stroke="${theme.border}"/>${chrome.svg}
  ${blocks.join("\n  ")}
</svg>`;
}

async function main() {
  const config = await loadConfig();

  await writeFile(join(OUT_DIR, "skills-dark.svg"), renderSVG(config, BASE_THEME.dark));
  await writeFile(join(OUT_DIR, "skills-light.svg"), renderSVG(config, BASE_THEME.light));

  console.log(`OK: habilidades geradas a partir de skills.config.json — SVGs escritos em ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
