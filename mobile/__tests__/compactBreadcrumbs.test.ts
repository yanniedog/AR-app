import { buildBreadcrumbs } from '../src/lib/breadcrumbs';
import { compactBreadcrumbs, shortBreadcrumbLabel } from '../src/lib/compactBreadcrumbs';

const trail = buildBreadcrumbs({ pathname: '/categories', section: 'Mortgage', path: ['OO', 'PI', 'VARIABLE'] });

it.each([320, 390, 768, 1440])('caps even a wide %spx trail at two short labels without losing ancestors', (width) => {
  const { visible, hidden } = compactBreadcrumbs(trail, width, 1);
  expect(visible.map((crumb) => shortBreadcrumbLabel(crumb.label))).toEqual(['P&I', 'Variable']);
  expect(hidden.map((crumb) => crumb.label)).toEqual(['Rates', 'Home loans', 'Owner-occupied']);
  expect([...hidden, ...visible]).toEqual(trail);
});

it('gives large text the current page and preserves all parent destinations in overflow', () => {
  const { visible, hidden } = compactBreadcrumbs(trail, 320, 2.5);
  expect(visible).toEqual([trail.at(-1)]);
  expect(hidden).toEqual(trail.slice(0, -1));
});

it('collapses a long product parent on narrow screens and keeps full names in the model', () => {
  const product = [
    ...trail.slice(0, -1),
    { label: 'An exceptionally long variable home loan name' },
  ];
  const { visible, hidden } = compactBreadcrumbs(product, 280, 1);
  expect(visible).toEqual([product.at(-1)]);
  expect(shortBreadcrumbLabel(visible[0].label)).toBe('An exceptionally…');
  expect([...hidden, ...visible]).toEqual(product);
});

it.each([
  ['Products without listed rates', 'Catalogue'],
  ['Principal & interest', 'P&I'],
  ['What if rates change?', 'Projections'],
  ['Term deposits', 'Term dep.'],
  ['Home loans', 'Loans'],
])('shortens %s meaningfully', (label, shortened) => {
  expect(shortBreadcrumbLabel(label)).toBe(shortened);
});

it('bounds unknown labels without splitting a Unicode character', () => {
  expect(shortBreadcrumbLabel('constructor')).toBe('constructor');
  expect(shortBreadcrumbLabel('__proto__')).toBe('__proto__');
  expect(shortBreadcrumbLabel('12345678901😀long name', 12)).toBe('12345678901…');
  expect(shortBreadcrumbLabel('1234567890😀long name', 12)).toBe('1234567890😀…');
});

it('keeps short root pages free of unnecessary overflow', () => {
  const today = buildBreadcrumbs({ pathname: '/', section: 'Mortgage' });
  expect(compactBreadcrumbs(today, 320, 1)).toEqual({ visible: today, hidden: [] });
});
