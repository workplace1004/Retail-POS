import React from 'react';
import { SmallKeyboardWithNumpad } from '../SmallKeyboardWithNumpad';
import { Dropdown } from '../Dropdown';

/**
 * Settings for Worldline C-TEP via the Java browser bridge (`backend/worldline-ctep-bridge`).
 * TCP: terminal → PC IP :9000 (C-TEP listen). Serial: bridge opens COM/USB; same HTTP :3210 for POS.
 */
export function ControlViewWorldlineCtep({
  tr,
  worldlineName,
  setWorldlineName,
  setWorldlineActiveField,
  worldlineConnectionType,
  setWorldlineConnectionType,
  worldlineCtepListenPort,
  setWorldlineCtepListenPort,
  worldlineSerialPort,
  setWorldlineSerialPort,
  worldlineSerialBaud,
  setWorldlineSerialBaud,
  savingWorldline,
  handleSaveWorldline,
  worldlineKeyboardValue,
  worldlineKeyboardOnChange,
}) {
  return (
    <div className="relative flex min-h-[570px] max-h-full flex-col rounded-xl border border-pos-border bg-pos-panel/30">
      <div className="flex-1 overflow-y-auto p-4 pb-0">
        <div className="mx-auto flex w-full max-w-2xl justify-center items-center flex-col gap-4 text-sm">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <label className="block min-w-[150px] max-w-[150px] shrink-0 font-medium text-pos-text">
                {tr('control.worldlineCtep.name', 'Name *')}
              </label>
              <input
                type="text"
                value={worldlineName}
                onChange={(e) => setWorldlineName(e.target.value)}
                onFocus={() => setWorldlineActiveField('name')}
                onClick={() => setWorldlineActiveField('name')}
                className="h-[40px] min-w-[200px] rounded-lg border border-gray-300 bg-pos-panel px-3 text-gray-200 placeholder-pos-muted focus:border-green-500 focus:outline-none"
              />
            </div>
            <div className="col-span-2 flex items-center gap-1">
              <label className="text-md font-medium min-w-[150px] max-w-[250px] shrink-0 text-pos-text">
                {tr('control.worldlineCtep.connectionType', 'Connection type *')}
              </label>
              <Dropdown
                options={[
                  { value: 'tcp', label: tr('control.worldlineCtep.connectionTypeTcp', 'IP / TCP') },
                  { value: 'serial', label: tr('control.worldlineCtep.connectionTypeSerial', 'Serial (COM/USB)') },
                ]}
                value={String(worldlineConnectionType || 'tcp')}
                onChange={(v) => setWorldlineConnectionType(String(v || 'tcp'))}
                className="text-md w-[200px]"
              />
            </div>
            {worldlineConnectionType === 'serial' ? (
              <>
                <div className="flex flex-col gap-4">
                  <div className="col-span-1 flex items-center gap-1">
                    <label className="text-md font-medium min-w-[150px] max-w-[150px] shrink-0 text-pos-text">
                      {tr('control.worldlineCtep.serialPort', 'Serial port *')}
                    </label>
                    <input
                      type="text"
                      value={worldlineSerialPort}
                      onChange={(e) => setWorldlineSerialPort(e.target.value)}
                      onFocus={() => setWorldlineActiveField('serialPort')}
                      onClick={() => setWorldlineActiveField('serialPort')}
                      className="h-[40px] min-w-[200px] rounded-lg border border-gray-300 bg-pos-panel px-3 font-mono text-md text-gray-200 placeholder-pos-muted focus:border-green-500 focus:outline-none"
                      placeholder="COM3"
                    />
                  </div>
                  <div className="col-span-1 flex items-center gap-1">
                    <label className="text-md font-medium min-w-[150px] max-w-[150px] shrink-0 text-pos-text">
                      {tr('control.worldlineCtep.serialBaud', 'Serial baud *')}
                    </label>
                    <input
                      type="text"
                      value={worldlineSerialBaud}
                      onChange={(e) => setWorldlineSerialBaud(e.target.value)}
                      onFocus={() => setWorldlineActiveField('serialBaud')}
                      onClick={() => setWorldlineActiveField('serialBaud')}
                      className="h-[40px] min-w-[200px] rounded-lg border border-gray-300 bg-pos-panel px-3 font-mono text-md text-gray-200 placeholder-pos-muted focus:border-green-500 focus:outline-none"
                      placeholder="115200"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="col-span-2 flex items-center gap-1">
                <label className="text-md font-medium min-w-[150px] max-w-[150px] shrink-0 text-pos-text">
                  {tr('control.worldlineCtep.ctepListenPort', 'C-TEP listen port *')}
                </label>
                <input
                  type="text"
                  value={worldlineCtepListenPort}
                  onChange={(e) => setWorldlineCtepListenPort(e.target.value)}
                  onFocus={() => setWorldlineActiveField('listenPort')}
                  onClick={() => setWorldlineActiveField('listenPort')}
                  className="h-[40px] w-[200px] rounded-lg border border-gray-300 bg-pos-panel px-3 font-mono text-md text-gray-200 placeholder-pos-muted focus:border-green-500 focus:outline-none"
                  placeholder="9000"
                />
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 absolute bottom-1/2 right-1/2 translate-x-1/2 justify-center">
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
