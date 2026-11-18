/**
 * Generic, bank-agnostic CSV import.
 *
 * Banks export wildly different CSVs (delimiter, encoding, preamble lines,
 * column names, signed amount vs. debit/credit columns, date and number
 * formats). We cannot know the layout in advance, so the flow is:
 *
 *   1. decodeCsvBytes()   – bytes -> text (UTF-8 / UTF-16 / Windows-1252)
 *   2. readCsvTable()     – text -> rows, auto-detecting the delimiter
 *   3. detectHeaderRow()  – find the header line, skipping any preamble
 *   4. guessMapping()     – best-effort column mapping + formats
 *   5. (user reviews / edits the mapping in the UI)
 *   6. applyMapping()     – rows -> ParsedImport (same shape as the xlsx parser)
 *
 * The output is a ParsedImport, so db/import.ts (dedup, rules) is unchanged.
 */
import Papa from 'papaparse';
import {
  extractAccountNumber,
  extractPeriod,
  parseEuroAmount,
  type ParsedImport,
  type ParsedTransaction,
} from './ca-parser';

// ─── Types ──────────────────────────────────────────────────────────────────

export type DateOrder = 'DMY' | 'MDY' | 'YMD';
export type AmountMode = 'split' | 'signed';
export type DecimalSeparator = ',' | '.';

export interface CsvMapping {
  /** 0-based index of the header row in CsvTable.rows */
  headerRow: number;
  /** Column index of the transaction date */
  date: number | null;
  /** Column indexes joined (in order) to build the label */
  labels: number[];
  /** 'split' = separate debit/credit columns, 'signed' = one signed amount column */
  amountMode: AmountMode;
  debit: number | null;
  credit: number | null;
  amount: number | null;
  /** Signed mode: treat positive as money out instead of money in */
  invertSign: boolean;
  dateOrder: DateOrder;
  decimal: DecimalSeparator;
}

export interface CsvTable {
  delimiter: string;
  rows: string[][];
}

export interface RejectedRow {
  /** 1-based line number among the parsed rows (for display) */
  line: number;
  reason: 'invalid_date' | 'no_amount' | 'no_label';
  cells: string[];
}

export interface CsvApplyResult {
  parsed: ParsedImport;
  rejected: RejectedRow[];
}

// ─── Decoding ───────────────────────────────────────────────────────────────

/**
 * Decode CSV bytes. Honours BOMs, tries strict UTF-8, and falls back to
 * Windows-1252 (what Crédit Agricole and many French banks export).
 */
export function decodeCsvBytes(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }
  try {
    // TextDecoder strips a UTF-8 BOM by default.
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return decodeWindows1252(bytes);
  }
}

// Windows-1252 differs from Latin-1 only in 0x80–0x9F (e.g. 0x80 = €).
// Decoded by hand so behaviour doesn't depend on the runtime's TextDecoder
// (some engines treat the "windows-1252" label as plain Latin-1).
const CP1252_0x80 = [
  0x20ac, 0x81, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021,
  0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x8d, 0x017d, 0x8f,
  0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x9d, 0x017e, 0x0178,
];

function decodeWindows1252(bytes: Uint8Array): string {
  const chars: string[] = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    chars[i] = String.fromCharCode(b >= 0x80 && b <= 0x9f ? CP1252_0x80[b - 0x80] : b);
  }
  return chars.join('');
}

// ─── Table reading ──────────────────────────────────────────────────────────

const DELIMITERS = [';', ',', '\t', '|'];

/**
 * Pick the delimiter that yields the most rows sharing one consistent width
 * (>= 3 columns). Robust against preamble lines, which a naive "first line"
 * sniffer is not.
 */
function detectDelimiter(text: string): string {
  let best = ',';
  let bestScore = 0;
  for (const delimiter of DELIMITERS) {
    const { data } = Papa.parse<string[]>(text, { delimiter });
    const widths = new Map<number, number>();
    for (const row of data) {
      if (row.length >= 3) widths.set(row.length, (widths.get(row.length) ?? 0) + 1);
    }
    const score = Math.max(0, ...widths.values());
    if (score > bestScore) {
      best = delimiter;
      bestScore = score;
    }
  }
  return best;
}

export function readCsvTable(text: string): CsvTable {
  const delimiter = detectDelimiter(text);
  const { data } = Papa.parse<string[]>(text, { delimiter });
  return { delimiter, rows: data };
}

// ─── Header & column recognition ────────────────────────────────────────────

type Role = 'date' | 'valueDate' | 'label' | 'debit' | 'credit' | 'amount';

export function normalizeHeader(cell: string): string {
  return cell
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const EXCLUDED = /\b(iban|bic|swift|account|compte|solde|balance|currency|devise|exchange|taux|type|categorie|category|original|id|uuid)\b/;

/** Best-effort role of a header cell (FR/EN/DE keywords). */
export function guessRole(cell: string): Role | null {
  const h = normalizeHeader(cell);
  if (!h || EXCLUDED.test(h)) return null;

  if (/\b(valeur|value|valuta)\b/.test(h) && /\b(date|datum)\b/.test(h)) return 'valueDate';
  if (/\b(date|datum|buchungstag)\b/.test(h)) return 'date';
  if (/\b(debit|debits|sortie|sorties|paid out|withdrawal|soll)\b/.test(h)) return 'debit';
  if (/\b(credit|credits|entree|entrees|paid in|deposit|haben)\b/.test(h)) return 'credit';
  if (/\b(amount|montant|betrag|somme|importe)\b/.test(h)) return 'amount';
  if (
    /\b(libelle|label|description|reference|payee|partner|merchant|memo|detail|details|communication|intitule|beneficiaire|objet|motif|narrative|name|verwendungszweck)\b/.test(h)
  ) {
    return 'label';
  }
  return null;
}

/** Stable identifier of a header row, used to remember a mapping per bank format. */
export function headerSignature(headerCells: string[]): string {
  return headerCells.map(normalizeHeader).filter(Boolean).join('|');
}

/**
 * Index of the most plausible header row (needs a date column and at least one
 * amount-ish column), or -1 if none looks like a header.
 */
export function detectHeaderRow(rows: string[][]): number {
  let bestIdx = -1;
  let bestScore = 0;
  const limit = Math.min(rows.length, 60);
  for (let i = 0; i < limit; i++) {
    const roles = new Set(rows[i].map((c) => guessRole(c)));
    const hasAmount = roles.has('amount') || roles.has('debit') || roles.has('credit');
    if (!(roles.has('date') || roles.has('valueDate')) || !hasAmount) continue;
    const score = roles.size + (roles.has('label') ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// ─── Mapping guess ──────────────────────────────────────────────────────────

function dataRows(table: CsvTable, headerRow: number, max = 200): string[][] {
  return table.rows.slice(headerRow + 1, headerRow + 1 + max).filter((r) => r.some((c) => c.trim()));
}

/** Detect the order of the date parts from sample values. Defaults to DMY. */
export function detectDateOrder(samples: string[]): DateOrder {
  let sawYmd = false;
  let firstOver12 = false;
  let secondOver12 = false;
  for (const s of samples) {
    const m = s.trim().match(/^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})/);
    if (!m) continue;
    if (m[1].length === 4) {
      sawYmd = true;
      continue;
    }
    if (Number(m[1]) > 12) firstOver12 = true;
    if (Number(m[2]) > 12) secondOver12 = true;
  }
  if (sawYmd) return 'YMD';
  if (secondOver12 && !firstOver12) return 'MDY';
  return 'DMY';
}

/** Detect the decimal separator from sample amount strings. Defaults to ','. */
export function detectDecimal(samples: string[]): DecimalSeparator {
  let comma = 0;
  let dot = 0;
  for (const s of samples) {
    if (/,\d{1,2}\D*$/.test(s)) comma++;
    else if (/\.\d{1,2}\D*$/.test(s)) dot++;
  }
  return dot > comma ? '.' : ',';
}

export function guessMapping(table: CsvTable, headerRow: number): CsvMapping {
  const header = table.rows[headerRow] ?? [];
  const byRole: Record<Role, number[]> = {
    date: [], valueDate: [], label: [], debit: [], credit: [], amount: [],
  };
  header.forEach((cell, idx) => {
    const role = guessRole(cell);
    if (role) byRole[role].push(idx);
  });

  const date = byRole.date[0] ?? byRole.valueDate[0] ?? null;
  const debit = byRole.debit[0] ?? null;
  const credit = byRole.credit[0] ?? null;
  const amount = byRole.amount[0] ?? null;
  const amountMode: AmountMode = debit !== null || credit !== null ? 'split' : 'signed';

  const rows = dataRows(table, headerRow);
  let labels = byRole.label;
  if (labels.length === 0) {
    // Fall back to the column with the longest text that is not already used.
    const used = new Set([date, debit, credit, amount]);
    let bestCol = -1;
    let bestLen = 0;
    for (let c = 0; c < header.length; c++) {
      if (used.has(c)) continue;
      const total = rows.reduce((sum, r) => sum + (r[c]?.trim().length ?? 0), 0);
      if (total > bestLen) {
        bestLen = total;
        bestCol = c;
      }
    }
    labels = bestCol >= 0 ? [bestCol] : [];
  }

  const amountCols = [debit, credit, amount].filter((c): c is number => c !== null);
  const amountSamples = rows.flatMap((r) => amountCols.map((c) => r[c] ?? ''));
  const dateSamples = date !== null ? rows.map((r) => r[date] ?? '') : [];

  return {
    headerRow,
    date,
    labels,
    amountMode,
    debit,
    credit,
    amount,
    invertSign: false,
    dateOrder: detectDateOrder(dateSamples),
    decimal: detectDecimal(amountSamples),
  };
}

// ─── Cell parsing ───────────────────────────────────────────────────────────

export function parseDateCell(raw: string, order: DateOrder): string | null {
  const m = raw.trim().match(/^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})(?:[\sT,].*)?$/);
  if (!m) return null;
  const [, a, b, c] = m;

  let y: string;
  let mo: string;
  let d: string;
  if (a.length === 4) {
    [y, mo, d] = [a, b, c]; // ISO-like, regardless of the chosen order
  } else if (order === 'MDY') {
    [mo, d, y] = [a, b, c];
  } else {
    [d, mo, y] = [a, b, c];
  }
  if (y.length === 2) y = `20${y}`;

  const yy = Number(y);
  const mm = Number(mo);
  const dd = Number(d);
  if (yy < 1900 || yy > 2100 || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  // Reject impossible dates such as 31/02.
  const check = new Date(Date.UTC(yy, mm - 1, dd));
  if (check.getUTCMonth() !== mm - 1 || check.getUTCDate() !== dd) return null;

  return `${String(yy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

/**
 * Parse an amount string with an explicit decimal separator.
 * Handles currency symbols, spaces/nbsp, thousands separators,
 * unicode minus, trailing minus and (parentheses) negatives.
 */
export function parseAmountCell(raw: string, decimal: DecimalSeparator): number | null {
  let s = raw.trim();
  if (!s) return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[\u2212\u2012\u2013\u2014]/g, '-').trim();
  if (s.endsWith('-')) {
    negative = !negative;
    s = s.slice(0, -1);
  }
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }

  s = s.replace(/[^\d.,]/g, '');
  if (!s) return null;
  const thousands = decimal === ',' ? '.' : ',';
  s = s.split(thousands).join('').replace(decimal, '.');

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

// ─── Applying a mapping ─────────────────────────────────────────────────────

function extractPreambleBalance(rows: string[][]): number | null {
  for (const row of rows) {
    const text = row.join(' ');
    const m = text.match(/Solde au \d{2}\/\d{2}\/\d{4}\s*:?\s*([-+]?[\d\s\u00a0.,]+)/i);
    if (m) return parseEuroAmount(m[1]);
  }
  return null;
}

/**
 * Normalize a multi-line label cell the same way the Crédit Agricole xlsx
 * export presents it: blank lines dropped, lines trimmed, and the first two
 * lines joined with " - " (remaining lines stay on their own line).
 *
 * This keeps the dedup hash (date|label|amount) identical between a CSV and
 * an xlsx export of the same transaction, so re-importing the same period in
 * the other format does not create duplicates. Single-line labels are
 * unaffected.
 */
export function normalizeMultilineLabel(raw: string): string {
  const lines = raw
    .split(/\r\n?|\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return '';
  return [lines.slice(0, 2).join(' - '), ...lines.slice(2)].join('\n');
}

export function applyMapping(
  table: CsvTable,
  mapping: CsvMapping,
  filename: string
): CsvApplyResult {
  const transactions: ParsedTransaction[] = [];
  const rejected: RejectedRow[] = [];

  const preamble = table.rows.slice(0, Math.max(0, mapping.headerRow));
  const cell = (row: string[], idx: number | null) => (idx === null ? '' : (row[idx] ?? ''));

  for (let i = mapping.headerRow + 1; i < table.rows.length; i++) {
    const row = table.rows[i];
    if (!row.some((c) => c.trim())) continue; // blank line

    const date = mapping.date === null ? null : parseDateCell(cell(row, mapping.date), mapping.dateOrder);
    if (!date) {
      rejected.push({ line: i + 1, reason: 'invalid_date', cells: row });
      continue;
    }

    const label = mapping.labels
      .map((c) => normalizeMultilineLabel(cell(row, c)))
      .filter(Boolean)
      .join(' - ');
    if (!label) {
      rejected.push({ line: i + 1, reason: 'no_label', cells: row });
      continue;
    }

    let debit: number | null = null;
    let credit: number | null = null;
    if (mapping.amountMode === 'split') {
      const d = parseAmountCell(cell(row, mapping.debit), mapping.decimal);
      const c = parseAmountCell(cell(row, mapping.credit), mapping.decimal);
      debit = d !== null && d !== 0 ? Math.abs(d) : null;
      credit = c !== null && c !== 0 ? Math.abs(c) : null;
    } else {
      let a = parseAmountCell(cell(row, mapping.amount), mapping.decimal);
      if (a !== null && mapping.invertSign) a = -a;
      if (a !== null && a < 0) debit = -a;
      else if (a !== null && a > 0) credit = a;
    }
    if (debit === null && credit === null) {
      rejected.push({ line: i + 1, reason: 'no_amount', cells: row });
      continue;
    }

    transactions.push({ date, label, debit, credit });
  }

  const { from, to } = extractPeriod(preamble);
  return {
    parsed: {
      filename,
      accountNumber: extractAccountNumber(preamble),
      balanceAtImport: extractPreambleBalance(preamble),
      periodFrom: from,
      periodTo: to,
      transactions,
    },
    rejected,
  };
}
