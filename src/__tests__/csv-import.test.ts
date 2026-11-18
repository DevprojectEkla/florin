import { describe, it, expect } from 'vitest';
import {
  decodeCsvBytes,
  readCsvTable,
  detectHeaderRow,
  guessMapping,
  applyMapping,
  parseAmountCell,
  parseDateCell,
  detectDateOrder,
  detectDecimal,
  normalizeMultilineLabel,
  headerSignature,
} from '../lib/csv-import';

// All fixtures below are fabricated; no real bank data.

/** Encode a string as Windows-1252 (enough for the characters used here). */
function cp1252(text: string): Uint8Array {
  const special: Record<string, number> = { '€': 0x80, '’': 0x92 };
  const out: number[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    out.push(special[ch] ?? (code < 256 ? code : 0x3f));
  }
  return new Uint8Array(out);
}

function load(text: string, bytes?: Uint8Array) {
  const decoded = decodeCsvBytes(bytes ?? new TextEncoder().encode(text));
  const table = readCsvTable(decoded);
  const headerRow = detectHeaderRow(table.rows);
  const mapping = guessMapping(table, headerRow);
  return { table, headerRow, mapping, result: applyMapping(table, mapping, 'test.csv') };
}

// Mimics the Crédit Agricole layout: Windows-1252, ';', preamble, multi-line labels.
const CA_CSV = [
  '',
  'Téléchargement du 18/11/2026;',
  '',
  '',
  'M.       JEAN DUPONT',
  'Compte de Dépôt carte n° 00011122233;',
  'Solde au 18/11/2026 1 379,51 €',
  '',
  'Liste des opérations du compte entre le 01/11/2026 et le 18/11/2026;',
  '',
  "Date d'opération;Libellé;Débit euros;Crédit euros;",
  '18/11/2026;"Virement émis',
  'VIR INST vers Alice Martin - Loyer',
  '',
  '',
  '',
  '";600,00;;',
  '17/11/2026;"Virement en votre faveur',
  'Salaire novembre',
  '',
  '";;2 100,50;',
  '16/11/2026;"Paiement par carte',
  'X0001 BOULANGERIE',
  '";4,20;;',
  '',
  '',
].join('\n');

// Mimics N26: UTF-8, ',', header on first line, signed amount, ISO dates.
const N26_CSV = [
  '"Booking Date","Value Date","Partner Name","Partner Iban",Type,"Payment Reference","Account Name","Amount (EUR)","Original Amount","Original Currency","Exchange Rate"',
  '2026-11-02,2026-11-02,"ALICE MARTIN","FR7600000000000000000000000","Credit Transfer","Remboursement","Compte courant",20.00,,,',
  '2026-11-02,2026-11-02,Money,,"Debit Transfer",Arrondi,"Compte courant",-0.73,,,',
  '2026-11-03,2026-11-03,"CAFE DU COIN",,Presentment,,"Compte courant",-20,20,EUR,1',
  '2026-11-04,2026-11-04,"ACME SARL",,"Credit Transfer","Facture, avril","Compte courant","1,234.50",,,',
].join('\n');

describe('decodeCsvBytes', () => {
  it('decodes UTF-8', () => {
    expect(decodeCsvBytes(new TextEncoder().encode('Libellé;€'))).toBe('Libellé;€');
  });

  it('strips a UTF-8 BOM', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('a;b')]);
    expect(decodeCsvBytes(bytes)).toBe('a;b');
  });

  it('falls back to Windows-1252 when bytes are not valid UTF-8', () => {
    expect(decodeCsvBytes(cp1252('Libellé 12,00 €'))).toBe('Libellé 12,00 €');
  });

  it('decodes UTF-16 LE with BOM', () => {
    const units = [0xfeff, ...'a;é'.split('').map((c) => c.charCodeAt(0))];
    const bytes = new Uint8Array(units.length * 2);
    units.forEach((u, i) => {
      bytes[i * 2] = u & 0xff;
      bytes[i * 2 + 1] = u >> 8;
    });
    expect(decodeCsvBytes(bytes)).toBe('a;é');
  });
});

describe('Crédit Agricole style CSV', () => {
  const { table, headerRow, mapping, result } = load(CA_CSV, cp1252(CA_CSV));

  it('detects delimiter and header row past the preamble', () => {
    expect(table.delimiter).toBe(';');
    expect(headerRow).toBe(10);
  });

  it('guesses a split debit/credit mapping with French formats', () => {
    expect(mapping).toMatchObject({
      date: 0,
      labels: [1],
      amountMode: 'split',
      debit: 2,
      credit: 3,
      dateOrder: 'DMY',
      decimal: ',',
    });
  });

  it('parses multi-line quoted labels and amounts', () => {
    const tx = result.parsed.transactions;
    expect(result.rejected).toEqual([]);
    expect(tx).toHaveLength(3);
    expect(tx[0]).toEqual({
      date: '2026-11-18',
      label: 'Virement émis - VIR INST vers Alice Martin - Loyer',
      debit: 600,
      credit: null,
    });
    expect(tx[1]).toMatchObject({ date: '2026-11-17', debit: null, credit: 2100.5 });
    expect(tx[2]).toMatchObject({ date: '2026-11-16', debit: 4.2, credit: null });
  });

  it('extracts account, balance and period from the preamble', () => {
    expect(result.parsed.accountNumber).toBe('00011122233');
    expect(result.parsed.balanceAtImport).toBe(1379.51);
    expect(result.parsed.periodFrom).toBe('2026-11-01');
    expect(result.parsed.periodTo).toBe('2026-11-18');
  });
});

describe('N26 style CSV', () => {
  const { table, headerRow, mapping, result } = load(N26_CSV);

  it('detects comma delimiter and header on the first line', () => {
    expect(table.delimiter).toBe(',');
    expect(headerRow).toBe(0);
  });

  it('guesses a signed mapping, skipping iban/type/account/original columns', () => {
    expect(mapping).toMatchObject({
      date: 0,
      labels: [2, 5], // Partner Name + Payment Reference
      amountMode: 'signed',
      amount: 7,
      dateOrder: 'YMD',
      decimal: '.',
    });
  });

  it('turns signed amounts into debit/credit and joins label columns', () => {
    const tx = result.parsed.transactions;
    expect(result.rejected).toEqual([]);
    expect(tx).toEqual([
      { date: '2026-11-02', label: 'ALICE MARTIN - Remboursement', debit: null, credit: 20 },
      { date: '2026-11-02', label: 'Money - Arrondi', debit: 0.73, credit: null },
      { date: '2026-11-03', label: 'CAFE DU COIN', debit: 20, credit: null },
      { date: '2026-11-04', label: 'ACME SARL - Facture, avril', debit: null, credit: 1234.5 },
    ]);
  });

  it('can invert the sign for banks that export expenses as positive', () => {
    const inverted = applyMapping(table, { ...mapping, invertSign: true }, 'x.csv');
    expect(inverted.parsed.transactions[0]).toMatchObject({ debit: 20, credit: null });
  });
});

describe('applyMapping edge cases', () => {
  it('reports rows it cannot parse instead of silently dropping them', () => {
    const csv = ['Date;Libellé;Montant', '01/02/2026;Coffee;-3,50', 'not a date;Oops;-1,00', '02/02/2026;;-2,00', '03/02/2026;Gift;'].join('\n');
    const { result } = load(csv);
    expect(result.parsed.transactions).toHaveLength(1);
    expect(result.rejected.map((r) => r.reason)).toEqual(['invalid_date', 'no_label', 'no_amount']);
  });

  it('ignores zero amounts in split mode', () => {
    const csv = ['Date;Libellé;Débit;Crédit', '01/02/2026;Zero;0,00;', '01/02/2026;Real;5,00;'].join('\n');
    const { result } = load(csv);
    expect(result.parsed.transactions.map((t) => t.label)).toEqual(['Real']);
  });

  it('falls back to the longest text column when no label header is recognised', () => {
    const csv = ['Date;Montant;Foo', '01/02/2026;-3,50;A long free text description', '02/02/2026;-1,00;Another long description here'].join('\n');
    const { mapping, result } = load(csv);
    expect(mapping.labels).toEqual([2]);
    expect(result.parsed.transactions).toHaveLength(2);
  });

  it('returns -1 when no header row can be recognised', () => {
    expect(detectHeaderRow([['foo', 'bar'], ['1', '2']])).toBe(-1);
  });
});

describe('parseAmountCell', () => {
  it('handles decimal comma with thousands spaces and currency', () => {
    expect(parseAmountCell(' 1 032,86 €', ',')).toBe(1032.86);
    expect(parseAmountCell('1\u00a0032,86', ',')).toBe(1032.86);
    expect(parseAmountCell('1.234,56', ',')).toBe(1234.56);
  });

  it('handles decimal dot with thousands commas', () => {
    expect(parseAmountCell('1,234.56', '.')).toBe(1234.56);
    expect(parseAmountCell('-20', '.')).toBe(-20);
  });

  it('handles unicode minus, trailing minus and parentheses', () => {
    expect(parseAmountCell('\u221212,5', ',')).toBe(-12.5);
    expect(parseAmountCell('12,50-', ',')).toBe(-12.5);
    expect(parseAmountCell('(12.50)', '.')).toBe(-12.5);
  });

  it('returns null for empty or non-numeric cells', () => {
    expect(parseAmountCell('', ',')).toBeNull();
    expect(parseAmountCell('n/a', ',')).toBeNull();
  });
});

describe('parseDateCell', () => {
  it('parses the three orders and ISO regardless of order', () => {
    expect(parseDateCell('31/12/2026', 'DMY')).toBe('2026-12-31');
    expect(parseDateCell('12/31/2026', 'MDY')).toBe('2026-12-31');
    expect(parseDateCell('2026-12-31', 'DMY')).toBe('2026-12-31');
    expect(parseDateCell('31.12.26', 'DMY')).toBe('2026-12-31');
  });

  it('ignores a trailing time component', () => {
    expect(parseDateCell('2026-11-02 14:03:00', 'YMD')).toBe('2026-11-02');
  });

  it('rejects impossible dates', () => {
    expect(parseDateCell('31/02/2026', 'DMY')).toBeNull();
    expect(parseDateCell('13/13/2026', 'DMY')).toBeNull();
    expect(parseDateCell('hello', 'DMY')).toBeNull();
  });
});

describe('format detection', () => {
  it('detects date order', () => {
    expect(detectDateOrder(['2026-11-02'])).toBe('YMD');
    expect(detectDateOrder(['13/02/2026'])).toBe('DMY');
    expect(detectDateOrder(['02/13/2026'])).toBe('MDY');
    expect(detectDateOrder(['01/02/2026'])).toBe('DMY'); // ambiguous -> DMY
  });

  it('detects the decimal separator', () => {
    expect(detectDecimal(['12,50', '3,00 €'])).toBe(',');
    expect(detectDecimal(['12.50', '-3.00'])).toBe('.');
    expect(detectDecimal(['12', '-3'])).toBe(',');
  });
});

describe('labels and signatures', () => {
  it('normalizeMultilineLabel drops blank lines and joins the first two with " - "', () => {
    expect(normalizeMultilineLabel('A\nB\n\n\nC')).toBe('A - B\nC');
    expect(normalizeMultilineLabel('  Single line  ')).toBe('Single line');
    expect(normalizeMultilineLabel('A\r\nB')).toBe('A - B');
    expect(normalizeMultilineLabel('\n \n')).toBe('');
  });

  it('headerSignature is accent/case/spacing insensitive', () => {
    expect(headerSignature(["Date d'opération", 'Libellé', ''])).toBe(
      headerSignature(["DATE D'OPERATION", ' libelle '])
    );
  });
});
