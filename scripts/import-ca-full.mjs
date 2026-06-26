#!/usr/bin/env node
/**
 * Import complete CA bank statement (Sept 2025 - June 2026) into database
 */

import XLSX from 'xlsx';
import { readFileSync } from 'fs';
import Database from 'better-sqlite3';
import { createHash } from 'crypto';

const CA_FILE = process.argv[2] || '/home/ekla/DevProjects/MVP/CA20260626_235231.xlsx';
const DB_PATH = process.argv[3] || `${process.env.HOME}/.config/com.devprojectekla.florin/florin.db`;

console.log('📂 Opening database:', DB_PATH);
const db = new Database(DB_PATH);

console.log('📄 Reading CA file:', CA_FILE);
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

if (headerIdx === -1) {
  console.error('❌ Cannot find transaction header row');
  process.exit(1);
}

console.log(`✓ Found header at row ${headerIdx + 1}`);

// Get fiscal year and account
const fiscalYear = db.prepare('SELECT id FROM fiscal_years WHERE start_year = 2025 AND start_month = 9').get();
const account = db.prepare('SELECT id FROM accounts LIMIT 1').get();

if (!fiscalYear) {
  console.error('❌ Fiscal year 2025-2026 not found');
  process.exit(1);
}

if (!account) {
  console.error('❌ No account found');
  process.exit(1);
}

console.log(`✓ Fiscal year ID: ${fiscalYear.id}`);
console.log(`✓ Account ID: ${account.id}`);

// Create import batch
const batchId = Date.now();
console.log(`✓ Import batch ID: ${batchId}`);

// Parse transactions
const transactions = [];
let imported = 0;
let skipped = 0;

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
  
  // Clean label
  const labelClean = label.replace(/\s+/g, ' ').trim();
  
  transactions.push({
    date,
    label,
    labelClean,
    debit,
    credit,
    dedupHash,
  });
}

console.log(`\n📊 Found ${transactions.length} transactions`);

// Insert transactions
const insertStmt = db.prepare(`
  INSERT INTO transactions (
    account_id,
    fiscal_year_id,
    import_batch_id,
    date,
    label,
    label_clean,
    debit,
    credit,
    category_id,
    is_out_of_budget,
    notes,
    is_reviewed,
    dedup_hash
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, 0, ?)
`);

const insertMany = db.transaction((txns) => {
  for (const txn of txns) {
    try {
      insertStmt.run(
        account.id,
        fiscalYear.id,
        batchId,
        txn.date,
        txn.label,
        txn.labelClean,
        txn.debit,
        txn.credit,
        txn.dedupHash
      );
      imported++;
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        skipped++;
      } else {
        console.error(`❌ Error inserting transaction: ${err.message}`);
        console.error(`   Date: ${txn.date}, Label: ${txn.label}`);
      }
    }
  }
});

console.log('💾 Importing transactions...');
insertMany(transactions);

console.log(`\n✅ Import complete!`);
console.log(`   Imported: ${imported}`);
console.log(`   Skipped (duplicates): ${skipped}`);

// Calculate balance
const result = db.prepare(`
  SELECT 
    (SELECT opening_balance FROM fiscal_years WHERE id = ?) as opening,
    SUM(debit) - SUM(credit) as net,
    (SELECT opening_balance FROM fiscal_years WHERE id = ?) + (SUM(debit) - SUM(credit)) as balance
  FROM transactions
  WHERE fiscal_year_id = ?
`).get(fiscalYear.id, fiscalYear.id, fiscalYear.id);

console.log(`\n💰 Balance calculation:`);
console.log(`   Opening balance: €${result.opening.toFixed(2)}`);
console.log(`   Net transactions: €${(-result.net).toFixed(2)}`);
console.log(`   Current balance: €${(result.opening - result.net).toFixed(2)}`);
console.log(`   Expected: €229.90`);

db.close();
