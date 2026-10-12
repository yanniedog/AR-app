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
