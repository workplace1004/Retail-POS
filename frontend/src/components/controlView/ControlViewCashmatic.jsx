import React from 'react';
import { SmallKeyboardWithNumpad } from '../SmallKeyboardWithNumpad';

export function ControlViewCashmatic({
  tr,
  cashmaticName,
  setCashmaticName,
  setCashmaticActiveField,
  cashmaticConnectionType,
  setCashmaticConnectionType,
  cashmaticIpAddress,
  setCashmaticIpAddress,
  cashmaticPort,
  setCashmaticPort,
  cashmaticUsername,
  setCashmaticUsername,
  cashmaticPassword,
  setCashmaticPassword,
  cashmaticUrl,
  setCashmaticUrl,
  savingCashmatic,
  handleSaveCashmatic,
  cashmaticKeyboardValue,
  cashmaticKeyboardOnChange
}) {
  return (
    <div className="relative min-h-[630px] rounded-xl border border-pos-border bg-pos-panel/30 p-4">
      <div className="grid grid-cols-1 mt-10 text-sm md:grid-cols-2 gap-x-10 gap-y-4 mb-6">
        <div className="flex items-center gap-2">
          <label className="block text-pos-text font-medium min-w-[120px] max-w-[120px] shrink-0">{tr('control.cashmatic.name', 'Name *')}</label>
          <input
            type="text"
            value={cashmaticName}
            onChange={(e) => setCashmaticName(e.target.value)}
            onFocus={() => setCashmaticActiveField('name')}
            onClick={() => setCashmaticActiveField('name')}
            className="px-4 w-[200px] py-3 bg-pos-panel h-[40px] border border-gray-300 rounded-lg text-gray-200 placeholder-pos-muted focus:outline-none focus:border-green-500"
          />
        </div>
        <div></div>
        <div className="flex items-center gap-2">
          <label className="block text-pos-text font-medium min-w-[120px] max-w-[120px] shrink-0">{tr('control.cashmatic.connectionType', 'Connection type *')}</label>
          <div className="flex gap-2">
            <button
              type="button"
              className={`px-6 py-2 text-sm font-medium rounded-lg ${cashmaticConnectionType === 'tcp' ? 'bg-cyan-500 text-white' : 'bg-pos-panel text-pos-text border border-gray-300'} active:bg-green-500`}
              onClick={() => setCashmaticConnectionType('tcp')}
            >
              {tr('control.cashmatic.tcpIp', 'TCP/IP')}
            </button>
            <button
              type="button"
              className={`px-6 py-2 text-sm font-medium rounded-lg ${cashmaticConnectionType === 'api' ? 'bg-cyan-500 text-white' : 'bg-pos-panel text-pos-text border border-gray-300'} active:bg-green-500`}
              onClick={() => setCashmaticConnectionType('api')}
            >
              {tr('control.cashmatic.api', 'API')}
            </button>
          </div>
        </div>
        <div></div>
        {cashmaticConnectionType === 'tcp' ? (
          <>
            <div className="flex items-center gap-2">
              <label className="block text-pos-text font-medium min-w-[120px] max-w-[120px] shrink-0">{tr('control.cashmatic.ipAddress', 'IP address *')}</label>
              <input
                type="text"
                value={cashmaticIpAddress}
                onChange={(e) => setCashmaticIpAddress(e.target.value)}
                onFocus={() => setCashmaticActiveField('ip')}
                onClick={() => setCashmaticActiveField('ip')}
                className="px-4 w-[200px] py-3 bg-pos-panel h-[40px] border border-gray-300 rounded-lg text-gray-200 focus:outline-none focus:border-green-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="block text-pos-text font-medium min-w-[120px] max-w-[120px] shrink-0">{tr('control.cashmatic.port', 'Port *')}</label>
              <input
                type="text"
                value={cashmaticPort}
                onChange={(e) => setCashmaticPort(e.target.value)}
                onFocus={() => setCashmaticActiveField('port')}
                onClick={() => setCashmaticActiveField('port')}
                className="px-4 w-[200px] py-3 bg-pos-panel h-[40px] border border-gray-300 rounded-lg text-gray-200 focus:outline-none focus:border-green-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="block text-pos-text font-medium min-w-[120px] max-w-[120px] shrink-0">{tr('control.cashmatic.username', 'Username')}</label>
              <input
                type="text"
                value={cashmaticUsername}
                onChange={(e) => setCashmaticUsername(e.target.value)}
                onFocus={() => setCashmaticActiveField('username')}
                onClick={() => setCashmaticActiveField('username')}
                placeholder={tr('control.cashmatic.optional', 'Optional')}
                className="px-4 w-[200px] py-3 bg-pos-panel h-[40px] border border-gray-300 rounded-lg text-gray-200 placeholder-pos-muted focus:outline-none focus:border-green-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="block text-pos-text font-medium min-w-[120px] max-w-[120px] shrink-0">{tr('control.cashmatic.password', 'Password')}</label>
              <input
                type="text"
                value={cashmaticPassword}
                onChange={(e) => setCashmaticPassword(e.target.value)}
                onFocus={() => setCashmaticActiveField('password')}
                onClick={() => setCashmaticActiveField('password')}
                placeholder={tr('control.cashmatic.optional', 'Optional')}
                className="px-4 w-[200px] py-3 bg-pos-panel h-[40px] border border-gray-300 rounded-lg text-gray-200 placeholder-pos-muted focus:outline-none focus:border-green-500"
              />
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <label className="block text-pos-text font-medium min-w-[120px] max-w-[120px] shrink-0">{tr('control.cashmatic.url', 'URL *')}</label>
            <input
              type="text"
              value={cashmaticUrl}
              onChange={(e) => setCashmaticUrl(e.target.value)}
              onFocus={() => setCashmaticActiveField('url')}
              onClick={() => setCashmaticActiveField('url')}
              placeholder={tr('control.cashmatic.urlPlaceholder', 'https://api.example.com')}
              className="px-4 w-[200px] py-3 bg-pos-panel h-[40px] border border-gray-300 rounded-lg text-gray-200 placeholder-pos-muted focus:outline-none focus:border-green-500"
            />
          </div>
        )}
      </div>
      <div className="flex justify-center pt-5 pb-5">
        <button type="button" className="flex items-center text-lg gap-4 px-6 py-3 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50" disabled={savingCashmatic} onClick={handleSaveCashmatic}>
          <svg fill="#ffffff" width="18px" height="18px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" /></svg>
          {tr('control.save', 'Save')}
        </button>
      </div>
      <div className="absolute shrink-0">
        <SmallKeyboardWithNumpad value={cashmaticKeyboardValue} onChange={cashmaticKeyboardOnChange} />
      </div>
    </div>
  );
}
