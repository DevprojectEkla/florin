import { useTranslation } from 'react-i18next';
import Modal from './Modal';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open, title, message, confirmLabel, danger = false, onConfirm, onCancel,
}: Props) {
  const { t } = useTranslation();
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <p className="text-slate-300 text-sm mb-5">{message}</p>
      <div className="flex justify-end gap-2">
        <button className="btn-ghost" onClick={onCancel}>{t('common.cancel')}</button>
        <button
          className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
            danger
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : 'btn-primary'
          }`}
          onClick={onConfirm}
        >
          {confirmLabel ?? t('common.confirm')}
        </button>
      </div>
    </Modal>
  );
}
