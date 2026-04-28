import React from 'react';
import { Dropdown } from '../Dropdown';

/** Maps stored/UI values to `serial` | `tcp-ip` so TCP mode matches dropdown options and LSM IP visibility. */
function normalizeScaleConnectionMode(mode) {
  let s = String(mode ?? '').replace(/^\uFEFF/, '').trim().toLowerCase();
  s = s.replace(/_/g, '-').replace(/\//g, '-');
  if (s === 'tcp-ip' || s === 'tcpip') return 'tcp-ip';
  return 'serial';
}

export function ControlViewExternalSimpleDevices(props) {
  const { subNavId, tr, mapTranslatedOptions } = props;

  if (subNavId === 'Price Display') {
    return (
      <div className="flex flex-col min-h-[650px] max-h-[550px] justify-between items-center">
        <div className="flex flex-col gap-6 mb-6 pt-[150px]">
          <div className="flex items-center gap-10">
            <label className="block text-pos-text text-sm font-medium shrink-0">{tr('control.external.type', 'Type:')}</label>
            <Dropdown options={mapTranslatedOptions(props.PRICE_DISPLAY_TYPE_OPTIONS)} value={props.priceDisplayType} onChange={props.setPriceDisplayType} placeholder={tr('control.external.disabled', 'Disabled')} className="text-sm min-w-[220px]" />
          </div>
          <div className="flex justify-center mt-[100px] text-md">
            <button type="button" className="flex items-center gap-4 px-6 py-2 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50" disabled={props.savingPriceDisplay} onClick={props.handleSavePriceDisplay}>
              <svg fill="currentColor" width="14" height="14" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" /></svg>
              {tr('control.save', 'Save')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (subNavId === 'RFID Reader') {
    return (
      <div className="flex flex-col min-h-[650px] max-h-[550px] justify-between items-center">
        <div className="flex flex-col gap-6 mb-6 pt-[150px]">
          <div className="flex items-center gap-10">
            <label className="block text-pos-text text-sm font-medium shrink-0">{tr('control.external.type', 'Type:')}</label>
            <Dropdown options={mapTranslatedOptions(props.RFID_READER_TYPE_OPTIONS)} value={props.rfidReaderType} onChange={props.setRfidReaderType} placeholder={tr('control.external.disabled', 'Disabled')} className="text-sm min-w-[220px]" />
          </div>
          <div className="flex justify-center mt-[100px] text-md">
            <button type="button" className="flex items-center gap-4 px-6 py-2 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50" disabled={props.savingRfidReader} onClick={props.handleSaveRfidReader}>
              <svg fill="currentColor" width="14" height="14" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" /></svg>
              {tr('control.save', 'Save')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (subNavId === 'Barcode Scanner') {
    return (
      <div className="flex flex-col min-h-[650px] max-h-[550px] justify-between items-center">
        <div className="flex flex-col gap-6 mb-6 pt-[150px]">
          <div className="flex items-center gap-10">
            <label className="block text-pos-text text-sm font-medium shrink-0">{tr('control.external.type', 'Type:')}</label>
            <Dropdown options={mapTranslatedOptions(props.BARCODE_SCANNER_TYPE_OPTIONS)} value={props.barcodeScannerType} onChange={props.setBarcodeScannerType} placeholder={tr('control.external.disabled', 'Disabled')} className="text-sm min-w-[220px]" />
          </div>
          <div className="flex justify-center mt-[100px] text-md">
            <button type="button" className="flex items-center gap-4 px-6 py-2 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50" disabled={props.savingBarcodeScanner} onClick={props.handleSaveBarcodeScanner}>
              <svg fill="currentColor" width="14" height="14" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" /></svg>
              {tr('control.save', 'Save')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (subNavId === 'Credit Card') {
    return (
      <div className="flex flex-col min-h-[650px] max-h-[550px] justify-between items-center">
        <div className="flex flex-col gap-6 mb-6 pt-[150px]">
          <div className="flex items-center gap-10">
            <label className="block text-pos-text text-sm font-medium shrink-0">{tr('control.external.type', 'Type:')}</label>
            <Dropdown options={mapTranslatedOptions(props.CREDIT_CARD_TYPE_OPTIONS)} value={props.creditCardType} onChange={props.setCreditCardType} placeholder={tr('control.external.disabled', 'Disabled')} className="text-sm min-w-[220px]" />
          </div>
          <div className="flex justify-center mt-[100px] text-md">
            <button type="button" className="flex items-center gap-4 px-6 py-2 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50" disabled={props.savingCreditCard} onClick={props.handleSaveCreditCard}>
              <svg fill="currentColor" width="14" height="14" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" /></svg>
              {tr('control.save', 'Save')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (subNavId === 'Scale') {
    const { scaleType, scaleConnectionMode, scalePort, scaleLsmIp, scaleUseWeightLabels, scaleConfirmWeight } = props;
    const enabled = Boolean(scaleType) && scaleType !== 'disabled';
    const scaleMode = normalizeScaleConnectionMode(scaleConnectionMode);
    const showLsmIpRow = scaleMode === 'tcp-ip';

    return (
      <div className="flex relative flex-col min-h-[550px] max-h-[550px] justify-between items-center">
        <div className="flex flex-col gap-6 mb-6 pt-[80px] w-full max-w-xl mx-auto px-4">
          <div className="flex items-center gap-6">
            <label className="block text-pos-text min-w-[200px] text-sm font-medium shrink-0">{tr('control.external.protocolType', 'Protocol / Type:')}</label>
            <Dropdown
              options={mapTranslatedOptions(props.SCALE_TYPE_OPTIONS)}
              value={scaleType}
              onChange={props.setScaleType}
              placeholder={tr('control.external.disabled', 'Disabled')}
              className="text-sm min-w-[220px]"
            />
          </div>
          {enabled ? (
            <div className="flex items-center gap-6">
              <label className="block text-pos-text min-w-[200px] text-sm font-medium shrink-0">{tr('control.external.scaleMode', 'Mode:')}</label>
              <Dropdown
                options={mapTranslatedOptions(props.SCALE_CONNECTION_MODE_OPTIONS)}
                value={scaleMode}
                onChange={props.setScaleConnectionMode}
                className="text-sm min-w-[220px]"
              />
            </div>
          ) : null}
          {showLsmIpRow ? (
            <div className="flex items-center gap-6">
              <label className="block text-pos-text min-w-[200px] text-sm font-medium shrink-0">{tr('control.external.lsmIp', 'LSM IP:')}</label>
              <input
                type="text"
                value={scaleLsmIp}
                onChange={(e) => props.setScaleLsmIp(e.target.value)}
                className="text-sm min-w-[220px] max-w-[280px] px-3 py-2.5 rounded-lg bg-pos-bg border border-pos-border text-pos-text"
                autoComplete="off"
              />
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <label className="block text-pos-text min-w-[200px] text-sm font-medium shrink-0">{tr('control.external.port', 'Port:')}</label>
              <Dropdown
                options={props.SCALE_PORT_OPTIONS}
                value={scalePort}
                onChange={props.setScalePort}
                placeholder={tr('control.external.selectPort', 'Select port')}
                className="text-sm min-w-[220px]"
              />
            </div>
          )}
          {enabled ? (
            <>
              <label className="flex items-center gap-6 cursor-pointer text-pos-text text-sm">
                <span className="min-w-[200px]">{tr('control.external.useWeightScaleLabels', 'Use of weight scale labels:')}</span>
                <input
                  type="checkbox"
                  checked={scaleUseWeightLabels}
                  onChange={(e) => props.setScaleUseWeightLabels(e.target.checked)}
                  className="w-5 h-5 rounded border-pos-border shrink-0"
                />
              </label>
              <label className="flex items-center gap-6 cursor-pointer text-pos-text text-sm">
                <span className="min-w-[200px]">{tr('control.external.confirmWeight', 'Confirm weight:')}</span>
                <input
                  type="checkbox"
                  checked={scaleConfirmWeight}
                  onChange={(e) => props.setScaleConfirmWeight(e.target.checked)}
                  className="w-5 h-5 rounded border-pos-border shrink-0"
                />
              </label>
            </>
          ) : null}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-10 text-md">
            <button
              type="button"
              className="flex items-center gap-2 px-6 py-2 rounded-lg border border-pos-border bg-pos-panel text-pos-text font-medium active:bg-green-500 disabled:opacity-50"
              disabled={props.testingScale || props.savingScale}
              onClick={props.handleTestScale}
            >
              {props.testingScale ? tr('control.testing', 'Testing...') : tr('control.external.test', 'Test')}
            </button>
            <button
              type="button"
              className="flex items-center gap-4 px-6 py-2 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50"
              disabled={props.savingScale || props.testingScale}
              onClick={props.handleSaveScale}
            >
              <svg fill="currentColor" width="14" height="14" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" /></svg>
              {tr('control.save', 'Save')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
