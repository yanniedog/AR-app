import { htmlPlainText } from '../src/lib/htmlPlainText';

test.each(['script', 'style'])('requires the complete %s closing name', (name) => {
  expect(htmlPlainText(`<${name}>hidden</${name}ure>hidden</${name}>Visible`).trim()).toBe('Visible');
});

test('discards an unterminated quoted attribute', () => {
  expect(htmlPlainText('Visible<div title="hidden >')).toBe('Visible ');
});

test.each([
  '<script data-x=foo">hidden</script>',
  '<script data-x="></script>">hidden</script>',
  '<script data-x= "></script>">hidden</script>',
  '<script/>hidden</script>',
  '<script>İ</SCRIPT >',
  '<!-- <script> -->',
])('preserves visible text after blocked markup %s', (prefix) => {
  expect(htmlPlainText(`${prefix}Visible`).trim()).toBe('Visible');
});

test('handles thousands of false closer prefixes in one forward scan', () => {
  const raw = `<script>${'</script'.repeat(8_000)}</script>Visible`;
  expect(htmlPlainText(raw).trim()).toBe('Visible');
});

test.each(['<!-- hidden --!>', '<!-->', '<!--->', '<!-- hidden --->'])('recognizes HTML comment ending %s', (comment) => {
  expect(htmlPlainText(`${comment}Visible`).trim()).toBe('Visible');
});

test.each([
  '<script><!--<script></script>alert(1)</script>',
  '<script><!--<ScRiPt ></SCRIPT >alert(1)</script>',
  '<script><!--<script/>hidden</script/>hidden</script>',
  '<script><!--<script>--></script>',
  '<script><!--<script>--><script></script>',
  '<script><!--></script>',
  '<script><!---></script>',
  '<script><!--<scripture></script>',
])('tracks script escape states in %s', (script) => {
  expect(htmlPlainText(`${script}Visible`).trim()).toBe('Visible');
});

test('does not expose text after an unclosed double-escaped script', () => {
  expect(htmlPlainText('<script><!--<script></script>hidden')).toBe(' ');
});

test.each(['<x="y>Visible', '</x="y>Visible'])('keeps equals signs inside tag names %s', (raw) => {
  expect(htmlPlainText(raw).trim()).toBe('Visible');
});

test.each(['Invalid value: size must be < 10', 'x < y > z', 'trailing <'])('keeps literal less-than signs in %s', (raw) => {
  expect(htmlPlainText(raw)).toBe(raw);
});

test.each(['<div =">', '<div = ">', '<div x/ =">', '<div x="value"=">'])('does not treat a bare attribute-name equals sign as assignment in %s', (tag) => {
  expect(htmlPlainText(`${tag}Visible`).trim()).toBe('Visible');
});

test.each(['<!foo "x>', '<!foo x=">', '</3 x=">', '<!DOCTYPE html SYSTEM "x>', '<!DOCTYPE html PUBLIC "x>'])('ends malformed declaration or end-tag markup at the first greater-than in %s', (tag) => {
  expect(htmlPlainText(`${tag}Visible`).trim()).toBe('Visible');
});

test.each(['<3 x=">Visible', 'trailing </'])('preserves invalid tag-open text %s', (raw) => {
  expect(htmlPlainText(raw)).toBe(raw);
});

test('preserves text after an abruptly ended quoted DOCTYPE identifier', () => {
  expect(htmlPlainText('<!DOCTYPE html SYSTEM "x>Visible">Tail').trim()).toBe('Visible">Tail');
});

test('returns an abrupt script escape to script data', () => {
  expect(htmlPlainText('<script><!--><script></script>Invalid request</script>Visible').replace(/\s+/g, ' ').trim())
    .toBe('Invalid request Visible');
});

test('drops a processing instruction before the error text', () => {
  const raw = `${'<?xml-stylesheet ' + 'x'.repeat(120) + '?>'}<Error>Invalid key</Error>`;
  expect(htmlPlainText(raw).replace(/\s+/g, ' ').trim()).toBe('Invalid key');
});
