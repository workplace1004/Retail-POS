import React from 'react';
import { Dropdown } from '../Dropdown';
import { PaginationArrows } from '../PaginationArrows';
import { SmallKeyboardWithNumpad } from '../SmallKeyboardWithNumpad';

export function ControlViewExternalPrinter(props) {
  const {
    tr,
    PRINTER_TAB_DEFS,
    printerTab,
    setPrinterTab,
    openNewPrinterModal,
    printers,
    PRINTERS_PAGE_SIZE,
    printersPage,
    setDefaultPrinter,
    openEditPrinterModal,
    setDeleteConfirmPrinterId,
    setPrintersPage,
    finalTicketsCompanyData1,
    setFinalTicketsCompanyData1,
    finalTicketsCompanyData2,
    setFinalTicketsCompanyData2,
    finalTicketsCompanyData3,
    setFinalTicketsCompanyData3,
    finalTicketsCompanyData4,
    setFinalTicketsCompanyData4,
    finalTicketsCompanyData5,
    setFinalTicketsCompanyData5,
    setFinalTicketsActiveField,
    finalTicketsThankText,
    setFinalTicketsThankText,
    finalTicketsProforma,
    setFinalTicketsProforma,
    finalTicketsPrintPaymentType,
    setFinalTicketsPrintPaymentType,
    finalTicketsTicketTearable,
    setFinalTicketsTicketTearable,
    finalTicketsPrintLogo,
    setFinalTicketsPrintLogo,
    mapTranslatedOptions,
    PRINTING_ORDER_OPTIONS,
    finalTicketsPrintingOrder,
    setFinalTicketsPrintingOrder,
    savingFinalTickets,
    handleSaveFinalTickets,
    finalTicketsKeyboardValue,
    finalTicketsKeyboardOnChange,
    prodTicketsDisplayCategories,
    setProdTicketsDisplayCategories,
    prodTicketsSpaceAbove,
    setProdTicketsSpaceAbove,
    prodTicketsTicketTearable,
    setProdTicketsTicketTearable,
    prodTicketsKeukenprinterBuzzer,
    setProdTicketsKeukenprinterBuzzer,
    prodTicketsProductenIndividueel,
    setProdTicketsProductenIndividueel,
    prodTicketsEatInTakeOutOnderaan,
    setProdTicketsEatInTakeOutOnderaan,
    productionTicketsPrinterOptions,
    prodTicketsNextCoursePrinter1,
    setProdTicketsNextCoursePrinter1,
    prodTicketsNextCoursePrinter2,
    setProdTicketsNextCoursePrinter2,
    prodTicketsNextCoursePrinter3,
    setProdTicketsNextCoursePrinter3,
    prodTicketsNextCoursePrinter4,
    setProdTicketsNextCoursePrinter4,
    prodTicketsPrintingOrder,
    setProdTicketsPrintingOrder,
    GROUPING_RECEIPT_OPTIONS,
    prodTicketsGroupingReceipt,
    setProdTicketsGroupingReceipt,
    prodTicketsPrinterOverboeken,
    setProdTicketsPrinterOverboeken,
    savingProdTickets,
    handleSaveProductionTickets,
    labelsList,
    labelsTypeOptions,
    labelsType,
    saveLabelsSettings,
    labelsPrinterOptions,
    labelsPrinter,
    openNewLabelModal,
    labelsListRef,
    updateLabelsScrollState,
    openEditLabelModal,
    setDeleteConfirmLabelId,
    canLabelsScrollUp,
    canLabelsScrollDown,
    scrollLabelsByPage
  } = props;

  return (
    <div className="flex flex-col">
      <div className="flex justify-around mb-6 shrink-0">
        {PRINTER_TAB_DEFS.map(({ id, labelKey, fallback }) => (
          <button
            key={id}
            type="button"
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${printerTab === id ? 'border-blue-500 text-pos-text' : 'border-transparent text-pos-muted active:text-pos-text'} active:bg-green-500`}
            onClick={() => setPrinterTab(id)}
          >
            {tr(labelKey, fallback)}
          </button>
        ))}
      </div>
      {printerTab === 'General' && (
        <div className="relative min-h-[580px] rounded-xl border border-pos-border bg-pos-panel/30 p-4 pb-[60px]">
          <div className="flex items-center w-full justify-center mb-2">
            <button
              type="button"
              className="px-6 py-3 rounded-lg text-sm font-medium bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 active:border-white/30 transition-colors disabled:opacity-50"
              onClick={openNewPrinterModal}
            >
              {tr('control.printer.addPrinter', 'Add printer')}
            </button>
          </div>
          {(() => {
            const sorted = [...printers].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
            const total = sorted.length;
            const totalPages = Math.max(1, Math.ceil(total / PRINTERS_PAGE_SIZE));
            const page = Math.min(printersPage, totalPages - 1);
            const start = page * PRINTERS_PAGE_SIZE;
            const paginated = sorted.slice(start, start + PRINTERS_PAGE_SIZE);
            const canPrev = page > 0;
            const canNext = page < totalPages - 1;
            return sorted.length === 0 ? (
              <ul className="w-full flex flex-col">
                <li className="text-pos-muted text-xl font-medium text-center py-4">{tr('control.printer.empty', 'No printers yet.')}</li>
              </ul>
            ) : (
              <>
                <div className="max-h-[510px] overflow-y-auto rounded-lg [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  <ul className="w-full flex flex-col">
                    {paginated.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center w-full justify-between px-4 py-2 bg-pos-bg border-y border-pos-panel text-pos-text text-sm"
                      >
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            className="p-2 flex justify-center rounded text-pos-text active:bg-green-500 shrink-0"
                            onClick={() => setDefaultPrinter(p.id)}
                            aria-label={p.isDefault ? tr('control.printer.defaultPrinter', 'Default printer') : tr('control.printer.setAsDefault', 'Set as default')}
                          >
                            {p.isDefault ? (
                              <span className="w-5 h-5 inline-flex justify-center items-center text-green-500 text-xl">{'\u2713'}</span>
                            ) : (
                              <span className="w-5 h-5 inline-block rounded-full border-2 border-pos-muted" />
                            )}
                          </button>
                        </div>
                        <span className="flex-1 text-center font-medium">{p.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            className="p-2 mr-5 rounded text-pos-text active:bg-green-500"
                            onClick={() => openEditPrinterModal(p)}
                            aria-label={tr('control.edit', 'Edit')}
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button
                            type="button"
                            className="p-2 rounded text-pos-text active:text-rose-500"
                            onClick={() => setDeleteConfirmPrinterId(p.id)}
                            aria-label={tr('delete', 'Delete')}
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                        <PaginationArrows
                          canPrev={canPrev}
                          canNext={canNext}
                          onPrev={() => setPrintersPage((pIndex) => Math.max(0, pIndex - 1))}
                          onNext={() => setPrintersPage((pIndex) => Math.min(totalPages - 1, pIndex + 1))}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            );
          })()}
        </div>
      )}
      {printerTab === 'Final tickets' && (
        <div className="relative min-h-[580px] rounded-xl border border-pos-border bg-pos-panel/30 p-4 pb-[60px]">
          <p className="text-pos-muted text-sm mb-4 max-w-4xl leading-snug">
            {tr(
              'control.printer.escPosFinalTicketHint',
              'Final tickets print with larger type on serial/network ESC/POS; TOTAL and PAID are extra large. Windows printer queue (Out-Printer) uses plain text only.',
            )}
          </p>
          <div className="grid grid-cols-1 text-sm md:grid-cols-2 gap-x-10 gap-y-4 mb-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-2">
                <label className="block text-pos-text font-medium min-w-[130px] max-w-[130px]">{tr('control.finalTickets.companyData', 'Company data:')}</label>
                <div className="grid grid-cols-2 items-start gap-4">
                  <input type="text" value={finalTicketsCompanyData1} onChange={(e) => setFinalTicketsCompanyData1(e.target.value)} onFocus={() => setFinalTicketsActiveField('companyData1')} className="px-4 min-w-[100px] max-w-[100px] flex py-3 bg-pos-panel h-[40px] border border-gray-300 rounded-lg justify-start items-start text-gray-200" />
                  {[2, 3, 4, 5].map((i) => (
                    <div key={i}>
                      <input type="text" value={i === 2 ? finalTicketsCompanyData2 : i === 3 ? finalTicketsCompanyData3 : i === 4 ? finalTicketsCompanyData4 : finalTicketsCompanyData5} onChange={(e) => { if (i === 2) setFinalTicketsCompanyData2(e.target.value); else if (i === 3) setFinalTicketsCompanyData3(e.target.value); else if (i === 4) setFinalTicketsCompanyData4(e.target.value); else setFinalTicketsCompanyData5(e.target.value); }} onFocus={() => setFinalTicketsActiveField(`companyData${i}`)} className="px-4 min-w-[100px] max-w-[100px] py-3 bg-pos-panel h-[40px] border border-gray-300 rounded-lg text-gray-200" placeholder="" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="block text-pos-text font-medium min-w-[130px] max-w-[130px]">{tr('control.finalTickets.thankText', 'Thank text:')}</label>
                <input type="text" value={finalTicketsThankText} onChange={(e) => setFinalTicketsThankText(e.target.value)} onFocus={() => setFinalTicketsActiveField('thankText')} className="px-4 min-w-[200px] max-w-[200px] py-3 bg-pos-panel h-[40px] border border-gray-300 rounded-lg text-gray-200" />
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex gap-2 items-center">
                <label className="block text-pos-text font-medium min-w-[180px] max-w-[180px]">{tr('control.finalTickets.proformaTicket', 'Proforma ticket:')}</label>
                <input type="checkbox" checked={finalTicketsProforma} onChange={(e) => setFinalTicketsProforma(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
              </div>
              <div className="flex gap-2 items-center">
                <label className="block text-pos-text font-medium min-w-[180px] max-w-[180px]">{tr('control.finalTickets.printPaymentType', 'Print payment type:')}</label>
                <input type="checkbox" checked={finalTicketsPrintPaymentType} onChange={(e) => setFinalTicketsPrintPaymentType(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
              </div>
              <div className="flex gap-2 items-center">
                <label className="block text-pos-text font-medium min-w-[180px] max-w-[180px]">{tr('control.finalTickets.ticketTearable', 'Ticket tearable:')}</label>
                <input type="checkbox" checked={finalTicketsTicketTearable} onChange={(e) => setFinalTicketsTicketTearable(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
              </div>
              <div className="flex gap-2 items-center">
                <label className="block text-pos-text font-medium min-w-[180px] max-w-[180px]">{tr('control.finalTickets.printLogo', 'Print logo:')}</label>
                <input type="checkbox" checked={finalTicketsPrintLogo} onChange={(e) => setFinalTicketsPrintLogo(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
              </div>
              <div className="flex items-center gap-3">
                <label className="block text-pos-text font-medium min-w-[180px] max-w-[180px] shrink-0">{tr('control.finalTickets.printingOrder', 'Printing order of ticket:')}</label>
                <Dropdown options={mapTranslatedOptions(PRINTING_ORDER_OPTIONS)} value={finalTicketsPrintingOrder} onChange={setFinalTicketsPrintingOrder} placeholder={tr('control.external.select', 'Select')} className="min-w-[150px]" />
              </div>
            </div>
          </div>
          <div className="flex justify-center pt-5 pb-5">
            <button type="button" className="flex items-center text-lg gap-4 px-6 py-3 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50" disabled={savingFinalTickets} onClick={handleSaveFinalTickets}>
              <svg fill="#ffffff" width="18px" height="18px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" /></svg>
              {tr('control.save', 'Save')}
            </button>
          </div>
          <div className="shrink-0">
            <SmallKeyboardWithNumpad value={finalTicketsKeyboardValue} onChange={finalTicketsKeyboardOnChange} />
          </div>
        </div>
      )}
      {printerTab === 'Production Tickets' && (
        <div className="relative min-h-[580px] rounded-xl border border-pos-border bg-pos-panel/30 p-4 pb-[60px]">
          <p className="text-pos-muted text-sm mb-4 max-w-4xl leading-snug">
            {tr(
              'control.printer.escPosKitchenHint',
              'Kitchen/production tickets print with larger type on serial/network ESC/POS. Windows printer queue uses plain text only.',
            )}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4 mb-6 text-sm">
            <div className="flex flex-col gap-4">
              <div className="flex gap-10 items-center"><label className="block text-pos-text font-medium min-w-[200px] max-w-[200px]">{tr('control.prodTickets.displayCategories', 'Display categories on production ticket:')}</label><input type="checkbox" checked={prodTicketsDisplayCategories} onChange={(e) => setProdTicketsDisplayCategories(e.target.checked)} className="w-5 h-5 rounded border-gray-300" /></div>
              <div className="flex gap-10 items-center"><label className="block text-pos-text font-medium min-w-[200px] max-w-[200px]">{tr('control.prodTickets.spaceAbove', 'Space above ticket:')}</label><input type="checkbox" checked={prodTicketsSpaceAbove} onChange={(e) => setProdTicketsSpaceAbove(e.target.checked)} className="w-5 h-5 rounded border-gray-300" /></div>
              <div className="flex gap-10 items-center"><label className="block text-pos-text font-medium min-w-[200px] max-w-[200px]">{tr('control.finalTickets.ticketTearable', 'Ticket tearable:')}</label><input type="checkbox" checked={prodTicketsTicketTearable} onChange={(e) => setProdTicketsTicketTearable(e.target.checked)} className="w-5 h-5 rounded border-gray-300" /></div>
              <div className="flex gap-10 items-center"><label className="block text-pos-text font-medium min-w-[200px] max-w-[200px]">{tr('control.prodTickets.keukenprinterBuzzer', 'Kitchen printer buzzer:')}</label><input type="checkbox" checked={prodTicketsKeukenprinterBuzzer} onChange={(e) => setProdTicketsKeukenprinterBuzzer(e.target.checked)} className="w-5 h-5 rounded border-gray-300" /></div>
              <div className="flex gap-10 items-center"><label className="block text-pos-text font-medium min-w-[200px] max-w-[200px]">{tr('control.prodTickets.productsIndividually', 'Print products individually:')}</label><input type="checkbox" checked={prodTicketsProductenIndividueel} onChange={(e) => setProdTicketsProductenIndividueel(e.target.checked)} className="w-5 h-5 rounded border-gray-300" /></div>
              <div className="flex gap-10 items-center"><label className="block text-pos-text font-medium min-w-[200px] max-w-[200px]">{tr('control.prodTickets.eatInTakeOutBottom', 'Print Eat in / Take out at bottom:')}</label><input type="checkbox" checked={prodTicketsEatInTakeOutOnderaan} onChange={(e) => setProdTicketsEatInTakeOutOnderaan(e.target.checked)} className="w-5 h-5 rounded border-gray-300" /></div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3"><label className="block text-pos-text font-medium min-w-[180px] max-w-[180px] shrink-0">{tr('control.prodTickets.nextCoursePrinter', 'Next course printer {n}:').replace('{n}', '1')}</label><Dropdown options={mapTranslatedOptions(productionTicketsPrinterOptions)} value={prodTicketsNextCoursePrinter1} onChange={setProdTicketsNextCoursePrinter1} placeholder={tr('control.external.disabled', 'Disabled')} className="min-w-[150px]" /></div>
              <div className="flex items-center gap-3"><label className="block text-pos-text font-medium min-w-[180px] max-w-[180px] shrink-0">{tr('control.prodTickets.nextCoursePrinter', 'Next course printer {n}:').replace('{n}', '2')}</label><Dropdown options={mapTranslatedOptions(productionTicketsPrinterOptions)} value={prodTicketsNextCoursePrinter2} onChange={setProdTicketsNextCoursePrinter2} placeholder={tr('control.external.disabled', 'Disabled')} className="min-w-[150px]" /></div>
              <div className="flex items-center gap-3"><label className="block text-pos-text font-medium min-w-[180px] max-w-[180px] shrink-0">{tr('control.prodTickets.nextCoursePrinter', 'Next course printer {n}:').replace('{n}', '3')}</label><Dropdown options={mapTranslatedOptions(productionTicketsPrinterOptions)} value={prodTicketsNextCoursePrinter3} onChange={setProdTicketsNextCoursePrinter3} placeholder={tr('control.external.disabled', 'Disabled')} className="min-w-[150px]" /></div>
              <div className="flex items-center gap-3"><label className="block text-pos-text font-medium min-w-[180px] max-w-[180px] shrink-0">{tr('control.prodTickets.nextCoursePrinter', 'Next course printer {n}:').replace('{n}', '4')}</label><Dropdown options={mapTranslatedOptions(productionTicketsPrinterOptions)} value={prodTicketsNextCoursePrinter4} onChange={setProdTicketsNextCoursePrinter4} placeholder={tr('control.external.disabled', 'Disabled')} className="min-w-[150px]" /></div>
              <div className="flex items-center gap-3"><label className="block text-pos-text font-medium min-w-[180px] max-w-[180px] shrink-0">{tr('control.prodTickets.printingOrder', 'Printing order of production ticket:')}</label><Dropdown options={mapTranslatedOptions(PRINTING_ORDER_OPTIONS)} value={prodTicketsPrintingOrder} onChange={setProdTicketsPrintingOrder} placeholder={tr('control.external.select', 'Select')} className="min-w-[150px]" /></div>
              <div className="flex items-center gap-3"><label className="block text-pos-text font-medium min-w-[180px] max-w-[180px] shrink-0">{tr('control.prodTickets.groupingReceipt', 'Grouping receipt:')}</label><Dropdown options={mapTranslatedOptions(GROUPING_RECEIPT_OPTIONS)} value={prodTicketsGroupingReceipt} onChange={setProdTicketsGroupingReceipt} placeholder={tr('control.external.select', 'Select')} className="min-w-[150px]" /></div>
              <div className="flex items-center gap-3"><label className="block text-pos-text font-medium min-w-[180px] max-w-[180px] shrink-0">{tr('control.prodTickets.transferPrinter', 'Transfer printer:')}</label><Dropdown options={mapTranslatedOptions(productionTicketsPrinterOptions)} value={prodTicketsPrinterOverboeken} onChange={setProdTicketsPrinterOverboeken} placeholder={tr('control.external.disabled', 'Disabled')} className="min-w-[150px]" /></div>
            </div>
          </div>
          <div className="flex justify-center pt-5 pb-5 text-md">
            <button type="button" className="flex items-center gap-4 px-6 py-2 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50" disabled={savingProdTickets} onClick={handleSaveProductionTickets}>
              <svg fill="#ffffff" width="14px" height="14px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" /></svg>
              {tr('control.save', 'Save')}
            </button>
          </div>
        </div>
      )}
      {printerTab === 'Labels' && (() => {
        const sortedLabels = [...labelsList].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        return (
          <div className="relative min-h-[580px] max-h-[580px] rounded-xl border border-pos-border bg-pos-panel/30 p-4 pb-[60px]">
            <div className="flex flex-wrap items-center justify-center w-full gap-4 mb-2">
              <Dropdown options={labelsTypeOptions} value={labelsType} onChange={(v) => saveLabelsSettings({ type: v })} placeholder={tr('control.labels.selectPlaceholder', 'Select')} className="text-sm min-w-[200px]" />
              <Dropdown options={labelsPrinterOptions} value={labelsPrinter} onChange={(v) => saveLabelsSettings({ printer: v })} placeholder={tr('control.labels.selectPrinter', 'Select printer')} className="text-sm min-w-[200px]" />
              <button type="button" className="px-6 py-3 rounded-lg text-sm font-medium bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 active:border-white/30 transition-colors disabled:opacity-50" onClick={openNewLabelModal}>
                {tr('control.labels.new', 'New label')}
              </button>
            </div>
            {sortedLabels.length === 0 ? (
              <ul className="w-full flex flex-col">
                <li className="text-pos-muted text-xl font-medium text-center py-4">{tr('control.labels.empty', 'No labels yet.')}</li>
              </ul>
            ) : (
              <>
                <div
                  ref={labelsListRef}
                  onScroll={updateLabelsScrollState}
                  className="max-h-[450px] overflow-y-auto rounded-lg [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                >
                  <ul className="w-full flex flex-col">
                    {sortedLabels.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center w-full justify-between px-4 py-2 bg-pos-bg border-y border-pos-panel text-pos-text text-sm"
                      >
                        <span className="flex-1 text-left font-medium">{item.sizeLabel || item.name || ''}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            className="p-2 mr-5 rounded text-pos-text active:bg-green-500"
                            onClick={() => openEditLabelModal(item)}
                            aria-label={tr('control.edit', 'Edit')}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button
                            type="button"
                            className="p-2 rounded text-pos-text active:text-rose-500"
                            onClick={() => setDeleteConfirmLabelId(item.id)}
                            aria-label={tr('delete', 'Delete')}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <PaginationArrows
                  canPrev={canLabelsScrollUp}
                  canNext={canLabelsScrollDown}
                  onPrev={() => scrollLabelsByPage('up')}
                  onNext={() => scrollLabelsByPage('down')}
                />
              </>
            )}
          </div>
        );
      })()}
      {printerTab !== 'General' && printerTab !== 'Final tickets' && printerTab !== 'Production Tickets' && printerTab !== 'Labels' && (
        <p className="text-pos-muted text-xl py-4">{tr('control.printerTabPlaceholder', 'Settings for "{tab}" will be available here.').replace('{tab}', printerTab)}</p>
      )}
    </div>
  );
}
