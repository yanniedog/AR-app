import { brandKeyForProvider, providerMatchesSearch } from './bankBrand';
import { parseSearchQuery } from './detailSearch';

/** Name or lender search; a leading or trailing lender name, short name or ticker
 * (NAB fixed, fixed WBC) scopes the remaining words to that lender's products. */
export function publicProductMatches(product: { name: string; providerName: string; aliases: readonly { name: string }[] }, needle: string): boolean {
  const text = (product.name + ' ' + product.providerName + ' ' + product.aliases.map(alias => alias.name).join(' ')).toLocaleLowerCase('en-AU');
  if (text.includes(needle) || providerMatchesSearch(product.providerName, needle)) return true;
  const { lender, tokens } = parseSearchQuery(needle);
  return !!lender && brandKeyForProvider(product.providerName) === lender && tokens.every(token => text.includes(token));
}
