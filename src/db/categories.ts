import { getDb } from './client';
import type { Category, CategoryType } from '../types';

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getAllCategories(): Promise<Category[]> {
  const db = await getDb();
  return db.select<Category[]>(
    `SELECT id, slug, label, type, color, icon,
            is_system, is_active, sort_order
     FROM categories
     ORDER BY sort_order ASC, label ASC`
  );
}

export async function getActiveCategories(): Promise<Category[]> {
  const db = await getDb();
  return db.select<Category[]>(
    `SELECT id, slug, label, type, color, icon,
            is_system, is_active, sort_order
     FROM categories
     WHERE is_active = 1
     ORDER BY sort_order ASC, label ASC`
  );
}

export async function getCategoryById(id: number): Promise<Category | null> {
  const db = await getDb();
  const rows = await db.select<Category[]>(
    `SELECT id, slug, label, type, color, icon,
            is_system, is_active, sort_order
     FROM categories WHERE id = ?`,
    [id]
  );
  return rows[0] ?? null;
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export interface CreateCategoryInput {
  slug: string;
  label: string;
  type: CategoryType;
  color?: string;
  icon?: string;
}

export async function createCategory(input: CreateCategoryInput): Promise<number> {
  const db = await getDb();

  // Guard: reject duplicate slugs with a friendly error before hitting the DB constraint
  const existing = await db.select<{ id: number }[]>(
    'SELECT id FROM categories WHERE slug = ?',
    [input.slug]
  );
  if (existing.length > 0) {
    throw new Error('DUPLICATE_SLUG');
  }

  // Place new category after existing ones of same type
  const rows = await db.select<{ max_order: number | null }[]>(
    `SELECT MAX(sort_order) as max_order FROM categories WHERE type = ?`,
    [input.type]
  );
  const sortOrder = (rows[0]?.max_order ?? 0) + 10;

  const result = await db.execute(
    `INSERT INTO categories (slug, label, type, color, icon, is_system, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, 0, 1, ?)`,
    [
      input.slug,
      input.label,
      input.type,
      input.color ?? null,
      input.icon ?? null,
      sortOrder,
    ]
  );
  return result.lastInsertId as number;
}

export interface UpdateCategoryInput {
  label?: string;
  color?: string;
  icon?: string;
  sort_order?: number;
}

export async function updateCategory(
  id: number,
  input: UpdateCategoryInput
): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.label     !== undefined) { fields.push('label = ?');      values.push(input.label); }
  if (input.color     !== undefined) { fields.push('color = ?');      values.push(input.color); }
  if (input.icon      !== undefined) { fields.push('icon = ?');       values.push(input.icon); }
  if (input.sort_order !== undefined){ fields.push('sort_order = ?'); values.push(input.sort_order); }

  if (fields.length === 0) return;
  values.push(id);

  await db.execute(
    `UPDATE categories SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

export async function archiveCategory(id: number): Promise<void> {
  // Cannot delete if transactions reference this category — archive instead
  const db = await getDb();
  const refs = await db.select<{ n: number }[]>(
    `SELECT COUNT(*) as n FROM transactions WHERE category_id = ?`,
    [id]
  );
  if ((refs[0]?.n ?? 0) > 0) {
    await db.execute(
      `UPDATE categories SET is_active = 0 WHERE id = ? AND is_system = 0`,
      [id]
    );
  } else {
    await db.execute(
      `DELETE FROM categories WHERE id = ? AND is_system = 0`,
      [id]
    );
  }
}

export async function reorderCategories(
  orderedIds: number[]
): Promise<void> {
  const db = await getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute(
      `UPDATE categories SET sort_order = ? WHERE id = ?`,
      [(i + 1) * 10, orderedIds[i]]
    );
  }
}
