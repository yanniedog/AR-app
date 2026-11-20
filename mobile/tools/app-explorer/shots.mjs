// Targeted screenshot pass. Reads shots.json (max 20 entries, edited by each PR for the
// next run), captures each screen with the explorer driver, then builds thumbnails,
// two contact sheets and a flag list so a reviewer reads only what is flagged.
// Usage: node shots.mjs <out dir> [--analyze-only]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const out = process.argv[2] || 'explorer-out/shots';
const here = path.dirname(new URL(import.meta.url).pathname);
const manifest = JSON.parse(fs.readFileSync(path.join(here, 'shots.json'), 'utf8')).slice(0, 20);
const FLAG_TEXT = /unavailable|went wrong|something|error|failed|retry|no data|crash/i;

if (!process.argv.includes('--analyze-only')) {
  const script = [{ launch: true, name: 'cold start' }];
  for (const s of manifest) {
    script.push({ open: s.open, name: `${s.name}-open` });
    if (s.scroll) script.push({ scroll: 'down', times: s.scroll, name: s.name });
    else script.push({ wait: 600, name: s.name });
  }
  fs.mkdirSync(out, { recursive: true });
  const scriptPath = path.join(out, 'shots-script.json');
  fs.writeFileSync(scriptPath, JSON.stringify(script));
  spawnSync('node', [path.join(here, 'driver.mjs'), '--mode', 'script', '--script', scriptPath, '--out', out, '--fresh'], { stdio: 'inherit' });
}

const report = (() => { try { return JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8')); } catch { return { steps: [] }; } })();
const im = (cmd, args) => { try { return execFileSync(cmd, args, { encoding: 'utf8' }).trim(); } catch { return ''; } };
const results = [];
fs.mkdirSync(path.join(out, 'thumbs'), { recursive: true });
for (const s of manifest) {
  const step = report.steps.find(st => st.name === s.name);
  const r = { name: s.name, why: s.why, flags: [] };
  if (!step) r.flags.push('not captured');
  else {
    if (!step.alive) r.flags.push('app dead');
    if (step.error) r.flags.push(`step error: ${step.error.slice(0, 80)}`);
    if (step.settleTimedOut) r.flags.push('never settled');
    if (step.log?.errors?.length) r.flags.push(`${step.log.errors.length} log errors`);
    const bad = (step.visible || []).find(v => FLAG_TEXT.test(v));
    if (bad) r.flags.push(`text: ${bad.slice(0, 50)}`);
    if (!(step.visible || []).length) r.flags.push('no visible text');
    const png = path.join(out, 'screens', `${step.slug}.png`);
    if (fs.existsSync(png)) {
      const sd = parseFloat(im('convert', [png, '-colorspace', 'Gray', '-format', '%[fx:standard_deviation]', 'info:']));
      if (!Number.isNaN(sd) && sd < 0.03) r.flags.push(`near blank (sd ${sd.toFixed(3)})`);
      im('convert', [png, '-resize', '240x', '-quality', '55', path.join(out, 'thumbs', `${s.name}.jpg`)]);
      r.thumb = true;
    }
  }
  results.push(r);
}
for (const [i, chunk] of [results.slice(0, 10), results.slice(10, 20)].entries()) {
  const files = chunk.filter(r => r.thumb).flatMap(r => ['-label', `${r.name}${r.flags.length ? ' !' : ''}`, path.join(out, 'thumbs', `${r.name}.jpg`)]);
  if (files.length) im('montage', [...files, '-tile', '5x2', '-geometry', '240x+4+4', '-pointsize', '14', '-quality', '60', path.join(out, `contact-${i + 1}.jpg`)]);
}
// Full-size PNGs stay out of the results branch; thumbnails and sheets are enough.
fs.rmSync(path.join(out, 'screens'), { recursive: true, force: true });
fs.writeFileSync(path.join(out, 'shots-result.json'), JSON.stringify({ count: results.filter(r => r.thumb).length, flagged: results.filter(r => r.flags.length).length, results }, null, 1));
console.log(`shots: ${results.filter(r => r.thumb).length} captured, ${results.filter(r => r.flags.length).length} flagged`);
