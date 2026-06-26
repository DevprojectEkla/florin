import { getDb } from './client';

export interface ClassificationRule {
  id: number;
  pattern: string;
  pattern_type: string;
  category_id: number;
  priority: number;
  is_active: boolean;
  match_count: number;
  created_at: string;
  // Joined
  category_label?: string;
  category_icon?: string;
  category_color?: string;
}

export async function getRules(): Promise<ClassificationRule[]> {
  const db = await getDb();
  return db.select<ClassificationRule[]>(
    `SELECT r.*, c.label as category_label, c.icon as category_icon, c.color as category_color
     FROM classification_rules r
     LEFT JOIN categories c ON c.id = r.category_id
     ORDER BY r.priority DESC, r.pattern ASC`
  );
}

export interface CreateRuleInput {
  pattern: string;
  pattern_type: string;
  category_id: number;
  priority: number;
}

export async function createRule(input: CreateRuleInput): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO classification_rules (pattern, pattern_type, category_id, priority, is_active)
     VALUES (?, ?, ?, ?, 1)`,
    [input.pattern, input.pattern_type, input.category_id, input.priority]
  );
  return result.lastInsertId as number;
}

export interface UpdateRuleInput {
  pattern?: string;
  pattern_type?: string;
  category_id?: number;
  priority?: number;
  is_active?: boolean;
}

export async function updateRule(id: number, input: UpdateRuleInput): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.pattern      !== undefined) { fields.push('pattern = ?');      values.push(input.pattern); }
  if (input.pattern_type !== undefined) { fields.push('pattern_type = ?'); values.push(input.pattern_type); }
  if (input.category_id  !== undefined) { fields.push('category_id = ?');  values.push(input.category_id); }
  if (input.priority     !== undefined) { fields.push('priority = ?');     values.push(input.priority); }
  if (input.is_active    !== undefined) { fields.push('is_active = ?');    values.push(input.is_active ? 1 : 0); }

  if (fields.length === 0) return;
  values.push(id);

  await db.execute(`UPDATE classification_rules SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteRule(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM classification_rules WHERE id = ?', [id]);
}

/**
 * Run classification rules on all unclassified transactions.
 * Returns the number of newly classified transactions.
 */
export async function reclassifyUnclassified(): Promise<number> {
  const db = await getDb();
  const rules = await db.select<{ id: number; pattern: string; pattern_type: string; category_id: number }[]>(
    `SELECT id, pattern, pattern_type, category_id
     FROM classification_rules WHERE is_active = 1 ORDER BY priority DESC`
  );

  const unclassified = await db.select<{ id: number; label: string }[]>(
    'SELECT id, label FROM transactions WHERE category_id IS NULL'
  );

  let classified = 0;
  for (const tx of unclassified) {
    for (const rule of rules) {
      if (matchesPattern(tx.label, rule.pattern, rule.pattern_type)) {
        await db.execute(
          'UPDATE transactions SET category_id = ? WHERE id = ?',
          [rule.category_id, tx.id]
        );
        await db.execute(
          'UPDATE classification_rules SET match_count = match_count + 1 WHERE id = ?',
          [rule.id]
        );
        classified++;
        break;
      }
    }
  }
  return classified;
}

function matchesPattern(label: string, pattern: string, type: string): boolean {
  const upperLabel = label.toUpperCase();
  const upperPattern = pattern.toUpperCase();
  switch (type) {
    case 'contains': return upperLabel.includes(upperPattern);
    case 'starts_with': return upperLabel.startsWith(upperPattern);
    case 'regex':
      try { return new RegExp(pattern, 'i').test(label); }
      catch { return false; }
    default: return upperLabel.includes(upperPattern);
  }
}
