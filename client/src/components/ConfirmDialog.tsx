import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Brand-styled replacement for window.confirm — sticker card, hard plum
 * shadow, pill buttons. Confirm is the warm/primary action; Cancel is quiet.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open, title, message,
  confirmLabel = 'Continue',
  cancelLabel = 'Cancel',
  onConfirm, onCancel,
}) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-ink/50 backdrop-blur-sm flex items-center justify-center p-6"
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 24 }}
          style={{ boxShadow: '4px 4px 0 0 var(--color-ink)' }}
          className="w-full max-w-sm bg-paper rounded-[20px] border-[3px] border-ink p-6 flex flex-col gap-4"
          onClick={(e) => e.stopPropagation()}
          role="alertdialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-butter border-[2px] border-ink flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-ink" />
            </div>
            <h3 className="font-cute font-bold text-ink text-lg leading-tight">{title}</h3>
          </div>
          <p className="font-body text-ink-soft text-sm leading-relaxed">{message}</p>
          <div className="flex gap-3 justify-end pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="h-10 px-4 font-cute font-semibold text-sm text-ink bg-paper hover:bg-butter/50 rounded-pill border-[2px] border-ink/30 hover:border-ink transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              autoFocus
              className="h-10 px-5 font-cute font-semibold text-sm text-ink bg-cotton hover:bg-accent-hover rounded-pill border-[2px] border-ink transition-colors"
              style={{ boxShadow: '2px 2px 0 0 var(--color-ink)' }}
            >
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);
