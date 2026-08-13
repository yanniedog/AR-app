import { readFileSync } from 'node:fs';

const read = (relative: string) => readFileSync(require.resolve(relative), 'utf8');

describe('compact mobile UX contracts', () => {
  it('keeps comparison content vertically reachable and difference-first on phones', () => {
    const source = read('../app/compare.tsx');

    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('COMPACT_COMPARE_BREAKPOINT = 600');
    expect(source).toContain('<ScrollView contentContainerStyle={styles.scrollContent}');
    expect(source).toContain('Key differences');
    expect(source).toContain('const differingRows');
    expect(source).toContain('Shared details');
    expect(source).toContain('showsHorizontalScrollIndicator');
  });

  it('uses one scrollable onboarding step without requesting notification permission', () => {
    const source = read('../app/onboarding.tsx');

    expect(source).toContain('<ScrollView');
    expect(source).toContain('flexGrow: 1');
    expect(source).toContain("completeOnboarding(interests, false)");
    expect(source).toContain("source === 'remote'");
    expect(source).toContain("source === 'cache'");
    expect(source).toContain('Sample rate');
    expect(source).toContain('Choose what you want to do');
    expect(source).toContain('Check a rate I have');
    expect(source).toContain('Find or plan');
    expect(source).toContain('Follow rate changes');
    expect(source).not.toContain('ensurePermissions');
    expect(source).not.toContain('Best rate today');
  });

  it('exposes toolbar icons as 48dp buttons with selected state', () => {
    const source = read('../src/components/ToolbarIconButton.tsx');

    expect(source).toContain('accessibilityRole="button"');
    expect(source).toContain('accessibilityState=');
    expect(source).toContain('minWidth: 48');
    expect(source).toContain('minHeight: 48');
  });

  it('reveals an explicit remove action without deleting on swipe-open', () => {
    const source = read('../src/components/SwipeableRow.tsx');

    expect(source).toContain('onPress={handleDelete}');
    expect(source).toContain('Remove');
    expect(source).not.toContain('onSwipeableOpen={handleDelete}');
  });

  it('lets the chart headline wrap without crushing its explanation', () => {
    const source = read('../src/components/viz/SwitcherEdgeChart.tsx');

    expect(source).toContain("flexWrap: 'wrap'");
    expect(source).toContain('typical tracked rate');
    expect(source).toContain('best advertised rate');
  });
});
