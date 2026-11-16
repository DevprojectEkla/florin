/**
 * Crédit Agricole xlsx file parser.
 *
 * Expected format (from CA20241026_105802.xlsx):
 *   Row 1: "Téléchargement du DD/MM/YYYY"
 *   Row 4: Account holder name
 *   Row 5: "Compte de Dépôt n° XXXXXXXXXXX"
 *   Row 7: [null, "Solde au DD/MM/YYYY", " X XXX,XX €", null]
 *   Row 9: "Liste des opérations du compte entre le DD/MM/YYYY et le DD/MM/YYYY"
 *   Row 10: ["Date", "Libellé", "Débit euros", "Crédit euros"]
 *   Row 11+: [Date, string, number|null, number|null]
 */
import * as XLSX from 'xlsx';

export interface ParsedTransaction {
  date: string;      // ISO8601 "YYYY-MM-DD"
  label: string;     // raw multi-line bank label
  debit: number | null;
  credit: number | null;
}

export interface ParsedImport {
  filename: string;
  accountNumber: string | null;
  balanceAtImport: number | null;
  periodFrom: string | null;
  periodTo: string | null;
  transactions: ParsedTransaction[];
}

/**
 * Parse a CA xlsx ArrayBuffer into structured data.
 */
export function parseCAFile(buffer: ArrayBuffer, filename: string): ParsedImport {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    dateNF: 'yyyy-mm-dd',
  });

  // Extract metadata from header rows
  const accountNumber = extractAccountNumber(rows);
  const balanceAtImport = extractBalance(rows);
  const { from: periodFrom, to: periodTo } = extractPeriod(rows);

  // Find the header row (Date, Libellé, Débit, Crédit)
  // Real CA exports label the first column "Date d'opération" (not just "Date"),
  // and accents/casing can vary, so match tolerantly.
  const headerIdx = rows.findIndex((row) => {
    if (!row) return false;
    const col0 = normalizeHeaderCell(row[0]);
    const col1 = normalizeHeaderCell(row[1]);
    return col0.startsWith('date') && col1.includes('libelle');
  });

  if (headerIdx === -1) {
    throw new Error('INVALID_CA_FORMAT: Cannot find header row (Date, Libellé, Débit, Crédit)');
  }

  // Parse transactions starting after header
  const transactions: ParsedTransaction[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;

    const dateRaw = row[0];
    const labelRaw = row[1];
    const debitRaw = row[2];
    const creditRaw = row[3];

    // Skip empty rows
    if (!dateRaw && !labelRaw) continue;

    const date = normalizeDate(dateRaw);
    if (!date) continue; // Skip non-transaction rows

    const label = String(labelRaw ?? '').trim();
    if (!label) continue;

    const debit = normalizeAmount(debitRaw);
    const credit = normalizeAmount(creditRaw);

    // Must have at least one amount
    if (debit === null && credit === null) continue;

    transactions.push({ date, label, debit, credit });
  }

  return {
    filename,
    accountNumber,
    balanceAtImport,
    periodFrom,
    periodTo,
    transactions,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Normalize a header cell for tolerant matching: trim, lowercase, strip accents. */
function normalizeHeaderCell(cell: unknown): string {
  if (typeof cell !== 'string') return '';
  return cell
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics (é → e)
    .trim()
    .toLowerCase();
}

function extractAccountNumber(rows: unknown[][]): string | null {
  // Row 5: "Compte de Dépôt n° 00012345678"
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const cell = String(rows[i]?.[0] ?? '');
    const match = cell.match(/n°\s*(\d+)/);
    if (match) return match[1];
  }
  return null;
}

function extractBalance(rows: unknown[][]): number | null {
  // Row 7: [null, "Solde au ...", " 1 032,86 €", null]
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    if (!row) continue;
    for (const cell of row) {
      const str = String(cell ?? '');
      if (str.includes('Solde au')) {
        // Next cell or same row has the amount
        const amtStr = String(row[2] ?? row[1] ?? '');
        return parseEuroAmount(amtStr);
      }
    }
  }
  return null;
}

function extractPeriod(rows: unknown[][]): { from: string | null; to: string | null } {
  // Row 9: "Liste des opérations du compte entre le DD/MM/YYYY et le DD/MM/YYYY"
  for (let i = 0; i < Math.min(12, rows.length); i++) {
    const cell = String(rows[i]?.[0] ?? '');
    const match = cell.match(/entre le (\d{2}\/\d{2}\/\d{4}) et le (\d{2}\/\d{2}\/\d{4})/);
    if (match) {
      return {
        from: frDateToISO(match[1]),
        to: frDateToISO(match[2]),
      };
    }
  }
  return { from: null, to: null };
}

function frDateToISO(fr: string): string {
  const [d, m, y] = fr.split('/');
  return `${y}-${m}-${d}`;
}

function normalizeDate(raw: unknown): string | null {
  if (raw instanceof Date) {
    return raw.toISOString().slice(0, 10);
  }
  if (typeof raw === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
  }
  if (typeof raw === 'string') {
    // Try DD/MM/YYYY
    const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) return `${match[3]}-${match[2]}-${match[1]}`;
    // Try ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  }
  return null;
}

function normalizeAmount(raw: unknown): number | null {
  if (typeof raw === 'number' && raw !== 0) return raw;
  if (typeof raw === 'string') {
    const parsed = parseEuroAmount(raw);
    if (parsed !== null && parsed !== 0) return parsed;
  }
  return null;
}

function parseEuroAmount(str: string): number | null {
  // Handle " 1 032,86 €" format
  const cleaned = str
    .replace(/[€\s\u00a0]/g, '')  // remove €, spaces, nbsp
    .replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}
