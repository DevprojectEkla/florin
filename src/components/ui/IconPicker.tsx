// Curated set of emoji icons relevant to finance categories

const ICONS = [
  // Income
  '💼','📦','🏛️','💵','💰','📈','📊','🎯',
  // Housing / fixed
  '🏠','⚡','��','📱','🛡️','🏦','✡️','🕍',
  // Variable
  '🛒','🍽️','🥗','☕','💊','🎭','🎬','🎵',
  '🚇','🚗','✈️','👗','👟','🏃','📚','🎓',
  // Savings / investment
  '🏧','🪙','💹','🔐','🏗️','🏢',
  // Transfer / misc
  '↔️','⚠️','🔖','⭐','🗂️','📋',
];

interface Props {
  value: string | null;
  onChange: (icon: string) => void;
}

export default function IconPicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-8 gap-1">
      {ICONS.map((icon) => (
        <button
          key={icon}
          type="button"
          onClick={() => onChange(icon)}
          className={`w-8 h-8 flex items-center justify-center rounded-lg text-lg transition-colors hover:bg-slate-600 ${
            value === icon ? 'bg-florin-500/20 ring-1 ring-florin-400' : ''
          }`}
          title={icon}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
