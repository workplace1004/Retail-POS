import React from 'react';
import { SmallKeyboardWithNumpad } from '../SmallKeyboardWithNumpad';

/**
 * Settings for Worldline C-TEP via the Java browser bridge (same stack as `sample/`).
 * Terminal → PC IP :9000 (C-TEP). POS Node → bridge HTTP :3210 (see sample POS_INTEGRATION_EXAMPLE_JS.js).
 */
export function ControlViewWorldlineCtep({
  tr,
  worldlineName,
  setWorldlineName,
  setWorldlineActiveField,
  worldlineHttpBaseUrl,
  setWorldlineHttpBaseUrl,
  savingWorldline,
  handleSaveWorldline,
  worldlineKeyboardValue,
  worldlineKeyboardOnChange,
}) {
  return (
    <div className="relative flex min-h-[570px] max-h-full flex-col rounded-xl border border-pos-border bg-pos-panel/30">
      <div className="flex-1 overflow-y-auto p-4 pb-0">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 text-sm">
          <p className="rounded-lg border border-pos-border bg-pos-bg/80 px-3 py-2 text-xs text-pos-muted">
            {tr(
              'control.worldlineCtep.hint',
              'Run the Java bridge from the repo (sample or backend/worldline-ctep-bridge). Terminal must connect to this PC on C-TEP port 9000; set the HTTP URL below to match the bridge (default http://127.0.0.1:3210).',
            )}
          </p>
          <div className="grid grid-cols-2 gap-10">
            <div className="flex items-center gap-2">
              <label className="block min-w-[100px] max-w-[100px] shrink-0 font-medium text-pos-text">
                {tr('control.worldlineCtep.name', 'Name *')}
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
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-xs font-medium text-pos-text">
                {tr('control.worldlineCtep.httpBaseUrl', 'Bridge HTTP base URL *')}
              </label>
              <input
                type="text"
                value={worldlineHttpBaseUrl}
                onChange={(e) => setWorldlineHttpBaseUrl(e.target.value)}
                onFocus={() => setWorldlineActiveField('http')}
                onClick={() => setWorldlineActiveField('http')}
                spellCheck={false}
                className="h-[40px] w-full rounded-lg border border-gray-300 bg-pos-panel px-3 font-mono text-xs text-gray-200 placeholder-pos-muted focus:border-green-500 focus:outline-none"
                placeholder="http://127.0.0.1:3210"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-center">
          <button
            type="button"
            className="flex items-center gap-4 rounded-lg bg-green-600 px-6 py-2 text-md font-medium text-white active:bg-green-500 disabled:opacity-50"
            disabled={savingWorldline}
            onClick={handleSaveWorldline}
          >
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
