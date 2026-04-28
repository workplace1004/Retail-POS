import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * Reusable delete confirmation modal.
 * @param {boolean} open - Whether the modal is visible
 * @param {() => void} onClose - Called when user cancels (No or backdrop)
 * @param {() => void} onConfirm - Called when user confirms (Yes)
 * @param {string} [message] - Confirmation question (default: delete price group)
 */
export function DeleteConfirmModal({ open, onClose, onConfirm, message = 'Are you sure you want to delete this price group?' }) {
  const { t } = useLanguage();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-confirm-title"
    >
      <div
        className="bg-pos-bg rounded-2xl shadow-xl max-w-2xl w-full mx-4 p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="delete-confirm-title" className="text-center text-white text-2xl font-medium py-8 leading-normal">
          {message}
        </p>
        <div className="flex justify-around mt-10 gap-12">
          <button
            type="button"
            className="px-8 py-4 rounded-lg text-lg font-semibold bg-rose-500 text-white active:bg-rose-600 focus:outline-none transition-colors"
            onClick={() => onConfirm?.()}
          >
            {t('yes')}
          </button>
          <button
            type="button"
            className="px-8 py-4 rounded-lg bg-pos-panel text-lg font-semibold text-white active:text-gray-400 focus:outline-none active:bg-green-500"
            onClick={onClose}
          >
            {t('no')}
          </button>
        </div>
      </div>
    </div>
  );
}
