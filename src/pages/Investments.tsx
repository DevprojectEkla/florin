import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFiscalYear } from '../store/FiscalYearContext';
import {
  useVehicleSummaries, useRiskBreakdown, useAllPositions,
  useCreateVehicle, useCreatePosition, useDeletePosition,
} from '../hooks/usePortfolio';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const RISK_COLORS: Record<string, string> = {
  'stable':          '#22c55e',
  'moyen':           '#eab308',
  'volatile':        '#f97316',
  'très volatile':   '#ef4444',
  'non classé':      '#64748b',
};

const RISK_ORDER = ['stable', 'moyen', 'volatile', 'très volatile', 'non classé'];

export default function Investments() {
  const { t } = useTranslation();
  const { selected: fiscalYear, selectedId: fyId } = useFiscalYear();
  const { data: summaries = [] } = useVehicleSummaries(fyId ?? undefined);
  const { data: riskData = [] }  = useRiskBreakdown(fyId ?? undefined);
  const { data: allPositions = [] } = useAllPositions(fyId ?? undefined);

  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showAddPosition, setShowAddPosition] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const createVehicleMut = useCreateVehicle();
  const createPositionMut = useCreatePosition();
  const deletePositionMut = useDeletePosition();

  const grandTotal = summaries.reduce((s, v) => s + v.total, 0);

  if (!fyId) {
    return (
      <div className="p-6">
        <div className="card text-slate-400">{t('portfolio.select_year')}</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{t('nav.investments')}</h1>
          <p className="text-slate-400 text-sm">{fiscalYear?.label}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost text-sm" onClick={() => setShowAddVehicle(true)}>
            + {t('portfolio.add_vehicle')}
          </button>
          {summaries.length > 0 && (
            <button className="btn-primary text-sm" onClick={() => setShowAddPosition(true)}>
              + {t('portfolio.add_position')}
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {summaries.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {/* Total */}
          <div className="card">
            <span className="text-xs text-slate-500">{t('portfolio.total_invested')}</span>
            <div className="text-2xl font-bold text-florin-400 mt-1">{grandTotal.toFixed(0)} €</div>
          </div>
          {/* Per vehicle */}
          {summaries.map((v) => (
            <div key={v.id} className="card">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-200">{v.name}</span>
                <span className="text-xs text-slate-500">{v.percentage.toFixed(0)}%</span>
              </div>
              <div className="text-lg font-bold text-slate-100 mt-1">{v.total.toFixed(0)} €</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {v.positionCount} {t('portfolio.positions')} · {t('portfolio.cash')}: {v.cashBalance.toFixed(0)} €
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Risk breakdown */}
      {riskData.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-medium text-slate-400 mb-3">{t('portfolio.risk_breakdown')}</h2>
          <div className="flex gap-1 h-4 rounded-full overflow-hidden mb-3">
            {RISK_ORDER.filter((r) => riskData.find((d) => d.risk_level === r))
              .map((level) => {
                const d = riskData.find((r) => r.risk_level === level);
                if (!d) return null;
                return (
                  <div
                    key={level}
                    className="h-full transition-all"
                    style={{ width: `${d.percentage}%`, backgroundColor: RISK_COLORS[level] }}
                    title={`${level}: ${d.percentage.toFixed(0)}%`}
                  />
                );
              })}
          </div>
          <div className="flex flex-wrap gap-4">
            {RISK_ORDER.filter((r) => riskData.find((d) => d.risk_level === r))
              .map((level) => {
                const d = riskData.find((r) => r.risk_level === level)!;
                return (
                  <div key={level} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: RISK_COLORS[level] }} />
                    <span className="text-xs text-slate-300">{level}</span>
                    <span className="text-xs text-slate-500">{d.percentage.toFixed(0)}% ({d.total.toFixed(0)} €)</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Positions table */}
      {allPositions.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-3 py-2.5 text-left">{t('portfolio.name')}</th>
                <th className="px-3 py-2.5 text-left w-20">{t('portfolio.vehicle_col')}</th>
                <th className="px-3 py-2.5 text-left w-20">{t('portfolio.type')}</th>
                <th className="px-3 py-2.5 text-left">{t('portfolio.sector')}</th>
                <th className="px-3 py-2.5 text-left w-24">{t('portfolio.risk')}</th>
                <th className="px-3 py-2.5 text-right w-24">{t('portfolio.amount')}</th>
                <th className="px-3 py-2.5 text-center w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {allPositions.map((pos) => (
                <tr key={pos.id} className="hover:bg-slate-700/30">
                  <td className="px-3 py-2 text-slate-200">{pos.name}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">{pos.vehicle_name}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">{pos.asset_type ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">{pos.sector ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: RISK_COLORS[pos.risk_level ?? 'non classé'] }}
                      />
                      <span className="text-xs text-slate-300">{pos.risk_level ?? '—'}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-200">{pos.amount.toFixed(0)} €</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      className="text-slate-500 hover:text-red-400 transition-colors p-1 inline-flex items-center justify-center"
                      onClick={() => setDeleteTarget(pos.id)}
                      title={t('common.delete')}
                    >
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18"/>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {summaries.length === 0 && (
        <div className="card text-center py-12 text-slate-400">
          <div className="text-4xl mb-3">📊</div>
          <p>{t('portfolio.empty')}</p>
        </div>
      )}

      {/* Add Vehicle Modal */}
      <AddVehicleModal
        open={showAddVehicle}
        onClose={() => setShowAddVehicle(false)}
        onSubmit={async (data) => {
          await createVehicleMut.mutateAsync({ fiscalYearId: fyId, ...data });
          setShowAddVehicle(false);
        }}
      />

      {/* Add Position Modal */}
      <AddPositionModal
        open={showAddPosition}
        onClose={() => setShowAddPosition(false)}
        vehicles={summaries}
        onSubmit={async (data) => {
          await createPositionMut.mutateAsync(data);
          setShowAddPosition(false);
        }}
      />

      {/* Delete Position Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={t('portfolio.delete_position_title')}
        message={t('portfolio.delete_position_message')}
        confirmLabel={t('common.delete')}
        danger={true}
        onConfirm={async () => {
          if (deleteTarget) {
            await deletePositionMut.mutateAsync(deleteTarget);
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ─── Add Vehicle Modal ───────────────────────────────────────────────────────

function AddVehicleModal({ open, onClose, onSubmit }: {
  open: boolean; onClose: () => void;
  onSubmit: (data: { name: string; expectedYield: number; cashBalance: number }) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [yield_, setYield] = useState('8');
  const [cash, setCash] = useState('0');

  return (
    <Modal open={open} onClose={onClose} title={t('portfolio.add_vehicle')} size="sm">
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-slate-300 mb-1">{t('portfolio.vehicle_name')}</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="PEA" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-slate-300 mb-1">{t('portfolio.expected_yield')} (%)</label>
            <input className="input" type="number" step="0.5" value={yield_} onChange={(e) => setYield(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">{t('portfolio.cash')}</label>
            <input className="input" type="number" step="10" value={cash} onChange={(e) => setCash(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="btn-primary"
            onClick={() => onSubmit({ name, expectedYield: parseFloat(yield_) / 100, cashBalance: parseFloat(cash) || 0 })}
            disabled={!name.trim()}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Add Position Modal ──────────────────────────────────────────────────────

function AddPositionModal({ open, onClose, vehicles, onSubmit }: {
  open: boolean; onClose: () => void;
  vehicles: { id: number; name: string }[];
  onSubmit: (data: {
    vehicleId: number; name: string; ticker?: string; assetType?: string;
    sector?: string; riskLevel?: string; amount: number;
  }) => void;
}) {
  const { t } = useTranslation();
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? 0);
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [assetType, setAssetType] = useState('Action');
  const [sector, setSector] = useState('');
  const [riskLevel, setRiskLevel] = useState('moyen');
  const [amount, setAmount] = useState('');

  const RISKS = ['stable', 'moyen', 'volatile', 'très volatile'];

  return (
    <Modal open={open} onClose={onClose} title={t('portfolio.add_position')} size="md">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-slate-300 mb-1">{t('portfolio.vehicle_col')}</label>
            <select className="input" value={vehicleId} onChange={(e) => setVehicleId(parseInt(e.target.value))}>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">{t('portfolio.type')}</label>
            <select className="input" value={assetType} onChange={(e) => setAssetType(e.target.value)}>
              <option>Action</option>
              <option>ETF</option>
              <option>Obligation</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-slate-300 mb-1">{t('portfolio.name')}</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nvidia" autoFocus />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Ticker</label>
            <input className="input" value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="NVDA" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-slate-300 mb-1">{t('portfolio.sector')}</label>
            <input className="input" value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Tech" />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">{t('portfolio.risk')}</label>
            <select className="input" value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)}>
              {RISKS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">{t('portfolio.amount')} (€)</label>
          <input className="input" type="number" step="10" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="btn-primary"
            onClick={() => onSubmit({
              vehicleId, name, ticker: ticker || undefined, assetType,
              sector: sector || undefined, riskLevel, amount: parseFloat(amount) || 0,
            })}
            disabled={!name.trim() || !amount}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
