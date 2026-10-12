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

test('keeps a literal less-than sign in plain text', () => {
  expect(htmlPlainText('Invalid value: size must be < 10')).toBe('Invalid value: size must be < 10');
  expect(htmlPlainText('x < y > z')).toBe('x < y > z');
});

test.each(['Before<!-->Invalid request', 'Before<!--->Invalid request'])(
  'keeps text after an abruptly closed comment %s',
  (raw) => {
    expect(htmlPlainText(raw).replace(/\s+/g, ' ').trim()).toBe('Before Invalid request');
  },
);

test('stops an HTML comment at the bang terminator', () => {
  expect(htmlPlainText('Before<!--hidden--!>Visible').trim()).toBe('Before Visible');
});

test('keeps a double-escaped script body inside the script', () => {
  expect(htmlPlainText('<script><!--<script></script>alert(1)</script>Visible').trim()).toBe('Visible');
});

test('handles thousands of false closer prefixes in one forward scan', () => {
  const raw = `<script>${'</script'.repeat(8_000)}</script>Visible`;
  expect(htmlPlainText(raw).trim()).toBe('Visible');
});

test('scans escaped script comment transitions in one forward pass', () => {
  const raw = `<script><!--${'--><!--'.repeat(8_000)}</script>Visible`;
  expect(htmlPlainText(raw).trim()).toBe('Visible');
});

test('keeps a comment closer inside a false script end tag', () => {
  expect(htmlPlainText('<script><!--<script></script --> <script>foo</script>Visible').trim()).toBe('Visible');
});

test('resumes double-escaped scanning after the script name', () => {
  const raw = '<script><!--<script></script x="<script>"></script>alert(1)</script>Visible';
  expect(htmlPlainText(raw).trim()).toBe('Visible');
});

test('drops a processing instruction before the error text', () => {
  const raw = `${'<?xml-stylesheet ' + 'x'.repeat(120) + '?>'}<Error>Invalid key</Error>`;
  expect(htmlPlainText(raw).replace(/\s+/g, ' ').trim()).toBe('Invalid key');
});
