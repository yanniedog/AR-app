import { providerMatchesSearch } from '../src/data/bankBrand';
import { displayProviderName } from '../src/data/providerDisplayName';
import { matchingLenders } from '../src/lib/filterOptions';
import { orderProviders } from '../src/data/bankGroups';
import { parseSearchQuery } from '../src/data/detailSearch';
import { publicProductMatches } from '../src/data/publicProductSearch';

test('capitalised provider names read in title case and keep acronyms', () => {
  expect(displayProviderName('NATIONAL AUSTRALIA BANK')).toBe('National Australia Bank');
  expect(displayProviderName('AAA FINANCIAL CORPORATION')).toBe('AAA Financial Corporation');
  expect(displayProviderName('BANK OF QUEENSLAND LIMITED')).toBe('Bank of Queensland Limited');
  expect(displayProviderName('BANKSA')).toBe('BankSA');
  expect(displayProviderName('HSBC BANK AUSTRALIA')).toBe('HSBC Bank Australia');
  expect(displayProviderName('WLTH')).toBe('WLTH');
  // Published mixed case is kept.
  expect(displayProviderName('Crown Money Management')).toBe('Crown Money Management');
  expect(displayProviderName('ubank')).toBe('ubank');
  expect(displayProviderName('ING')).toBe('ING');
});

test.each([
  ['NAB', 'National Australia Bank'], ['ANZ', 'Australia and New Zealand Banking Group'],
  ['CBA', 'Commonwealth Bank of Australia'], ['WBC', 'Westpac Banking Corporation'],
  ['westpac', 'Westpac Banking Corporation'], ['BEN', 'Bendigo and Adelaide Bank'], ['MQG', 'Macquarie Bank'],
  ['BOQ', 'Bank of Queensland'], ['JDO', 'Judo Bank'], ['afc', 'AAA FINANCIAL CORPORATION'],
])('%s finds %s in every lender search', (query, provider) => {
  expect(providerMatchesSearch(provider, query)).toBe(true);
  expect(matchingLenders([provider, 'Other Lender'], query, [])).toEqual([provider]);
  expect(orderProviders([provider, 'Other Lender'], name => name, new Set(), query)).toEqual([provider]);
});

test('tickers and short names scope product search to the lender', () => {
  expect(parseSearchQuery('WBC fixed').lender).toBe('westpac banking corporation');
  expect(parseSearchQuery('BEN variable').lender).toBe('bendigo and adelaide bank');
  expect(parseSearchQuery('nab').lender).toBe('national australia bank');
  expect(providerMatchesSearch('Commonwealth Bank of Australia', 'NAB')).toBe(false);
});

test('public pricing search takes a lender term plus product words', () => {
  const product = { name: 'Fixed Rate Home Loan', providerName: 'National Australia Bank', aliases: [] };
  expect(publicProductMatches(product, 'nab fixed')).toBe(true);
  expect(publicProductMatches(product, 'fixed nab')).toBe(true);
  expect(publicProductMatches(product, 'nab variable')).toBe(false);
  expect(publicProductMatches(product, 'cba fixed')).toBe(false);
});

test('term-deposit timeframes are whole numbers of terms', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PROJECTION_HORIZONS, termDepositRolloversFor } = require('../src/data/projectionHorizons');
  const offered = (term: number) => PROJECTION_HORIZONS.filter((option: { months: number }) => option.months % term === 0
    && (termDepositRolloversFor(option.months, term) ?? 99) <= 10).map((option: { label: string }) => option.label);
  expect(offered(9)).toEqual([]);
  expect(offered(12)).toEqual(['1Y', '5Y', '10Y']);
  expect(offered(3)).toEqual(['3M', '1Y']);
  expect(offered(60)).toEqual(['5Y', '10Y', '20Y', '30Y', '40Y', '50Y']);
});
