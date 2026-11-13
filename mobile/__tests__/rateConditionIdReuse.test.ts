import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import { rateConditionId } from '../src/data/rateConditions';

jest.mock('@noble/hashes/sha256', () => ({
  ...jest.requireActual('@noble/hashes/sha256'),
  sha256: jest.fn(jest.requireActual('@noble/hashes/sha256').sha256),
}));
const digest = jest.mocked(sha256);

it('reuses the hash across 100 repeated clause validations', () => {
  const source = 'a'.repeat(64), pointer = '/data/depositRates/0/additionalInfo';
  const expected = bytesToHex(sha256(utf8ToBytes(JSON.stringify([source, pointer]))));
  digest.mockClear();
  for (let i = 0; i < 100; i++) expect(rateConditionId(source, pointer)).toBe(expected);
  expect(digest).toHaveBeenCalledTimes(1);
  expect(rateConditionId('b'.repeat(64), pointer)).not.toBe(expected);
  expect(rateConditionId(source, '/data/depositRates/1/additionalInfo')).not.toBe(expected);
  expect(digest).toHaveBeenCalledTimes(3);
});

it('bounds retained keys and evicts old inputs without changing their identity', () => {
  const original = rateConditionId('old', '/old');
  for (let i = 0; i < 2_049; i++) rateConditionId('edition', `/pointer/${i}`);
  digest.mockClear();
  expect(rateConditionId('old', '/old')).toBe(original);
  expect(digest).toHaveBeenCalledTimes(1);
  const oversized = 'x'.repeat(1_025);
  digest.mockClear();
  expect(rateConditionId('source', oversized)).toBe(rateConditionId('source', oversized));
  expect(digest).toHaveBeenCalledTimes(2);
});
