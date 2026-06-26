import { useState } from 'react';

// Comprehensive emoji icon set organized by category
const ICON_CATEGORIES = {
  'Money & Finance': [
    '💰','💵','💴','💶','💷','💸','💳','💎','🪙','📈','📉','💹','💱','🏦','🏧','💼','📊','🎯','🔐'
  ],
  'Shopping & Food': [
    '🛒','🛍️','🏪','🏬','🍽️','🍕','🍔','🍟','🍗','🥗','🥙','🍱','🍜','🍲','☕','🍺','🍷','🥂','🎂','🍰'
  ],
  'Transport': [
    '🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍️','🛵','🚲','🛴','✈️','🚁','🚂','🚆','🚇','🚊','🚉','⛴️','🚢','⛽','🅿️'
  ],
  'Home & Living': [
    '🏠','🏡','🏘️','🏚️','🏗️','🏢','🏬','🏭','🏛️','🛋️','🛏️','🪑','🚪','🪟','🛁','🚽','🧹','🧺','🧼','🧽','🧴','🔑','🗝️','💡','🕯️','🔦','⚡','💧','🔥'
  ],
  'Tech & Electronics': [
    '💻','🖥️','⌨️','🖱️','🖨️','💾','💿','📀','📱','☎️','📞','📟','📠','📺','📻','🎙️','🎚️','🎛️','⏱️','⏰','⌚','📡','🔋','🔌','💡','🔦','📷','📸','📹','🎥','📽️','🎬'
  ],
  'Clothing & Fashion': [
    '👔','👕','👖','🧥','🧦','👗','👘','👙','👚','👛','👜','👝','🎒','👞','👟','🥾','🥿','👠','👡','👢','👑','👒','🎩','🎓','🧢','⛑️','💄','💍','💎','👓','🕶️'
  ],
  'Sports & Fitness': [
    '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🏒','🏑','🥍','🏏','⛳','🏹','🎣','🥊','🥋','🎽','🛹','🛼','🥌','🎿','⛷️','🏂','🏋️','🤸','🚴','🤾','⛹️','🏊'
  ],
  'Entertainment': [
    '🎮','🕹️','🎲','🎯','🎰','🎪','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🪕','🎻','🎳','🎯','📺','🎬','🎭','🎨','🖼️','🎪','🎡','🎢','🎠'
  ],
  'Education & Work': [
    '📚','📖','📝','✏️','✒️','🖊️','🖋️','🖍️','📕','📗','📘','📙','📓','📔','📒','📃','📄','📰','🗞️','📑','🔖','🏷️','💼','📁','📂','🗂️','📅','📆','🗓️','📇','📈','📉','📊','📋','📌','📍','📎','🖇️','📏','📐','✂️','🗃️'
  ],
  'Health & Medical': [
    '💊','💉','🩺','🩹','🩼','🦷','🧬','🔬','🔭','🧪','🧫','🩻','🏥','⚕️','🚑','🧑‍⚕️','😷','🤒','🤕'
  ],
  'Beauty & Personal Care': [
    '💇','💇‍♀️','💇‍♂️','💆','💆‍♀️','💆‍♂️','💅','💄','💋','👄','🧴','🧼','🧽','🧻','🪒','✂️','💈','🪮','🧖','🧖‍♀️','🧖‍♂️','🛁','🚿'
  ],
  'Travel & Places': [
    '🗺️','🗿','🗼','🗽','🏰','🏯','🏟️','🎡','🎢','🎠','⛱️','🏖️','🏝️','🏜️','🏔️','⛰️','🏕️','⛺','🏞️','🌁','🌄','🌅','🌆','🌇','🌉','🌃','🌌','🏙️','🌠','✨'
  ],
  'Gifts & Celebrations': [
    '🎁','🎀','🎈','🎉','🎊','🎋','🎍','🎎','🎏','🎐','🎑','🧧','✉️','💌','💝','💖','💗','💓','💞','💕','🎂','🍰','🧁','🎉','🎊','🎈'
  ],
  'Nature & Animals': [
    '🌱','🌿','☘️','🍀','🎋','🎍','🌾','🌵','🌴','🌳','🌲','🏵️','🌸','🌺','🌻','🌷','🌹','🥀','💐','🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵'
  ],
  'Symbols & Misc': [
    '⭐','✨','💫','⚡','🔥','💥','💢','💨','💦','💧','☀️','⛅','☁️','🌧️','⛈️','🌩️','❄️','☃️','⛄','🌈','⚠️','🔰','✅','❌','⭕','🔴','🟠','🟡','🟢','🔵','🟣','🟤','⚫','⚪','🔶','🔷','▪️','▫️','◾','◽','◼️','◻️','⬛','⬜','🔲','🔳'
  ],
  'Transfer & Internal': [
    '↔️','⬅️','➡️','⬆️','⬇️','↩️','↪️','🔄','🔃','🔀','🔁','🔂','▶️','⏸️','⏹️','⏺️','⏏️','🔼','🔽'
  ],
};

interface Props {
  value: string | null;
  onChange: (icon: string) => void;
}

export default function IconPicker({ value, onChange }: Props) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Flatten all icons for search
  const allIcons = Object.values(ICON_CATEGORIES).flat();
  
  // Filter icons based on search (you can enhance this with emoji names if needed)
  const filteredIcons = search
    ? allIcons.filter(() => true) // For now, show all when searching
    : selectedCategory
    ? ICON_CATEGORIES[selectedCategory as keyof typeof ICON_CATEGORIES]
    : allIcons.slice(0, 80); // Show first 80 by default

  const categories = Object.keys(ICON_CATEGORIES);

  return (
    <div className="space-y-3">
      {/* Search */}
      <input
        type="text"
        placeholder="Search emoji..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500"
      />

      {/* Category tabs */}
      <div className="flex gap-1 flex-wrap max-h-24 overflow-y-auto">
        <button
          type="button"
          onClick={() => setSelectedCategory(null)}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            selectedCategory === null
              ? 'bg-florin-500/20 text-florin-400'
              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              selectedCategory === cat
                ? 'bg-florin-500/20 text-florin-400'
                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Icon grid */}
      <div className="grid grid-cols-10 gap-1 max-h-64 overflow-y-auto p-1">
        {filteredIcons.map((icon, idx) => (
          <button
            key={`${icon}-${idx}`}
            type="button"
            onClick={() => onChange(icon)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg text-lg transition-colors hover:bg-slate-600 ${
              value === icon ? 'bg-florin-500/20 ring-2 ring-florin-400' : ''
            }`}
            title={icon}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  );
}
