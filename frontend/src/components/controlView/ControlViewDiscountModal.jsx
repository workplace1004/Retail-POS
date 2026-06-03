import React from 'react';
import { Dropdown } from '../Dropdown';
import { KeyboardWithNumpad } from '../KeyboardWithNumpad';
import { CalendarModal } from '../CalendarModal';

export function ControlViewDiscountModal({
  tr,
  showDiscountModal,
  closeDiscountModal,
  categories,
  discountProductOptions,
  discountTargetIds,
  discountOn,
  discountTargetId,
  setDiscountTargetId,
  setDiscountTargetIds,
  discountName,
  setDiscountName,
  discountOnOptions,
  setDiscountOn,
  discountTriggerOptions,
  discountTrigger,
  setDiscountTrigger,
  discountPieces,
  setDiscountPieces,
  discountCombinable,
  setDiscountCombinable,
  discountTypeOptions,
  discountType,
  setDiscountType,
  discountValue,
  setDiscountValue,
  formatDateForCurrentLanguage,
  discountStartDate,
  discountEndDate,
  setDiscountCalendarField,
  discountTargetListRef,
  updateDiscountTargetScrollState,
  canDiscountTargetScrollUp,
  canDiscountTargetScrollDown,
  scrollDiscountTargetByPage,
  savingDiscount,
  handleSaveDiscount,
  discountKeyboardValue,
  setDiscountKeyboardValue,
  discountCalendarField,
  setDiscountStartDate,
  setDiscountEndDate
}) {
  if (!showDiscountModal) return null;

  const discountTargetOptions = discountOn === 'categories'
    ? categories
      .filter((c) => c && c.id != null)
      .map((c) => ({ value: c.id, label: c.name || `#${c.id}` }))
    : discountProductOptions;
  const discountTargetOptionMap = new Map(discountTargetOptions.map((o) => [String(o.value), o.label]));
  const visibleDiscountTargetOptions = discountTargetOptions.filter((o) => !discountTargetIds.includes(o.value));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative bg-pos-bg rounded-xl shadow-2xl max-w-[90%] w-full justify-center items-center mx-4 overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="absolute top-4 right-4 z-10 p-2 rounded text-pos-muted active:text-pos-text active:bg-green-500" onClick={closeDiscountModal} aria-label="Close">
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div className="flex-1 min-h-0 overflow-auto w-full">
          <div className="p-6 pb-0 flex text-sm space-y-3 w-full pt-14">
            <div className="flex flex-col w-2/3 gap-3">
              <div className="flex w-full gap-5">
                <div className="flex items-center">
                  <label className="block font-medium min-w-[100px] text-gray-200">{tr('name', 'Name')} : </label>
                  <input type="text" value={discountName} onChange={(e) => setDiscountName(e.target.value)} placeholder={tr('control.discounts.modal.discountNamePlaceholder', 'Discount name')} className="px-4 w-[150px] bg-pos-panel h-[40px] py-3 border border-gray-300 rounded-lg text-gray-200 placeholder:text-gray-500" />
                </div>
                <div className="flex w-full items-center">
                  <label className="block font-medium text-gray-200 min-w-[100px]">{tr('control.discounts.modal.discountOn', 'Discount on')} : </label>
                  <Dropdown options={discountOnOptions.map((opt) => ({ ...opt, label: tr(`control.discounts.on.${opt.value}`, opt.label) }))} value={discountOn} onChange={setDiscountOn} placeholder={tr('control.discounts.on.products', 'Products')} className="text-md min-w-[150px]" />
                </div>
              </div>
              <div className="flex w-full items-center flex-wrap">
                <div className="flex items-center">
                  <label className="block min-w-[100px] font-medium text-gray-200">{tr('control.discounts.modal.trigger', 'Trigger')} : </label>
                  <Dropdown options={discountTriggerOptions.map((opt) => ({ ...opt, label: tr(`control.discounts.trigger.${opt.value}`, opt.label) }))} value={discountTrigger} onChange={setDiscountTrigger} placeholder={tr('control.discounts.trigger.number', 'Number')} className="text-md min-w-[150px]" />
                </div>
                <div className="flex gap-5 items-center pl-5">
                  <input type="text" value={discountPieces} onChange={(e) => setDiscountPieces(e.target.value)} placeholder="" className="px-4 w-[70px] bg-pos-panel h-[40px] py-3 border border-gray-300 rounded-lg text-gray-200" />
                  <label className="block font-medium text-gray-200">{tr('control.discounts.modal.pieces', 'Piece(s)')}</label>
                </div>
                <div className="flex items-center gap-3 pl-5">
                  <div className="flex items-center justify-start">
                    <input type="checkbox" checked={discountCombinable} onChange={(e) => setDiscountCombinable(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                  </div>
                  <label className="block items-center font-medium text-gray-200">{tr('control.discounts.modal.combinable', 'Combinable')}</label>
                </div>
              </div>
              <div className="flex w-full items-center flex-wrap">
                <div className="flex items-center">
                  <label className="block min-w-[100px] font-medium text-gray-200">{tr('control.optionButton.discount', 'Discount')} : </label>
                  <Dropdown options={discountTypeOptions.map((opt) => ({ ...opt, label: tr(`control.discounts.type.${opt.value}`, opt.label) }))} value={discountType} onChange={setDiscountType} placeholder={tr('control.discounts.type.amount', 'Amount')} className="text-md min-w-[150px]" />
                </div>
                <div className="flex items-center pl-5 gap-5">
                  <input type="text" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="0" className="flex-1 px-4 max-w-[70px] h-[40px] py-3 border border-gray-300 rounded-lg bg-pos-panel text-gray-200" />
                  <span className="text-md text-gray-200 shrink-0">{tr('control.discounts.modal.currency', 'euro')}</span>
                </div>
              </div>
              <div className="flex w-full items-center">
                <label className="block min-w-[100px] font-medium text-gray-200">{tr('control.discounts.modal.startDate', 'Starting date')} : </label>
                <div className="flex items-center gap-5 w-[150px]">
                  <input
                    type="text"
                    readOnly
                    value={formatDateForCurrentLanguage(discountStartDate)}
                    placeholder={tr('control.discounts.modal.datePlaceholder', 'MM/DD/YYYY')}
                    className="flex-1 px-4 h-[40px] w-[150px] py-3 border border-gray-300 rounded-lg bg-pos-panel text-gray-200 cursor-pointer focus:border-green-500 focus:outline-none"
                    onClick={() => setDiscountCalendarField('start')}
                  />
                  <button type="button" className="p-2 rounded-lg bg-pos-panel border border-gray-300 text-gray-200 active:bg-green-500 shrink-0" onClick={() => setDiscountCalendarField('start')} aria-label={tr('control.discounts.modal.openCalendar', 'Open calendar')}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </button>
                </div>
              </div>
              <div className="flex w-full items-center">
                <label className="block min-w-[100px] font-medium text-gray-200 mb-2">{tr('control.discounts.modal.endDate', 'End date')} : </label>
                <div className="flex items-center gap-5 w-[150px]">
                  <input
                    type="text"
                    readOnly
                    value={formatDateForCurrentLanguage(discountEndDate)}
                    placeholder={tr('control.discounts.modal.datePlaceholder', 'MM/DD/YYYY')}
                    className="flex-1 px-4 h-[40px] py-3 w-[150px] border border-gray-300 rounded-lg bg-pos-panel text-gray-200 cursor-pointer focus:border-green-500 focus:outline-none"
                    onClick={() => setDiscountCalendarField('end')}
                  />
                  <button type="button" className="p-2 rounded-lg bg-pos-panel border border-gray-300 text-gray-200 active:bg-green-500 shrink-0" onClick={() => setDiscountCalendarField('end')} aria-label={tr('control.discounts.modal.openCalendar', 'Open calendar')}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </button>
                </div>
              </div>
            </div>
            <div className="flex flex-col w-1/3 max-w-md items-center gap-3">
              <Dropdown
                options={visibleDiscountTargetOptions}
                value={discountTargetId}
                onChange={(v) => {
                  if (!v) return;
                  setDiscountTargetIds((prev) => (prev.includes(v) ? prev : [...prev, v]));
                  setDiscountTargetId('');
                }}
                placeholder={discountOn === 'categories' ? tr('control.discounts.on.categories', 'Categories') : tr('control.discounts.on.products', 'Products')}
                className="text-md min-w-[150px] w-full"
              />
              <div
                ref={discountTargetListRef}
                className="w-full min-h-[220px] max-h-[220px] rounded-lg border border-gray-300 bg-pos-panel/30 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                onScroll={updateDiscountTargetScrollState}
              >
                <ul className="p-2">
                  {discountTargetIds.map((id) => (
                    <li key={id} className="text-md py-1.5 px-2 flex items-center justify-between gap-2 text-gray-200 active:bg-green-500 rounded">
                      <span className="truncate">{discountTargetOptionMap.get(String(id)) || String(id)}</span>
                      <button
                        type="button"
                        className="p-1 rounded active:bg-green-500"
                        onClick={() => setDiscountTargetIds((prev) => prev.filter((x) => x !== id))}
                        aria-label="Remove"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex w-full justify-around gap-2 items-center pt-2">
                <button
                  type="button"
                  className="p-2 rounded-lg text-pos-muted active:text-pos-text active:bg-green-500 border border-gray-300 disabled:opacity-40 disabled:pointer-events-none"
                  aria-label="Scroll up"
                  disabled={!canDiscountTargetScrollUp}
                  onClick={() => scrollDiscountTargetByPage('up')}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                </button>
                <button
                  type="button"
                  className="p-2 rounded-lg text-pos-muted active:text-pos-text active:bg-green-500 border border-gray-300 disabled:opacity-40 disabled:pointer-events-none"
                  aria-label="Scroll down"
                  disabled={!canDiscountTargetScrollDown}
                  onClick={() => scrollDiscountTargetByPage('down')}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-center pb-5 shrink-0">
          <button
            type="button"
            className="flex items-center text-md gap-4 px-6 py-2 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50"
            disabled={savingDiscount}
            onClick={handleSaveDiscount}
          >
            <svg fill="#ffffff" width="14px" height="14px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" /></svg>
            {tr('control.save', 'Save')}
          </button>
        </div>
        <div className="shrink-0">
          <KeyboardWithNumpad value={discountKeyboardValue} onChange={setDiscountKeyboardValue} />
        </div>
        {discountCalendarField && (
          <CalendarModal
            open
            onClose={() => setDiscountCalendarField(null)}
            value={discountCalendarField === 'start' ? discountStartDate : discountEndDate}
            onChange={(date) => {
              const yyyy = date.getFullYear();
              const mm = String(date.getMonth() + 1).padStart(2, '0');
              const dd = String(date.getDate()).padStart(2, '0');
              const iso = `${yyyy}-${mm}-${dd}`;
              if (discountCalendarField === 'start') setDiscountStartDate(iso);
              else setDiscountEndDate(iso);
            }}
          />
        )}
      </div>
    </div>
  );
}
