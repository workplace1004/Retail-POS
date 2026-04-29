import React from 'react';
import { SmallKeyboardWithNumpad } from '../SmallKeyboardWithNumpad';

export function ControlViewBancontactPro({
  tr,
  bancontactProName,
  setBancontactProName,
  setBancontactProActiveField,
  bancontactProApiKey,
  setBancontactProApiKey,
  bancontactProSandbox,
  setBancontactProSandbox,
  bancontactProCallbackUrl,
  setBancontactProCallbackUrl,
  savingBancontactPro,
  handleSaveBancontactPro,
  bancontactProKeyboardValue,
  bancontactProKeyboardOnChange,
}) {
  const lk = (suffix, fallback) => tr(`control.bancontactPro.${suffix}`, fallback);
  return (
    <div className="relative min-h-[570px] rounded-xl border border-pos-border bg-pos-panel/30 p-4">
      {/* <p className="text-center text-sm text-pos-muted mb-4 max-w-xl mx-auto leading-relaxed">
        {lk(
          'intro',
          'Bancontact Pro integrated payments (Payconiq v3 API): show a QR code on this screen for the customer to scan. API key from the Bancontact Pro portal.',
        )}
      </p> */}
      <div className="flex text-sm gap-x-10 gap-y-4 mb-6">
        <div className="flex flex-col gap-4 pt-[10px] w-full justify-center items-center">
          <div className="flex items-center gap-2">
            <label className="block text-pos-text font-medium min-w-[120px] max-w-[120px] shrink-0">{lk('name', 'Name *')}</label>
            <input
              type="text"
              value={bancontactProName}
              onChange={(e) => setBancontactProName(e.target.value)}
              onFocus={() => setBancontactProActiveField('name')}
              onClick={() => setBancontactProActiveField('name')}
              className="px-4 w-[280px] py-3 bg-pos-panel h-[40px] border border-gray-300 rounded-lg text-gray-200 placeholder-pos-muted focus:outline-none focus:border-green-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="block text-pos-text font-medium min-w-[120px] max-w-[120px] shrink-0">{lk('apiKey', 'API key *')}</label>
            <input
              type="password"
              autoComplete="off"
              value={bancontactProApiKey}
              onChange={(e) => setBancontactProApiKey(e.target.value)}
              onFocus={() => setBancontactProActiveField('apiKey')}
              onClick={() => setBancontactProActiveField('apiKey')}
              placeholder={lk('apiKeyPlaceholder', 'Bearer token from portal')}
              className="px-4 w-[280px] py-3 bg-pos-panel h-[40px] border border-gray-300 rounded-lg text-gray-200 placeholder-pos-muted focus:outline-none focus:border-green-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="block text-pos-text font-medium min-w-[120px] max-w-[120px] shrink-0">{lk('callbackUrl', 'Callback URL')}</label>
            <input
              type="text"
              value={bancontactProCallbackUrl}
              onChange={(e) => setBancontactProCallbackUrl(e.target.value)}
              onFocus={() => setBancontactProActiveField('callback')}
              onClick={() => setBancontactProActiveField('callback')}
              placeholder={lk('callbackPlaceholder', 'Optional HTTPS webhook')}
              className="px-4 w-[280px] py-3 bg-pos-panel h-[40px] border border-gray-300 rounded-lg text-gray-200 placeholder-pos-muted focus:outline-none focus:border-green-500"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none text-pos-text">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-pos-border"
              checked={!!bancontactProSandbox}
              onChange={(e) => setBancontactProSandbox(e.target.checked)}
            />
            <span>{lk('sandbox', 'Use test API (api.ext.payconiq.com)')}</span>
          </label>
        </div>
      </div>
      <div className="flex justify-center pt-5 pb-5">
        <button
          type="button"
          className="flex items-center text-lg gap-4 px-6 py-3 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50"
          disabled={savingBancontactPro}
          onClick={handleSaveBancontactPro}
        >
          <svg fill="#ffffff" width="18px" height="18px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" /></svg>
          {tr('control.save', 'Save')}
        </button>
      </div>
      <div className="shrink-0 absolute bottom-0">
        <SmallKeyboardWithNumpad value={bancontactProKeyboardValue} onChange={bancontactProKeyboardOnChange} />
      </div>
    </div>
  );
}
