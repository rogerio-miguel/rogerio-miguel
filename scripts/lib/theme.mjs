// Paleta compartilhada pelos geradores de SVG (heatmap, hero, ...),
// pra manter a mesma cara de "terminal" em todas as seções do README.

export const FONT = "ui-monospace,'SF Mono',SFMono-Regular,Menlo,Consolas,monospace";

// Largura de um caractere em ui-monospace, calibrada a partir dos valores
// de referência do gitskins (9.02px de avanço por caractere a font-size 15).
export function charW(fontSize) {
  return fontSize * 0.6013;
}

export const BASE_THEME = {
  dark: {
    bg: "#0b0e14",
    header: "#161b22",
    border: "#2a3038",
    text: "#c9d1d9",
    mute: "#8b949e",
    accent: "#3fb950",
    link: "#58a6ff",
    dots: ["#ff5f56", "#ffbd2e", "#27c93f"],
  },
  light: {
    bg: "#ffffff",
    header: "#f6f8fa",
    border: "#d0d7de",
    text: "#24292f",
    mute: "#57606a",
    accent: "#1a7f37",
    link: "#0969da",
    dots: ["#ff5f56", "#ffbd2e", "#27c93f"],
  },
};

export const TITLE_BAR_H = 32;

/** Cabeçalho da janela de terminal (barra de título + 3 bolinhas). */
export function terminalChrome(width, theme, titleText) {
  const titleBarH = TITLE_BAR_H;
  const svg = `
  <path d="M0.5 12 a11 11 0 0 1 11 -11 h${width - 24} a11 11 0 0 1 11 11 v${titleBarH - 12} h-${width - 1} z" fill="${theme.header}"/>
  <rect x="0.5" y="${titleBarH}" width="${width - 1}" height="1" fill="${theme.border}"/>
  <circle cx="22" cy="16" r="6" fill="${theme.dots[0]}"/><circle cx="42" cy="16" r="6" fill="${theme.dots[1]}"/><circle cx="62" cy="16" r="6" fill="${theme.dots[2]}"/>
  <text x="${width / 2}" y="20.5" text-anchor="middle" font-family="${FONT}" font-size="12.5" fill="${theme.mute}">${titleText}</text>`;
  return { svg, titleBarH };
}
