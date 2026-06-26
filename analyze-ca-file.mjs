#!/usr/bin/env node
/**
 * Analyze CA bank statement file to understand balance discrepancy
 */

import XLSX from 'xlsx';
import { readFileSync } from 'fs';

const CA_FILE = process.argv[2] || '/home/ekla/DevProjects/MVP/CA20260626_215551.xlsx';

console.log('=== CA BANK STATEMENT ANALYSIS ===\n');

const buffer = readFileSync(CA_FILE);
const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, {
  header: 1,
  raw: true,
  dateNF: 'yyyy-mm-dd',
});

console.log('File:', CA_FILE);
console.log('Total rows:', rows.length);
console.log('\n--- HEADER SECTION ---');

// Extract metadata
let accountNumber = null;
let balanceAtImport = null;
let periodFrom = null;
let periodTo = null;

for (let i = 0; i < Math.min(12, rows.length); i++) {
  const row = rows[i];
  if (!row) continue;
  
  // Account number
  const cell0 = String(row[0] ?? '');
  const accMatch = cell0.match(/n°\s*(\d+)/);
  if (accMatch) {
    accountNumber = accMatch[1];
    console.log(`Account Number: ${accountNumber}`);
  }
  
  // Balance
  for (let j = 0; j < row.length; j++) {
    const cellStr = String(row[j] ?? '');
    if (cellStr.includes('Solde au')) {
      const amtStr = String(row[j+1] ?? row[j] ?? '');
      const cleaned = amtStr.replace(/[€\s\u00a0]/g, '').replace(',', '.');
      balanceAtImport = parseFloat(cleaned);
      console.log(`Balance at Import: €${balanceAtImport} (from "${cellStr}")`);
      break;
    }
  }
  
  // Period
  const periodMatch = cell0.match(/entre le (\d{2}\/\d{2}\/\d{4}) et le (\d{2}\/\d{2}\/\d{4})/);
  if (periodMatch) {
    periodFrom = periodMatch[1];
    periodTo = periodMatch[2];
    console.log(`Period: ${periodFrom} to ${periodTo}`);
  }
}

// Find header row
const headerIdx = rows.findIndex(
  (row) => row && row[0] === 'Date' && typeof row[1] === 'string' && row[1].includes('Libellé')
);

if (headerIdx === -1) {
  console.error('\n❌ ERROR: Cannot find transaction header row');
  process.exit(1);
}

console.log(`\nTransaction header at row ${headerIdx + 1}`);
console.log('\n--- TRANSACTIONS ---');

const transactions = [];
let totalDebits = 0;
let totalCredits = 0;

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
  const debit = (typeof debitRaw === 'number' && debitRaw !== 0) ? debitRaw : null;
  const credit = (typeof creditRaw === 'number' && creditRaw !== 0) ? creditRaw : null;
  
  if (debit === null && credit === null) continue;
  
  transactions.push({ date, label, debit, credit });
  
  if (debit) totalDebits += debit;
  if (credit) totalCredits += credit;
  
  console.log(`${date} | ${label.slice(0, 40).padEnd(40)} | D:${debit ? debit.toFixed(2).padStart(10) : '      -   '} | C:${credit ? credit.toFixed(2).padStart(10) : '      -   '}`);
}

console.log('\n--- SUMMARY ---');
console.log(`Total Transactions: ${transactions.length}`);
console.log(`Total Debits:  €${totalDebits.toFixed(2)}`);
console.log(`Total Credits: €${totalCredits.toFixed(2)}`);
console.log(`Net Change:    €${(totalCredits - totalDebits).toFixed(2)}`);
console.log(`\nBalance at Import: €${balanceAtImport}`);

// Calculate what the opening balance should be
const openingBalance = balanceAtImport - (totalCredits - totalDebits);
console.log(`\n📊 CALCULATION:`);
console.log(`   Current Balance:     €${balanceAtImport}`);
console.log(`   - Net Change:        €${(totalCredits - totalDebits).toFixed(2)}`);
console.log(`   = Opening Balance:   €${openingBalance.toFixed(2)}`);
console.log(`\n   This means at the START of the period (${periodFrom}),`);
console.log(`   the balance should have been €${openingBalance.toFixed(2)}`);
