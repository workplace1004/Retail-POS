import React, { useEffect, useRef } from 'react';
import { Dropdown } from '../Dropdown';
import { KeyboardWithNumpad } from '../KeyboardWithNumpad';
import { resolveMediaSrc } from '../../lib/publicAssetUrl.js';

const VAT_PERCENT_OPTIONS = [
  { value: '', label: '--' },
  { value: '0', label: '0%' },
  { value: '6', label: '6%' },
  { value: '9', label: '9%' },
  { value: '12', label: '12%' },
  { value: '21', label: '21%' }
];

const EXTRA_PRICE_PRINTER_OPTIONS = [
  { value: 'Disabled', label: 'Disabled' }
];

const VERVALTYPE_OPTIONS = [
  { value: 'Shelf life', label: 'Shelf life' },
  { value: 'Expiration date', label: 'Expiration date' }
];

const PURCHASE_UNIT_OPTIONS = [
  { value: 'Piece', label: 'Piece' },
  { value: 'Kg', label: 'Kg' },
  { value: 'Liter', label: 'Liter' },
  { value: 'Meter', label: 'Meter' }
];

const KIOSK_SUBS_OPTIONS = [
  { value: 'unlimited', label: 'Unlimited' },
  ...Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))
];


export function ControlViewProductModal({
  tr,
  showProductModal,
  closeProductModal,
  productTab,
  setProductTab,
  productTabsUnlocked,
  productName,
  setProductName,
  onProductNameInputSynced,
  productFieldErrors,
  setProductFieldErrors,
  productKeyName,
  setProductKeyName,
  productProductionName,
  setProductProductionName,
  productPrice,
  setProductPrice,
  productPriceLockedByProfit,
  productVatTakeOut,
  setProductVatTakeOut,
  productDisplayNumber,
  productCategoryIds,
  setProductCategoryIds,
  categories,
  productAddition,
  setProductAddition,
  productBarcode,
  setProductBarcode,
  handleGenerateBarcode,
  barcodeButtonSpinning,
  getUniqueProductPrinterOptions,
  productPrinter1,
  productPrinter2,
  productPrinter3,
  setProductPrinter1,
  setProductPrinter2,
  setProductPrinter3,
  savingProduct,
  handleSaveProduct,
  setProductActiveField,
  advancedOpenPrice,
  setAdvancedOpenPrice,
  advancedWeegschaal,
  setAdvancedWeegschaal,
  advancedSubproductRequires,
  setAdvancedSubproductRequires,
  advancedLeeggoedPrijs,
  setAdvancedLeeggoedPrijs,
  advancedPagerVerplicht,
  setAdvancedPagerVerplicht,
  advancedBoldPrint,
  setAdvancedBoldPrint,
  advancedGroupingReceipt,
  setAdvancedGroupingReceipt,
  advancedLabelExtraInfo,
  setAdvancedLabelExtraInfo,
  advancedKassaPhotoPreview,
  setAdvancedKassaPhotoPreview,
  advancedVoorverpakVervaltype,
  setAdvancedVoorverpakVervaltype,
  advancedHoudbareDagen,
  setAdvancedHoudbareDagen,
  advancedBewarenGebruik,
  setAdvancedBewarenGebruik,
  extraPricesScrollRef,
  syncExtraPricesScrollEdges,
  extraPricesRows,
  setExtraPricesRows,
  setExtraPricesSelectedIndex,
  extraPricesScrollEdges,
  purchaseVat,
  setPurchaseVat,
  purchasePriceExcl,
  setPurchasePriceExcl,
  purchasePriceIncl,
  setPurchasePriceIncl,
  profitPct,
  setProfitPct,
  purchaseUnit,
  setPurchaseUnit,
  unitContent,
  setUnitContent,
  stock,
  setStock,
  purchaseSupplier,
  setPurchaseSupplier,
  purchaseSupplierOptions = [{ value: '', label: '--' }],
  supplierCode,
  setSupplierCode,
  stockNotification,
  setStockNotification,
  expirationDate,
  setExpirationDate,
  declarationExpiryDays,
  setDeclarationExpiryDays,
  notificationSoldOutPieces,
  setNotificationSoldOutPieces,
  productInWebshop,
  setProductInWebshop,
  webshopOnlineOrderable,
  setWebshopOnlineOrderable,
  websiteRemark,
  setWebsiteRemark,
  websiteOrder,
  setWebsiteOrder,
  shortWebText,
  setShortWebText,
  websitePhotoFileName,
  setWebsitePhotoFileName,
  kioskInfo,
  setKioskInfo,
  kioskTakeAway,
  setKioskTakeAway,
  kioskEatIn,
  setKioskEatIn,
  kioskSubtitle,
  setKioskSubtitle,
  kioskMinSubs,
  setKioskMinSubs,
  kioskMaxSubs,
  setKioskMaxSubs,
  kioskPicturePreview,
  setKioskPicturePreview,
  productKeyboardValue,
  productKeyboardOnChange
}) {
  const barcodeInputRef = useRef(null);
  const usbScanBufferRef = useRef('');
  const usbScanLastKeyTsRef = useRef(0);

  useEffect(() => {
    if (!showProductModal) return undefined;

    const INTER_KEY_MS = 85;
    const MIN_BARCODE_LEN = 3;
    const isBarcodeChar = (ch) => /[A-Za-z0-9+\-./_*$]/.test(ch);
    const isCompleteBarcode = (s) => s.length >= MIN_BARCODE_LEN && [...s].every(isBarcodeChar);

    const flushToBarcode = (raw, event) => {
      const buf = raw.trim();
      if (!isCompleteBarcode(buf)) return false;
      setProductBarcode(buf);
      setProductActiveField('barcode');
      event.preventDefault();
      event.stopPropagation();
      window.requestAnimationFrame(() => {
        try {
          barcodeInputRef.current?.focus();
        } catch {
          /* ignore */
        }
      });
      return true;
    };

    const onKeyDown = (event) => {
      if (productTab !== 'general') return;

      if (barcodeInputRef.current && document.activeElement === barcodeInputRef.current) {
        return;
      }

      const t = event.target;
      if (t instanceof HTMLElement) {
        if (t.tagName === 'INPUT' && t.type === 'file') return;
      }

      if (event.key === 'Escape') {
        usbScanBufferRef.current = '';
        usbScanLastKeyTsRef.current = 0;
        return;
      }

      const now = Date.now();

      if (event.key === 'Enter' || event.key === 'Tab') {
        const buf = usbScanBufferRef.current;
        usbScanBufferRef.current = '';
        usbScanLastKeyTsRef.current = 0;
        if (buf.length > 0) flushToBarcode(buf, event);
        return;
      }

      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (!isBarcodeChar(event.key)) {
          usbScanBufferRef.current = '';
          usbScanLastKeyTsRef.current = now;
          return;
        }
        if (now - usbScanLastKeyTsRef.current > INTER_KEY_MS) {
          usbScanBufferRef.current = '';
        }
        usbScanLastKeyTsRef.current = now;
        const prevLen = usbScanBufferRef.current.length;
        usbScanBufferRef.current += event.key;
        if (prevLen >= 1) {
          event.preventDefault();
          event.stopPropagation();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      usbScanBufferRef.current = '';
      usbScanLastKeyTsRef.current = 0;
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [showProductModal, productTab, setProductBarcode, setProductActiveField]);

  if (!showProductModal) return null;
  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative bg-pos-bg rounded-xl shadow-2xl max-w-[90%] w-full justify-center items-center mx-4 overflow-hidden flex flex-col min-h-[705px] max-h-[705px]" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="absolute top-2 right-4 z-10 p-2 rounded text-pos-muted active:text-pos-text active:bg-green-500" onClick={closeProductModal} aria-label="Close">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="flex gap-1 w-full justify-around px-10 pt-5 shrink-0 pr-14">
              {[
                { id: 'general', label: tr('control.productModal.tab.general', 'General') },
                { id: 'advanced', label: tr('control.productModal.tab.advanced', 'Advanced') },
                { id: 'extra_prices', label: tr('control.productModal.tab.extraPrices', 'Extra prices') },
                { id: 'purchase_stock', label: tr('control.productModal.tab.purchaseStock', 'Purchase and stock') },
                { id: 'webshop', label: tr('control.productModal.tab.webshop', 'Webshop') },
                // { id: 'kiosk', label: tr('control.productModal.tab.kiosk', 'Kiosk') },
              ].map((tab) => {
                const isLocked = tab.id !== 'general' && !productTabsUnlocked;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    disabled={isLocked}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${productTab === tab.id ? 'bg-green-600 text-white border border-b-0 border-pos-border' : isLocked ? 'text-pos-muted opacity-50 cursor-not-allowed' : 'text-white active:text-pos-text'} active:bg-green-500`}
                    onClick={() => !isLocked && setProductTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
            {/* Single scrollable area for all tabs so keyboard stays fixed at bottom */}
            <div className="flex-1 min-h-0 w-full overflow-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {productTab === 'general' && (
                <div className="p-6 pb-0">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="flex text-md flex-col gap-3">
                      <div className="flex w-full items-center gap-1">
                        <label className="text-md min-w-[125px] font-medium text-gray-200">{tr('name', 'Name')}:</label>
                        <input type="text" value={productName} onChange={(e) => onProductNameInputSynced(e.target.value)} className={`h-[40px] min-w-[150px] max-w-[150px] px-4 py-3 border rounded-lg text-pos-text text-md caret-white ${productFieldErrors.name ? 'bg-rose-500/40 border-rose-400' : 'bg-pos-panel border-pos-border'}`} onFocus={() => setProductActiveField('name')} onClick={() => setProductActiveField('name')} />
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="min-w-[125px] font-medium text-gray-200 text-md">{tr('control.productModal.testName', 'Test name')}:</label>
                        <input type="text" value={productKeyName} onChange={(e) => setProductKeyName(e.target.value)} className={`min-w-[150px] max-w-[150px] px-4 h-[40px] py-3 border rounded-lg text-pos-text text-md ${productFieldErrors.keyName ? 'bg-rose-500/40 border-rose-400' : 'bg-pos-panel border-pos-border'}`} onFocus={() => setProductActiveField('keyName')} onClick={() => setProductActiveField('keyName')} />
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="min-w-[125px] font-medium text-gray-200 text-md">{tr('control.productModal.productionName', 'Production name')}:</label>
                        <input type="text" value={productProductionName} onChange={(e) => setProductProductionName(e.target.value)} className={`min-w-[150px] max-w-[150px] px-4 h-[40px] py-3 border rounded-lg text-pos-text text-md ${productFieldErrors.productionName ? 'bg-rose-500/40 border-rose-400' : 'bg-pos-panel border-pos-border'}`} onFocus={() => setProductActiveField('productionName')} onClick={() => setProductActiveField('productionName')} />
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="min-w-[125px] font-medium text-gray-200 text-md">{tr('control.productModal.price', 'Price')}:</label>
                        <input type="text" value={productPrice} disabled={productPriceLockedByProfit} onChange={(e) => setProductPrice(e.target.value)} className="min-w-[150px] max-w-[150px] px-4 h-[40px] py-3 bg-pos-panel border border-pos-border rounded-lg text-pos-text text-md max-w-[150px] disabled:opacity-60 disabled:cursor-not-allowed" onFocus={() => setProductActiveField('price')} onClick={() => setProductActiveField('price')} />
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="min-w-[125px] font-medium text-gray-200 text-md">{tr('control.productModal.vatTakeOut', 'VAT Take out')}:</label>
                        <Dropdown options={VAT_PERCENT_OPTIONS} value={productVatTakeOut} onChange={(v) => { setProductVatTakeOut(v); setProductFieldErrors((e) => ({ ...e, vatTakeOut: false })); }} placeholder="--" className={`text-md min-w-[150px] ${productFieldErrors.vatTakeOut ? '!bg-rose-500/40 !border-rose-400' : ''}`} />
                      </div>
                      {productTabsUnlocked ? (
                        <div className="flex items-center gap-1 h-[40px]">
                          <label className="min-w-[125px] font-medium text-gray-200 text-md">{tr('control.productModal.id', 'Id')}:</label>
                          <span className="text-pos-text text-md">{productDisplayNumber != null ? productDisplayNumber : '—'}</span>
                        </div>
                      )
                        : (
                          <div className="flex items-center gap-1 h-[40px]">
                          </div>
                        )
                      }
                    </div>
                    <div className='flex flex-col w-full gap-4 max-h-[340px] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'>
                      {(() => {
                        const ids = [...productCategoryIds];
                        let numVisible = 1;
                        if (productTabsUnlocked && categories.length > 0) {
                          for (let i = 0; i < categories.length; i++) {
                            const prevId = i > 0 ? ids[i - 1] : '';
                            if (i > 0 && !prevId) break;
                            const selectedIds = ids.slice(0, i + 1);
                            const optionsForNext = categories.filter((c) => !selectedIds.includes(c.id));
                            if (!ids[i]) {
                              numVisible = i + 1;
                              break;
                            }
                            if (optionsForNext.length < 1) {
                              numVisible = i + 1;
                              break;
                            }
                            numVisible = i + 2;
                          }
                        }
                        while (ids.length < numVisible) ids.push('');
                        return Array.from({ length: numVisible }, (_, i) => {
                          const prevIds = ids.slice(0, i);
                          const optionsForI = i === 0 ? categories : categories.filter((c) => !prevIds.includes(c.id));
                          return (
                            <div key={i} className="flex gap-1 w-full h-[40px]">
                              <label className="pr-5 font-medium text-md items-center justify-center flex h-[40px] text-gray-200">{tr('control.productModal.category', 'Category')}:</label>
                              <Dropdown
                                options={optionsForI.map((c) => ({ value: c.id, label: c.name }))}
                                value={ids[i] || ''}
                                onChange={(v) => {
                                  setProductCategoryIds((prev) => {
                                    const next = [...prev];
                                    while (next.length <= i) next.push('');
                                    next[i] = v;
                                    for (let j = i + 1; j < next.length; j++) next[j] = '';
                                    return next;
                                  });
                                }}
                                placeholder="--"
                                className="text-md w-full min-w-[150px]"
                              />
                            </div>
                          );
                        });
                      })()}
                    </div>
                    <div className="flex flex-col gap-4">
                      <div className="flex gap-1 items-center w-full">
                        <label className="min-w-[80px] font-medium text-md text-gray-200">{tr('control.productModal.addition', 'Addition')}:</label>
                        <Dropdown options={[{ value: 'Subproducts', label: tr('control.productModal.subproducts', 'Subproducts') }]} value={productAddition} onChange={setProductAddition} placeholder="--" className="text-md w-full min-w-[150px]" />
                      </div>
                      <div className="flex gap-1 items-center">
                        <label className="min-w-[80px] font-medium text-md text-gray-200">{tr('control.productModal.barcode', 'Barcode')}:</label>
                        <div className="flex gap-2 items-center w-full">
                          <input ref={barcodeInputRef} type="text" value={productBarcode} onChange={(e) => setProductBarcode(e.target.value)} className="min-w-[150px] max-w-[150px] px-4 h-[40px] py-3 bg-pos-panel border border-pos-border rounded-lg text-pos-text text-md" onFocus={() => setProductActiveField('barcode')} onClick={() => setProductActiveField('barcode')} />
                          <button type="button" className="p-2 rounded-full bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 disabled:opacity-70" aria-label="Generate barcode" onClick={handleGenerateBarcode}>
                            <svg className={`w-5 h-5 ${barcodeButtonSpinning ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-1 items-center">
                        <label className="min-w-[80px] font-medium text-md text-gray-200">{tr('control.productModal.printer1', 'Printer 1')}:</label>
                        <Dropdown
                          options={getUniqueProductPrinterOptions(productPrinter1, [productPrinter2, productPrinter3])}
                          value={productPrinter1}
                          onChange={setProductPrinter1}
                          className="text-md w-full min-w-[150px]"
                        />
                      </div>
                      <div className="flex gap-1 items-center">
                        <label className="min-w-[80px] font-medium text-md text-gray-200">{tr('control.productModal.printer2', 'Printer 2')}:</label>
                        <Dropdown
                          options={getUniqueProductPrinterOptions(productPrinter2, [productPrinter1, productPrinter3])}
                          value={productPrinter2}
                          onChange={setProductPrinter2}
                          className="text-md w-full min-w-[150px]"
                        />
                      </div>
                      <div className="flex gap-1 items-center">
                        <label className="min-w-[80px] font-medium text-md text-gray-200">{tr('control.productModal.printer3', 'Printer 3')}:</label>
                        <Dropdown
                          options={getUniqueProductPrinterOptions(productPrinter3, [productPrinter1, productPrinter2])}
                          value={productPrinter3}
                          onChange={setProductPrinter3}
                          className="text-md w-full min-w-[150px]"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex w-full justify-center gap-4">
                    <button type="button" className="flex items-center text-md gap-4 px-6 py-2 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50" disabled={savingProduct} onClick={handleSaveProduct}>
                      <svg fill="#ffffff" width="18px" height="18px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" /></svg>
                      {tr('control.productModal.addAndClose', 'Add and close')}
                    </button>
                  </div>
                </div>
              )}
              {productTab === 'advanced' && (
                <div className="p-6 pb-0 flex w-full flex-col px-10 text-sm">
                  <div className="flex w-full gap-10">
                    <div className="flex flex-col gap-3">
                      <div className='flex items-center'>
                        <label className="flex items-center gap-2 min-w-[170px] text-pos-text">{tr('control.productModal.advanced.openPrice', 'Open price')}:</label>
                        <input type="checkbox" checked={advancedOpenPrice} onChange={(e) => setAdvancedOpenPrice(e.target.checked)} className="rounded border-pos-border w-5 h-5" />
                      </div>
                      <div className='flex items-center'>
                        <label className="flex items-center min-w-[170px] gap-2 text-pos-text">{tr('control.productModal.advanced.libra', 'Scale')}:</label>
                        <input type="checkbox" checked={advancedWeegschaal} onChange={(e) => setAdvancedWeegschaal(e.target.checked)} className="rounded border-pos-border w-5 h-5" />
                      </div>
                      <div className='flex items-center'>
                        <label className="flex items-center min-w-[170px] gap-2 text-pos-text">{tr('control.productModal.advanced.subproductRequires', 'Subproduct requires')} :</label>
                        <input type="checkbox" checked={advancedSubproductRequires} onChange={(e) => setAdvancedSubproductRequires(e.target.checked)} className="rounded border-pos-border w-5 h-5" />
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="block text-pos-text mb-1 min-w-[170px] text-md">{tr('control.productModal.advanced.emptyPrice', 'Empty price')}:</label>
                        <input type="text" value={advancedLeeggoedPrijs} onChange={(e) => setAdvancedLeeggoedPrijs(e.target.value)} onFocus={() => setProductActiveField('leeggoedPrijs')} className="w-full h-[40px] border border-pos-border rounded-lg px-3 py-2 bg-pos-bg text-pos-text max-w-[100px]" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-4">
                      <div className='flex items-center'>
                        <label className="flex min-w-[140px] items-center gap-2 text-pos-text">{tr('control.productModal.advanced.pagerRequired', 'Pager required')}:</label>
                        <input type="checkbox" checked={advancedPagerVerplicht} onChange={(e) => setAdvancedPagerVerplicht(e.target.checked)} className="rounded border-pos-border w-5 h-5" />
                      </div>
                      <div className='flex items-center'>
                        <label className="flex min-w-[140px] items-center gap-2 text-pos-text">{tr('control.productModal.advanced.boldPrint', 'Bold print')}:</label>
                        <input type="checkbox" checked={advancedBoldPrint} onChange={(e) => setAdvancedBoldPrint(e.target.checked)} className="rounded border-pos-border w-5 h-5" />
                      </div>
                      <div className='flex items-center'>
                        <label className="flex min-w-[140px] items-center gap-2 text-pos-text">{tr('control.productModal.advanced.groupingReceipt', 'Grouping receipt')}:</label>
                        <input type="checkbox" checked={advancedGroupingReceipt} onChange={(e) => setAdvancedGroupingReceipt(e.target.checked)} className="rounded border-pos-border w-5 h-5" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 ml-10">
                      <div className="flex items-center">
                        <label className="block min-w-[150px] text-pos-text mb-1">{tr('control.productModal.advanced.labelExtraInfo', 'Label extra info')}:</label>
                        <input type="text" value={advancedLabelExtraInfo} onChange={(e) => setAdvancedLabelExtraInfo(e.target.value)} onFocus={() => setProductActiveField('labelExtraInfo')} className="w-full h-[40px] border border-pos-border rounded-lg px-3 py-2 bg-pos-bg text-pos-text max-w-[160px]" />
                      </div>
                      <div className="flex items-center">
                        <label className="block min-w-[150px] text-pos-text mb-1">{tr('control.productModal.advanced.cashRegisterPhoto', 'Cash register photo')}:</label>
                        <div className="flex items-center gap-3">
                          {!advancedKassaPhotoPreview ? (
                            <label className="px-4 py-2 border border-pos-border rounded-lg text-pos-text active:bg-green-500 cursor-pointer shrink-0 text-md">
                              {tr('control.productModal.chooseFileSimple', 'Select')}
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
                                    if (dataUrl) setAdvancedKassaPhotoPreview(dataUrl);
                                  }
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          ) : (
                            <>
                              <img src={advancedKassaPhotoPreview} alt="Cash register" className="w-16 h-16 object-cover rounded-lg border border-pos-border shrink-0" />
                              <button
                                type="button"
                                className="px-4 py-2 border border-pos-border rounded-lg text-pos-text active:bg-green-500 shrink-0"
                                onClick={() => {
                                  setAdvancedKassaPhotoPreview(null);
                                }}
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center">
                        <label className="block min-w-[150px] text-pos-text">{tr('control.productModal.advanced.prepackExpiryType', 'Pre-pack expiry type')}:</label>
                        <Dropdown options={VERVALTYPE_OPTIONS} value={advancedVoorverpakVervaltype} onChange={setAdvancedVoorverpakVervaltype} placeholder={tr('control.productModal.select', 'Select…')} className="bg-pos-bg text-pos-text min-w-[160px]" />
                      </div>
                      <div className="flex items-center">
                        <label className="block min-w-[150px] text-pos-text">{tr('control.productModal.advanced.shelfLife', 'Shelf life')}:</label>
                        <input type="text" value={advancedHoudbareDagen} onChange={(e) => setAdvancedHoudbareDagen(e.target.value)} onFocus={() => setProductActiveField('houdbareDagen')} className="w-full h-[40px] border border-pos-border max-w-[160px] rounded-lg px-3 py-2 bg-pos-bg text-pos-text text-md" />
                      </div>
                      <div className="flex text-md">
                        <label className="block min-w-[150px] text-pos-text">{tr('control.productModal.advanced.storageUse', 'Storage, use')}:</label>
                        <textarea value={advancedBewarenGebruik} onChange={(e) => setAdvancedBewarenGebruik(e.target.value)} onFocus={() => setProductActiveField('bewarenGebruik')} rows={4} className="w-full border border-pos-border max-w-[160px] rounded-lg px-3 py-2 bg-pos-bg text-pos-text resize-none" />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <button type="button" className="flex items-center gap-4 px-6 py-2 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50" onClick={handleSaveProduct} disabled={savingProduct}>
                      <svg fill="#ffffff" width="14px" height="14px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" /></svg>
                      {tr('control.save', 'Save')}
                    </button>
                  </div>
                </div>
              )}
              {productTab === 'extra_prices' && (
                <div className="p-6 flex flex-col gap-3 pb-0">
                  <div className="flex gap-4 w-full justify-around text-sm text-pos-text">
                    <div className="font-medium">{tr('control.productModal.extraPrices.pricegroup', 'Pricegroup')}</div>
                    <div className="font-medium">{tr('control.productModal.extraPrices.otherName', 'Other name')}</div>
                    <div className="font-medium">{tr('control.productModal.extraPrices.otherPrinter', 'Other printer')}</div>
                    <div className="font-medium">{tr('control.productModal.extraPrices.otherPrice', 'Other price')}</div>
                  </div>
                  <div
                    ref={extraPricesScrollRef}
                    onScroll={syncExtraPricesScrollEdges}
                    className="max-h-[250px] overflow-x-auto overflow-y-auto text-sm border-collapse border border-pos-border scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden]"
                  >
                    <table className="w-full h-full rounded-lg text-pos-text">
                      <tbody className="w-full">
                        {extraPricesRows.map((row, idx) => (
                          <tr key={idx} className="bg-pos-bg">
                            <td className="min-w-[200px] px-4 py-1">
                              <span className="px-3 max-w-[200px] min-h-[40px] max-h-[40px] py-2 block flex justify-center rounded-lg text-pos-text">{row.priceGroupLabel}</span>
                            </td>
                            <td className=" min-w-[250px] min-h-[40px] max-h-[40px] px-4 py-1">
                              <div className='w-full flex justify-center items-center'>
                                <input
                                  type="text"
                                  value={row.otherName}
                                  onChange={(e) => setExtraPricesRows((prev) => prev.map((r, i) => i === idx ? { ...r, otherName: e.target.value } : r))}
                                  onFocus={() => { setExtraPricesSelectedIndex(idx); setProductActiveField('extraOtherName'); }}
                                  className="w-full max-w-[150px] min-h-[40px] max-h-[40px] rounded-lg px-3 py-2 border border-pos-border flex justify-center bg-pos-panel text-pos-text"
                                />
                              </div>
                            </td>
                            <td className="min-w-[200px] min-h-[40px] max-h-[40px] px-4 py-1">
                              <div className="w-full flex justify-center items-center">
                                <div className="w-full max-w-[150px] min-w-0">
                                  <Dropdown
                                    options={EXTRA_PRICE_PRINTER_OPTIONS}
                                    value={row.otherPrinter}
                                    onChange={(v) => setExtraPricesRows((prev) => prev.map((r, i) => i === idx ? { ...r, otherPrinter: v } : r))}
                                    placeholder="--"
                                    className="w-full min-h-[40px] max-h-[40px] bg-pos-bg text-pos-text"
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="min-w-[200px] min-h-[40px] max-h-[40px] px-4 py-1">
                              <input
                                type="text"
                                value={row.otherPrice}
                                onChange={(e) => setExtraPricesRows((prev) => prev.map((r, i) => i === idx ? { ...r, otherPrice: e.target.value } : r))}
                                onFocus={() => { setExtraPricesSelectedIndex(idx); setProductActiveField('extraOtherPrice'); }}
                                className="w-full min-h-[40px] max-h-[40px] rounded-lg ml-[50px] max-w-[120px] px-3 py-2 border border-pos-border bg-pos-panel text-pos-text"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-around px-[200px]">
                    <button
                      type="button"
                      className="p-2 px-4 bg-pos-panel rounded-lg text-white active:bg-green-500 disabled:opacity-50 text-lg font-medium"
                      disabled={extraPricesScrollEdges.atTop}
                      onClick={() => {
                        const el = extraPricesScrollRef.current;
                        if (!el) return;
                        const step = Math.min(56, Math.max(40, Math.round(el.clientHeight * 0.45)));
                        el.scrollBy({ top: -step, behavior: 'smooth' });
                      }}
                      aria-label={tr('control.productModal.extraPrices.scrollUp', 'Scroll up')}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="p-2 px-4 rounded-lg bg-pos-panel text-white active:bg-green-500 disabled:opacity-50 text-lg font-medium"
                      disabled={extraPricesScrollEdges.atBottom}
                      onClick={() => {
                        const el = extraPricesScrollRef.current;
                        if (!el) return;
                        const step = Math.min(56, Math.max(40, Math.round(el.clientHeight * 0.45)));
                        el.scrollBy({ top: step, behavior: 'smooth' });
                      }}
                      aria-label={tr('control.productModal.extraPrices.scrollDown', 'Scroll down')}
                    >
                      ↓
                    </button>
                  </div>
                  <div className="flex justify-center text-md">
                    <button type="button" className="flex text-md items-center gap-4 px-6 py-2 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50" onClick={handleSaveProduct} disabled={savingProduct}>
                      <svg fill="#ffffff" width="14px" height="14px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" /></svg>
                      {tr('control.save', 'Save')}
                    </button>
                  </div>
                </div>
              )}
              {productTab === 'purchase_stock' && (
                <div className="p-6 flex flex-col gap-6 text-sm">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex flex-col gap-3">
                      <div className='flex items-center'>
                        <label className="block min-w-[150px] text-pos-text text-md">{tr('control.productModal.purchase.purchaseVat', 'Purchase VAT')}:</label>
                        <Dropdown options={VAT_PERCENT_OPTIONS} value={purchaseVat} onChange={setPurchaseVat} placeholder="--" className="min-w-[120px] bg-pos-bg text-pos-text text-md" />
                      </div>
                      <div className='flex items-center'>
                        <label className="block text-pos-text min-w-[150px] text-md">{tr('control.productModal.purchase.purchasePriceExcl', 'Purchase price excl')}:</label>
                        <input type="text" value={purchasePriceExcl} onChange={(e) => setPurchasePriceExcl(e.target.value)} onFocus={() => setProductActiveField('purchasePriceExcl')} className="border max-w-[120px] h-[40px] border-pos-border rounded-lg px-3 py-2 bg-pos-bg text-pos-text text-md" />
                      </div>
                      <div className='flex items-center'>
                        <label className="block text-pos-text min-w-[150px] text-md">{tr('control.productModal.purchase.purchasePriceIncl', 'Purchase price incl.')}:</label>
                        <input type="text" value={purchasePriceIncl} onChange={(e) => setPurchasePriceIncl(e.target.value)} onFocus={() => setProductActiveField('purchasePriceIncl')} className="border max-w-[120px] h-[40px] border-pos-border rounded-lg px-3 py-2 bg-pos-bg text-pos-text text-md" />
                      </div>
                      <div className='flex items-center'>
                        <label className="block text-pos-text min-w-[150px] text-md">{tr('control.productModal.purchase.profitPercentage', 'Profit percentage')}:</label>
                        <input type="text" value={profitPct} onChange={(e) => setProfitPct(e.target.value)} onFocus={() => setProductActiveField('profitPct')} className="border border-pos-border rounded-lg px-3 max-w-[120px] h-[40px] py-2 bg-pos-bg text-pos-text text-md" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-3">
                      <div className='flex items-center'>
                        <label className="block min-w-[110px] text-pos-text text-md">{tr('control.productModal.purchase.unit', 'Unit')}:</label>
                        <Dropdown options={PURCHASE_UNIT_OPTIONS} value={purchaseUnit} onChange={setPurchaseUnit} placeholder="--" className="min-w-[150px] bg-pos-bg text-pos-text text-md" />
                      </div>
                      <div className='flex items-center'>
                        <label className="block min-w-[110px] text-pos-text text-md">{tr('control.productModal.purchase.unitContent', 'Unit content')}:</label>
                        <input type="text" value={unitContent} onChange={(e) => setUnitContent(e.target.value)} onFocus={() => setProductActiveField('unitContent')} className="border min-w-[150px] max-w-[150px] border-pos-border rounded-lg px-3 py-2 h-[40px] bg-pos-bg text-pos-text text-md" />
                      </div>
                      <div className='flex items-center'>
                        <label className="block min-w-[110px] text-pos-text text-md">{tr('control.productModal.purchase.stock', 'Stock')}:</label>
                        <input type="text" value={stock} onChange={(e) => setStock(e.target.value)} onFocus={() => setProductActiveField('stock')} className="border border-pos-border rounded-lg min-w-[150px] max-w-[150px] px-3 py-2 h-[40px] bg-pos-bg text-pos-text text-md" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-3">
                      <div className='flex items-center'>
                        <label className="block text-pos-text min-w-[105px]">{tr('control.productModal.purchase.supplier', 'Supplier')}:</label>
                        <Dropdown options={purchaseSupplierOptions} value={purchaseSupplier} onChange={setPurchaseSupplier} placeholder="--" className="min-w-[150px] bg-pos-bg text-pos-text" />
                      </div>
                      <div className='flex items-center'>
                        <label className="block text-pos-text min-w-[105px]">{tr('control.productModal.purchase.supplierCode', 'Supplier code')}:</label>
                        <input type="text" value={supplierCode} onChange={(e) => setSupplierCode(e.target.value)} onFocus={() => setProductActiveField('supplierCode')} className="border max-w-[150px] h-[40px] border-pos-border rounded-lg px-3 py-2 bg-pos-bg text-pos-text" />
                      </div>
                      <div className='flex items-center'>
                        <label className="flex min-w-[105px] items-centertext-pos-text">
                          {tr('control.productModal.purchase.stockNotification', 'Stock notification')}
                        </label>
                        <input type="checkbox" checked={stockNotification} onChange={(e) => setStockNotification(e.target.checked)} className="rounded w-5 h-5 border-pos-border" />
                      </div>
                      <div className='flex items-center'>
                        <label className="blockflex min-w-[105px] text-pos-text">{tr('control.productModal.purchase.expirationDate', 'Expiration date')}:</label>
                        <input type="text" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} onFocus={() => setProductActiveField('expirationDate')} className="border border-pos-border max-w-[150px] h-[40px] rounded-lg px-3 py-2 bg-pos-bg text-pos-text" placeholder="" />
                      </div>
                      <div className='flex items-center'>
                        <label className="blockflex min-w-[105px] max-w-[105px] text-pos-text">{tr('control.productModal.purchase.declarationOfExpiry', 'Declaration of expiry')}:</label>
                        <div className="flex items-center gap-2">
                          <input type="text" value={declarationExpiryDays} onChange={(e) => setDeclarationExpiryDays(e.target.value)} onFocus={() => setProductActiveField('declarationExpiryDays')} className="border max-w-[50px] h-[40px] border-pos-border rounded-lg px-3 py-2 bg-pos-bg text-pos-text" />
                          <span className="text-pos-text">{tr('control.productModal.purchase.daysInAdvance', 'days in advance')}</span>
                        </div>
                      </div>
                      <div className='flex items-center'>
                        <label className="blockflex min-w-[105px] max-w-[105px] text-pos-text">{tr('control.productModal.purchase.notificationSoldOut', 'Notification sold out')}:</label>
                        <div className="flex items-center gap-2">
                          <input type="text" value={notificationSoldOutPieces} onChange={(e) => setNotificationSoldOutPieces(e.target.value)} onFocus={() => setProductActiveField('notificationSoldOutPieces')} className="border max-w-[50px] h-[40px] border-pos-border rounded-lg px-3 py-2 bg-pos-bg text-pos-text" />
                          <span className="text-pos-text">{tr('control.productModal.purchase.piecesInAdvance', 'pieces in advance')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <button type="button" className="flex items-center text-md gap-4 px-6 py-2 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50" onClick={handleSaveProduct} disabled={savingProduct}>
                      <svg fill="#ffffff" width="14px" height="14px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" /></svg>
                      {tr('control.save', 'Save')}
                    </button>
                  </div>
                </div>
              )}
              {productTab === 'webshop' && (
                <div className="p-6 flex flex-col gap-6">
                  <div className="grid text-sm grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-3">
                      <div className='flex items-center'>
                        <label className="flex min-w-[150px] items-center text-pos-text">{tr('control.productModal.webshop.inWebshop', 'In webshop')}:</label>
                        <input type="checkbox" checked={productInWebshop} onChange={(e) => setProductInWebshop(e.target.checked)} className="w-5 h-5 rounded border-pos-border" />
                      </div>
                      <div className='flex items-center'>
                        <label className="flex items-center min-w-[150px] text-pos-text">{tr('control.productModal.webshop.onlineOrderable', 'Online orderable')}:</label>
                        <input type="checkbox" checked={webshopOnlineOrderable} onChange={(e) => setWebshopOnlineOrderable(e.target.checked)} className="w-5 h-5 rounded border-pos-border" />
                      </div>
                      <div className='flex items-center'>
                        <label className="block text-pos-text min-w-[150px]">{tr('control.productModal.webshop.websiteRemark', 'Website remark')}:</label>
                        <input type="text" value={websiteRemark} onChange={(e) => setWebsiteRemark(e.target.value)} onFocus={() => setProductActiveField('websiteRemark')} className="border max-w-[150px] h-[40px] border-pos-border rounded-lg px-3 py-2 bg-pos-bg text-pos-text" />
                      </div>
                      <div className='flex items-center'>
                        <label className="block text-pos-text min-w-[150px]">{tr('control.productModal.webshop.websiteOrder', 'Website order')}:</label>
                        <input type="text" value={websiteOrder} onChange={(e) => setWebsiteOrder(e.target.value)} onFocus={() => setProductActiveField('websiteOrder')} className="border max-w-[150px] h-[40px] border-pos-border rounded-lg px-3 py-2 bg-pos-bg text-pos-text" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-4">
                      <div className='flex items-center'>
                        <label className="block text-pos-text min-w-[150px]">{tr('control.productModal.webshop.shortWebText', 'Short web text')}:</label>
                        <input type="text" value={shortWebText} onChange={(e) => setShortWebText(e.target.value)} onFocus={() => setProductActiveField('shortWebText')} className="border max-w-[150px] h-[40px] border-pos-border rounded-lg px-3 py-2 bg-pos-bg text-pos-text" />
                      </div>
                      <div className='flex items-center'>
                        <label className="block text-pos-text min-w-[150px]">{tr('control.productModal.webshop.websitePhoto', 'Website photo')}:</label>
                        <div className="flex gap-3 items-center">
                          <label className="px-4 py-2 border border-pos-border rounded-lg text-pos-text active:bg-green-500 cursor-pointer shrink-0">
                            {tr('control.productModal.chooseFile', 'Choose File')}
                            <input type="file" className="hidden focus:border-green-500 focus:outline-none" accept="image/*" onChange={(e) => setWebsitePhotoFileName(e.target.files?.[0]?.name ?? '')} />
                          </label>
                          <span className="text-pos-muted">{websitePhotoFileName || tr('control.productModal.noFileChosen', 'No file chosen')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-center pt-20">
                    <button type="button" className="flex items-center gap-4 px-6 py-2 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50" onClick={handleSaveProduct} disabled={savingProduct}>
                      <svg fill="#ffffff" width="14px" height="14px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" /></svg>
                      {tr('control.save', 'Save')}
                    </button>
                  </div>
                </div>
              )}
              {productTab === 'kiosk' && (
                <div className="p-6 flex flex-col gap-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className='flex flex-col gap-5'>
                      <div className='flex items-center'>
                        <label className="block w-[150px] text-pos-text">{tr('control.productModal.kiosk.kioskInfo', 'Kiosk info')}:</label>
                        <input type="text" value={kioskInfo} onChange={(e) => setKioskInfo(e.target.value)} onFocus={() => setProductActiveField('kioskInfo')} className="border border-pos-border rounded-lg px-3 py-2 h-[40px] bg-pos-bg text-pos-text" />
                      </div>
                      <div className='flex items-center'>
                        <label className="flex min-w-[150px] items-center text-pos-text">
                          {tr('control.productModal.kiosk.kioskTakeAway', 'Kiosk take away')}:
                        </label>
                        <input type="checkbox" checked={kioskTakeAway} onChange={(e) => setKioskTakeAway(e.target.checked)} className="w-5 h-5 rounded border-pos-border" />
                      </div>
                      <div className='flex items-center'>
                        <label className="block w-[150px] text-pos-text">{tr('control.productModal.kiosk.kioskEatIn', 'Kiosk eat in')}:</label>
                        <input type="text" value={kioskEatIn} onChange={(e) => setKioskEatIn(e.target.value)} onFocus={() => setProductActiveField('kioskEatIn')} className="border border-pos-border rounded-lg px-3 py-2 h-[40px] bg-pos-bg text-pos-text max-w-md" />
                      </div>
                      <div className='flex items-center'>
                        <label className="block w-[150px] text-pos-text">{tr('control.productModal.kiosk.kioskSubtitle', 'Kiosk subtitle')}:</label>
                        <input type="text" value={kioskSubtitle} onChange={(e) => setKioskSubtitle(e.target.value)} onFocus={() => setProductActiveField('kioskSubtitle')} className="border border-pos-border rounded-lg px-3 py-2 h-[40px] bg-pos-bg text-pos-text" />
                      </div>
                      <div className='flex items-center'>
                        <label className="block text-pos-text w-[150px]">{tr('control.productModal.kiosk.kioskMinSubs', 'Kiosk min. subs')}:</label>
                        <Dropdown options={KIOSK_SUBS_OPTIONS} value={kioskMinSubs} onChange={setKioskMinSubs} className="min-w-[200px] bg-pos-bg text-pos-text" />
                      </div>
                      <div className='flex items-center'>
                        <label className="block text-pos-text w-[150px]">{tr('control.productModal.kiosk.kioskMaxSubs', 'Kiosk max. subs')}:</label>
                        <Dropdown options={KIOSK_SUBS_OPTIONS} value={kioskMaxSubs} onChange={setKioskMaxSubs} className="min-w-[200px] bg-pos-bg text-pos-text" />
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="flex flex-col gap-2">
                        <label className="block text-pos-text pr-10">{tr('control.productModal.kiosk.kioskPicture', 'Kiosk picture')}:</label>
                        <div className="flex flex-wrap items-center gap-3">
                          {!kioskPicturePreview ? (
                            <label className="px-4 py-2 border border-pos-border rounded-lg text-pos-text active:bg-green-500 cursor-pointer shrink-0">
                              {tr('control.productModal.chooseFile', 'Choose File')}
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
                                    if (dataUrl) setKioskPicturePreview(dataUrl);
                                  }
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          ) : (
                            <>
                              <img
                                src={resolveMediaSrc(kioskPicturePreview)}
                                alt=""
                                className="w-24 h-24 object-cover rounded-lg border border-pos-border shrink-0"
                              />
                              <button
                                type="button"
                                className="px-4 py-2 border border-pos-border rounded-lg text-pos-text active:bg-green-500 shrink-0"
                                onClick={() => setKioskPicturePreview(null)}
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <button type="button" className="flex items-center text-md gap-4 px-6 py-2 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50" onClick={handleSaveProduct} disabled={savingProduct}>
                      <svg fill="#ffffff" width="14px" height="14px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" /></svg>
                      {tr('control.save', 'Save')}
                    </button>
                  </div>
                </div>
              )}
            </div>
            {/* Keyboard fixed at bottom in every tab */}
            <div className="shrink-0">
              <KeyboardWithNumpad value={productKeyboardValue} onChange={productKeyboardOnChange} />
            </div>
          </div>
        </div>
  );
}
