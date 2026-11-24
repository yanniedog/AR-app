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
// Manifest values reach adb and the issue body, so only plain, bounded values are accepted.
const validLabel = label => typeof label === 'string' && /^[a-z0-9 &-]{1,60}$/i.test(label);
for (const s of manifest) {
  if (!/^[a-z0-9-]{1,40}$/.test(s.name)) throw new Error(`bad shot name: ${s.name}`);
  if (!/^\/[a-z0-9-]+(\/[a-z0-9-]+)*(\?[a-z0-9=&_-]*)?$/i.test(s.open)) throw new Error(`bad shot route: ${s.open}`);
  if (s.scroll !== undefined && !(Number.isInteger(s.scroll) && s.scroll >= 0 && s.scroll <= 10)) throw new Error(`bad shot scroll: ${s.scroll}`);
  if (s.taps !== undefined && (!Array.isArray(s.taps) || s.taps.length > 3 || !s.taps.every(validLabel))) throw new Error(`bad shot taps: ${s.name}`);
  if (s.visibleAction !== undefined && (!validLabel(s.visibleAction) || s.scroll)) throw new Error(`bad shot action: ${s.name}`);
}
const FLAG_TEXT = /unavailable|went wrong|something|error|failed|retry|no data|crash/i;

if (!process.argv.includes('--analyze-only')) {
  const script = [{ launch: true, name: 'cold start' }];
  for (const s of manifest) {
    script.push({ open: s.open, name: `${s.name}-open` });
    for (const [i, tap] of (s.taps || []).entries()) {
      script.push({ tap: { label: tap, clickable: true }, scroll: true, name: `${s.name}-tap-${i + 1}` });
    }
    if (s.visibleAction) script.push({ waitFor: { label: s.visibleAction, clickable: true, enabled: true }, timeout: 8000, name: s.name });
    else if (s.scroll) script.push({ scroll: 'down', times: s.scroll, name: s.name });
    else script.push({ wait: 600, name: s.name });
  }
  fs.mkdirSync(out, { recursive: true });
  const scriptPath = path.join(out, 'shots-script.json');
  fs.writeFileSync(scriptPath, JSON.stringify(script));
  spawnSync('node', [path.join(here, 'driver.mjs'), '--mode', 'script', '--script', scriptPath, '--out', out, ...(process.env.FRESH === 'false' ? [] : ['--fresh'])], { stdio: 'inherit' });
}

const report = (() => { try { return JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8')); } catch { return { steps: [] }; } })();
const hasBin = name => { try { execFileSync('which', [name]); return true; } catch { return false; } };
const IM7 = !hasBin('convert') && hasBin('magick');
const im = (cmd, args) => {
  const [bin, pre] = IM7 ? ['magick', [cmd === 'convert' ? [] : [cmd]].flat()] : [cmd, []];
  try { return execFileSync(bin, [...pre, ...args], { encoding: 'utf8' }).trim(); } catch { return ''; }
};
const results = [];
fs.mkdirSync(path.join(out, 'thumbs'), { recursive: true });
for (const s of manifest) {
  const step = report.steps.find(st => st.name === s.name);
  const nav = report.steps.find(st => st.name === `${s.name}-open`);
  const r = { name: s.name, why: s.why, flags: [] };
  // Failures while opening the route count against the shot even if a later step looks healthy.
  if (nav) {
    if (!nav.alive) r.flags.push('app died opening route');
    if (nav.error) r.flags.push(`open error: ${nav.error.slice(0, 80)}`);
    if (nav.settleTimedOut) r.flags.push('open never settled');
    if (nav.anr) r.flags.push('ANR opening route');
    if (nav.log?.errors?.length) r.flags.push(`${nav.log.errors.length} log errors opening`);
  }
  for (const [i, tap] of (s.taps || []).entries()) {
    const navigation = report.steps.find(st => st.name === `${s.name}-tap-${i + 1}`);
    if (!navigation || !navigation.alive || navigation.error) r.flags.push(`could not tap ${tap}`);
  }
  if (!step) r.flags.push('not captured');
  else {
    if (!step.alive) r.flags.push('app dead');
    if (step.error) r.flags.push(`step error: ${step.error.slice(0, 80)}`);
    if (step.settleTimedOut) r.flags.push('never settled');
    if (step.anr) r.flags.push('ANR');
    if (step.log?.errors?.length) r.flags.push(`${step.log.errors.length} log errors`);
    const bad = (step.visible || []).find(v => FLAG_TEXT.test(v));
    if (bad) r.flags.push(`text: ${bad.slice(0, 50)}`);
    if (!(step.visible || []).length) r.flags.push('no visible text');
    const png = path.join(out, 'screens', `${step.slug}.png`);
    if (!fs.existsSync(png)) r.flags.push('no screenshot file');
    if (fs.existsSync(png)) {
      const sd = parseFloat(im('convert', [png, '-colorspace', 'Gray', '-format', '%[fx:standard_deviation]', 'info:']));
      if (!Number.isNaN(sd) && sd < 0.03) r.flags.push(`near blank (sd ${sd.toFixed(3)})`);
      const thumb = path.join(out, 'thumbs', `${s.name}.jpg`);
      im('convert', [png, '-resize', '240x', '-quality', '55', thumb]);
      if (fs.existsSync(thumb)) r.thumb = true;
      else { r.flags.push('thumbnail failed'); r.keepPng = true; }
    }
  }
  results.push(r);
}
const sheets = [];
for (const [i, chunk] of [results.slice(0, 10), results.slice(10, 20)].entries()) {
  const files = chunk.filter(r => r.thumb).flatMap(r => ['-label', `${r.name}${r.flags.length ? ' !' : ''}`, path.join(out, 'thumbs', `${r.name}.jpg`)]);
  if (files.length) im('montage', [...files, '-tile', '5x2', '-geometry', '240x+4+4', '-pointsize', '14', '-quality', '60', path.join(out, `contact-${i + 1}.jpg`)]);
  if (fs.existsSync(path.join(out, `contact-${i + 1}.jpg`))) sheets.push(i + 1);
  else if (files.length) for (const r of chunk.filter(x => x.thumb)) r.flags.push('contact sheet failed');
}
// Full-size PNGs stay out of the results branch; thumbnails and sheets are enough.
if (results.every(r => r.thumb || !r.keepPng)) fs.rmSync(path.join(out, 'screens'), { recursive: true, force: true });
fs.writeFileSync(path.join(out, 'shots-result.json'), JSON.stringify({ count: results.filter(r => r.thumb).length, flagged: results.filter(r => r.flags.length).length, sheets, results }, null, 1));
console.log(`shots: ${results.filter(r => r.thumb).length} captured, ${results.filter(r => r.flags.length).length} flagged`);
