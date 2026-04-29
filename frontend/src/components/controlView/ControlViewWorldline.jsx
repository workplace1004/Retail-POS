import React, { useEffect, useState } from 'react';
import { POS_API_PREFIX as API } from '../../lib/apiOrigin.js';
import { SmallKeyboardWithNumpad } from '../SmallKeyboardWithNumpad';

export function ControlViewWorldline({
  tr,
  worldlineName,
  setWorldlineName,
  setWorldlineActiveField,
  worldlineTerminalConnectsToPos,
  setWorldlineTerminalConnectsToPos,
  worldlineIpAddress,
  setWorldlineIpAddress,
  worldlinePort,
  setWorldlinePort,
  worldlineSimulate,
  setWorldlineSimulate,
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
    <div className="relative min-h-[570px] rounded-xl border border-pos-border bg-pos-panel/30 p-4">
      <p className="text-center text-sm text-pos-muted mb-4 max-w-xl mx-auto leading-relaxed">
        {tr(
          'control.worldline.inboundExplanation',
          'RX5000 CTEP usually connects to the cash register: set this POS IP and the listen port on the terminal, not the other way around.',
        )}
      </p>
      <div className="flex flex-col gap-3 mb-4 max-w-xl mx-auto">
        <label className="flex items-start gap-3 cursor-pointer select-none text-pos-text">
          <input
            type="radio"
            className="mt-1.5"
            checked={!!worldlineTerminalConnectsToPos}
            onChange={() => setWorldlineTerminalConnectsToPos(true)}
          />
          <span>
            <span className="font-medium block">
              {tr('control.worldline.modeInboundTitle', 'Terminal connects to this POS (recommended)')}
            </span>
            <span className="text-sm text-pos-muted block mt-0.5">
              {tr(
                'control.worldline.modeInboundBody',
                'The Worldline device is configured with this computer\'s IP address. This app listens on the port below.',
              )}
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer select-none text-pos-text">
          <input
            type="radio"
            className="mt-1.5"
            checked={!worldlineTerminalConnectsToPos}
            onChange={() => setWorldlineTerminalConnectsToPos(false)}
          />
          <span>
            <span className="font-medium block">
              {tr('control.worldline.modeOutboundTitle', 'This POS connects to the terminal (legacy)')}
            </span>
            <span className="text-sm text-pos-muted block mt-0.5">
              {tr('control.worldline.modeOutboundBody', 'Use if your terminal accepts incoming TCP from the register (terminal IP + port).')}
            </span>
          </span>
        </label>
      </div>

      <div className="flex text-sm gap-x-10 gap-y-4 mb-6">
        <div className="flex flex-col gap-4 pt-[10px] w-full justify-center items-center">
          <div className="flex items-center gap-2">
            <label className="block text-pos-text font-medium min-w-[100px] max-w-[100px] shrink-0">
              {tr('control.worldline.name', 'Name *')}
            </label>
            <input
              type="text"
              value={worldlineName}
              onChange={(e) => setWorldlineName(e.target.value)}
              onFocus={() => setWorldlineActiveField('name')}
              onClick={() => setWorldlineActiveField('name')}
              className="px-4 w-[200px] py-3 bg-pos-panel h-[40px] border border-gray-300 rounded-lg text-gray-200 placeholder-pos-muted focus:outline-none focus:border-green-500"
            />
          </div>

          {worldlineTerminalConnectsToPos ? (
            <>
              {lanHints.length > 0 ? (
                <div className="text-sm text-pos-muted max-w-md text-center px-2">
                  {tr('control.worldline.posLanHint', 'Use on the terminal one of these addresses for this PC:')}{' '}
                  <span className="text-pos-text font-mono">{lanHints.join(', ')}</span>
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <label className="block text-pos-text font-medium min-w-[100px] max-w-[100px] shrink-0">
                  {tr('control.worldline.listenPort', 'Listen port *')}
                </label>
                <input
                  type="text"
                  value={worldlinePort}
                  onChange={(e) => setWorldlinePort(e.target.value)}
                  onFocus={() => setWorldlineActiveField('port')}
                  onClick={() => setWorldlineActiveField('port')}
                  placeholder={tr('control.worldline.listenPortPlaceholder', '9001')}
                  className="px-4 w-[200px] py-3 bg-pos-panel h-[40px] border border-gray-300 rounded-lg text-gray-200 placeholder-pos-muted focus:outline-none focus:border-green-500"
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <label className="block text-pos-text font-medium min-w-[100px] max-w-[100px] shrink-0">
                  {tr('control.worldline.terminalIp', 'Terminal IP *')}
                </label>
                <input
                  type="text"
                  value={worldlineIpAddress}
                  onChange={(e) => setWorldlineIpAddress(e.target.value)}
                  onFocus={() => setWorldlineActiveField('ip')}
                  onClick={() => setWorldlineActiveField('ip')}
                  placeholder={tr('control.worldline.ipPlaceholder', 'e.g. 192.168.1.60')}
                  className="px-4 w-[200px] py-3 bg-pos-panel h-[40px] border border-gray-300 rounded-lg text-gray-200 placeholder-pos-muted focus:outline-none focus:border-green-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="block text-pos-text font-medium min-w-[100px] max-w-[100px] shrink-0">
                  {tr('control.worldline.terminalPort', 'Terminal port *')}
                </label>
                <input
                  type="text"
                  value={worldlinePort}
                  onChange={(e) => setWorldlinePort(e.target.value)}
                  onFocus={() => setWorldlineActiveField('port')}
                  onClick={() => setWorldlineActiveField('port')}
                  placeholder={tr('control.worldline.portPlaceholder', '9001')}
                  className="px-4 w-[200px] py-3 bg-pos-panel h-[40px] border border-gray-300 rounded-lg text-gray-200 placeholder-pos-muted focus:outline-none focus:border-green-500"
                />
              </div>
            </>
          )}

          <label className="flex items-center gap-2 cursor-pointer select-none text-pos-text">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-pos-border"
              checked={!!worldlineSimulate}
              onChange={(e) => setWorldlineSimulate(e.target.checked)}
            />
            <span>{tr('control.worldline.simulate', 'Test mode (simulate payment, no CTEP on wire)')}</span>
          </label>
        </div>
      </div>

      <div className="flex justify-center pt-5 pb-5">
        <button
          type="button"
          className="flex items-center text-lg gap-4 px-6 py-3 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50"
          disabled={savingWorldline}
          onClick={handleSaveWorldline}
        >
          <svg fill="#ffffff" width="18px" height="18px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" /></svg>
          {tr('control.save', 'Save')}
        </button>
      </div>
      <div className="shrink-0 absolute bottom-0">
        <SmallKeyboardWithNumpad value={worldlineKeyboardValue} onChange={worldlineKeyboardOnChange} />
      </div>
    </div>
  );
}
