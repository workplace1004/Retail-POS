import React, { useMemo, useState } from 'react';
import { KeyboardWithNumpad } from '../KeyboardWithNumpad';

export function ControlViewLabelModal({
  tr,
  showLabelModal,
  closeLabelModal,
  labelName,
  setLabelName,
  labelHeight,
  setLabelHeight,
  labelWidth,
  setLabelWidth,
  labelStandard,
  setLabelStandard,
  labelMarginLeft,
  setLabelMarginLeft,
  labelMarginRight,
  setLabelMarginRight,
  labelMarginBottom,
  setLabelMarginBottom,
  labelMarginTop,
  setLabelMarginTop,
  handleSaveLabel
}) {
  const [activeField, setActiveField] = useState('name');

  const keyboardValue = useMemo(() => {
    if (activeField === 'height') return String(labelHeight ?? '');
    if (activeField === 'width') return String(labelWidth ?? '');
    if (activeField === 'marginLeft') return String(labelMarginLeft ?? '');
    if (activeField === 'marginRight') return String(labelMarginRight ?? '');
    if (activeField === 'marginBottom') return String(labelMarginBottom ?? '');
    if (activeField === 'marginTop') return String(labelMarginTop ?? '');
    return String(labelName ?? '');
  }, [activeField, labelHeight, labelMarginBottom, labelMarginLeft, labelMarginRight, labelMarginTop, labelName, labelWidth]);

  const handleKeyboardChange = (next) => {
    const value = String(next ?? '');
    if (activeField === 'height') {
      setLabelHeight(value);
      return;
    }
    if (activeField === 'width') {
      setLabelWidth(value);
      return;
    }
    if (activeField === 'marginLeft') {
      setLabelMarginLeft(value);
      return;
    }
    if (activeField === 'marginRight') {
      setLabelMarginRight(value);
      return;
    }
    if (activeField === 'marginBottom') {
      setLabelMarginBottom(value);
      return;
    }
    if (activeField === 'marginTop') {
      setLabelMarginTop(value);
      return;
    }
    setLabelName(value);
  };

  if (!showLabelModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative bg-pos-bg rounded-xl shadow-2xl max-w-[90%] w-full justify-center items-center mx-4 overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="absolute top-2 right-4 z-10 p-2 rounded text-pos-muted active:text-pos-text active:bg-green-500" onClick={closeLabelModal} aria-label="Close">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div className="p-6 flex w-full pt-14 overflow-auto text-sm">
          <div className='flex flex-col gap-3 w-1/3'>
            <div className="flex gap-2 w-full items-center">
              <label className="block min-w-[80px] max-w-[80px] font-medium text-gray-200">{tr('name', 'Name')} : </label>
              <input type="text" value={labelName} onChange={(e) => setLabelName(e.target.value)} onFocus={() => setActiveField('name')} placeholder={tr('control.labelModal.placeholder', 'e.g. 5.6cm x 3.5cm')} className="px-4 w-[150px] bg-pos-panel h-[40px] py-3 border border-gray-300 rounded-lg text-gray-200" />
            </div>
            <div className="flex gap-2 w-full items-center">
              <label className="block min-w-[80px] max-w-[80px] font-medium text-gray-200">{tr('control.labelModal.height', 'Height')} : </label>
              <input type="text" value={labelHeight} onChange={(e) => setLabelHeight(e.target.value)} onFocus={() => setActiveField('height')} className="px-4 w-[150px] bg-pos-panel h-[40px] py-3 border border-gray-300 rounded-lg text-gray-200" />
            </div>
            <div className="flex gap-2 w-full items-center">
              <label className="block min-w-[80px] max-w-[80px] font-medium text-gray-200">{tr('control.labelModal.width', 'Width')} : </label>
              <input type="text" value={labelWidth} onChange={(e) => setLabelWidth(e.target.value)} onFocus={() => setActiveField('width')} className="px-4 w-[150px] bg-pos-panel h-[40px] py-3 border border-gray-300 rounded-lg text-gray-200" />
            </div>
          </div>
          <div className="flex gap-2 w-1/3 justify-center">
            <div className='flex gap-2 w-full h-[40px] justify-center items-center'>
              <label className="block min-w-[120px] max-w-[120px] font-medium text-gray-200">{tr('control.labelModal.standard', 'Standard')} : </label>
              <input type="checkbox" checked={labelStandard} onChange={(e) => setLabelStandard(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
            </div>
          </div>
          <div className='flex flex-col gap-3 w-1/4'>
            <div className="flex gap-2 w-full items-center justify-center">
              <label className="block min-w-[120px] max-w-[120px] font-medium text-gray-200">{tr('control.labelModal.marginLeft', 'Margin left')} : </label>
              <input type="text" inputMode="numeric" value={labelMarginLeft} onChange={(e) => setLabelMarginLeft(e.target.value)} onFocus={() => setActiveField('marginLeft')} className="px-4 w-[150px] bg-pos-panel h-[40px] py-3 border border-gray-300 rounded-lg text-gray-200" />
            </div>
            <div className="flex gap-2 w-full items-center justify-center">
              <label className="block min-w-[120px] max-w-[120px] font-medium text-gray-200 mb-2">{tr('control.labelModal.marginRight', 'Margin right')} : </label>
              <input type="text" inputMode="numeric" value={labelMarginRight} onChange={(e) => setLabelMarginRight(e.target.value)} onFocus={() => setActiveField('marginRight')} className="px-4 w-[150px] bg-pos-panel h-[40px] py-3 border border-gray-300 rounded-lg text-gray-200" />
            </div>
            <div className="flex gap-2 w-full items-center justify-center">
              <label className="block min-w-[120px] max-w-[120px] font-medium text-gray-200 mb-2">{tr('control.labelModal.marginBottom', 'Margin bottom')} : </label>
              <input type="text" inputMode="numeric" value={labelMarginBottom} onChange={(e) => setLabelMarginBottom(e.target.value)} onFocus={() => setActiveField('marginBottom')} className="px-4 w-[150px] bg-pos-panel h-[40px] py-3 border border-gray-300 rounded-lg text-gray-200" />
            </div>
            <div className="flex gap-2 w-full items-center justify-center">
              <label className="block min-w-[120px] max-w-[120px] font-medium text-gray-200 mb-2">{tr('control.labelModal.marginTop', 'Margin top')} : </label>
              <input type="text" inputMode="numeric" value={labelMarginTop} onChange={(e) => setLabelMarginTop(e.target.value)} onFocus={() => setActiveField('marginTop')} className="px-4 w-[150px] bg-pos-panel h-[40px] py-3 border border-gray-300 rounded-lg text-gray-200" />
            </div>
          </div>
        </div>
        <div className="flex justify-center pt-5 pb-5">
          <button type="button" className="flex items-center text-md gap-4 px-6 py-3 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50" disabled={!(labelName || '').trim()} onClick={handleSaveLabel}>
            <svg fill="#ffffff" width="14px" height="14px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" /></svg>
            {tr('control.save', 'Save')}
          </button>
        </div>
        <KeyboardWithNumpad value={keyboardValue} onChange={handleKeyboardChange} />
      </div>
    </div>
  );
}
