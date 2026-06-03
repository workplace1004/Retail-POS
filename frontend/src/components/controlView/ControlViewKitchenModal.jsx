import React from 'react';
import { KeyboardWithNumpad } from '../KeyboardWithNumpad';

export function ControlViewKitchenModal({
  tr,
  showKitchenModal,
  closeKitchenModal,
  kitchenModalName,
  setKitchenModalName,
  savingKitchen,
  handleSaveKitchen
}) {
  if (!showKitchenModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative bg-pos-bg rounded-xl shadow-2xl max-w-[90%] w-full justify-center items-center mx-4 overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="absolute top-2 right-4 z-10 p-2 rounded text-pos-muted active:text-pos-text active:bg-green-500" onClick={closeKitchenModal} aria-label="Close">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div className="p-6 flex flex-col space-y-6 w-full justify-center items-center pt-20">
          <div className="w-full flex flex-col justify-center items-center gap-10">
            <div className="flex gap-2 w-full items-center justify-center">
              <label className="block text-md min-w-[100px] font-medium text-gray-200">{tr('name', 'Name')} : </label>
              <input
                type="text"
                value={kitchenModalName}
                onChange={(e) => setKitchenModalName(e.target.value)}
                placeholder={tr('control.enterName', 'Enter name')}
                className="px-4 w-[200px] bg-pos-panel h-[40px] py-3 text-md border border-gray-300 rounded-lg text-gray-200 focus:outline-none focus:border-green-500"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-center py-10">
          <button
            type="button"
            className="flex items-center text-md gap-4 px-6 py-2 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50"
            disabled={savingKitchen}
            onClick={handleSaveKitchen}
          >
            <svg fill="#ffffff" width="14px" height="14px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
              <path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" />
            </svg>
            {tr('control.save', 'Save')}
          </button>
        </div>
        <KeyboardWithNumpad value={kitchenModalName} onChange={setKitchenModalName} />
      </div>
    </div>
  );
}
