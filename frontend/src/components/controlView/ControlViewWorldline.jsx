import React, { useEffect, useState } from 'react';
import { POS_API_PREFIX as API } from '../../lib/apiOrigin.js';
import { SmallKeyboardWithNumpad } from '../SmallKeyboardWithNumpad';

export function ControlViewWorldline({
  tr,
  worldlineName,
  setWorldlineName,
  setWorldlineActiveField,
  worldlinePort,
  setWorldlinePort,
  worldlineSaleBodyTemplate,
  setWorldlineSaleBodyTemplate,
  worldlineApproveRegex,
  setWorldlineApproveRegex,
  worldlineDeclineRegex,
  setWorldlineDeclineRegex,
  worldlineRawTcp,
  setWorldlineRawTcp,
  worldlineAppendLrc,
  setWorldlineAppendLrc,
  savingWorldline,
  handleSaveWorldline,
  worldlineKeyboardValue,
  worldlineKeyboardOnChange,
}) {
  const [lanHints, setLanHints] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/worldline/local-addrs`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;
        const ips = Array.isArray(data?.ips) ? data.ips : [];
        setLanHints(ips.filter(Boolean));
      } catch {
        if (!cancelled) setLanHints([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative flex min-h-[570px] max-h-full flex-col rounded-xl border border-pos-border bg-pos-panel/30">
      <div className="flex-1 overflow-y-auto p-4 pb-0">

        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 text-sm">
          <div className="grid grid-cols-2 gap-10">
            <div className="flex items-center gap-2">
              <label className="block min-w-[100px] max-w-[100px] shrink-0 font-medium text-pos-text">
                {tr('control.worldline.name', 'Name *')}
              </label>
              <input
                type="text"
                value={worldlineName}
                onChange={(e) => setWorldlineName(e.target.value)}
                onFocus={() => setWorldlineActiveField('name')}
                onClick={() => setWorldlineActiveField('name')}
                className="h-[40px] flex-1 rounded-lg border border-gray-300 bg-pos-panel px-3 text-gray-200 placeholder-pos-muted focus:border-green-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="block min-w-[100px] max-w-[100px] shrink-0 font-medium text-pos-text">
                {tr('control.worldline.listenPort', 'Listen port *')}
              </label>
              <input
                type="text"
                value={worldlinePort}
                onChange={(e) => setWorldlinePort(e.target.value)}
                onFocus={() => setWorldlineActiveField('port')}
                onClick={() => setWorldlineActiveField('port')}
                placeholder={tr('control.worldline.listenPortPlaceholder', '9001')}
                className="h-[40px] w-[200px] rounded-lg border border-gray-300 bg-pos-panel px-3 text-gray-200 placeholder-pos-muted focus:border-green-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-2">
            <label className="mb-1 block text-xs font-medium text-pos-text">
              {tr('control.worldline.saleBodyTemplate', 'Sale command template')}
            </label>
            <textarea
              value={worldlineSaleBodyTemplate}
              onChange={(e) => setWorldlineSaleBodyTemplate(e.target.value)}
              onFocus={() => setWorldlineActiveField('template')}
              onClick={() => setWorldlineActiveField('template')}
              rows={4}
              spellCheck={false}
              className="textarea-dark-scrollbar w-full rounded-lg border border-gray-300 bg-pos-panel px-3 py-2 font-mono text-xs text-gray-200 placeholder-pos-muted focus:border-green-500 focus:outline-none"
              placeholder={tr('control.worldline.saleBodyTemplatePlaceholder', 'ACTION=SALE|amountMinor={amountMinor}|currency={currency}|merchantRef={reference}')}
            />
          </div>

          <div className="grid grid-cols-2 gap-10">
            <div className="flex min-w-0 flex-1 gap-1 items-center">
              <label className="text-xs min-w-[100px] max-w-[100px] font-medium text-pos-text">
                {tr('control.worldline.approveRegex', 'Approve regex')}
              </label>
              <input
                type="text"
                value={worldlineApproveRegex}
                onChange={(e) => setWorldlineApproveRegex(e.target.value)}
                onFocus={() => setWorldlineActiveField('approveRegex')}
                onClick={() => setWorldlineActiveField('approveRegex')}
                className="h-[40px] w-full rounded-lg border border-gray-300 bg-pos-panel px-3 font-mono text-xs text-gray-200 focus:border-green-500 focus:outline-none"
              />
            </div>
            <div className="flex min-w-0 flex-1 gap-1 items-center">
              <label className="text-xs min-w-[100px] max-w-[100px] font-medium text-pos-text">
                {tr('control.worldline.declineRegex', 'Decline regex')}
              </label>
              <input
                type="text"
                value={worldlineDeclineRegex}
                onChange={(e) => setWorldlineDeclineRegex(e.target.value)}
                onFocus={() => setWorldlineActiveField('declineRegex')}
                onClick={() => setWorldlineActiveField('declineRegex')}
                className="h-[40px] w-full rounded-lg border border-gray-300 bg-pos-panel px-3 font-mono text-xs text-gray-200 focus:border-green-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
            <label className="flex cursor-pointer items-center gap-2 select-none text-pos-text">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-500"
                checked={worldlineRawTcp}
                onChange={(e) => setWorldlineRawTcp(e.target.checked)}
              />
              <span className="text-sm">{tr('control.worldline.rawTcp', 'Raw TCP (no STX/ETX wrapper)')}</span>
            </label>
            <label
              className={`flex cursor-pointer items-center gap-2 select-none text-pos-text ${worldlineRawTcp ? 'opacity-40 pointer-events-none' : ''}`}
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-500"
                checked={worldlineAppendLrc}
                disabled={worldlineRawTcp}
                onChange={(e) => setWorldlineAppendLrc(e.target.checked)}
              />
              <span className="text-sm">{tr('control.worldline.appendLrc', 'Append LRC (with STX/ETX)')}</span>
            </label>
          </div>
        </div>

        <div className="mt-4 flex justify-center">
          <button
            type="button"
            className="flex items-center gap-4 rounded-lg bg-green-600 px-6 py-2 text-md font-medium text-white active:bg-green-500 disabled:opacity-50"
            disabled={savingWorldline}
            onClick={handleSaveWorldline}
          >
            <svg fill="#ffffff" width="14px" height="14px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" /></svg>
            {tr('control.save', 'Save')}
          </button>
        </div>
      </div>

      <div className="shrink-0 px-2">
        <SmallKeyboardWithNumpad value={worldlineKeyboardValue} onChange={worldlineKeyboardOnChange} />
      </div>
    </div>
  );
}
