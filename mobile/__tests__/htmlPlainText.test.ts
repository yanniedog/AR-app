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

test('stops an HTML comment at the bang terminator', () => {
  expect(htmlPlainText('Before<!--hidden--!>Visible').trim()).toBe('Before Visible');
});

test.each(['<!-->Visible', '<!--->Visible'])('keeps text after an abruptly closed comment %s', (raw) => {
  expect(htmlPlainText(raw).trim()).toBe('Visible');
});

test('leaves a double-escaped script when the escape comment ends', () => {
  expect(htmlPlainText('<script><!--<script>--></script>Visible').trim()).toBe('Visible');
});

test('reads a comment end inside a double-escaped end-tag suffix', () => {
  expect(htmlPlainText('<script><!--<script></script --> <script>foo</script>Visible').trim()).toBe('Visible');
});

test('keeps a quoted doctype identifier out of the text', () => {
  const raw = '<!DOCTYPE html SYSTEM "x>Cash rate target 9.99% Effective date 12 August 2026">4.35';
  expect(htmlPlainText(raw)).toBe(' 4.35');
  expect(htmlPlainText(raw)).not.toContain('9.99');
});

test('keeps text after an equals sign inside a tag name', () => {
  expect(htmlPlainText('<x="y>Visible').trim()).toBe('Visible');
});

test('keeps a double-escaped script body inside the script', () => {
  expect(htmlPlainText('<script><!--<script></script>alert(1)</script>Visible').trim()).toBe('Visible');
});

test('handles thousands of false closer prefixes in one forward scan', () => {
  const raw = `<script>${'</script'.repeat(8_000)}</script>Visible`;
  expect(htmlPlainText(raw).trim()).toBe('Visible');
});
