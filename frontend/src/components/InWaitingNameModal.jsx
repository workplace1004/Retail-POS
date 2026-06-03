import React, { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { KeyboardWithNumpad } from './KeyboardWithNumpad';

/**
 * Modal for entering customer name before sending order to "In waiting" / "In planning".
 * Layout: input field, three buttons (Cancel, Without name, Continue), and AZERTY + numpad keyboard.
 */
export function InWaitingNameModal({ open, onClose, onConfirm }) {
  const { t } = useLanguage();
  const tr = (key, fallback) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) setName('');
  }, [open]);

  if (!open) return null;

  const handleContinue = () => {
    onConfirm(name.trim());
    onClose();
  };

  const handleWithoutName = () => {
    onConfirm('');
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[52] flex items-center justify-center bg-black/40"
      onClick={(e) => e.target === e.currentTarget && handleCancel()}
    >
      <div
        className="flex flex-col bg-pos-bg rounded-xl shadow-2xl max-w-[900px] w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input field */}
        <div className="p-4 w-full flex items-center justify-center my-5">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tr('control.enterName', 'Enter name')}
            className="w-full px-4 py-2 min-w-[250px] max-w-[250px] text-lg bg-pos-panel border border-pos-border rounded-md text-pos-text placeholder-pos-muted focus:outline-none focus:ring-2 focus:ring-pos-accent"
            autoFocus
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 px-4 pb-3 justify-around">
          <button
            type="button"
            onClick={handleCancel}
            className="px-6 py-2.5 bg-pos-panel border border-pos-border active:bg-green-500 text-pos-text rounded-md font-medium"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleWithoutName}
            className="px-6 py-2.5 bg-pos-panel border border-pos-border active:bg-green-500 text-pos-text rounded-md font-medium"
          >
            {tr('orderPanel.inWaitingModal.withoutName', 'Without name')}
          </button>
          <button
            type="button"
            onClick={handleContinue}
            className="px-6 py-2.5 bg-pos-panel border border-pos-border active:bg-green-500 text-pos-text rounded-md font-medium"
          >
            {tr('orderPanel.inWaitingModal.continue', 'Continue')}
          </button>
        </div>

        {/* Keyboard */}
        <div className="overflow-auto">
          <KeyboardWithNumpad
            value={name}
            onChange={setName}
          />
        </div>
      </div>
    </div>
  );
}
