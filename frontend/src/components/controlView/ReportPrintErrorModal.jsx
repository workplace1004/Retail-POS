import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * In-app error dialog for report printing (replaces window.alert).
 */
export function ReportPrintErrorModal({ open, message, onClose }) {
  const { t } = useLanguage();
  if (!open || message == null || String(message).trim() === '') return null;

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-print-error-title"
      onClick={onClose}
    >
      <div
        className="bg-pos-panel rounded-2xl shadow-xl max-w-2xl w-full p-8 border-2 border-pos-border"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="report-print-error-title" className="text-2xl font-semibold text-pos-text mb-4 text-center">
          {t('control.reports.printErrorTitle', 'Print failed')}
        </h2>
        <p className="text-pos-text text-xl text-center whitespace-pre-wrap break-words py-4 leading-relaxed">
          {message}
        </p>
        <div className="flex justify-center mt-8">
          <button
            type="button"
            className="px-16 py-4 rounded-lg text-2xl font-semibold bg-rose-600 text-white active:bg-rose-500"
            onClick={onClose}
          >
            {t('ok')}
          </button>
        </div>
      </div>
    </div>
  );
}
