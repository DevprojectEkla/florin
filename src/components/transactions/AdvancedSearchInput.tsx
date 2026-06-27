import { useState, useRef, useEffect } from 'react';
import { getSearchHints } from '../../lib/searchParser';

interface AdvancedSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function AdvancedSearchInput({
  value,
  onChange,
  placeholder = 'Rechercher...',
}: AdvancedSearchInputProps) {
  const [showHints, setShowHints] = useState(false);
  const [hints, setHints] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const hintsRef = useRef<HTMLDivElement>(null);

  // Update hints when query changes
  useEffect(() => {
    if (showHints) {
      setHints(getSearchHints(value));
    }
  }, [value, showHints]);

  // Close hints when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        hintsRef.current &&
        !hintsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowHints(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFocus = () => {
    setShowHints(true);
    setHints(getSearchHints(value));
  };

  const handleHintClick = (hint: string) => {
    // If hint is a suggestion, append or replace smartly
    if (hint.includes(':') || hint.includes('"') || hint.includes('OR')) {
      // For operator hints, replace the last word/token
      const tokens = value.split(/\s+/);
      const lastToken = tokens[tokens.length - 1] || '';
      
      if (lastToken.startsWith('category:') && hint.startsWith('category:')) {
        tokens[tokens.length - 1] = hint;
        onChange(tokens.join(' '));
      } else if (lastToken.startsWith('date:') && hint.startsWith('date:')) {
        tokens[tokens.length - 1] = hint;
        onChange(tokens.join(' '));
      } else {
        // Append
        onChange(value ? `${value} ${hint}` : hint);
      }
    } else {
      // For simple hints, append
      onChange(value ? `${value} ${hint}` : hint);
    }
    
    inputRef.current?.focus();
  };

  return (
    <div className="relative flex-1 max-w-md">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="input w-full pr-10"
        />
        
        {/* Search icon */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Help icon */}
        {!value && (
          <div 
            className="absolute right-10 top-1/2 -translate-y-1/2 text-slate-500 cursor-help"
            onClick={handleFocus}
            title="Voir les opérateurs de recherche"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )}
      </div>

      {/* Hints dropdown */}
      {showHints && hints.length > 0 && (
        <div
          ref={hintsRef}
          className="absolute z-50 mt-2 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden"
        >
          <div className="p-2 border-b border-slate-700">
            <p className="text-xs text-slate-400 font-medium">
              {value ? 'Suggestions' : 'Opérateurs de recherche'}
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {hints.map((hint, index) => (
              <button
                key={index}
                onClick={() => handleHintClick(hint.split(' - ')[0])}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700 transition-colors"
              >
                <span className="text-slate-200 font-mono text-xs">
                  {hint.split(' - ')[0]}
                </span>
                {hint.includes(' - ') && (
                  <span className="text-slate-400 text-xs ml-2">
                    {hint.split(' - ')[1]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
