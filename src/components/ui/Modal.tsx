import { ReactNode, useEffect } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClass = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-5xl' };

export default function Modal({ open, onClose, title, children, footer, size = 'md' }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Dialog */}
      <div className={`relative bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full mx-4 flex flex-col ${sizeClass[size]} max-h-[90vh]`}>
        {/* Header — fixed */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>
        {/* Body — scrollable */}
        <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>
        {/* Footer — fixed, outside scroll */}
        {footer && (
          <div className="px-5 py-4 border-t border-slate-700 flex-shrink-0 bg-slate-800">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
