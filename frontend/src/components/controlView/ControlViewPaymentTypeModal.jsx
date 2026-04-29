import React from 'react';
import { Dropdown } from '../Dropdown';
import { KeyboardWithNumpad } from '../KeyboardWithNumpad';

const PAYMENT_INTEGRATION_OPTIONS = [
  { value: 'manual_cash', labelKey: 'control.paymentTypes.integration.manual_cash', fallback: 'Manual Cash' },
  { value: 'cashmatic', labelKey: 'control.paymentTypes.integration.cashmatic', fallback: 'Cashmatic' },
  { value: 'card', labelKey: 'control.paymentTypes.integration.card', fallback: 'Card' },
  { value: 'generic', labelKey: 'control.paymentTypes.integration.generic', fallback: 'Manual Card' }
];

const CARD_PROVIDER_OPTIONS = [
  { value: 'payworld', labelKey: 'control.paymentTypes.cardProvider.payworld', fallback: 'payworld' },
  { value: 'worldline', labelKey: 'control.paymentTypes.cardProvider.worldline', fallback: 'worldline' },
  { value: 'bancontactpro', labelKey: 'control.paymentTypes.cardProvider.bancontactpro', fallback: 'Bancontact QR (Pro)' },
  { value: 'ccv', labelKey: 'control.paymentTypes.cardProvider.ccv', fallback: 'ccv' },
  { value: 'viva', labelKey: 'control.paymentTypes.cardProvider.viva', fallback: 'viva' },
  { value: 'multisafepay', labelKey: 'control.paymentTypes.cardProvider.multisafepay', fallback: 'multisafepay' }
];

const CARD_PROVIDER_VALUES = new Set(CARD_PROVIDER_OPTIONS.map((option) => option.value));

export function ControlViewPaymentTypeModal({
  tr,
  mapTranslatedOptions,
  showPaymentTypeModal,
  closePaymentTypeModal,
  paymentTypeName,
  setPaymentTypeName,
  paymentTypeActive,
  setPaymentTypeActive,
  paymentTypeIntegration,
  setPaymentTypeIntegration,
  savingPaymentType,
  handleSavePaymentType
}) {
  if (!showPaymentTypeModal) return null;
  const selectedIntegration = CARD_PROVIDER_VALUES.has(paymentTypeIntegration) ? 'card' : paymentTypeIntegration;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative flex flex-col bg-pos-bg justify-between items-center rounded-xl border border-pos-border shadow-2xl max-w-[90%] w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="absolute top-2 right-4 z-10 p-2 rounded text-pos-muted active:text-pos-text active:bg-green-500" onClick={closePaymentTypeModal} aria-label="Close">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div className="p-6 flex flex-col gap-4 pt-14 text-sm">
          <div className="flex items-center gap-2">
            <label className="text-pos-text font-medium shrink-0 min-w-[130px]">{tr('control.paymentTypes.name', 'Name :')}</label>
            <input
              type="text"
              value={paymentTypeName}
              onChange={(e) => setPaymentTypeName(e.target.value)}
              placeholder={tr('control.paymentTypes.namePlaceholder', 'e.g. Cash, Bancontact')}
              className="flex-1 max-w-[200px] px-4 py-3 h-[40px] rounded-lg bg-pos-panel border border-gray-300 text-gray-200 placeholder-pos-muted focus:outline-none focus:border-green-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-pos-text font-medium shrink-0 min-w-[130px]">{tr('control.paymentTypes.active', 'Active :')}</span>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={paymentTypeActive} onChange={(e) => setPaymentTypeActive(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-pos-text font-medium shrink-0 min-w-[130px]">{tr('control.paymentTypes.integration', 'Integration:')}</label>
            <Dropdown
              options={mapTranslatedOptions(PAYMENT_INTEGRATION_OPTIONS)}
              value={selectedIntegration}
              onChange={(value) => {
                if (value === 'card') {
                  setPaymentTypeIntegration(CARD_PROVIDER_VALUES.has(paymentTypeIntegration) ? paymentTypeIntegration : 'payworld');
                } else {
                  setPaymentTypeIntegration(value);
                }
              }}
              placeholder={tr('control.paymentTypes.selectIntegration', 'Select integration')}
              className="flex-1 min-w-[200px] max-w-[280px] text-md"
            />
          </div>
          {selectedIntegration === 'card' ? (
            <div className="flex items-center gap-2">
              <label className="text-pos-text font-medium shrink-0 min-w-[130px]">{tr('control.paymentTypes.cardProvider', 'Card:')}</label>
              <Dropdown
                options={mapTranslatedOptions(CARD_PROVIDER_OPTIONS)}
                value={CARD_PROVIDER_VALUES.has(paymentTypeIntegration) ? paymentTypeIntegration : 'payworld'}
                onChange={setPaymentTypeIntegration}
                placeholder={tr('control.paymentTypes.selectCardProvider', 'Select card provider')}
                className="flex-1 min-w-[200px] max-w-[280px] text-md"
              />
            </div>
          ) : null}
          <div className="flex justify-center pt-5 pb-5">
            <button
              type="button"
              className="flex items-center text-lg gap-4 px-6 py-3 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50"
              disabled={savingPaymentType || !(paymentTypeName || '').trim()}
              onClick={handleSavePaymentType}
            >
              <svg fill="#ffffff" width="18px" height="18px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" /></svg>
              {tr('control.save', 'Save')}
            </button>
          </div>
        </div>
        <div className="shrink-0">
          <KeyboardWithNumpad value={paymentTypeName} onChange={setPaymentTypeName} />
        </div>
      </div>
    </div>
  );
}
