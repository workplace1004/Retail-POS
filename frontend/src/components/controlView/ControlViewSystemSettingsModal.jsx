import React from 'react';
import { Dropdown } from '../Dropdown';
import { safeNumberInputValue } from './controlViewUtils';

const SYSTEM_SETTINGS_TABS = ['General', 'Prices', 'Ticket'];
const SYSTEM_SETTINGS_TAB_LABEL_KEYS = {
  General: 'control.systemSettingsTab.general',
  Prices: 'control.systemSettingsTab.prices',
  Ticket: 'control.systemSettingsTab.ticket'
};

const LEEGGOED_OPTIONS = [
  { value: 'by-customers-name', labelKey: 'control.sys.deposit.byCustomersName', fallback: 'By customers name' },
  { value: 'other', labelKey: 'control.sys.deposit.other', fallback: 'Other' }
];

const SAVINGS_DISCOUNT_OPTIONS = [
  { value: '', labelKey: 'control.external.disabled', fallback: 'Disabled' },
  { value: 'percentage', labelKey: 'control.sys.savings.percentage', fallback: 'Percentage' },
  { value: 'amount', labelKey: 'control.sys.savings.amount', fallback: 'Amount' }
];

const TICKET_VOUCHER_VALIDITY_OPTIONS = [
  { value: '1', labelKey: 'control.sys.voucher.month1', fallback: '1 month' },
  { value: '3', labelKey: 'control.sys.voucher.month3', fallback: '3 months' },
  { value: '6', labelKey: 'control.sys.voucher.month6', fallback: '6 months' },
  { value: '12', labelKey: 'control.sys.voucher.month12', fallback: '12 months' }
];

const TICKET_SCHEDULED_PRINT_MODE_OPTIONS = [
  { value: 'Production ticket', labelKey: 'control.sys.scheduledPrint.productionTicket', fallback: 'Production ticket' },
  { value: 'label-small', labelKey: 'control.sys.scheduledPrint.smallLabel', fallback: 'Small label' },
  { value: 'label-large', labelKey: 'control.sys.scheduledPrint.largeLabel', fallback: 'Large label' },
  { value: 'label-Production ticket + Small label', labelKey: 'control.sys.scheduledPrint.prodPlusSmall', fallback: 'Production ticket + Small label' },
  { value: 'Production ticket + Large label', labelKey: 'control.sys.scheduledPrint.prodPlusLarge', fallback: 'Production ticket + Large label' }
];

const TICKET_SCHEDULED_CUSTOMER_SORT_OPTIONS = [
  { value: 'as-registered', labelKey: 'control.external.asRegistered', fallback: 'As Registered' },
  { value: 'Alphabetical first name', labelKey: 'control.sys.customerSort.alphabeticalFirstName', fallback: 'Alphabetical first name' },
  { value: 'Alphabetical last name', labelKey: 'control.sys.customerSort.alphabeticalLastName', fallback: 'Alphabetical last name' }
];

const BARCODE_TYPE_OPTIONS = [
  { value: 'Code39', label: 'Code39' },
  { value: 'Code93', label: 'Code93' },
  { value: 'Code128', label: 'Code128' },
  { value: 'Interleaved2of5', label: 'Interleaved 2 of 5' }
];

const VAT_PERCENT_OPTIONS = [
  { value: '', label: '--' },
  { value: '0', label: '0%' },
  { value: '6', label: '6%' },
  { value: '9', label: '9%' },
  { value: '12', label: '12%' },
  { value: '21', label: '21%' }
];

export function ControlViewSystemSettingsModal({
  tr,
  mapTranslatedOptions,
  showSystemSettingsModal,
  closeSystemSettingsModal,
  systemSettingsTab,
  setSystemSettingsTab,
  priceGroups,
  savingSystemSettings,
  handleSaveSystemSettings,
  onSystemSettingsEdited,
  sysUseStockManagement,
  setSysUseStockManagement,
  sysUsePriceGroups,
  setSysUsePriceGroups,
  sysLoginWithoutCode,
  setSysLoginWithoutCode,
  sysCategorieenPerKassa,
  setSysCategorieenPerKassa,
  sysAutoAcceptQROrders,
  setSysAutoAcceptQROrders,
  sysQrOrdersAutomatischAfrekenen,
  setSysQrOrdersAutomatischAfrekenen,
  sysEnkelQROrdersKeukenscherm,
  setSysEnkelQROrdersKeukenscherm,
  sysAspect169Windows,
  setSysAspect169Windows,
  sysVatRateVariousProducts,
  setSysVatRateVariousProducts,
  sysArrangeProductsManually,
  setSysArrangeProductsManually,
  sysLimitOneUserPerTable,
  setSysLimitOneUserPerTable,
  sysOneWachtorderPerKlant,
  setSysOneWachtorderPerKlant,
  sysCashButtonVisibleMultiplePayment,
  setSysCashButtonVisibleMultiplePayment,
  sysUsePlaceSettings,
  setSysUsePlaceSettings,
  sysTegoedAutomatischInladen,
  setSysTegoedAutomatischInladen,
  sysNieuwstePrijsGebruiken,
  setSysNieuwstePrijsGebruiken,
  sysLeeggoedTerugname,
  setSysLeeggoedTerugname,
  sysKlantgegevensQRAfdrukken,
  setSysKlantgegevensQRAfdrukken,
  sysPriceTakeAway,
  setSysPriceTakeAway,
  sysPriceDelivery,
  setSysPriceDelivery,
  sysPriceCounterSale,
  setSysPriceCounterSale,
  sysPriceTableSale,
  setSysPriceTableSale,
  sysSavingsPointsPerEuro,
  setSysSavingsPointsPerEuro,
  sysSavingsPointsPerDiscount,
  setSysSavingsPointsPerDiscount,
  sysSavingsDiscount,
  setSysSavingsDiscount,
  sysBarcodeType,
  setSysBarcodeType,
  sysTicketVoucherValidity,
  setSysTicketVoucherValidity,
  sysTicketScheduledPrintMode,
  setSysTicketScheduledPrintMode,
  sysTicketScheduledCustomerSort,
  setSysTicketScheduledCustomerSort
}) {
  if (!showSystemSettingsModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="relative px-10 text-xl bg-pos-bg rounded-xl shadow-2xl w-full mx-4 overflow-hidden flex flex-col max-h-[90vh] min-h-[705px] max-h-[705px]"
        onClick={(e) => e.stopPropagation()}
        onChangeCapture={() => {
          if (typeof onSystemSettingsEdited === 'function') onSystemSettingsEdited();
        }}
      >
        <button type="button" className="absolute top-2 right-4 z-10 p-2 rounded text-pos-muted active:text-pos-text active:bg-green-500" onClick={closeSystemSettingsModal} aria-label="Close">
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div className="flex mt-10 mb-2 px-10 w-full justify-around text-xl shrink-0 overflow-x-auto">
          {SYSTEM_SETTINGS_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`px-4 pb-2 font-medium whitespace-nowrap border-b-2 transition-colors ${systemSettingsTab === tab ? 'border-blue-500 text-pos-text' : 'border-transparent text-pos-muted active:text-pos-text'} active:bg-green-500`}
              onClick={() => setSystemSettingsTab(tab)}
            >
              {tr(SYSTEM_SETTINGS_TAB_LABEL_KEYS[tab], tab)}
            </button>
          ))}
        </div>
        <div className="p-6 overflow-auto flex-1 text-sm">
          {systemSettingsTab === 'General' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="text-pos-text min-w-[270px] max-w-[270px]">{tr('control.sys.general.useStockManagement', 'Use of stock management:')}</span>
                  <input type="checkbox" checked={sysUseStockManagement} onChange={(e) => setSysUseStockManagement(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="text-pos-text min-w-[270px] max-w-[270px]">{tr('control.sys.general.usePriceGroups', 'Use of price groups:')}</span>
                  <input type="checkbox" checked={sysUsePriceGroups} onChange={(e) => setSysUsePriceGroups(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="text-pos-text min-w-[270px] max-w-[270px]">{tr('control.sys.general.loginWithoutCode', 'Log in without code:')}</span>
                  <input type="checkbox" checked={sysLoginWithoutCode} onChange={(e) => setSysLoginWithoutCode(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="text-pos-text min-w-[270px] max-w-[270px]">{tr('control.sys.general.categoriesPerRegister', 'Categories per register:')}</span>
                  <input type="checkbox" checked={sysCategorieenPerKassa} onChange={(e) => setSysCategorieenPerKassa(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="text-pos-text min-w-[270px] max-w-[270px]">{tr('control.sys.general.autoAcceptQROrders', 'Automatically accept QR orders:')}</span>
                  <input type="checkbox" checked={sysAutoAcceptQROrders} onChange={(e) => setSysAutoAcceptQROrders(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="text-pos-text min-w-[270px] max-w-[270px]">{tr('control.sys.general.qrOrdersAutoCheckout', 'QR orders auto checkout:')}</span>
                  <input type="checkbox" checked={sysQrOrdersAutomatischAfrekenen} onChange={(e) => setSysQrOrdersAutomatischAfrekenen(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="text-pos-text min-w-[270px] max-w-[270px]">{tr('control.sys.general.sendOnlyQROrdersToKitchen', 'Send only QR orders to kitchen screen:')}</span>
                  <input type="checkbox" checked={sysEnkelQROrdersKeukenscherm} onChange={(e) => setSysEnkelQROrdersKeukenscherm(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="text-pos-text min-w-[270px] max-w-[270px]">{tr('control.sys.general.aspect169Windows', '16:9 aspect (Windows):')}</span>
                  <input type="checkbox" checked={sysAspect169Windows} onChange={(e) => setSysAspect169Windows(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-pos-text min-w-[270px] max-w-[270px] shrink-0">{tr('control.sys.general.vatRateVariousProducts', 'VAT rate of various products:')}</span>
                  <Dropdown options={VAT_PERCENT_OPTIONS.filter((o) => o.value !== '')} value={sysVatRateVariousProducts} onChange={setSysVatRateVariousProducts} placeholder={tr('control.external.select', 'Select')} className="text-am min-w-[150px]" />
                </div>
              </div>
              <div className="flex flex-col gap-8">
                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="text-pos-text min-w-[270px] max-w-[270px]">{tr('control.sys.general.arrangeProductsManually', 'Arrange products manually:')}</span>
                  <input type="checkbox" checked={sysArrangeProductsManually} onChange={(e) => setSysArrangeProductsManually(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="text-pos-text min-w-[270px] max-w-[270px]">{tr('control.sys.general.limitOneUserPerTable', 'Limit one user per table:')}</span>
                  <input type="checkbox" checked={sysLimitOneUserPerTable} onChange={(e) => setSysLimitOneUserPerTable(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="text-pos-text min-w-[270px] max-w-[270px]">{tr('control.sys.general.oneWaitingOrderPerCustomer', 'One waiting order per customer:')}</span>
                  <input type="checkbox" checked={sysOneWachtorderPerKlant} onChange={(e) => setSysOneWachtorderPerKlant(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="text-pos-text min-w-[270px] max-w-[270px]">{tr('control.sys.general.cashButtonVisibleMultiplePayment', 'Cash button visible with multiple payment options:')}</span>
                  <input type="checkbox" checked={sysCashButtonVisibleMultiplePayment} onChange={(e) => setSysCashButtonVisibleMultiplePayment(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="text-pos-text min-w-[270px] max-w-[270px]">{tr('control.sys.general.usePlaceSettings', 'Use of place settings:')}</span>
                  <input type="checkbox" checked={sysUsePlaceSettings} onChange={(e) => setSysUsePlaceSettings(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="text-pos-text min-w-[270px] max-w-[270px]">{tr('control.sys.general.autoLoadCredit', 'Auto load credit:')}</span>
                  <input type="checkbox" checked={sysTegoedAutomatischInladen} onChange={(e) => setSysTegoedAutomatischInladen(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="text-pos-text min-w-[270px] max-w-[270px]">{tr('control.sys.general.useLatestPrice', 'Use latest price:')}</span>
                  <input type="checkbox" checked={sysNieuwstePrijsGebruiken} onChange={(e) => setSysNieuwstePrijsGebruiken(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-pos-text min-w-[270px] max-w-[270px] shrink-0">{tr('control.sys.general.depositReturn', 'Deposit return:')}</span>
                  <Dropdown options={mapTranslatedOptions(LEEGGOED_OPTIONS)} value={sysLeeggoedTerugname} onChange={setSysLeeggoedTerugname} placeholder={tr('control.external.select', 'Select')} className="min-w-[150px] max-w-[150px]" />
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="text-pos-text min-w-[270px] max-w-[270px]">{tr('control.sys.general.printCustomerDetailsOnQR', 'Print customer details on QR:')}</span>
                  <input type="checkbox" checked={sysKlantgegevensQRAfdrukken} onChange={(e) => setSysKlantgegevensQRAfdrukken(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                </label>
              </div>
            </div>
          )}
          {systemSettingsTab === 'Prices' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
              <div className="flex flex-col border border-gray-400 rounded-lg p-6 gap-8">
                <div className="flex items-center gap-10">
                  <span className="text-pos-text min-w-[150px] max-w-[150px] shrink-0">{tr('control.sys.prices.takeAwayMeals', 'Take-away meals of selected customer:')}</span>
                  <Dropdown
                    options={[{ value: '', label: '—' }, ...(priceGroups || []).sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((pg) => ({ value: pg.id, label: pg.name || pg.id }))]}
                    value={sysPriceTakeAway}
                    onChange={setSysPriceTakeAway}
                    placeholder={tr('control.external.select', 'Select')}
                    className="text-sm min-w-[150px]"
                  />
                </div>
                <div className="flex items-center gap-10">
                  <span className="text-pos-text min-w-[150px] max-w-[150px] shrink-0">{tr('control.sys.prices.deliveryOfCustomer', 'Delivery of selected customer:')}</span>
                  <Dropdown
                    options={[{ value: '', label: '—' }, ...(priceGroups || []).sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((pg) => ({ value: pg.id, label: pg.name || pg.id }))]}
                    value={sysPriceDelivery}
                    onChange={setSysPriceDelivery}
                    placeholder={tr('control.external.select', 'Select')}
                    className="text-sm min-w-[150px]"
                  />
                </div>
                <div className="flex items-center gap-10">
                  <span className="text-pos-text min-w-[150px] max-w-[150px] shrink-0">{tr('control.sys.prices.counterSale', 'Counter sale:')}</span>
                  <Dropdown
                    options={[{ value: '', label: '—' }, ...(priceGroups || []).sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((pg) => ({ value: pg.id, label: pg.name || pg.id }))]}
                    value={sysPriceCounterSale}
                    onChange={setSysPriceCounterSale}
                    placeholder={tr('control.external.select', 'Select')}
                    className="text-sm min-w-[150px]"
                  />
                </div>
                <div className="flex items-center gap-10">
                  <span className="text-pos-text min-w-[150px] max-w-[150px] shrink-0">{tr('control.sys.prices.tableSale', 'Table sale:')}</span>
                  <Dropdown
                    options={[{ value: '', label: '—' }, ...(priceGroups || []).sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((pg) => ({ value: pg.id, label: pg.name || pg.id }))]}
                    value={sysPriceTableSale}
                    onChange={setSysPriceTableSale}
                    placeholder={tr('control.external.select', 'Select')}
                    className="text-sm min-w-[150px]"
                  />
                </div>
              </div>
              <div className="flex flex-col border border-gray-400 rounded-lg p-6 gap-8">
                <p className="text-pos-text font-medium text-2xl flex justify-center items-center mb-5">{tr('control.sys.prices.customerSavingsCard', 'Customer savings card settings')}</p>
                <div className="flex items-center gap-3">
                  <span className="text-pos-text min-w-[150px] max-w-[150px] shrink-0">{tr('control.sys.prices.pointsPerEuro', 'Points / euro:')}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" className="p-1 px-3 rounded bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 text-3xl" onClick={() => setSysSavingsPointsPerEuro((n) => Math.max(0, n - 1))}>−</button>
                    <input type="number" min={0} value={safeNumberInputValue(sysSavingsPointsPerEuro, 0)} onChange={(e) => setSysSavingsPointsPerEuro(Number(e.target.value) || 0)} className="w-20 px-3 py-2 bg-pos-panel border border-pos-border rounded text-pos-text text-xl text-center" />
                    <button type="button" className="p-1 px-3 rounded bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 text-3xl" onClick={() => setSysSavingsPointsPerEuro((n) => n + 1)}>+</button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-pos-text min-w-[150px] max-w-[150px] shrink-0">{tr('control.sys.prices.pointsPerDiscount', 'Points / discount:')}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" className="p-1 px-3 rounded bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 text-3xl" onClick={() => setSysSavingsPointsPerDiscount((n) => Math.max(0, n - 1))}>−</button>
                    <input type="number" min={0} value={safeNumberInputValue(sysSavingsPointsPerDiscount, 0)} onChange={(e) => setSysSavingsPointsPerDiscount(Number(e.target.value) || 0)} className="w-20 px-3 py-2 bg-pos-panel border border-pos-border rounded text-pos-text text-xl text-center" />
                    <button type="button" className="p-1 px-3 rounded bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 text-3xl" onClick={() => setSysSavingsPointsPerDiscount((n) => n + 1)}>+</button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-pos-text min-w-[150px] max-w-[150px] shrink-0">{tr('control.sys.prices.discount', 'Discount:')}</span>
                  <Dropdown options={mapTranslatedOptions(SAVINGS_DISCOUNT_OPTIONS)} value={sysSavingsDiscount} onChange={setSysSavingsDiscount} placeholder={tr('control.external.disabled', 'Disabled')} className="text-sm min-w-[150px]" />
                </div>
              </div>
            </div>
          )}
          {systemSettingsTab === 'Ticket' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
              <div className="flex flex-col gap-8">
                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="text-pos-text min-w-[270px] max-w-[270px]">{tr('control.sys.ticket.askVatPrinter', 'Ask for VAT ticket printer:')}</span>
                  <input type="checkbox" checked={sysUsePlaceSettings} onChange={(e) => setSysUsePlaceSettings(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="text-pos-text min-w-[270px] max-w-[270px]">{tr('control.sys.ticket.productionPrinterCascade', 'Production printer cascade:')}</span>
                  <input type="checkbox" checked={sysTegoedAutomatischInladen} onChange={(e) => setSysTegoedAutomatischInladen(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="text-pos-text min-w-[270px] max-w-[270px]">{tr('control.sys.ticket.displaySubproductsWithoutPrice', 'Display sub-products without price on VAT ticket:')}</span>
                  <input type="checkbox" checked={sysNieuwstePrijsGebruiken} onChange={(e) => setSysNieuwstePrijsGebruiken(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="text-pos-text min-w-[270px] max-w-[270px]">{tr('control.sys.ticket.pricePerKiloPrints', 'Price per kilo prints:')}</span>
                  <input type="checkbox" checked={sysNieuwstePrijsGebruiken} onChange={(e) => setSysNieuwstePrijsGebruiken(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="text-pos-text min-w-[270px] max-w-[270px]">{tr('control.sys.ticket.printUnitPrice', 'Print unit price:')}</span>
                  <input type="checkbox" checked={sysKlantgegevensQRAfdrukken} onChange={(e) => setSysKlantgegevensQRAfdrukken(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-pos-text min-w-[270px] max-w-[270px] shrink-0">{tr('control.sys.ticket.typeBarcodeGenerated', 'Type barcode of generated barcode:')}</span>
                  <Dropdown options={BARCODE_TYPE_OPTIONS} value={sysBarcodeType} onChange={setSysBarcodeType} placeholder="Code39" className="text-sm min-w-[150px]" />
                </div>
              </div>
              <div className="flex flex-col gap-8">
                <div className="flex items-center gap-3">
                  <span className="text-pos-text min-w-[270px] max-w-[270px] shrink-0">{tr('control.sys.ticket.validityPeriodVoucher', 'Validity period voucher:')}</span>
                  <Dropdown options={mapTranslatedOptions(TICKET_VOUCHER_VALIDITY_OPTIONS)} value={sysTicketVoucherValidity} onChange={setSysTicketVoucherValidity} placeholder={tr('control.external.select', 'Select')} className="text-sm min-w-[150px]" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-pos-text min-w-[270px] max-w-[270px] shrink-0">{tr('control.sys.ticket.scheduledOrdersPrintMode', 'Scheduled orders print mode:')}</span>
                  <Dropdown options={mapTranslatedOptions(TICKET_SCHEDULED_PRINT_MODE_OPTIONS)} value={sysTicketScheduledPrintMode} onChange={setSysTicketScheduledPrintMode} placeholder={tr('control.external.select', 'Select')} className="text-sm min-w-[150px]" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-pos-text min-w-[270px] max-w-[270px] shrink-0">{tr('control.sys.ticket.scheduledOrdersCustomerSort', 'Scheduled orders customer sort:')}</span>
                  <Dropdown options={mapTranslatedOptions(TICKET_SCHEDULED_CUSTOMER_SORT_OPTIONS)} value={sysTicketScheduledCustomerSort} onChange={setSysTicketScheduledCustomerSort} placeholder={tr('control.external.select', 'Select')} className="text-sm min-w-[150px]" />
                </div>
              </div>
            </div>
          )}
          {systemSettingsTab !== 'General' && systemSettingsTab !== 'Prices' && systemSettingsTab !== 'Ticket' && (
            <p className="text-pos-muted text-xl py-4">Settings for “{systemSettingsTab}” will be available here.</p>
          )}
        </div>
        <div className="w-full flex items-center px-6 py-8 justify-center shrink-0">
          <button
            type="button"
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50 text-xl"
            disabled={savingSystemSettings}
            onClick={handleSaveSystemSettings}
          >
            <svg fill="currentColor" width="24" height="24" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" /></svg>
            {tr('control.save', 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
}
