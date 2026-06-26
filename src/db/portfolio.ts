import { getDb } from './client';

// ─── Vehicles ────────────────────────────────────────────────────────────────

export interface Vehicle {
  id: number;
  fiscal_year_id: number;
  name: string;
  expected_yield: number;
  cash_balance: number;
}

export async function getVehicles(fiscalYearId: number): Promise<Vehicle[]> {
  const db = await getDb();
  return db.select<Vehicle[]>(
    'SELECT * FROM portfolio_vehicles WHERE fiscal_year_id = ? ORDER BY name',
    [fiscalYearId]
  );
}

export async function createVehicle(input: {
  fiscalYearId: number; name: string; expectedYield: number; cashBalance: number;
}): Promise<number> {
  const db = await getDb();
  const r = await db.execute(
    `INSERT INTO portfolio_vehicles (fiscal_year_id, name, expected_yield, cash_balance)
     VALUES (?, ?, ?, ?)`,
    [input.fiscalYearId, input.name, input.expectedYield, input.cashBalance]
  );
  return r.lastInsertId as number;
}

export async function updateVehicle(id: number, input: {
  name?: string; expectedYield?: number; cashBalance?: number;
}): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  if (input.name !== undefined)          { fields.push('name = ?');           values.push(input.name); }
  if (input.expectedYield !== undefined) { fields.push('expected_yield = ?'); values.push(input.expectedYield); }
  if (input.cashBalance !== undefined)   { fields.push('cash_balance = ?');   values.push(input.cashBalance); }
  if (fields.length === 0) return;
  values.push(id);
  await db.execute(`UPDATE portfolio_vehicles SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteVehicle(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM portfolio_positions WHERE vehicle_id = ?', [id]);
  await db.execute('DELETE FROM portfolio_vehicles WHERE id = ?', [id]);
}

// ─── Positions ───────────────────────────────────────────────────────────────

export interface Position {
  id: number;
  vehicle_id: number;
  name: string;
  ticker: string | null;
  asset_type: string | null;
  sector: string | null;
  description: string | null;
  risk_level: string | null;
  amount: number;
  fees: number;
  updated_at: string;
}

export async function getPositions(vehicleId: number): Promise<Position[]> {
  const db = await getDb();
  return db.select<Position[]>(
    'SELECT * FROM portfolio_positions WHERE vehicle_id = ? ORDER BY amount DESC',
    [vehicleId]
  );
}

export async function getAllPositions(fiscalYearId: number): Promise<(Position & { vehicle_name: string })[]> {
  const db = await getDb();
  return db.select<(Position & { vehicle_name: string })[]>(
    `SELECT p.*, v.name as vehicle_name
     FROM portfolio_positions p
     JOIN portfolio_vehicles v ON v.id = p.vehicle_id
     WHERE v.fiscal_year_id = ?
     ORDER BY p.amount DESC`,
    [fiscalYearId]
  );
}

export async function createPosition(input: {
  vehicleId: number; name: string; ticker?: string; assetType?: string;
  sector?: string; description?: string; riskLevel?: string; amount: number; fees?: number;
}): Promise<number> {
  const db = await getDb();
  const r = await db.execute(
    `INSERT INTO portfolio_positions
      (vehicle_id, name, ticker, asset_type, sector, description, risk_level, amount, fees)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.vehicleId, input.name, input.ticker ?? null, input.assetType ?? null,
      input.sector ?? null, input.description ?? null, input.riskLevel ?? null,
      input.amount, input.fees ?? 0,
    ]
  );
  return r.lastInsertId as number;
}

export async function updatePosition(id: number, input: {
  name?: string; ticker?: string; assetType?: string; sector?: string;
  description?: string; riskLevel?: string; amount?: number; fees?: number;
}): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  if (input.name !== undefined)        { fields.push('name = ?');        values.push(input.name); }
  if (input.ticker !== undefined)      { fields.push('ticker = ?');      values.push(input.ticker); }
  if (input.assetType !== undefined)   { fields.push('asset_type = ?');  values.push(input.assetType); }
  if (input.sector !== undefined)      { fields.push('sector = ?');      values.push(input.sector); }
  if (input.description !== undefined) { fields.push('description = ?'); values.push(input.description); }
  if (input.riskLevel !== undefined)   { fields.push('risk_level = ?');  values.push(input.riskLevel); }
  if (input.amount !== undefined)      { fields.push('amount = ?');      values.push(input.amount); }
  if (input.fees !== undefined)        { fields.push('fees = ?');        values.push(input.fees); }
  if (fields.length === 0) return;
  fields.push("updated_at = datetime('now')");
  values.push(id);
  await db.execute(`UPDATE portfolio_positions SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deletePosition(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM portfolio_positions WHERE id = ?', [id]);
}

// ─── Aggregates ──────────────────────────────────────────────────────────────

export interface RiskBreakdown {
  risk_level: string;
  total: number;
  percentage: number;
}

export async function getRiskBreakdown(fiscalYearId: number): Promise<RiskBreakdown[]> {
  const positions = await getAllPositions(fiscalYearId);
  const grandTotal = positions.reduce((s, p) => s + p.amount, 0);
  if (grandTotal === 0) return [];

  const byRisk: Record<string, number> = {};
  for (const p of positions) {
    const level = p.risk_level ?? 'non classé';
    byRisk[level] = (byRisk[level] ?? 0) + p.amount;
  }

  return Object.entries(byRisk)
    .map(([risk_level, total]) => ({
      risk_level,
      total,
      percentage: (total / grandTotal) * 100,
    }))
    .sort((a, b) => b.total - a.total);
}

export interface VehicleSummary {
  id: number;
  name: string;
  total: number;
  percentage: number;
  positionCount: number;
  cashBalance: number;
  expectedYield: number;
}

export async function getVehicleSummaries(fiscalYearId: number): Promise<VehicleSummary[]> {
  const vehicles = await getVehicles(fiscalYearId);
  const positions = await getAllPositions(fiscalYearId);
  const grandTotal = positions.reduce((s, p) => s + p.amount, 0) +
                     vehicles.reduce((s, v) => s + v.cash_balance, 0);

  return vehicles.map((v) => {
    const vPositions = positions.filter((p) => p.vehicle_id === v.id);
    const total = vPositions.reduce((s, p) => s + p.amount, 0) + v.cash_balance;
    return {
      id: v.id,
      name: v.name,
      total,
      percentage: grandTotal > 0 ? (total / grandTotal) * 100 : 0,
      positionCount: vPositions.length,
      cashBalance: v.cash_balance,
      expectedYield: v.expected_yield,
    };
  });
}
