import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseCAFile } from '../lib/ca-parser';

function buildMockXlsx(rows: unknown[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet0');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return buf;
}

const HEADER_ROWS = [
  ['Téléchargement du 26/10/2024'],
  [],
  [],
  ['M.       RAPHAEL BORALEVI'],
  ['Compte de Dépôt n° 00032999227'],
  [],
  [null, 'Solde au 26/10/2024', ' 1\u00a0032,86 €', null],
  [],
  ['Liste des opérations du compte entre le 26/09/2024 et le 26/10/2024'],
  ['Date', 'Libellé', 'Débit euros', 'Crédit euros'],
];

describe('CA xlsx parser', () => {
  it('extracts account number from header', () => {
    const rows = [...HEADER_ROWS, [new Date('2024-10-25'), 'TEST', 10, null]];
    const buffer = buildMockXlsx(rows);
    const result = parseCAFile(buffer, 'test.xlsx');
    expect(result.accountNumber).toBe('00032999227');
  });

  it('extracts period from/to', () => {
    const rows = [...HEADER_ROWS, [new Date('2024-10-25'), 'TEST', 10, null]];
    const buffer = buildMockXlsx(rows);
    const result = parseCAFile(buffer, 'test.xlsx');
    expect(result.periodFrom).toBe('2024-09-26');
    expect(result.periodTo).toBe('2024-10-26');
  });

  it('parses debit transactions', () => {
    const rows = [
      ...HEADER_ROWS,
      [new Date('2024-10-25'), 'PAIEMENT PAR CARTE\nX0475 CASINO', 37.83, null],
    ];
    const buffer = buildMockXlsx(rows);
    const result = parseCAFile(buffer, 'test.xlsx');
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].date).toBe('2024-10-25');
    expect(result.transactions[0].debit).toBe(37.83);
    expect(result.transactions[0].credit).toBeNull();
    expect(result.transactions[0].label).toContain('CASINO');
  });

  it('parses credit transactions', () => {
    const rows = [
      ...HEADER_ROWS,
      [new Date('2024-10-04'), 'VIREMENT EN VOTRE FAVEUR\nCAF DE SEINE', null, 559.42],
    ];
    const buffer = buildMockXlsx(rows);
    const result = parseCAFile(buffer, 'test.xlsx');
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].credit).toBe(559.42);
    expect(result.transactions[0].debit).toBeNull();
  });

  it('skips empty rows', () => {
    const rows = [
      ...HEADER_ROWS,
      [new Date('2024-10-25'), 'TX1', 10, null],
      [],
      [null, null, null, null],
      [new Date('2024-10-24'), 'TX2', 20, null],
    ];
    const buffer = buildMockXlsx(rows);
    const result = parseCAFile(buffer, 'test.xlsx');
    expect(result.transactions).toHaveLength(2);
  });

  it('handles multiple transactions', () => {
    const rows = [
      ...HEADER_ROWS,
      [new Date('2024-10-25'), 'TX1', 10, null],
      [new Date('2024-10-24'), 'TX2', null, 500],
      [new Date('2024-10-23'), 'TX3', 19.99, null],
    ];
    const buffer = buildMockXlsx(rows);
    const result = parseCAFile(buffer, 'test.xlsx');
    expect(result.transactions).toHaveLength(3);
  });

  it('throws on invalid format (no header row)', () => {
    const rows = [
      ['Random data'],
      ['No header here'],
    ];
    const buffer = buildMockXlsx(rows);
    expect(() => parseCAFile(buffer, 'bad.xlsx')).toThrow('INVALID_CA_FORMAT');
  });

  it('stores filename', () => {
    const rows = [...HEADER_ROWS, [new Date('2024-10-25'), 'TX', 5, null]];
    const buffer = buildMockXlsx(rows);
    const result = parseCAFile(buffer, 'CA20241026.xlsx');
    expect(result.filename).toBe('CA20241026.xlsx');
  });

  it('handles dedup key consistency (same tx same key)', () => {
    const rows = [
      ...HEADER_ROWS,
      [new Date('2024-10-25'), 'PAIEMENT PAR CARTE X0475 CASINO', 37.83, null],
    ];
    const buffer = buildMockXlsx(rows);
    const r1 = parseCAFile(buffer, 'f1.xlsx');
    const r2 = parseCAFile(buffer, 'f2.xlsx');
    // Same transaction parsed twice produces identical data
    expect(r1.transactions[0].date).toBe(r2.transactions[0].date);
    expect(r1.transactions[0].label).toBe(r2.transactions[0].label);
    expect(r1.transactions[0].debit).toBe(r2.transactions[0].debit);
  });
});
