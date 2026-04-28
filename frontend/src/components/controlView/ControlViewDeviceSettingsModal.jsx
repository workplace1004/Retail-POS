import React, { useLayoutEffect } from 'react';
import { Dropdown } from '../Dropdown';
import { safeNumberInputValue } from './controlViewUtils';

const DEVICE_SETTINGS_TABS = [
  'General',
  'Printer',
  'Category display',
  'Orders in waiting',
  'Scheduled orders',
  'Option buttons',
  'Function buttons'
];
const DEVICE_SETTINGS_TAB_LABEL_KEYS = {
  General: 'control.deviceSettingsTab.general',
  Printer: 'control.deviceSettingsTab.printer',
  'Category display': 'control.deviceSettingsTab.categoryDisplay',
  'Orders in waiting': 'control.deviceSettingsTab.ordersInWaiting',
  'Scheduled orders': 'control.deviceSettingsTab.scheduledOrders',
  'Option buttons': 'control.deviceSettingsTab.optionButtons',
  'Function buttons': 'control.deviceSettingsTab.functionButtons'
};

/** Kiosk greys these out; full POS control keeps them available. */
const DEVICE_SETTINGS_DISABLED_TABS = new Set();

const SCHEDULED_ORDERS_PRODUCTION_FLOW_OPTIONS = [
  { value: 'scheduled-orders-print', labelKey: 'control.device.scheduledOrders.scheduledOrdersPrint', fallback: 'Scheduled orders…' },
  { value: 'default', labelKey: 'control.device.scheduledOrders.default', fallback: 'Default' }
];

const SCHEDULED_ORDERS_LOADING_OPTIONS = [
  { value: '0', labelKey: 'control.device.scheduledOrders.daysAgo0', fallback: '0 days ago' },
  { value: '1', labelKey: 'control.device.scheduledOrders.daysAgo1', fallback: '1 day ago' },
  { value: '7', labelKey: 'control.device.scheduledOrders.daysAgo7', fallback: '7 days ago' },
  { value: '30', labelKey: 'control.device.scheduledOrders.daysAgo30', fallback: '30 days ago' }
];

const SCHEDULED_ORDERS_MODE_OPTIONS = [
  { value: 'labels', labelKey: 'control.device.scheduledOrders.labels', fallback: 'Labels' },
  { value: 'list', labelKey: 'control.device.scheduledOrders.list', fallback: 'List' }
];

const SCHEDULED_ORDERS_INVOICE_LAYOUT_OPTIONS = [
  { value: 'standard', labelKey: 'control.device.scheduledOrders.standard', fallback: 'Standard' },
  { value: 'compact', labelKey: 'control.device.scheduledOrders.compact', fallback: 'Compact' }
];

const SCHEDULED_ORDERS_CHECKOUT_AT_OPTIONS = [
  { value: 'delivery-note', labelKey: 'control.device.scheduledOrders.deliveryNote', fallback: 'Delivery note' },
  { value: 'order-date', labelKey: 'control.device.scheduledOrders.orderDate', fallback: 'Order date' }
];

const OPTION_BUTTON_SLOT_COUNT = 28;
const OPTION_BUTTON_LOCKED_ID = 'meer';
const FUNCTION_BUTTON_SLOT_COUNT = 4;


export function ControlViewDeviceSettingsModal(props) {
  const {
    tr,
    mapTranslatedOptions,
    vatOptions,
    printingOrderOptions,
    groupingReceiptOptions,
    showDeviceSettingsModal,
    closeDeviceSettingsModal,
    deviceSettingsTab,
    onSelectDeviceSettingsTab,
    printers,
    categories,
    categoriesLoading,
    savingDeviceSettings,
    handleSaveDeviceSettings,
    onDeviceSettingsEdited,
    optionButtonItems,
    functionButtonItems,
    optionButtonSlots,
    functionButtonSlots,
    getOptionButtonLabel,
    getFunctionButtonLabel,
    selectedOptionButtonSlotIndex,
    setSelectedOptionButtonSlotIndex,
    selectedOptionButtonPoolItemId,
    setSelectedOptionButtonPoolItemId,
    handleOptionButtonSlotClick,
    handleOptionButtonDragStartFromSlot,
    handleOptionButtonDropOnSlot,
    handleRemoveOptionButtonFromSlot,
    handleOptionButtonDragStart,
    selectedFunctionButtonSlotIndex,
    setSelectedFunctionButtonSlotIndex,
    selectedFunctionButtonPoolItemId,
    setSelectedFunctionButtonPoolItemId,
    handleFunctionButtonSlotClick,
    handleFunctionButtonDropOnSlot,
    handleRemoveFunctionButtonFromSlot,
    handleFunctionButtonDragStart,
    deviceUseSubproducts,
    setDeviceUseSubproducts,
    deviceAutoLogoutAfterTransaction,
    setDeviceAutoLogoutAfterTransaction,
    deviceAutoReturnToTablePlan,
    setDeviceAutoReturnToTablePlan,
    deviceDisableCashButtonInPayment,
    setDeviceDisableCashButtonInPayment,
    deviceOpenPriceWithoutPopup,
    setDeviceOpenPriceWithoutPopup,
    deviceOpenCashDrawerAfterOrder,
    setDeviceOpenCashDrawerAfterOrder,
    deviceAutoReturnToCounterSale,
    setDeviceAutoReturnToCounterSale,
    deviceAskSendToKitchen,
    setDeviceAskSendToKitchen,
    deviceCounterSaleVat,
    setDeviceCounterSaleVat,
    deviceTableSaleVat,
    setDeviceTableSaleVat,
    deviceTimeoutLogout,
    setDeviceTimeoutLogout,
    deviceFixedBorder,
    setDeviceFixedBorder,
    deviceAlwaysOnTop,
    setDeviceAlwaysOnTop,
    deviceAskInvoiceOrTicket,
    setDeviceAskInvoiceOrTicket,
    devicePrinterGroupingProducts,
    setDevicePrinterGroupingProducts,
    devicePrinterShowErrorScreen,
    setDevicePrinterShowErrorScreen,
    devicePrinterProductionMessageOnVat,
    setDevicePrinterProductionMessageOnVat,
    devicePrinterNextCourseOrder,
    setDevicePrinterNextCourseOrder,
    devicePrinterStandardMode,
    setDevicePrinterStandardMode,
    devicePrinterQROrderPrinter,
    setDevicePrinterQROrderPrinter,
    devicePrinterReprintWithNextCourse,
    setDevicePrinterReprintWithNextCourse,
    devicePrinterPrintZeroTickets,
    setDevicePrinterPrintZeroTickets,
    devicePrinterGiftVoucherAtMin,
    setDevicePrinterGiftVoucherAtMin,
    deviceCategoryDisplayIds,
    setDeviceCategoryDisplayIds,
    deviceOrdersConfirmOnHold,
    setDeviceOrdersConfirmOnHold,
    deviceOrdersPrintBarcodeAfterCreate,
    setDeviceOrdersPrintBarcodeAfterCreate,
    deviceOrdersCustomerCanBeModified,
    setDeviceOrdersCustomerCanBeModified,
    deviceOrdersBookTableToWaiting,
    setDeviceOrdersBookTableToWaiting,
    deviceOrdersFastCustomerName,
    setDeviceOrdersFastCustomerName,
    deviceScheduledPrinter,
    setDeviceScheduledPrinter,
    deviceScheduledProductionFlow,
    setDeviceScheduledProductionFlow,
    deviceScheduledLoading,
    setDeviceScheduledLoading,
    deviceScheduledMode,
    setDeviceScheduledMode,
    deviceScheduledInvoiceLayout,
    setDeviceScheduledInvoiceLayout,
    deviceScheduledCheckoutAt,
    setDeviceScheduledCheckoutAt,
    deviceScheduledPrintBarcodeLabel,
    setDeviceScheduledPrintBarcodeLabel,
    deviceScheduledDeliveryNoteToTurnover,
    setDeviceScheduledDeliveryNoteToTurnover,
    deviceScheduledPrintProductionReceipt,
    setDeviceScheduledPrintProductionReceipt,
    deviceScheduledPrintCustomerProductionReceipt,
    setDeviceScheduledPrintCustomerProductionReceipt,
    deviceScheduledWebOrderAutoPrint,
    setDeviceScheduledWebOrderAutoPrint
  } = props;

  useLayoutEffect(() => {
    if (!showDeviceSettingsModal) return;
    if (DEVICE_SETTINGS_DISABLED_TABS.has(deviceSettingsTab)) {
      onSelectDeviceSettingsTab('General');
    }
  }, [showDeviceSettingsModal, deviceSettingsTab, onSelectDeviceSettingsTab]);

  if (!showDeviceSettingsModal) return null;

  const assignedOptionButtonIds = new Set(optionButtonSlots.filter(Boolean));
  const unassignedOptionButtons = optionButtonItems.filter((item) => !assignedOptionButtonIds.has(item.id));
  const assignedFunctionButtonIds = new Set(functionButtonSlots.filter(Boolean));
  const hasSelectedRemovableOptionButton = Number.isInteger(selectedOptionButtonSlotIndex)
    && !!optionButtonSlots[selectedOptionButtonSlotIndex]
    && optionButtonSlots[selectedOptionButtonSlotIndex] !== OPTION_BUTTON_LOCKED_ID;
  const hasSelectedFunctionButton = Number.isInteger(selectedFunctionButtonSlotIndex)
    && !!functionButtonSlots[selectedFunctionButtonSlotIndex];

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="relative text-md bg-pos-bg rounded-xl shadow-2xl max-w-[1430px] h-[1000px] w-full mx-4 overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
            onChangeCapture={() => {
              if (typeof onDeviceSettingsEdited === 'function') onDeviceSettingsEdited();
            }}
          >
            <button type="button" className="absolute top-2 right-4 z-10 p-2 rounded text-pos-muted active:text-pos-text active:bg-green-500" onClick={closeDeviceSettingsModal} aria-label="Close">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="flex mt-16 mb-4 px-6 w-full justify-around text-md shrink-0 overflow-x-auto">
              {DEVICE_SETTINGS_TABS.map((tab) => {
                const disabled = DEVICE_SETTINGS_DISABLED_TABS.has(tab);
                return (
                  <button
                    key={tab}
                    type="button"
                    disabled={disabled}
                    className={`px-4 py-2 font-medium whitespace-nowrap border-b-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none ${deviceSettingsTab === tab ? 'border-blue-500 text-pos-text' : 'border-transparent text-pos-muted'} ${!disabled ? 'active:text-pos-text active:bg-green-500' : ''}`}
                    onClick={() => onSelectDeviceSettingsTab(tab)}
                  >
                    {tr(DEVICE_SETTINGS_TAB_LABEL_KEYS[tab], tab)}
                  </button>
                );
              })}
            </div>
            <div className="p-4 overflow-auto flex-1 ">
              {deviceSettingsTab === 'General' && (
                <div className="grid grid-cols-1 text-md md:grid-cols-2 gap-x-10 gap-y-4">
                  <div className="flex flex-col gap-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-pos-text min-w-[350px] max-w-[350px]">{tr('control.device.general.useSubproducts', 'Use of subproducts:')}</span>
                      <input type="checkbox" checked={deviceUseSubproducts} onChange={(e) => setDeviceUseSubproducts(e.target.checked)} className="w-9 h-9 rounded border-gray-300" />
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-pos-text min-w-[350px] max-w-[350px]">{tr('control.device.general.autoLogoutAfterTransaction', 'Automatically log out after transaction:')}</span>
                      <input type="checkbox" checked={deviceAutoLogoutAfterTransaction} onChange={(e) => setDeviceAutoLogoutAfterTransaction(e.target.checked)} className="w-9 h-9 rounded border-gray-300" />
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-pos-text min-w-[350px] max-w-[350px]">{tr('control.device.general.disableCashButton', 'Disable cash button in payment popup:')}</span>
                      <input type="checkbox" checked={deviceDisableCashButtonInPayment} onChange={(e) => setDeviceDisableCashButtonInPayment(e.target.checked)} className="w-9 h-9 rounded border-gray-300" />
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-pos-text min-w-[350px] max-w-[350px]">{tr('control.device.general.openPriceWithoutPopup', 'Open price without popup and without comma:')}</span>
                      <input type="checkbox" checked={deviceOpenPriceWithoutPopup} onChange={(e) => setDeviceOpenPriceWithoutPopup(e.target.checked)} className="w-9 h-9 rounded border-gray-300" />
                    </label>
                  </div>
                  <div className="flex flex-col gap-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-pos-text min-w-[270px] max-w-[270px] shrink-0">{tr('control.device.general.openCashDrawerAfterOrder', 'Open cash drawer after order:')}</span>
                      <input type="checkbox" checked={deviceOpenCashDrawerAfterOrder} onChange={(e) => setDeviceOpenCashDrawerAfterOrder(e.target.checked)} className="w-9 h-9 rounded border-gray-300" />
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-pos-text min-w-[270px] max-w-[270px]">{tr('control.device.general.autoReturnToCounterSale', 'Automatically return to counter sale:')}</span>
                      <input type="checkbox" checked={deviceAutoReturnToCounterSale} onChange={(e) => setDeviceAutoReturnToCounterSale(e.target.checked)} className="w-9 h-9 rounded border-gray-300" />
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-pos-text min-w-[270px] max-w-[270px]">{tr('control.device.general.askSendToKitchen', 'Ask to send to the kitchen screen:')}</span>
                      <input type="checkbox" checked={deviceAskSendToKitchen} onChange={(e) => setDeviceAskSendToKitchen(e.target.checked)} className="w-9 h-9 rounded border-gray-300" />
                    </label>
                    <div className="flex items-center gap-3">
                      <span className="text-pos-text min-w-[270px] max-w-[270px] shrink-0">{tr('control.device.general.counterSaleVat', 'Counter sale VAT:')}</span>
                      <Dropdown options={mapTranslatedOptions(vatOptions)} value={deviceCounterSaleVat} onChange={setDeviceCounterSaleVat} placeholder={tr('control.external.select', 'Select')} className="text-lg min-w-[150px]" />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-pos-text min-w-[270px] max-w-[270px] shrink-0">{tr('control.device.general.tableSaleVat', 'Table sale VAT:')}</span>
                      <Dropdown options={mapTranslatedOptions(vatOptions)} value={deviceTableSaleVat} onChange={setDeviceTableSaleVat} placeholder={tr('control.external.select', 'Select')} className="text-lg min-w-[150px]" />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-pos-text min-w-[270px] max-w-[270px] shrink-0">{tr('control.device.general.timeoutLogout', 'Timeout log out:')}</span>
                      <div className="flex items-center gap-2">
                        <button type="button" className="p-2 px-3 rounded bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 text-lg font-medium" onClick={() => setDeviceTimeoutLogout((n) => Math.max(0, n - 1))}>−</button>
                        <input type="number" min={0} value={safeNumberInputValue(deviceTimeoutLogout, 0)} onChange={(e) => setDeviceTimeoutLogout(Number(e.target.value) || 0)} className="w-16 px-2 py-2 bg-pos-panel border border-gray-300 rounded text-pos-text text-lg text-center h-[40px]" />
                        <button type="button" className="p-2 px-3 rounded bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 text-lg font-medium" onClick={() => setDeviceTimeoutLogout((n) => n + 1)}>+</button>
                      </div>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-pos-text min-w-[270px] max-w-[270px]">{tr('control.device.general.fixedBorder', 'Fixed edge: (Windows)')}</span>
                      <input type="checkbox" checked={deviceFixedBorder} onChange={(e) => setDeviceFixedBorder(e.target.checked)} className="w-9 h-9 rounded border-gray-300" />
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-pos-text min-w-[270px] max-w-[270px]">{tr('control.device.general.alwaysOnTop', 'Always in the foreground: (Windows)')}</span>
                      <input type="checkbox" checked={deviceAlwaysOnTop} onChange={(e) => setDeviceAlwaysOnTop(e.target.checked)} className="w-9 h-9 rounded border-gray-300" />
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-3 cursor-pointer shrink-0">
                        <span className="text-pos-text min-w-[270px] max-w-[270px]">{tr('control.device.general.askInvoiceOrTicket', 'Ask a question about an invoice or ticket')}</span>
                        <input type="checkbox" checked={deviceAskInvoiceOrTicket} onChange={(e) => setDeviceAskInvoiceOrTicket(e.target.checked)} className="w-9 h-9 rounded border-gray-300" />
                      </label>
                      <Dropdown options={[{ value: '-', label: '-' }]} value="-" onChange={() => { }} placeholder="-" className="text-lg min-w-[120px] opacity-60 pointer-events-none" disabled />
                    </div>
                  </div>
                </div>
              )}
              {deviceSettingsTab === 'Printer' && (
                <div className="grid grid-cols-1 text-md md:grid-cols-2 gap-x-10 gap-y-4">
                  <div className="flex flex-col gap-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-pos-text min-w-[270px] max-w-[270px]">{tr('control.device.printer.groupingProducts', 'Grouping products on the ticket:')}</span>
                      <input type="checkbox" checked={devicePrinterGroupingProducts} onChange={(e) => setDevicePrinterGroupingProducts(e.target.checked)} className="w-9 h-9 rounded border-gray-300" />
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-pos-text min-w-[270px] max-w-[270px]">{tr('control.device.printer.displayErrorScreen', 'Display error screen on printer error:')}</span>
                      <input type="checkbox" checked={devicePrinterShowErrorScreen} onChange={(e) => setDevicePrinterShowErrorScreen(e.target.checked)} className="w-9 h-9 rounded border-gray-300" />
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-pos-text min-w-[270px] max-w-[270px]">{tr('control.device.printer.printProductionOnVat', 'Print production message on VAT ticket:')}</span>
                      <input type="checkbox" checked={devicePrinterProductionMessageOnVat} onChange={(e) => setDevicePrinterProductionMessageOnVat(e.target.checked)} className="w-9 h-9 rounded border-gray-300" />
                    </label>
                    <div className="flex items-center gap-3">
                      <span className="text-pos-text min-w-[270px] max-w-[270px] shrink-0">{tr('control.device.printer.nextCourseOrder', 'Next course order:')}</span>
                      <Dropdown options={mapTranslatedOptions(printingOrderOptions)} value={devicePrinterNextCourseOrder} onChange={setDevicePrinterNextCourseOrder} placeholder={tr('control.external.asRegistered', 'As Registered')} className="text-lg min-w-[150px] max-w-[150px]" />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-pos-text min-w-[270px] max-w-[270px] shrink-0">{tr('control.device.printer.standardModeTicket', 'Standard mode ticket printing:')}</span>
                      <Dropdown options={mapTranslatedOptions(groupingReceiptOptions)} value={devicePrinterStandardMode} onChange={setDevicePrinterStandardMode} placeholder={tr('control.external.enable', 'Enable')} className="text-lg min-w-[150px] max-w-[150px]" />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-pos-text min-w-[270px] max-w-[270px] shrink-0">{tr('control.device.printer.qrOrderPrinter', 'QR order printer:')}</span>
                      <Dropdown
                        options={[{ value: '', label: tr('control.external.disabled', 'Disabled') }, ...printers.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((p) => ({ value: p.id, label: p.name }))]}
                        value={devicePrinterQROrderPrinter}
                        onChange={setDevicePrinterQROrderPrinter}
                        placeholder={tr('control.external.selectPrinter', 'Select printer')}
                        className="text-lg min-w-[150px] max-w-[150px]"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-8">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-pos-text  min-w-[300px] max-w-[300px]">{tr('control.device.printer.reprintWithNextCourse', 'Reprint products with next course:')}</span>
                      <input type="checkbox" checked={devicePrinterReprintWithNextCourse} onChange={(e) => setDevicePrinterReprintWithNextCourse(e.target.checked)} className="w-9 h-9 rounded border-gray-300" />
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-pos-text  min-w-[300px] max-w-[300px]">{tr('control.device.printer.printZeroTickets', 'Print 0 euro tickets:')}</span>
                      <input type="checkbox" checked={devicePrinterPrintZeroTickets} onChange={(e) => setDevicePrinterPrintZeroTickets(e.target.checked)} className="w-9 h-9 rounded border-gray-300" />
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-pos-text  min-w-[300px] max-w-[300px]">{tr('control.device.printer.printGiftVoucherAtMin', 'Print gift voucher at minimum amount:')}</span>
                      <input type="checkbox" checked={devicePrinterGiftVoucherAtMin} onChange={(e) => setDevicePrinterGiftVoucherAtMin(e.target.checked)} className="w-9 h-9 rounded border-gray-300" />
                    </label>
                  </div>
                </div>
              )}
              {deviceSettingsTab === 'Category display' && (
                <div className="grid grid-cols-1 text-md px-4 md:grid-cols-3 lg:grid-cols-4 gap-x-10 gap-4">
                  {categoriesLoading ? (
                    <p className="text-pos-muted text-xl col-span-full">{tr('control.device.category.loading', 'Loading categories…')}</p>
                  ) : (
                    categories.map((cat) => {
                      const isChecked = deviceCategoryDisplayIds.length === 0 || deviceCategoryDisplayIds.includes(cat.id);
                      return (
                        <label key={cat.id} className="flex items-center gap-5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setDeviceCategoryDisplayIds((prev) => {
                                const allIds = categories.map((c) => c.id);
                                if (prev.length === 0) return allIds.filter((id) => id !== cat.id);
                                if (prev.includes(cat.id)) return prev.filter((id) => id !== cat.id);
                                return [...prev, cat.id];
                              });
                            }}
                            className="w-9 h-9 rounded border-gray-300"
                          />
                          <span className="text-pos-text  min-w-[150px] max-w-[150px] truncate">{cat.name || cat.id}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              )}
              {deviceSettingsTab === 'Orders in waiting' && (
                <div className="grid px-4 grid-cols-1 text-md md:grid-cols-2 gap-x-10 gap-y-4">
                  <div className="flex flex-col gap-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-pos-text min-w-[300px] max-w-[300px]">{tr('control.device.orders.confirmOnHold', 'Confirm on hold orders:')}</span>
                      <input type="checkbox" checked={deviceOrdersConfirmOnHold} onChange={(e) => setDeviceOrdersConfirmOnHold(e.target.checked)} className="w-9 h-9 rounded border-gray-300" />
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-pos-text min-w-[300px] max-w-[300px]">{tr('control.device.orders.printBarcodeAfterCreate', 'Print barcode ticket after order creation:')}</span>
                      <input type="checkbox" checked={deviceOrdersPrintBarcodeAfterCreate} onChange={(e) => setDeviceOrdersPrintBarcodeAfterCreate(e.target.checked)} className="w-9 h-9 rounded border-gray-300" />
                    </label>
                  </div>
                  <div className="flex flex-col gap-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-pos-text min-w-[330px] max-w-[330px] shrink-0">{tr('control.device.orders.customerCanBeModified', 'Customer on hold order can be modified:')}</span>
                      <input type="checkbox" checked={deviceOrdersCustomerCanBeModified} onChange={(e) => setDeviceOrdersCustomerCanBeModified(e.target.checked)} className="w-9 h-9 rounded border-gray-300" />
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-pos-text min-w-[330px] max-w-[330px]">{tr('control.device.orders.bookTableToWaiting', 'Book table to waiting order:')}</span>
                      <input type="checkbox" checked={deviceOrdersBookTableToWaiting} onChange={(e) => setDeviceOrdersBookTableToWaiting(e.target.checked)} className="w-9 h-9 rounded border-gray-300" />
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-pos-text min-w-[330px] max-w-[330px]">{tr('control.device.orders.fastCustomerName', 'Fast customer name on hold orders:')}</span>
                      <input type="checkbox" checked={deviceOrdersFastCustomerName} onChange={(e) => setDeviceOrdersFastCustomerName(e.target.checked)} className="w-9 h-9 rounded border-gray-300" />
                    </label>
                  </div>
                </div>
              )}
              {deviceSettingsTab === 'Scheduled orders' && (
                <div className="grid grid-cols-1 text-lg md:grid-cols-2 px-4 gap-x-10 gap-y-4">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-5">
                      <span className="text-pos-text min-w-[270px] max-w-[270px] shrink-0">{tr('control.device.scheduled.printer', 'Scheduled orders printer:')}</span>
                      <Dropdown
                        options={[{ value: '', label: tr('control.external.disabled', 'Disabled') }, ...printers.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((p) => ({ value: p.id, label: p.name }))]}
                        value={deviceScheduledPrinter}
                        onChange={setDeviceScheduledPrinter}
                        placeholder={tr('control.external.selectPrinter', 'Select printer')}
                        className="text-lg min-w-[150px] max-w-[150px]"
                      />
                    </div>
                    <div className="flex items-center gap-5">
                      <span className="text-pos-text min-w-[270px] max-w-[270px] shrink-0">{tr('control.device.scheduled.productionFlow', 'Scheduled orders production ticket flow:')}</span>
                      <Dropdown options={mapTranslatedOptions(SCHEDULED_ORDERS_PRODUCTION_FLOW_OPTIONS)} value={deviceScheduledProductionFlow} onChange={setDeviceScheduledProductionFlow} placeholder={tr('control.external.select', 'Select')} className="text-lg min-w-[150px] max-w-[150px]" />
                    </div>
                    <div className="flex items-center gap-5">
                      <span className="text-pos-text min-w-[270px] max-w-[270px] shrink-0">{tr('control.device.scheduled.loading', 'Scheduled orders loading:')}</span>
                      <Dropdown options={mapTranslatedOptions(SCHEDULED_ORDERS_LOADING_OPTIONS)} value={deviceScheduledLoading} onChange={setDeviceScheduledLoading} placeholder={tr('control.external.select', 'Select')} className="text-lg min-w-[150px] max-w-[150px]" />
                    </div>
                    <div className="flex items-center gap-5">
                      <span className="text-pos-text min-w-[270px] max-w-[270px] shrink-0">{tr('control.device.scheduled.mode', 'Scheduled order mode:')}</span>
                      <Dropdown options={mapTranslatedOptions(SCHEDULED_ORDERS_MODE_OPTIONS)} value={deviceScheduledMode} onChange={setDeviceScheduledMode} placeholder={tr('control.external.select', 'Select')} className="text-lg min-w-[150px] max-w-[150px]" />
                    </div>
                    <div className="flex items-center gap-5">
                      <span className="text-pos-text min-w-[270px] max-w-[270px] shrink-0">{tr('control.device.scheduled.invoiceLayout', 'Scheduled order invoice layout:')}</span>
                      <Dropdown options={mapTranslatedOptions(SCHEDULED_ORDERS_INVOICE_LAYOUT_OPTIONS)} value={deviceScheduledInvoiceLayout} onChange={setDeviceScheduledInvoiceLayout} placeholder={tr('control.external.select', 'Select')} className="text-lg min-w-[150px] max-w-[150px]" />
                    </div>
                    <div className="flex items-center gap-5">
                      <span className="text-pos-text min-w-[270px] max-w-[270px] shrink-0">{tr('control.device.scheduled.checkoutAt', 'Scheduled order checkout at:')}</span>
                      <Dropdown options={mapTranslatedOptions(SCHEDULED_ORDERS_CHECKOUT_AT_OPTIONS)} value={deviceScheduledCheckoutAt} onChange={setDeviceScheduledCheckoutAt} placeholder={tr('control.external.select', 'Select')} className="text-lg min-w-[150px] max-w-[150px]" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-pos-text min-w-[350px] max-w-[350px] shrink-0">{tr('control.device.scheduled.printLabel', 'Print barcode label:')}</span>
                      <input type="checkbox" checked={deviceScheduledPrintBarcodeLabel} onChange={(e) => setDeviceScheduledPrintBarcodeLabel(e.target.checked)} className="w-9 h-9 rounded border-gray-300" />
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-pos-text min-w-[350px] max-w-[350px]">{tr('control.device.scheduled.deliveryNoteToTurnover', 'Add delivery note to turnover when printing:')}</span>
                      <input type="checkbox" checked={deviceScheduledDeliveryNoteToTurnover} onChange={(e) => setDeviceScheduledDeliveryNoteToTurnover(e.target.checked)} className="w-9 h-9 rounded border-gray-300" />
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-pos-text min-w-[350px] max-w-[350px]">{tr('control.device.scheduled.printProductionReceipt', 'When new planning order print production receipt:')}</span>
                      <input type="checkbox" checked={deviceScheduledPrintProductionReceipt} onChange={(e) => setDeviceScheduledPrintProductionReceipt(e.target.checked)} className="w-9 h-9 rounded border-gray-300" />
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-pos-text min-w-[350px] max-w-[350px]">{tr('control.device.scheduled.printCustomerProductionReceipt', 'When new planning order print customer production receipt:')}</span>
                      <input type="checkbox" checked={deviceScheduledPrintCustomerProductionReceipt} onChange={(e) => setDeviceScheduledPrintCustomerProductionReceipt(e.target.checked)} className="w-9 h-9 rounded border-gray-300" />
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-pos-text min-w-[350px] max-w-[350px]">{tr('control.device.scheduled.webOrderAutoPrint', 'Automatically print scheduled web order production slip:')}</span>
                      <input type="checkbox" checked={deviceScheduledWebOrderAutoPrint} onChange={(e) => setDeviceScheduledWebOrderAutoPrint(e.target.checked)} className="w-9 h-9 rounded border-gray-300" />
                    </label>
                  </div>
                </div>
              )}
              {deviceSettingsTab === 'Option buttons' && (
                <div className="px-4 py-2">
                  <div className="mx-auto max-w-[1000px] flex gap-8">
                    <div className="flex-1 border border-[#aeb3bf] bg-[#d7d8de] px-3 py-5">
                      <div className="grid grid-cols-7 gap-3">
                        {Array.from({ length: OPTION_BUTTON_SLOT_COUNT }).map((_, slotIndex) => {
                          const assignedId = optionButtonSlots[slotIndex];
                          const assignedLabel = getOptionButtonLabel(assignedId);
                          const isSelected = selectedOptionButtonSlotIndex === slotIndex;
                          return (
                            <button
                              key={`option-slot-${slotIndex}`}
                              type="button"
                              draggable={!!assignedId && assignedId !== OPTION_BUTTON_LOCKED_ID}
                              onDragStart={(event) => handleOptionButtonDragStartFromSlot(event, slotIndex)}
                              onClick={() => handleOptionButtonSlotClick(slotIndex)}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) => handleOptionButtonDropOnSlot(event, slotIndex)}
                              className={`h-[74px] max-w-[70px] min-w-[70px] border px-2 text-center text-[12px] leading-[1.2] whitespace-pre-line transition-colors ${assignedId ? 'bg-[#b7b9c2] text-[#31353d]' : 'bg-[#dde0e7] text-transparent'
                                } ${isSelected ? 'border-blue-500' : 'border-[#bcc0ca]'} active:brightness-95`}
                            >
                              {assignedLabel || ' '}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-10 text-center">
                        <button
                          type="button"
                          onClick={handleRemoveOptionButtonFromSlot}
                          disabled={!hasSelectedRemovableOptionButton}
                          className={`text-[20px] ${hasSelectedRemovableOptionButton
                            ? 'text-[#858d99] active:text-[#5c6370]'
                            : 'text-[#9ca3af] opacity-60 cursor-not-allowed'
                            } active:bg-green-500`}
                        >
                          {tr('control.optionButtons.removeFromPlace', 'Remove from place')}
                        </button>
                      </div>
                    </div>
                    <div className="w-[380px] border border-[#aeb3bf] bg-[#d7d8de] px-6 py-5 flex flex-col">
                      <div className="flex-1 min-h-[360px] max-h-[360px] overflow-y-auto space-y-4 text-center pr-1 [scrollbar-width:thin] [scrollbar-color:#6b7289_#c5c8d0] [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-[#c5c8d0] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border [&::-webkit-scrollbar-thumb]:border-[#b7b9c2] [&::-webkit-scrollbar-thumb]:bg-[#6b7289] hover:[&::-webkit-scrollbar-thumb]:bg-[#5d6478] active:[&::-webkit-scrollbar-thumb]:bg-[#4f5566]">
                        {unassignedOptionButtons.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            draggable
                            onDragStart={(event) => handleOptionButtonDragStart(event, item.id)}
                            onClick={() => {
                              setSelectedOptionButtonPoolItemId(item.id);
                              setSelectedOptionButtonSlotIndex(null);
                            }}
                            className={`w-full text-[14px] min-w-[250px] leading-[1.15] whitespace-pre-line text-[#4a505c] active:text-[#2e333c] cursor-grab active:cursor-grabbing ${selectedOptionButtonPoolItemId === item.id ? 'text-rose-500' : ''}`}
                          >
                            {tr(item.labelKey, item.fallbackLabel)}
                          </button>
                        ))}
                        {unassignedOptionButtons.length === 0 ? (
                          <div className="text-[20px] text-[#8a919e]">-</div>
                        ) : null}
                      </div>
                      <div className="pt-4 flex items-center justify-around text-[18px] text-[#596170]">
                        <span aria-hidden>↑</span>
                        <span aria-hidden>↓</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {deviceSettingsTab === 'Function buttons' && (
                <div className="px-8 py-2">
                  <div className="mx-auto rounded-sm bg-[#7f7f84] p-3">
                    <div className="grid grid-cols-4 gap-6">
                      {Array.from({ length: FUNCTION_BUTTON_SLOT_COUNT }).map((_, slotIndex) => {
                        const assignedId = functionButtonSlots[slotIndex];
                        const assignedLabel = getFunctionButtonLabel(assignedId);
                        const isSelected = selectedFunctionButtonSlotIndex === slotIndex;
                        return (
                          <button
                            key={`function-slot-${slotIndex}`}
                            type="button"
                            onClick={() => handleFunctionButtonSlotClick(slotIndex)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => handleFunctionButtonDropOnSlot(event, slotIndex)}
                            className={`h-[40px] border bg-transparent text-md text-white transition-colors ${isSelected ? 'border-blue-400' : 'border-[#a8a8ad]'
                              } active:bg-green-500`}
                          >
                            {assignedLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mx-auto mt-5 max-w-[1030px] border border-[#9d9da3] bg-transparent py-3">
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={handleRemoveFunctionButtonFromSlot}
                        disabled={!hasSelectedFunctionButton}
                        className={`text-xl ${hasSelectedFunctionButton
                          ? 'text-[#8e959d] active:text-[#b2b8be]'
                          : 'text-[#646d76] opacity-50 cursor-not-allowed'
                          } active:bg-green-500`}
                      >
                        {tr('control.functionButtons.removeFromPlace', 'Remove from place')}
                      </button>
                    </div>
                    <div className="mt-4 space-y-5 text-center flex flex-col">
                      {functionButtonItems.filter((item) => !assignedFunctionButtonIds.has(item.id)).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          draggable
                          onDragStart={(event) => handleFunctionButtonDragStart(event, item.id)}
                          onClick={() => {
                            setSelectedFunctionButtonPoolItemId(item.id);
                            setSelectedFunctionButtonSlotIndex(null);
                          }}
                          className={`text-xl text-gray active:text-[#4b5d68] cursor-grab active:cursor-grabbing ${selectedFunctionButtonPoolItemId === item.id ? 'text-rose-500' : ''}`}
                        >
                          {tr(item.labelKey, item.fallbackLabel)}
                        </button>
                      ))}
                      {functionButtonItems.filter((item) => !assignedFunctionButtonIds.has(item.id)).length === 0 ? (
                        <div className="text-xl text-[#54616b]">-</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
              {deviceSettingsTab !== 'General' && deviceSettingsTab !== 'Printer' && deviceSettingsTab !== 'Category display' && deviceSettingsTab !== 'Orders in waiting' && deviceSettingsTab !== 'Scheduled orders' && deviceSettingsTab !== 'Option buttons' && deviceSettingsTab !== 'Function buttons' && (
                <p className="text-pos-muted text-xl py-4">Settings for “{deviceSettingsTab}” will be available here.</p>
              )}
            </div>
            <div className="w-full flex items-center px-4 pt-5 pb-5 justify-center shrink-0">
              <button
                type="button"
                className="flex items-center text-lg gap-4 px-6 py-3 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50"
                disabled={savingDeviceSettings}
                onClick={handleSaveDeviceSettings}
              >
                <svg fill="#ffffff" width="18px" height="18px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" /></svg>
                {tr('control.save', 'Save')}
              </button>
            </div>
          </div>
        </div>
  );
}
