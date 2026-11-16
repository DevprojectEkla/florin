import { describe, it, expect } from 'vitest';
import { sumSavingsNet } from '../lib/utils';

describe('sumSavingsNet', () => {
  it('nets debits against credits (CTO scenario: 601 − 200 → 401)', () => {
    const txs = [
      { debit: 100, credit: null },
      { debit: 200, credit: null },
      { debit: 20, credit: null },
      { debit: 110, credit: null },
      { debit: 105, credit: null },
      { debit: 66, credit: null },
      { debit: null, credit: 200 }, // "Plafond CB - cash Trade Republik"
    ];
    expect(sumSavingsNet(txs)).toBe(401);
  });

  it('sums deposits only', () => {
    expect(
      sumSavingsNet([
        { debit: 100, credit: null },
        { debit: 50, credit: null },
      ])
    ).toBe(150);
  });

  it('allows a negative net for a single withdrawal', () => {
    expect(sumSavingsNet([{ debit: null, credit: 200 }])).toBe(-200);
  });

  it('returns 0 for an empty array', () => {
    expect(sumSavingsNet([])).toBe(0);
  });

  it('treats null debit and credit as 0', () => {
    expect(sumSavingsNet([{ debit: null, credit: null }])).toBe(0);
  });
});
