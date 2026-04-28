/** Map `/api/settings/device-settings` value ↔ webpanel Device settings UI (non–option-key fields). */

export type GeneralFormState = {
  subproducts: boolean;
  autoLogout: boolean;
  cashOff: boolean;
  openPrice: boolean;
  drawerOpen: boolean;
  timeout: number;
  fixedEdge: boolean;
  alwaysTop: boolean;
  askInvoice: boolean;
};

export type PrinterFormState = {
  group: boolean;
  errorScreen: boolean;
  vatTicket: boolean;
  defaultMode: "on" | "off";
  qrPrinter: string;
  zeroTicket: boolean;
  voucherMin: boolean;
};

export type OrdersWaitFormState = {
  confirm: boolean;
  barcode: boolean;
  customerChange: boolean;
  tableBook: boolean;
  fastName: boolean;
};

export type PlannedFormState = {
  printer: string;
  flow: string;
  load: string;
  mode: string;
  layout: string;
  settle: string;
  barcode: boolean;
  deliveryNote: boolean;
  newPrint: boolean;
  newPrintCustomer: boolean;
  autoPrint: boolean;
};

export function generalFromServer(v: Record<string, unknown>): GeneralFormState {
  return {
    subproducts: v.useSubproducts != null ? !!v.useSubproducts : true,
    autoLogout: !!v.autoLogoutAfterTransaction,
    cashOff: !!v.disableCashButtonInPayment,
    openPrice: !!v.openPriceWithoutPopup,
    drawerOpen: v.openCashDrawerAfterOrder != null ? !!v.openCashDrawerAfterOrder : true,
    timeout: Number(v.timeoutLogout) || 0,
    fixedEdge: !!v.fixedBorder,
    alwaysTop: v.alwaysOnTop != null ? !!v.alwaysOnTop : true,
    askInvoice: !!v.askInvoiceOrTicket,
  };
}

export function generalToServerPatch(s: GeneralFormState): Record<string, unknown> {
  return {
    useSubproducts: s.subproducts,
    autoLogoutAfterTransaction: s.autoLogout,
    disableCashButtonInPayment: s.cashOff,
    openPriceWithoutPopup: s.openPrice,
    openCashDrawerAfterOrder: s.drawerOpen,
    timeoutLogout: s.timeout,
    fixedBorder: s.fixedEdge,
    alwaysOnTop: s.alwaysTop,
    askInvoiceOrTicket: s.askInvoice,
  };
}

export function printerFromServer(v: Record<string, unknown>): PrinterFormState {
  const std = String(v.printerStandardMode || "enable");
  return {
    group: v.printerGroupingProducts != null ? !!v.printerGroupingProducts : true,
    errorScreen: v.printerShowErrorScreen != null ? !!v.printerShowErrorScreen : true,
    vatTicket: !!v.printerProductionMessageOnVat,
    defaultMode: std === "disable" ? "off" : "on",
    qrPrinter: v.printerQROrderPrinter != null && String(v.printerQROrderPrinter).trim() !== "" ? String(v.printerQROrderPrinter) : "disabled",
    zeroTicket: !!v.printerPrintZeroTickets,
    voucherMin: !!v.printerGiftVoucherAtMin,
  };
}

export function printerToServerPatch(s: PrinterFormState): Record<string, unknown> {
  return {
    printerGroupingProducts: s.group,
    printerShowErrorScreen: s.errorScreen,
    printerProductionMessageOnVat: s.vatTicket,
    printerStandardMode: s.defaultMode === "off" ? "disable" : "enable",
    printerQROrderPrinter: s.qrPrinter === "disabled" ? "" : s.qrPrinter,
    printerPrintZeroTickets: s.zeroTicket,
    printerGiftVoucherAtMin: s.voucherMin,
  };
}

export function ordersWaitFromServer(v: Record<string, unknown>): OrdersWaitFormState {
  return {
    confirm: !!v.ordersConfirmOnHold,
    barcode: !!v.ordersPrintBarcodeAfterCreate,
    customerChange: !!v.ordersCustomerCanBeModified,
    tableBook: !!v.ordersBookTableToWaiting,
    fastName: !!v.ordersFastCustomerName,
  };
}

export function ordersWaitToServerPatch(s: OrdersWaitFormState): Record<string, unknown> {
  return {
    ordersConfirmOnHold: s.confirm,
    ordersPrintBarcodeAfterCreate: s.barcode,
    ordersCustomerCanBeModified: s.customerChange,
    ordersBookTableToWaiting: s.tableBook,
    ordersFastCustomerName: s.fastName,
  };
}

export function plannedFromServer(v: Record<string, unknown>): PlannedFormState {
  const mode = String(v.scheduledMode || "labels");
  const settle = String(v.scheduledCheckoutAt || "delivery-note");
  return {
    printer: v.scheduledPrinter != null && String(v.scheduledPrinter).trim() !== "" ? String(v.scheduledPrinter) : "disabled",
    flow: String(v.scheduledProductionFlow || "scheduled-orders-print"),
    load: String(v.scheduledLoading ?? "0"),
    mode: mode === "list" ? "list" : "labels",
    layout: String(v.scheduledInvoiceLayout || "standard"),
    settle: settle === "order-date" ? "order-date" : "delivery-note",
    barcode: !!v.scheduledPrintBarcodeLabel,
    deliveryNote: !!v.scheduledDeliveryNoteToTurnover,
    newPrint: !!v.scheduledPrintProductionReceipt,
    newPrintCustomer: !!v.scheduledPrintCustomerProductionReceipt,
    autoPrint: !!v.scheduledWebOrderAutoPrint,
  };
}

export function plannedToServerPatch(s: PlannedFormState): Record<string, unknown> {
  return {
    scheduledPrinter: s.printer === "disabled" ? "" : s.printer,
    scheduledProductionFlow: s.flow,
    scheduledLoading: s.load,
    scheduledMode: s.mode === "list" ? "list" : "labels",
    scheduledInvoiceLayout: s.layout === "compact" ? "compact" : "standard",
    scheduledCheckoutAt: s.settle === "order-date" ? "order-date" : "delivery-note",
    scheduledPrintBarcodeLabel: s.barcode,
    scheduledDeliveryNoteToTurnover: s.deliveryNote,
    scheduledPrintProductionReceipt: s.newPrint,
    scheduledPrintCustomerProductionReceipt: s.newPrintCustomer,
    scheduledWebOrderAutoPrint: s.autoPrint,
  };
}
