#!/usr/bin/env node
/**
 * Generate SQL to classify transactions using seed data category mappings
 */

import { readFileSync } from 'fs';

const SEED_FILE = process.argv[2] || '/home/ekla/DevProjects/MVP/florin/src/db/seed-data.json';
const DB_PATH = `${process.env.HOME}/.config/com.devprojectekla.florin/florin.db`;

console.error('📄 Reading seed data:', SEED_FILE);
const seedData = JSON.parse(readFileSync(SEED_FILE, 'utf8'));

// Get fiscal year 2025-2026 transactions from seed
const seedTransactions = seedData.transactions['2025-2026'];
console.error(`✓ Found ${seedTransactions.length} seed transactions with categories`);

// Generate SQL
console.log('-- Classify transactions based on seed data');
console.log('-- Generated from:', SEED_FILE);
console.log('BEGIN TRANSACTION;');

let count = 0;

for (const seed of seedTransactions) {
  if (!seed.category_slug) continue;
  
  const debit = seed.debit || 0;
  const credit = seed.credit || 0;
  
  // Update transaction by matching date and amounts
  console.log(`
UPDATE transactions 
SET category_id = (SELECT id FROM categories WHERE slug = '${seed.category_slug}')
WHERE fiscal_year_id = 2
  AND date = '${seed.date}'
  AND ABS(debit - ${debit}) < 0.01
  AND ABS(credit - ${credit}) < 0.01
  AND category_id IS NULL;
`.trim());
  
  count++;
}

console.log('COMMIT;');
console.error(`\n✓ Generated ${count} UPDATE statements`);
