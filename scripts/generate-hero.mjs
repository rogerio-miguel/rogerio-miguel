#!/usr/bin/env node
/**
 * Gera a hero section (dark + light) usada no README a partir de
 * hero.config.json — substitui o widget de terceiros (gitskins.com),
 * cujos dados não dá pra editar. Pra mudar nome, cargo ou bio, edite
 * o hero.config.json e rode este script de novo. Não depende de token
 * nem de rede: é só texto que você controla.
 *
 * Uso:
 *   node scripts/generate-hero.mjs
 *
 * Saída:
 *   assets/hero-dark.svg
 *   assets/hero-light.svg
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FONT, BASE_THEME, TITLE_BAR_H, terminalChrome, charW } from "./lib/theme.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "assets");
const CONFIG_PATH = join(__dirname, "..", "hero.config.json");

const THEMES = { dark: BASE_THEME.dark, light: BASE_THEME.light };

function escapeXML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function loadConfig() {
  const raw = await readFile(CONFIG_PATH, "utf8");
  const config = JSON.parse(raw);
  for (const field of ["username", "name", "role"]) {
    if (!config[field]) throw new Error(`hero.config.json: campo obrigatório ausente: "${field}"`);
  }
  config.shell = config.shell || "-zsh";
  config.bio = Array.isArray(config.bio) ? config.bio : [];
  return config;
}

const CHAR_W = charW(15);

/** Uma linha de prompt "user@github:~$ comando". Retorna { svg, endX } (endX = fim do texto, pro cursor). */
function promptLine(x, y, username, command, theme) {
  const label = `${username}@github`;
  const x2 = x + label.length * CHAR_W; // ":"
  const x3 = x2 + CHAR_W; // "~"
  const x4 = x3 + CHAR_W; // "$ "
  const x5 = x4 + 2 * CHAR_W; // comando
  const svg =
    `<text x="${x}" y="${y}" font-family="${FONT}" font-size="15" font-weight="700" fill="${theme.accent}">${escapeXML(label)}</text>` +
    `<text x="${x2}" y="${y}" font-family="${FONT}" font-size="15" fill="${theme.text}">:</text>` +
    `<text x="${x3}" y="${y}" font-family="${FONT}" font-size="15" fill="${theme.link}">~</text>` +
    `<text x="${x4}" y="${y}" font-family="${FONT}" font-size="15" fill="${theme.text}">$ </text>` +
    `<text x="${x5}" y="${y}" font-family="${FONT}" font-size="15" fill="${theme.text}">${escapeXML(command)}</text>`;
  return { svg, endX: x5 + command.length * CHAR_W };
}

function renderSVG(config, theme) {
  const padX = 28;
  const width = 860;

  const rows = [];
  let y = TITLE_BAR_H + 38;

  rows.push({ y, svg: promptLine(padX, y, config.username, "whoami", theme).svg });
  y += 34;
  rows.push({ y, svg: `<text x="${padX}" y="${y}" font-family="${FONT}" font-size="20" font-weight="800" fill="${theme.text}">${escapeXML(config.name)}</text>` });
  y += 28;
  rows.push({ y, svg: `<text x="${padX}" y="${y}" font-family="${FONT}" font-size="15" fill="${theme.link}">${escapeXML(config.role)}</text>` });
  y += 40;

  if (config.bio.length > 0) {
    rows.push({ y, svg: promptLine(padX, y, config.username, "cat bio.txt", theme).svg });
    y += 30;
    for (const line of config.bio) {
      rows.push({ y, svg: `<text x="${padX}" y="${y}" font-family="${FONT}" font-size="15" fill="${theme.mute}">${escapeXML(line)}</text>` });
      y += 24;
    }
    y += 10;
  }

  // prompt final ocioso, com cursor piscando
  const idle = promptLine(padX, y, config.username, "", theme);
  rows.push({ y, svg: `${idle.svg}<rect class="cur" x="${idle.endX}" y="${y - 12}" width="9" height="16" fill="${theme.link}"/>` });
  y += 20;

  const height = y + 24;
  const chrome = terminalChrome(width, theme, `${config.username}@github: ~ — ${config.shell}`);
  const label = `${config.name} — ${config.role}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXML(label)}">
  <style>
    .cur { animation: blink 1.1s step-end infinite; }
    @keyframes blink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }
  </style>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="11" fill="${theme.bg}" stroke="${theme.border}"/>${chrome.svg}
  ${rows.map((r) => r.svg).join("\n  ")}
</svg>`;
}

async function main() {
  const config = await loadConfig();

  await writeFile(join(OUT_DIR, "hero-dark.svg"), renderSVG(config, THEMES.dark));
  await writeFile(join(OUT_DIR, "hero-light.svg"), renderSVG(config, THEMES.light));

  console.log(`OK: hero de "${config.name}" gerado a partir de hero.config.json — SVGs escritos em ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
