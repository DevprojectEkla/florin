#!/usr/bin/env node
import XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';

const CA_FILE = process.argv[2] || '/home/ekla/DevProjects/MVP/CA20260626_235231.xlsx';

const buffer = readFileSync(CA_FILE);
const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, {
  header: 1,
  raw: true,
  dateNF: 'yyyy-mm-dd',
});

// Find header row
const headerIdx = rows.findIndex(
  (row) => row && row[0] === 'Date' && typeof row[1] === 'string' && row[1].includes('Libellé')
);

console.log('-- Import transactions from CA file');
console.log('-- File: ' + CA_FILE);
console.log('BEGIN TRANSACTION;');

const batchId = Date.now();
let count = 0;

for (let i = headerIdx + 1; i < rows.length; i++) {
  const row = rows[i];
  if (!row || row.length < 2) continue;
  
  const dateRaw = row[0];
  const label = String(row[1] ?? '').trim();
  const debitRaw = row[2];
  const creditRaw = row[3];
  
  if (!dateRaw || !label) continue;
  
  // Parse date
  let date;
  if (dateRaw instanceof Date) {
    date = dateRaw.toISOString().slice(0, 10);
  } else if (typeof dateRaw === 'number') {
    const d = XLSX.SSF.parse_date_code(dateRaw);
    if (d) {
      date = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
  } else {
    continue;
  }
  
  // Parse amounts
  const debit = (typeof debitRaw === 'number' && debitRaw !== 0) ? debitRaw : 0;
  const credit = (typeof creditRaw === 'number' && creditRaw !== 0) ? creditRaw : 0;
  
  if (debit === 0 && credit === 0) continue;
  
  // Create dedup hash
  const dedupStr = `${date}|${label}|${debit}|${credit}`;
  const dedupHash = createHash('sha256').update(dedupStr).digest('hex');
  
  // Clean label - escape single quotes for SQL
  const labelClean = label.replace(/\s+/g, ' ').trim();
  const labelEscaped = label.replace(/'/g, "''");
  const labelCleanEscaped = labelClean.replace(/'/g, "''");
  
  console.log(`INSERT INTO transactions (account_id, fiscal_year_id, import_batch_id, date, label, label_clean, debit, credit, category_id, is_out_of_budget, notes, is_reviewed, dedup_hash) VALUES (1, 2, ${batchId}, '${date}', '${labelEscaped}', '${labelCleanEscaped}', ${debit}, ${credit}, NULL, 0, NULL, 0, '${dedupHash}');`);
  
  count++;
}

console.log('COMMIT;');
console.error(`-- Total transactions: ${count}`);
