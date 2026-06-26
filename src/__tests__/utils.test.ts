import { describe, it, expect } from 'vitest';
import { slugify, dedupKey } from '../lib/utils';

describe('slugify', () => {
  it('lowercases and strips spaces', () => {
    expect(slugify('Courses Bio')).toBe('courses_bio');
  });

  it('strips diacritics', () => {
    expect(slugify('Énergie')).toBe('energie');
    expect(slugify('Loyer & charges')).toBe('loyer_charges');
  });

  it('collapses multiple special chars into one underscore', () => {
    expect(slugify('Bar / Restaurant --- fun!')).toBe('bar_restaurant_fun');
  });

  it('trims leading and trailing underscores', () => {
    expect(slugify('  ---hello--- ')).toBe('hello');
  });

  it('produces same slug for visually similar labels (CRIT-02 scenario)', () => {
    // These MUST produce the same slug — the dedup guard catches it
    const slug1 = slugify('Courses bio');
    const slug2 = slugify('Courses Bïo');
    expect(slug1).toBe(slug2); // both -> "courses_bio"
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('handles only special chars', () => {
    expect(slugify('---!!!')).toBe('');
  });

  it('handles numbers', () => {
    expect(slugify('Phase 2 test')).toBe('phase_2_test');
  });
});

describe('dedupKey', () => {
  it('produces canonical key shape', () => {
    const key = dedupKey('2025-12-01', 'PAIEMENT PAR CARTE X0475', 347);
    expect(key).toBe('2025-12-01|PAIEMENT PAR CARTE X0475|347.00');
  });

  it('trims label whitespace', () => {
    const key = dedupKey('2025-12-01', '  PAIEMENT  ', 5.19);
    expect(key).toBe('2025-12-01|PAIEMENT|5.19');
  });

  it('handles zero amount', () => {
    const key = dedupKey('2025-01-01', 'TEST', 0);
    expect(key).toBe('2025-01-01|TEST|0.00');
  });

  it('same transaction produces same key (dedup guarantee)', () => {
    const a = dedupKey('2025-10-02', 'LINODE . AKAMAI 6093 02/10', 5.43);
    const b = dedupKey('2025-10-02', 'LINODE . AKAMAI 6093 02/10', 5.43);
    expect(a).toBe(b);
  });

  it('different amount produces different key', () => {
    const a = dedupKey('2025-10-02', 'LINODE', 5.43);
    const b = dedupKey('2025-10-02', 'LINODE', 5.44);
    expect(a).not.toBe(b);
  });

  it('different date produces different key', () => {
    const a = dedupKey('2025-10-02', 'LINODE', 5.43);
    const b = dedupKey('2025-10-03', 'LINODE', 5.43);
    expect(a).not.toBe(b);
  });
});

import { splitLabel } from '../lib/utils';

describe('splitLabel', () => {
  it('splits PAIEMENT PAR CARTE with card number', () => {
    const result = splitLabel('PAIEMENT PAR CARTE      X0475 CARREFOUR MARKET 92 CLIC 29/08');
    expect(result.type).toBe('Carte');
    expect(result.detail).toBe('CARREFOUR MARKET 92 CLIC 29/08');
  });

  it('splits VIREMENT EMIS', () => {
    const result = splitLabel('VIREMENT EMIS           VIR INST vers SARL AGENCE DU PARC IMM Loyer');
    expect(result.type).toBe('Virement émis');
    expect(result.detail).toBe('VIR INST vers SARL AGENCE DU PARC IMM Loyer');
  });

  it('splits VIREMENT EN VOTRE FAVEUR', () => {
    const result = splitLabel('VIREMENT EN VOTRE FAVEURCPAM HAUTS DE SEINE SEPA 2524500');
    expect(result.type).toBe('Virement reçu');
    expect(result.detail).toBe('CPAM HAUTS DE SEINE SEPA 2524500');
  });

  it('splits PRELEVEMENT', () => {
    const result = splitLabel('PRELEVEMENT             Frais carte étranger hors UE');
    expect(result.type).toBe('Prélèvement');
    expect(result.detail).toBe('Frais carte étranger hors UE');
  });

  it('splits RETRAIT AU DISTRIBUTEUR', () => {
    const result = splitLabel('RETRAIT AU DISTRIBUTEUR X0475 CLICHY         31/12 13H45');
    expect(result.type).toBe('Retrait DAB');
    expect(result.detail).toBe('CLICHY 31/12 13H45');
  });

  it('handles unknown format gracefully', () => {
    const result = splitLabel('Something random');
    expect(result.type).toBe('');
    expect(result.detail).toBe('Something random');
  });

  it('handles multiline labels', () => {
    const result = splitLabel('PRELEVEMENT             \nFrais carte étranger hors UE');
    expect(result.type).toBe('Prélèvement');
    expect(result.detail).toContain('Frais carte');
  });
});
