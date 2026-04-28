import React from 'react';
import { Dropdown } from '../Dropdown';
import { KeyboardWithNumpad } from '../KeyboardWithNumpad';
import { resolveMediaSrc } from '../../lib/publicAssetUrl.js';

const SUBPRODUCT_VAT_OPTIONS = [
  { value: '', label: '--' },
  { value: '0', label: '0%' },
  { value: '6', label: '6%' },
  { value: '12', label: '12%' },
  { value: '21', label: '21%' }
];

export function ControlViewSubproductModal({
  tr,
  showSubproductModal,
  closeSubproductModal,
  subproductName,
  handleSubproductNameChange,
  setSubproductActiveField,
  subproductKeyName,
  setSubproductKeyName,
  subproductProductionName,
  setSubproductProductionName,
  subproductPrice,
  setSubproductPrice,
  subproductVatTakeOut,
  setSubproductVatTakeOut,
  subproductGroups,
  subproductModalGroupId,
  setSubproductModalGroupId,
  subproductKioskPicture,
  setSubproductKioskPicture,
  categories,
  subproductAttachToCategoryIds,
  setSubproductAttachToCategoryIds,
  subproductAttachToListRef,
  scrollSubproductAttachToByPage,
  savingSubproduct,
  handleSaveSubproduct,
  subproductKeyboardValue,
  subproductKeyboardOnChange
}) {
  if (!showSubproductModal) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative bg-pos-bg rounded-xl border border-pos-border shadow-2xl max-w-[90%] w-full justify-center items-center mx-4 overflow-hidden flex flex-col max-h-[90vh] text-sm" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="absolute top-4 right-4 z-10 p-2 rounded text-pos-muted active:text-pos-text active:bg-green-500" onClick={closeSubproductModal} aria-label="Close">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div className="flex-1 min-h-0 overflow-auto w-full">
          <div className="p-6 flex w-full text-sm pt-14">
            <div className='flex flex-col gap-3 w-1/3'>
              <div className="flex gap-2 w-full items-center">
                <label className="block min-w-[110px] text-md font-medium text-gray-200 mb-2">{tr('control.subproductModal.name', 'Name :')} </label>
                <input
                  type="text"
                  value={subproductName}
                  onChange={(e) => handleSubproductNameChange(e.target.value)}
                  onFocus={() => setSubproductActiveField('name')}
                  placeholder=""
                  className="px-4 w-[150px] bg-pos-panel h-[40px] py-3 text-md border border-gray-300 rounded-lg text-gray-200"
                />
              </div>
              <div className="flex gap-2 w-full items-center">
                <label className="block min-w-[110px] text-md font-medium text-gray-200 mb-2">{tr('control.subproductModal.keyName', 'Key name :')} </label>
                <input
                  type="text"
                  value={subproductKeyName}
                  onChange={(e) => setSubproductKeyName(e.target.value)}
                  onFocus={() => setSubproductActiveField('keyName')}
                  placeholder=""
                  className="px-4 w-[150px] bg-pos-panel h-[40px] py-3 text-md border border-gray-300 rounded-lg text-gray-200"
                />
              </div>
              <div className="flex gap-2 w-full items-center">
                <label className="block min-w-[110px] text-md font-medium text-gray-200 mb-2">{tr('control.subproductModal.productionName', 'Production name :')} </label>
                <input
                  type="text"
                  value={subproductProductionName}
                  onChange={(e) => setSubproductProductionName(e.target.value)}
                  onFocus={() => setSubproductActiveField('productionName')}
                  placeholder=""
                  className="px-4 w-[150px] bg-pos-panel h-[40px] py-3 text-md border border-gray-300 rounded-lg text-gray-200"
                />
              </div>
              <div className="flex gap-2 w-full items-center">
                <label className="block min-w-[110px] text-md font-medium text-gray-200 mb-2">{tr('control.subproductModal.price', 'Price :')} </label>
                <input
                  type="text"
                  value={subproductPrice}
                  onChange={(e) => setSubproductPrice(e.target.value)}
                  onFocus={() => setSubproductActiveField('price')}
                  placeholder=""
                  className="px-4 w-[150px] bg-pos-panel h-[40px] py-3 text-md border border-gray-300 rounded-lg text-gray-200"
                />
              </div>
              <div className="flex gap-2 w-full items-center">
                <label className="block min-w-[110px] text-md font-medium text-gray-200 mb-2">{tr('control.subproductModal.vatTakeOut', 'VAT Take out :')} </label>
                <Dropdown options={SUBPRODUCT_VAT_OPTIONS} value={subproductVatTakeOut} onChange={setSubproductVatTakeOut} placeholder="--" className="text-md min-w-[150px]" />
              </div>
            </div>
            <div className='flex flex-col gap-3 w-1/3'>
              <div className="flex gap-2 w-full items-center">
                <label className="block min-w-[100px] text-md font-medium text-gray-200 mb-2">{tr('control.subproductModal.group', 'Group :')} </label>
                <Dropdown
                  options={subproductGroups.map((g) => ({ value: g.id, label: g.name }))}
                  value={subproductModalGroupId}
                  onChange={setSubproductModalGroupId}
                  placeholder="--"
                  className="text-md min-w-[150px]"
                />
              </div>
              <div className="flex gap-2 w-full items-center">
                <label className="block min-w-[100px] text-md font-medium text-gray-200 mb-2">{tr('control.subproductModal.kioskPicture', 'Kiosk picture :')} </label>
                <div className="w-[200px] flex items-center justify-start flex-wrap gap-2">
                  {!subproductKioskPicture ? (
                    <label className="px-4 py-2 border border-gray-300 rounded-lg text-gray-200 active:bg-green-500 cursor-pointer shrink-0 text-md">
                      {tr('control.subproductModal.select', 'Select')}
                      <input
                        type="file"
                        className="hidden focus:border-green-500 focus:outline-none"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file && file.type.startsWith('image/')) {
                            const dataUrl = await new Promise((resolve, reject) => {
                              const reader = new FileReader();
                              reader.onload = () => resolve(String(reader.result || ''));
                              reader.onerror = () => reject(reader.error);
                              reader.readAsDataURL(file);
                            }).catch(() => '');
                            if (dataUrl) setSubproductKioskPicture(dataUrl);
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  ) : (
                    <>
                      <img src={resolveMediaSrc(subproductKioskPicture)} alt="Kiosk" className="w-16 h-16 object-cover rounded-lg border border-gray-300 shrink-0" />
                      <button
                        type="button"
                        className="px-3 py-2 border border-gray-300 rounded-lg text-gray-200 active:bg-green-500 text-md shrink-0"
                        onClick={() => setSubproductKioskPicture('')}
                      >
                        {tr('control.subproductModal.remove', 'Remove')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col w-1/3 items-center gap-3">
              <label className="block text-md font-medium text-gray-200">{tr('control.subproductModal.attachTo', 'Attach To')}</label>
              <div ref={subproductAttachToListRef} className="border border-gray-300 rounded-lg bg-pos-panel/30 w-full h-[220px] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <ul className="p-2">
                  {categories.length === 0 ? (
                    <li className="text-pos-muted text-md py-2 px-2">{tr('control.subproductModal.noCategoriesAvailable', 'No categories available')}</li>
                  ) : (
                    categories.map((c) => {
                      const attached = subproductAttachToCategoryIds.includes(c.id);
                      const toggle = () => setSubproductAttachToCategoryIds((prev) => attached ? prev.filter((id) => id !== c.id) : [...prev, c.id]);
                      return (
                        <li
                          key={c.id}
                          role="button"
                          tabIndex={0}
                          className={`text-md py-1.5 px-2 flex items-center gap-2 cursor-pointer rounded select-none ${attached ? 'text-gray-200 font-medium bg-pos-panel' : 'text-pos-muted'} active:bg-green-500`}
                          onClick={toggle}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
                          aria-label={attached ? tr('control.subproductModal.attachedToHint', 'Attached to {name}. Click to detach.').replace('{name}', c.name || '') : tr('control.subproductModal.attachToHint', 'Click to attach to {name}').replace('{name}', c.name || '')}
                        >
                          <span className="uppercase font-medium truncate flex-1 min-w-0">{(c.name || '').toUpperCase()}</span>
                          <input
                            type="checkbox"
                            checked={attached}
                            onChange={() => { }}
                            onClick={(e) => { e.stopPropagation(); toggle(); }}
                            className="w-5 h-5 rounded border-gray-300 cursor-pointer shrink-0"
                            aria-label={attached ? tr('control.subproductModal.detachFromHint', 'Detach from {name}').replace('{name}', c.name || '') : tr('control.subproductModal.attachToCategoryHint', 'Attach to {name}').replace('{name}', c.name || '')}
                          />
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
              <div className="flex w-full justify-around gap-2 items-center pt-2">
                <button type="button" className="p-2 rounded-lg text-pos-muted active:text-pos-text active:bg-green-500 border border-gray-300" aria-label="Scroll attach list up" onClick={() => scrollSubproductAttachToByPage('up')}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                </button>
                <button type="button" className="p-2 rounded-lg text-pos-muted active:text-pos-text active:bg-green-500 border border-gray-300" aria-label="Scroll attach list down" onClick={() => scrollSubproductAttachToByPage('down')}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-center shrink-0">
          <button
            type="button"
            className="flex items-center text-md gap-4 px-6 py-2 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50"
            disabled={savingSubproduct}
            onClick={handleSaveSubproduct}
          >
            <svg fill="#ffffff" width="14px" height="14px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
              <path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" />
            </svg>
            {tr('control.save', 'Save')}
          </button>
        </div>
        <div className="shrink-0">
          <KeyboardWithNumpad value={subproductKeyboardValue} onChange={subproductKeyboardOnChange} />
        </div>
      </div>
    </div>
  );
}
