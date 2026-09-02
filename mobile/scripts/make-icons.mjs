/** Generate deterministic Rate Ledger release artwork using the declared Node toolchain. */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pngjs from 'pngjs';

const { PNG } = pngjs;
const assets = fileURLToPath(new URL('../assets/', import.meta.url));
const PAPER = [244, 240, 230, 255];
const INK = [21, 35, 31, 255];
const RULE = [147, 139, 124, 255];
const EUCALYPTUS = [46, 106, 86, 255];
const WATTLE = [213, 166, 46, 255];
const CLEAR = [0, 0, 0, 0];

function canvas(size, color) {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) setPixel(png, x, y, color, 1);
  }
  return png;
}

function setPixel(png, x, y, color, coverage) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height || coverage <= 0) return;
  const offset = (Math.floor(y) * png.width + Math.floor(x)) * 4;
  const alpha = (color[3] / 255) * Math.min(1, coverage);
  const priorAlpha = png.data[offset + 3] / 255;
  const outAlpha = alpha + priorAlpha * (1 - alpha);
  for (let channel = 0; channel < 3; channel += 1) {
    const prior = png.data[offset + channel];
    png.data[offset + channel] = outAlpha
      ? Math.round((color[channel] * alpha + prior * priorAlpha * (1 - alpha)) / outAlpha)
      : 0;
  }
  png.data[offset + 3] = Math.round(outAlpha * 255);
}

function rect(png, x0, y0, x1, y1, color) {
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(png.height, Math.ceil(y1)); y += 1) {
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(png.width, Math.ceil(x1)); x += 1) {
      setPixel(png, x, y, color, 1);
    }
  }
}

function circle(png, cx, cy, radius, color) {
  const edge = radius + 1;
  for (let y = Math.floor(cy - edge); y <= Math.ceil(cy + edge); y += 1) {
    for (let x = Math.floor(cx - edge); x <= Math.ceil(cx + edge); x += 1) {
      const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      setPixel(png, x, y, color, Math.max(0, Math.min(1, radius + 0.5 - distance)));
    }
  }
}

function line(png, from, to, width, color) {
  const [x0, y0] = from;
  const [x1, y1] = to;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lengthSquared = dx * dx + dy * dy || 1;
  const radius = width / 2;
  const padding = radius + 1;
  for (let y = Math.floor(Math.min(y0, y1) - padding); y <= Math.ceil(Math.max(y0, y1) + padding); y += 1) {
    for (let x = Math.floor(Math.min(x0, x1) - padding); x <= Math.ceil(Math.max(x0, x1) + padding); x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / lengthSquared));
      const distance = Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
      setPixel(png, x, y, color, Math.max(0, Math.min(1, radius + 0.5 - distance)));
    }
  }
}

function rateMark(png, inset) {
  const x0 = inset;
  const y0 = inset;
  const x1 = png.width - inset;
  const y1 = png.height - inset;
  const width = x1 - x0;
  const height = y1 - y0;
  for (const fraction of [0.24, 0.5, 0.76]) {
    const y = y0 + height * fraction;
    line(png, [x0, y], [x1, y], Math.max(2, width * 0.018), RULE);
  }
  const points = [
    [x0 + width * 0.04, y0 + height * 0.72],
    [x0 + width * 0.30, y0 + height * 0.57],
    [x0 + width * 0.49, y0 + height * 0.63],
    [x0 + width * 0.72, y0 + height * 0.35],
    [x0 + width * 0.96, y0 + height * 0.27],
  ];
  for (let index = 1; index < points.length; index += 1) {
    line(png, points[index - 1], points[index], Math.max(3, width * 0.045), INK);
  }
  const radius = Math.max(3, width * 0.068);
  circle(png, points[3][0], points[3][1], radius, WATTLE);
  circle(png, points[3][0], points[3][1], radius * 0.34, INK);
}

function write(name, size, background, insetFraction, sideRule = false) {
  const png = canvas(size, background);
  if (sideRule) rect(png, 0, 0, size * 0.055, size, EUCALYPTUS);
  rateMark(png, size * insetFraction);
  writeFileSync(`${assets}${name}`, PNG.sync.write(png, { colorType: 6, inputColorType: 6 }));
}

write('icon.png', 1024, PAPER, 0.17, true);
write('favicon.png', 64, PAPER, 0.17, true);
write('adaptive-icon.png', 1024, CLEAR, 0.27);
write('splash.png', 1024, CLEAR, 0.31);
process.stdout.write(`Wrote Rate Ledger artwork to ${assets}\n`);
