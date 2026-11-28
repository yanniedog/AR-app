import { readFileSync } from 'node:fs';
import { unpackHistoricalBankRateCatalogue } from '../../src/data/historicalBankRateCataloguePacked.ts';

// Use the shipping bounded decoder, retaining only the fields the oracle compares.
const catalogue = unpackHistoricalBankRateCatalogue(JSON.parse(readFileSync(0, 'utf8')));
if (catalogue?.schema_version !== 2) throw new Error('Invalid packed rate history');
process.stdout.write(JSON.stringify({ run_dates: catalogue.run_dates, sections: catalogue.sections }));
