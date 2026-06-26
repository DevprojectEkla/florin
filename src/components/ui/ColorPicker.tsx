// Simple swatchboard color picker — no external dependency needed

const SWATCHES = [
  // Greens (income)
  '#22c55e', '#16a34a', '#86efac', '#4ade80',
  // Oranges (fixed)
  '#f97316', '#ea580c', '#fb923c', '#fdba74',
  // Blues (variable)
  '#3b82f6', '#2563eb', '#60a5fa', '#93c5fd',
  // Yellows (savings)
  '#eab308', '#ca8a04', '#facc15', '#fde047',
  // Purples
  '#a855f7', '#9333ea', '#c084fc', '#d8b4fe',
  // Reds
  '#ef4444', '#dc2626', '#f87171', '#fca5a5',
  // Slates (transfer/neutral)
  '#64748b', '#475569', '#94a3b8', '#cbd5e1',
  // White/black
  '#f8fafc', '#1e293b',
];

interface Props {
  value: string | null;
  onChange: (color: string) => void;
}

export default function ColorPicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {SWATCHES.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={`w-6 h-6 rounded-md transition-transform hover:scale-110 ${
            value === color ? 'ring-2 ring-florin-400 ring-offset-1 ring-offset-slate-800' : ''
          }`}
          style={{ backgroundColor: color }}
          title={color}
        />
      ))}
    </div>
  );
}
