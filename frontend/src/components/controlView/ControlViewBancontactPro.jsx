import React, { useState } from 'react';
import { SmallKeyboardWithNumpad } from '../SmallKeyboardWithNumpad';

/**
 * Bancontact Pro — Merchant API + optional PPID for “On a receipt” static QR (see Bancontact Pro integration guide).
 */
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
  bancontactProProductProfileId,
  setBancontactProProductProfileId,
  savingBancontactPro,
  handleSaveBancontactPro,
  bancontactProKeyboardValue,
  bancontactProKeyboardOnChange,
}) {
  const lk = (suffix, fallback) => tr(`control.bancontactPro.${suffix}`, fallback);
  const [showApiKey, setShowApiKey] = useState(false);
  return (
    <div className="relative min-h-[570px] rounded-xl border border-pos-border bg-pos-panel/30 p-4">
      <div className="flex text-sm gap-x-10 gap-y-4 mb-6">
        <div className="flex flex-col gap-4 pt-[10px] w-full justify-center items-center">
          <div className="flex items-center gap-2">
            <label className="block text-pos-text font-medium min-w-[100px] max-w-[100px] shrink-0">{lk('name', 'Name *')}</label>
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
            <label className="block text-pos-text font-medium min-w-[100px] max-w-[100px] shrink-0">{lk('apiKey', 'API key *')}</label>
            <div className="relative w-[280px] shrink-0">
              <input
                type={showApiKey ? 'text' : 'password'}
                autoComplete="off"
                value={bancontactProApiKey}
                onChange={(e) => setBancontactProApiKey(e.target.value)}
                onFocus={() => setBancontactProActiveField('apiKey')}
                onClick={() => setBancontactProActiveField('apiKey')}
                placeholder={lk('apiKeyPlaceholder', 'Bancontact Pro API key (Bearer)')}
                className="px-4 pr-11 w-full py-3 bg-pos-panel h-[40px] border border-gray-300 rounded-lg text-gray-200 placeholder-pos-muted focus:outline-none focus:border-green-500"
              />
              <button
                type="button"
                tabIndex={-1}
                aria-label={showApiKey ? lk('hideApiKey', 'Hide API key') : lk('showApiKey', 'Show API key')}
                title={showApiKey ? lk('hideApiKey', 'Hide API key') : lk('showApiKey', 'Show API key')}
                className="absolute right-1 top-1/2 -translate-y-1/2 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-pos-panel/80 hover:text-gray-200 active:bg-pos-panel touch-manipulation"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowApiKey((v) => !v)}
              >
                {showApiKey ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 w-[380px] max-w-full justify-center">
            <label className="flex items-center gap-3 cursor-pointer text-pos-text">
              <input
                type="checkbox"
                checked={bancontactProSandbox}
                onChange={(e) => setBancontactProSandbox(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300"
              />
              <span>{lk('sandbox', 'Use test / pre-prod API')}</span>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <label className="block text-pos-text font-medium min-w-[100px] max-w-[100px] shrink-0">{lk('ppid', 'Product profile ID')}</label>
            <input
              type="text"
              value={bancontactProProductProfileId}
              onChange={(e) => setBancontactProProductProfileId(e.target.value)}
              onFocus={() => setBancontactProActiveField('ppid')}
              onClick={() => setBancontactProActiveField('ppid')}
              placeholder={lk('ppidPlaceholder', 'PPID — for receipt / static QR')}
              className="px-4 w-[280px] py-3 bg-pos-panel h-[40px] border border-gray-300 rounded-lg text-gray-200 placeholder-pos-muted focus:outline-none focus:border-green-500"
            />
          </div>
          {/* <div className="flex items-center gap-2">
            <label className="block text-pos-text font-medium min-w-[100px] max-w-[100px] shrink-0">{lk('callbackUrl', 'Callback URL')}</label>
            <input
              type="text"
              value={bancontactProCallbackUrl}
              onChange={(e) => setBancontactProCallbackUrl(e.target.value)}
              onFocus={() => setBancontactProActiveField('callback')}
              onClick={() => setBancontactProActiveField('callback')}
              placeholder={lk('callbackPlaceholder', 'Optional — HTTPS webhook')}
              className="px-4 w-[280px] py-3 bg-pos-panel h-[40px] border border-gray-300 rounded-lg text-gray-200 placeholder-pos-muted focus:outline-none focus:border-green-500"
            />
          </div> */}
        </div>
      </div>
      <div className="flex justify-center pt-5 pb-5">
        <button
          type="button"
          className="flex items-center text-lg gap-4 px-6 py-3 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50"
          disabled={savingBancontactPro}
          onClick={handleSaveBancontactPro}
        >
          <svg fill="#ffffff" width="18px" height="18px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z"
              transform="translate(21)"
            />
          </svg>
          {tr('control.save', 'Save')}
        </button>
      </div>
      <div className="shrink-0 absolute bottom-0">
        <SmallKeyboardWithNumpad value={bancontactProKeyboardValue} onChange={bancontactProKeyboardOnChange} />
      </div>
    </div>
  );
}
