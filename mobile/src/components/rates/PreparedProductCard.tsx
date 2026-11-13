import React from 'react';
import { ProductCard } from '../ProductCard';

type Props = React.ComponentProps<typeof ProductCard> & {
  /** Only the exact, current, fixed-formula Mortgage index may supply this
   * owner. It proves that changing admitted inputs cannot change this row's
   * displayed resolution. Source/time/gate replacement revokes the owner. */
  quoteOwner?: object | null;
};

/** Keep independent Cell revision commits in the parent. Rebuilding a card's
 * identical graphical tree is unnecessary when the current index has already
 * proved its fixed quote for the new actual inputs. Store/context subscriptions
 * inside ProductCard continue to update independently of this parent memo. */
export const PreparedProductCard = React.memo(function PreparedProductCard({ quoteOwner: _quoteOwner, ...props }: Props) {
  return <ProductCard {...props} />;
}, (previous, next) => {
  const fixed = previous.quoteOwner != null && previous.quoteOwner === next.quoteOwner && previous.row === next.row;
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  for (const key of keys) {
    if (fixed && key === 'rateScenario') continue;
    if (previous[key as keyof Props] !== next[key as keyof Props]) return false;
  }
  return true;
});
