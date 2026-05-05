import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Dropdown } from '../Dropdown';
import { KeyboardWithNumpad } from '../KeyboardWithNumpad';
import { SmallKeyboardWithNumpad } from '../SmallKeyboardWithNumpad';
import { PaginationArrows } from '../PaginationArrows';
import { ControlViewCategoriesProductsContent } from './ControlViewCategoriesProductsContent';
import { ControlViewExternalSimpleDevices } from './ControlViewExternalSimpleDevices';
import { ControlViewCashmatic } from './ControlViewCashmatic';
import { ControlViewPayworld } from './ControlViewPayworld';
import { ControlViewBancontactPro } from './ControlViewBancontactPro';
import { ControlViewWorldlineCtep } from './ControlViewWorldlineCtep';
import { ControlViewCcv } from './ControlViewCcv';
import { ControlViewExternalPrinter } from './ControlViewExternalPrinter';
import { TopNavIcon, ReportTabIcon } from './controlViewNavIcons';
import {
  closeFinancialZReport,
  fetchFinancialPeriod,
  fetchFinancialXReport,
  fetchUserReport,
  fetchZReportHistory,
  fetchZReportReceiptLines,
} from '../../lib/financialReportsApi.js';
import { printPeriodicReportLines, splitPeriodicReportBodyIntoChunks } from '../../lib/periodicReportDisplay.js';
import { POS_API_PREFIX as API } from '../../lib/apiOrigin.js';
import { ReportPrintErrorModal } from './ReportPrintErrorModal.jsx';
import * as XLSX from 'xlsx';

function ReportPrintSpinner({ className = 'w-4 h-4' }) {
  return (
    <svg className={`${className} animate-spin shrink-0`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.35" strokeWidth="3" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function ddMmYyyyToDateInput(value) {
  const m = String(value || '').trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return '';
  const dd = m[1].padStart(2, '0');
  const mm = m[2].padStart(2, '0');
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

function dateInputToDdMmYyyy(value) {
  const m = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

const IMPORT_EXPORT_DATASET_OPTIONS = [
  { value: 'priceGroups', label: 'Price Groups' },
  { value: 'categories', label: 'Categories' },
  { value: 'products', label: 'Products' },
  { value: 'subproducts', label: 'Subproducts' },
  { value: 'discounts', label: 'Discounts' },
  { value: 'kitchens', label: 'Kitchen' },
];

export function ControlViewMainContentArea({ ctx }) {
  const [reportPrintErrorMessage, setReportPrintErrorMessage] = useState(null);
  const [reportPrintBusy, setReportPrintBusy] = useState(null);
  const {
    BARCODE_SCANNER_TYPE_OPTIONS,
    CASH_REGISTER_SUB_NAV_ITEMS,
    EXTERNAL_DEVICES_SUB_NAV_ITEMS,
    GROUPING_RECEIPT_OPTIONS,
    LANGUAGE_OPTIONS,
    PERIODIC_REPORT_TIME_OPTIONS,
    PRICE_DISPLAY_TYPE_OPTIONS,
    PRINTERS_PAGE_SIZE,
    PRINTER_TAB_DEFS,
    PRINTING_ORDER_OPTIONS,
    REPORT_GENERATE_UNTIL_OPTIONS,
    REPORT_SETTINGS_ROWS,
    REPORT_TABS,
    RFID_READER_TYPE_OPTIONS,
    SCALE_CONNECTION_MODE_OPTIONS,
    SCALE_PORT_OPTIONS,
    SCALE_TYPE_OPTIONS,
    SUB_NAV_ITEMS,
    TOP_NAV_ITEMS,
    appLanguage,
    barcodeScannerType,
    canCategoriesScrollDown,
    canCategoriesScrollUp,
    canDiscountsScrollDown,
    canDiscountsScrollUp,
    canKitchenScrollDown,
    canKitchenScrollUp,
    canLabelsScrollDown,
    canLabelsScrollUp,
    canPaymentTypesScrollDown,
    canPaymentTypesScrollUp,
    canPriceGroupsScrollDown,
    canPriceGroupsScrollUp,
    canProductsScrollDown,
    canProductsScrollUp,
    canSubproductsScrollDown,
    canSubproductsScrollUp,
    canUsersScrollDown,
    canUsersScrollUp,
    cashmaticConnectionType,
    cashmaticIpAddress,
    cashmaticName,
    cashmaticPassword,
    cashmaticPort,
    cashmaticUrl,
    cashmaticUsername,
    cashmaticKeyboardOnChange,
    cashmaticKeyboardValue,
    categories,
    categoriesListRef,
    categoriesLoading,
    controlSidebarId,
    currentRegisterId,
    currentRegisterName,
    realtimeSocket,
    currentUser,
    discounts,
    discountsListRef,
    finalTicketsCompanyData1,
    finalTicketsCompanyData2,
    finalTicketsCompanyData3,
    finalTicketsCompanyData4,
    finalTicketsCompanyData5,
    finalTicketsPrintLogo,
    finalTicketsPrintPaymentType,
    finalTicketsPrintingOrder,
    finalTicketsProforma,
    finalTicketsThankText,
    finalTicketsTicketTearable,
    finalTicketsKeyboardOnChange,
    finalTicketsKeyboardValue,
    filteredProducts,
    handleMoveCategory,
    handleSaveAppLanguage,
    handleSaveBarcodeScanner,
    handleSaveCashmatic,
    cardTerminalProvider,
    handleSaveFinalTickets,
    handleSavePayworld,
    handleSaveCcv,
    handleSaveViva,
    handleSaveWorldline,
    handleSaveBancontactPro,
    handleSavePriceDisplay,
    handleSaveProductionTickets,
    handleSaveReportSettings,
    handleMakePeriodicReport,
    handleSaveRfidReader,
    handleSaveScale,
    handleTestScale,
    kitchenListRef,
    kitchens,
    lang,
    labelsList,
    labelsListRef,
    labelsPrinter,
    labelsType,
    labelsTypeOptions,
    labelsPrinterOptions,
    mapTranslatedOptions,
    openCategoryModal,
    openEditCategoryModal,
    openEditDiscountModal,
    openEditKitchenModal,
    openEditLabelModal,
    openEditPaymentTypeModal,
    openEditPriceGroupModal,
    openEditPrinterModal,
    openEditProductModal,
    openEditSubproductModal,
    openEditUserModal,
    openKitchenProductsModal,
    openNewDiscountModal,
    openNewKitchenModal,
    openNewLabelModal,
    openNewPaymentTypeModal,
    openNewPrinterModal,
    openNewUserModal,
    openPriceGroupModal,
    openProductModal,
    openProductPositioningModal,
    openProductSubproductsModal,
    openSubproductModal,
    paymentTypes,
    paymentTypesListRef,
    paymentTypesLoading,
    payworldIpAddress,
    payworldName,
    payworldPort,
    payworldKeyboardOnChange,
    payworldKeyboardValue,
    vivaName,
    vivaIpAddress,
    vivaPort,
    vivaKeyboardOnChange,
    vivaKeyboardValue,
    worldlineName,
    worldlineHttpBaseUrl,
    setWorldlineName,
    setWorldlineHttpBaseUrl,
    setWorldlineActiveField,
    worldlineKeyboardOnChange,
    worldlineKeyboardValue,
    ccvName,
    ccvIpAddress,
    ccvCommandPort,
    ccvDevicePort,
    ccvWorkstationId,
    ccvKeyboardOnChange,
    ccvKeyboardValue,
    bancontactProName,
    setBancontactProName,
    bancontactProApiKey,
    setBancontactProApiKey,
    bancontactProSandbox,
    setBancontactProSandbox,
    bancontactProCallbackUrl,
    setBancontactProCallbackUrl,
    setBancontactProActiveField,
    bancontactProKeyboardOnChange,
    bancontactProKeyboardValue,
    periodicReportEndDate,
    periodicReportEndTime,
    periodicReportLines,
    periodicReportLoading,
    periodicReportStartDate,
    periodicReportStartTime,
    priceDisplayType,
    priceGroups,
    priceGroupsListRef,
    priceGroupsLoading,
    printerTab,
    printers,
    printersPage,
    prodTicketsDisplayCategories,
    prodTicketsEatInTakeOutOnderaan,
    prodTicketsGroupingReceipt,
    prodTicketsKeukenprinterBuzzer,
    prodTicketsNextCoursePrinter1,
    prodTicketsNextCoursePrinter2,
    prodTicketsNextCoursePrinter3,
    prodTicketsNextCoursePrinter4,
    prodTicketsPrinterOverboeken,
    prodTicketsPrintingOrder,
    prodTicketsProductenIndividueel,
    prodTicketsSpaceAbove,
    prodTicketsTicketTearable,
    productionTicketsPrinterOptions,
    productHasSubproductsById,
    productSearch,
    products,
    productsCategoryTabsRef,
    productsListRef,
    productsLoading,
    reportGenerateUntil,
    reportSettings,
    reportTabId,
    financialReportKind,
    userReportKind,
    rfidReaderType,
    saveLabelsSettings,
    savingAppLanguage,
    savingBarcodeScanner,
    savingCashmatic,
    savingFinalTickets,
    savingPayworld,
    savingCcv,
    savingViva,
    savingWorldline,
    savingBancontactPro,
    savingPriceDisplay,
    savingProdTickets,
    savingReportSettings,
    savingRfidReader,
    savingScale,
    testingScale,
    scaleConfirmWeight,
    scaleConnectionMode,
    scaleLsmIp,
    scalePort,
    scaleType,
    scaleUseWeightLabels,
    scrollCategoriesByPage,
    scrollDiscountsByPage,
    scrollKitchenByPage,
    scrollLabelsByPage,
    scrollPaymentTypesByPage,
    scrollPriceGroupsByPage,
    scrollProductsByPage,
    scrollSubproductsByPage,
    scrollUsersByPage,
    selectedCategoryId,
    selectedProductId,
    selectedSubproductGroupId,
    selectedSubproductId,
    setAppLanguage,
    setBarcodeScannerType,
    setCashmaticActiveField,
    setCashmaticConnectionType,
    setCashmaticIpAddress,
    setCashmaticName,
    setCashmaticPassword,
    setCashmaticPort,
    setCashmaticUrl,
    setCashmaticUsername,
    setCardTerminalProvider,
    setDefaultPrinter,
    setDeleteConfirmCategoryId,
    setDeleteConfirmDiscountId,
    setDiscounts,
    setDeleteConfirmId,
    setDeleteConfirmKitchenId,
    setDeleteConfirmLabelId,
    setDeleteConfirmPaymentTypeId,
    setDeleteConfirmPrinterId,
    setDeleteConfirmProductId,
    setDeleteConfirmSubproductId,
    setDeleteConfirmUserId,
    setFinalTicketsActiveField,
    setFinalTicketsCompanyData1,
    setFinalTicketsCompanyData2,
    setFinalTicketsCompanyData3,
    setFinalTicketsCompanyData4,
    setFinalTicketsCompanyData5,
    setFinalTicketsPrintLogo,
    setFinalTicketsPrintPaymentType,
    setFinalTicketsPrintingOrder,
    setFinalTicketsProforma,
    setFinalTicketsThankText,
    setFinalTicketsTicketTearable,
    setPayworldActiveField,
    setPayworldIpAddress,
    setPayworldName,
    setPayworldPort,
    setVivaActiveField,
    setVivaName,
    setVivaIpAddress,
    setVivaPort,
    setCcvActiveField,
    setCcvName,
    setCcvIpAddress,
    setCcvCommandPort,
    setCcvDevicePort,
    setCcvWorkstationId,
    setPeriodicReportEndDate,
    setPeriodicReportEndTime,
    setPeriodicReportStartDate,
    setPeriodicReportStartTime,
    setPriceDisplayType,
    setPrinterTab,
    setPrintersPage,
    setProdTicketsDisplayCategories,
    setProdTicketsEatInTakeOutOnderaan,
    setProdTicketsGroupingReceipt,
    setProdTicketsKeukenprinterBuzzer,
    setProdTicketsNextCoursePrinter1,
    setProdTicketsNextCoursePrinter2,
    setProdTicketsNextCoursePrinter3,
    setProdTicketsNextCoursePrinter4,
    setProdTicketsPrinterOverboeken,
    setProdTicketsPrintingOrder,
    setProdTicketsProductenIndividueel,
    setProdTicketsSpaceAbove,
    setProdTicketsTicketTearable,
    setProductSearch,
    setReportSetting,
    setReportGenerateUntil,
    setReportTabId,
    setFinancialReportKind,
    setUserReportKind,
    setRfidReaderType,
    setScaleConfirmWeight,
    setScaleConnectionMode,
    setScaleLsmIp,
    setScalePort,
    setScaleType,
    setScaleUseWeightLabels,
    setSelectedCategoryId,
    setSelectedProductId,
    setSelectedSubproductGroupId,
    setSelectedSubproductId,
    setShowDeviceSettingsModal,
    setShowManageGroupsModal,
    setShowProductSearchKeyboard,
    setShowProductionMessagesModal,
    setShowSystemSettingsModal,
    setSubNavId,
    setTopNavId,
    subNavId,
    subproductGroups,
    subproductGroupsLoading,
    subproducts,
    subproductsGroupTabsRef,
    subproductsListRef,
    subproductsLoading,
    togglePaymentTypeActive,
    topNavId,
    tr,
    updateCategoriesScrollState,
    updateDiscountsScrollState,
    updateKitchenScrollState,
    updateLabelsScrollState,
    updatePaymentTypesScrollState,
    updatePriceGroupsScrollState,
    updateProductsScrollState,
    updateSubproductsScrollState,
    updateUsersScrollState,
    users,
    usersListRef,
    usersLoading
  } = ctx;

  const reportUserName = String(currentUser?.label ?? currentUser?.name ?? '').trim();

  const [financialLive, setFinancialLive] = useState(null);
  const [financialPeriod, setFinancialPeriod] = useState(null);
  const [zHistoryList, setZHistoryList] = useState([]);
  const [userReportLines, setUserReportLines] = useState([]);
  const [userReportLoading, setUserReportLoading] = useState(false);
  const [financialLoadError, setFinancialLoadError] = useState(null);
  const [financialRefreshing, setFinancialRefreshing] = useState(false);
  const [showZCloseConfirm, setShowZCloseConfirm] = useState(false);
  const backupFileInputRef = useRef(null);
  const xlsxImportFileInputRef = useRef(null);
  const [backupBusyAction, setBackupBusyAction] = useState(null);
  const [backupStatusMessage, setBackupStatusMessage] = useState('');
  const [backupErrorMessage, setBackupErrorMessage] = useState('');
  const [datasetBusyAction, setDatasetBusyAction] = useState(null);
  const [selectedDatasetForExport, setSelectedDatasetForExport] = useState('priceGroups');
  const [selectedDatasetForImport, setSelectedDatasetForImport] = useState('priceGroups');

  const loadFinancialLive = useCallback(async () => {
    setFinancialLoadError(null);
    setFinancialRefreshing(true);
    try {
      const [period, xdata] = await Promise.all([
        fetchFinancialPeriod(),
        fetchFinancialXReport({
          lang: appLanguage,
          userName: reportUserName,
          storeName: '',
          reportSettings,
        }),
      ]);
      setFinancialPeriod(period);
      setFinancialLive(xdata);
    } catch (e) {
      setFinancialLoadError(e?.message || 'Failed to load financial report');
      setFinancialLive(null);
    } finally {
      setFinancialRefreshing(false);
    }
  }, [appLanguage, reportUserName, reportSettings]);

  useEffect(() => {
    if (controlSidebarId !== 'reports' || reportTabId !== 'financial') return undefined;
    let cancelled = false;
    if (financialReportKind === 'history') {
      setFinancialLive(null);
      setFinancialPeriod(null);
      setFinancialLoadError(null);
      setFinancialRefreshing(true);
      fetchZReportHistory(80)
        .then((rows) => {
          if (!cancelled) setZHistoryList(rows);
        })
        .catch((e) => {
          if (!cancelled) {
            setZHistoryList([]);
            setFinancialLoadError(e?.message || 'Failed to load history');
          }
        })
        .finally(() => {
          if (!cancelled) setFinancialRefreshing(false);
        });
      return () => {
        cancelled = true;
      };
    }
    setZHistoryList([]);
    loadFinancialLive();
    return () => {
      cancelled = true;
    };
  }, [controlSidebarId, reportTabId, financialReportKind, loadFinancialLive]);

  useEffect(() => {
    if (!realtimeSocket?.on) return undefined;
    const handleZReportsChanged = () => {
      if (controlSidebarId !== 'reports' || reportTabId !== 'financial') return;
      if (financialReportKind === 'history') {
        setFinancialRefreshing(true);
        fetchZReportHistory(80)
          .then((rows) => setZHistoryList(rows))
          .catch((e) => {
            setZHistoryList([]);
            setFinancialLoadError(e?.message || 'Failed to load history');
          })
          .finally(() => setFinancialRefreshing(false));
        return;
      }
      void loadFinancialLive();
    };
    realtimeSocket.on('z-reports:changed', handleZReportsChanged);
    return () => {
      realtimeSocket.off('z-reports:changed', handleZReportsChanged);
    };
  }, [realtimeSocket, controlSidebarId, reportTabId, financialReportKind, loadFinancialLive]);

  const loadUserReportLive = useCallback(async () => {
    setUserReportLoading(true);
    setFinancialLoadError(null);
    try {
      const data = await fetchUserReport({
        kind: userReportKind,
        lang: appLanguage,
        userName: reportUserName,
        storeName: '',
        registerId: String(currentRegisterId || '').trim() || null,
        registerName: String(currentRegisterName || '').trim() || null,
        reportSettings,
      });
      setUserReportLines(Array.isArray(data?.lines) ? data.lines : []);
    } catch (e) {
      setUserReportLines([]);
      setFinancialLoadError(e?.message || 'Failed to load user report');
    } finally {
      setUserReportLoading(false);
    }
  }, [appLanguage, currentRegisterId, currentRegisterName, reportSettings, reportUserName, userReportKind]);

  useEffect(() => {
    if (controlSidebarId !== 'reports' || reportTabId !== 'user') return;
    void loadUserReportLive();
  }, [controlSidebarId, reportTabId, loadUserReportLive]);

  const confirmZCloseAndPrint = useCallback(async () => {
    setShowZCloseConfirm(false);
    if ((Number(financialLive?.summary?.grossTotal) || 0) <= 0) {
      setReportPrintErrorMessage(
        tr('control.reports.zZeroBlock', 'Cannot print/close Z report when gross total is €0.'),
      );
      return;
    }
    if (reportPrintBusy != null) return;
    setReportPrintBusy('financial');
    try {
      const data = await closeFinancialZReport({
        lang: appLanguage,
        userName: reportUserName,
        storeName: '',
        closedByName: reportUserName,
        closedByUserId: currentUser?.id != null ? String(currentUser.id) : null,
        registerId: String(currentRegisterId || '').trim() || null,
        registerName: String(currentRegisterName || '').trim() || null,
        reportSettings,
      });
      await printPeriodicReportLines(data.lines);
      await loadFinancialLive();
    } catch (e) {
      setReportPrintErrorMessage(
        e?.message || tr('control.reports.printFailed', 'Could not print on the main printer.'),
      );
    } finally {
      setReportPrintBusy(null);
    }
  }, [
    reportPrintBusy,
    appLanguage,
    reportUserName,
    currentRegisterId,
    currentRegisterName,
    currentUser,
    financialLive,
    loadFinancialLive,
    reportSettings,
    tr,
  ]);

  const financialGrossTotal = Number(financialLive?.summary?.grossTotal || 0);
  const zPrintBlocked = financialReportKind === 'z' && financialGrossTotal <= 0;
  const backupBusy = backupBusyAction != null;
  const datasetBusy = datasetBusyAction != null;
  const importExportBusy = backupBusy || datasetBusy;

  const parseBackupError = useCallback(async (res, fallback) => {
    try {
      const data = await res.json();
      return data?.error || fallback;
    } catch {
      return fallback;
    }
  }, []);

  const readAsBoolean = useCallback((value, fallback = false) => {
    if (value === true || value === false) return value;
    if (typeof value === 'number') return value !== 0;
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) return fallback;
    if (['true', '1', 'yes', 'y'].includes(raw)) return true;
    if (['false', '0', 'no', 'n'].includes(raw)) return false;
    return fallback;
  }, []);

  const asStringOrNull = useCallback((value) => {
    if (value == null) return null;
    const text = String(value).trim();
    return text === '' ? null : text;
  }, []);

  const asStringOrEmpty = useCallback((value) => {
    if (value == null) return '';
    return String(value).trim();
  }, []);

  const parseJsonArrayCell = useCallback((value) => {
    if (Array.isArray(value)) return value.map((x) => String(x)).filter(Boolean);
    const raw = String(value ?? '').trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((x) => String(x)).filter(Boolean) : [];
    } catch {
      return raw.split(',').map((x) => x.trim()).filter(Boolean);
    }
  }, []);

  const requestJson = useCallback(async (url, options = {}, fallbackMessage = 'Request failed.') => {
    const res = await fetch(url, options);
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      throw new Error(data?.error || fallbackMessage);
    }
    return data;
  }, []);

  const requestNoContent = useCallback(async (url, options = {}, fallbackMessage = 'Request failed.') => {
    const res = await fetch(url, options);
    if (!res.ok) {
      const message = await parseBackupError(res, fallbackMessage);
      throw new Error(message);
    }
  }, [parseBackupError]);

  const loadAllProducts = useCallback(async () => {
    const categoryList = await requestJson(`${API}/categories`, {}, 'Could not load categories.');
    const safeCategories = Array.isArray(categoryList) ? categoryList : [];
    const nestedProducts = await Promise.all(
      safeCategories.map(async (category) => {
        if (!category?.id) return [];
        try {
          const rows = await requestJson(
            `${API}/categories/${category.id}/products`,
            {},
            'Could not load products.',
          );
          return Array.isArray(rows) ? rows.map((row) => ({ ...row, categoryName: category.name || '' })) : [];
        } catch {
          return [];
        }
      }),
    );
    return nestedProducts.flat();
  }, [requestJson]);

  const downloadWorkbook = useCallback((workbook, fileName) => {
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, []);

  const exportSelectedDatasetToXlsx = useCallback(async (datasetKey) => {
    const workbook = XLSX.utils.book_new();

    if (datasetKey === 'priceGroups') {
      const rows = await requestJson(`${API}/price-groups`, {}, 'Could not load price groups.');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(Array.isArray(rows) ? rows : []), 'Price Groups');
      return { workbook, label: 'Price Groups' };
    }

    if (datasetKey === 'categories') {
      const rows = await requestJson(`${API}/categories`, {}, 'Could not load categories.');
      const cleanRows = (Array.isArray(rows) ? rows : []).map((row) => ({
        id: row.id ?? '',
        name: row.name ?? '',
        sortOrder: row.sortOrder ?? 0,
        inWebshop: row.inWebshop === true,
        displayOnCashRegister: row.displayOnCashRegister !== false,
        nextCourse: row.nextCourse ?? '',
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(cleanRows), 'Categories');
      return { workbook, label: 'Categories' };
    }

    if (datasetKey === 'products') {
      const rows = await loadAllProducts();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(Array.isArray(rows) ? rows : []), 'Products');
      return { workbook, label: 'Products' };
    }

    if (datasetKey === 'subproducts') {
      const groups = await requestJson(`${API}/subproduct-groups`, {}, 'Could not load subproduct groups.');
      const safeGroups = Array.isArray(groups) ? groups : [];
      const rowsNested = await Promise.all(
        safeGroups.map(async (group) => {
          const subRows = await requestJson(
            `${API}/subproduct-groups/${group.id}/subproducts`,
            {},
            'Could not load subproducts.',
          );
          const safeRows = Array.isArray(subRows) ? subRows : [];
          return safeRows.map((row) => ({
            id: row.id ?? '',
            name: row.name ?? '',
            sortOrder: row.sortOrder ?? 0,
            price: row.price ?? '',
            groupId: group.id ?? '',
            groupName: group.name ?? '',
            groupSortOrder: group.sortOrder ?? 0,
          }));
        }),
      );
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rowsNested.flat()), 'Subproducts');
      return { workbook, label: 'Subproducts' };
    }

    if (datasetKey === 'discounts') {
      const rows = Array.isArray(discounts) ? discounts : [];
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Discounts');
      return { workbook, label: 'Discounts' };
    }

    if (datasetKey === 'kitchens') {
      const rows = await requestJson(`${API}/kitchens`, {}, 'Could not load kitchens.');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(Array.isArray(rows) ? rows : []), 'Kitchen');
      return { workbook, label: 'Kitchen' };
    }

    throw new Error('Unsupported export target.');
  }, [discounts, loadAllProducts, requestJson]);

  const importSelectedDatasetFromWorkbook = useCallback(async (datasetKey, workbook) => {
    const getRows = (sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) return [];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      return Array.isArray(rows) ? rows : [];
    };

    if (datasetKey === 'priceGroups') {
      const rows = getRows('Price Groups');
      const existing = await requestJson(`${API}/price-groups`, {}, 'Could not load price groups.');
      await Promise.all(
        (Array.isArray(existing) ? existing : []).map((row) =>
          requestNoContent(`${API}/price-groups/${row.id}`, { method: 'DELETE' }, 'Could not delete price group.'),
        ),
      );
      for (const row of rows) {
        await requestJson(
          `${API}/price-groups`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: asStringOrEmpty(row.name) || 'New price group',
              tax: asStringOrNull(row.tax),
            }),
          },
          'Could not import price group.',
        );
      }
      return rows.length;
    }

    if (datasetKey === 'categories') {
      const rows = getRows('Categories');
      const existing = await requestJson(`${API}/categories`, {}, 'Could not load categories.');
      await Promise.all(
        (Array.isArray(existing) ? existing : []).map((row) =>
          requestNoContent(`${API}/categories/${row.id}`, { method: 'DELETE' }, 'Could not delete category.'),
        ),
      );
      for (const row of rows) {
        await requestJson(
          `${API}/categories`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: asStringOrEmpty(row.name) || 'New category',
              inWebshop: readAsBoolean(row.inWebshop, true),
              displayOnCashRegister: readAsBoolean(row.displayOnCashRegister, true),
              nextCourse: asStringOrNull(row.nextCourse),
            }),
          },
          'Could not import category.',
        );
      }
      return rows.length;
    }

    if (datasetKey === 'products') {
      const rows = getRows('Products');
      const categories = await requestJson(`${API}/categories`, {}, 'Could not load categories.');
      const safeCategories = Array.isArray(categories) ? categories : [];
      const categoryById = new Map(safeCategories.map((row) => [String(row.id), row.id]));
      const categoryByName = new Map(
        safeCategories.map((row) => [String(row.name || '').trim().toLowerCase(), row.id]),
      );
      const existingProducts = await loadAllProducts();
      await Promise.all(
        existingProducts.map((row) =>
          requestNoContent(`${API}/products/${row.id}`, { method: 'DELETE' }, 'Could not delete product.'),
        ),
      );
      let importedCount = 0;
      for (const row of rows) {
        const fromId = categoryById.get(String(row.categoryId ?? '').trim());
        const fromName = categoryByName.get(String(row.categoryName ?? '').trim().toLowerCase());
        const resolvedCategoryId = fromId || fromName || null;
        if (!resolvedCategoryId) continue;
        const payload = {
          name: asStringOrEmpty(row.name) || 'New product',
          price: Number.isFinite(Number(row.price)) ? Number(row.price) : 0,
          categoryId: resolvedCategoryId,
          keyName: asStringOrNull(row.keyName),
          productionName: asStringOrNull(row.productionName),
          vatTakeOut: asStringOrNull(row.vatTakeOut),
          barcode: asStringOrNull(row.barcode),
          printer1: asStringOrNull(row.printer1),
          printer2: asStringOrNull(row.printer2),
          printer3: asStringOrNull(row.printer3),
          addition: asStringOrNull(row.addition),
          categoryIdsJson: asStringOrNull(row.categoryIdsJson),
          openPrice: readAsBoolean(row.openPrice, false),
          weegschaal: readAsBoolean(row.weegschaal, false),
          subproductRequires: readAsBoolean(row.subproductRequires, false),
          leeggoedPrijs: asStringOrNull(row.leeggoedPrijs),
          pagerVerplicht: readAsBoolean(row.pagerVerplicht, false),
          boldPrint: readAsBoolean(row.boldPrint, false),
          groupingReceipt: readAsBoolean(row.groupingReceipt, true),
          labelExtraInfo: asStringOrNull(row.labelExtraInfo),
          kassaPhotoPath: asStringOrNull(row.kassaPhotoPath),
          voorverpakVervaltype: asStringOrNull(row.voorverpakVervaltype),
          houdbareDagen: asStringOrNull(row.houdbareDagen),
          bewarenGebruik: asStringOrNull(row.bewarenGebruik),
          extraPricesJson: asStringOrNull(row.extraPricesJson),
          purchaseVat: asStringOrNull(row.purchaseVat),
          purchasePriceExcl: asStringOrNull(row.purchasePriceExcl),
          purchasePriceIncl: asStringOrNull(row.purchasePriceIncl),
          profitPct: asStringOrNull(row.profitPct),
          unit: asStringOrNull(row.unit),
          unitContent: asStringOrNull(row.unitContent),
          stock: asStringOrNull(row.stock),
          supplierCode: asStringOrNull(row.supplierCode),
          stockNotification: readAsBoolean(row.stockNotification, true),
          expirationDate: asStringOrNull(row.expirationDate),
          declarationExpiryDays: asStringOrNull(row.declarationExpiryDays),
          notificationSoldOutPieces: asStringOrNull(row.notificationSoldOutPieces),
          inWebshop: readAsBoolean(row.inWebshop, false),
          onlineOrderable: readAsBoolean(row.onlineOrderable, true),
          websiteRemark: asStringOrNull(row.websiteRemark),
          websiteOrder: asStringOrNull(row.websiteOrder),
          shortWebText: asStringOrNull(row.shortWebText),
          websitePhotoPath: asStringOrNull(row.websitePhotoPath),
          kioskInfo: asStringOrNull(row.kioskInfo),
          kioskTakeAway: readAsBoolean(row.kioskTakeAway, true),
          kioskEatIn: asStringOrNull(row.kioskEatIn),
          kioskSubtitle: asStringOrNull(row.kioskSubtitle),
          kioskMinSubs: asStringOrNull(row.kioskMinSubs),
          kioskMaxSubs: asStringOrNull(row.kioskMaxSubs),
          kioskPicturePath: asStringOrNull(row.kioskPicturePath),
        };
        await requestJson(
          `${API}/products`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
          'Could not import product.',
        );
        importedCount += 1;
      }
      return importedCount;
    }

    if (datasetKey === 'subproducts') {
      const rows = getRows('Subproducts');
      const existingGroups = await requestJson(`${API}/subproduct-groups`, {}, 'Could not load subproduct groups.');
      await Promise.all(
        (Array.isArray(existingGroups) ? existingGroups : []).map((group) =>
          requestNoContent(
            `${API}/subproduct-groups/${group.id}`,
            { method: 'DELETE' },
            'Could not delete subproduct group.',
          ),
        ),
      );
      const groupNameToId = new Map();
      for (const row of rows) {
        const groupName = asStringOrEmpty(row.groupName) || 'Default';
        const key = groupName.toLowerCase();
        if (!groupNameToId.has(key)) {
          const created = await requestJson(
            `${API}/subproduct-groups`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: groupName }),
            },
            'Could not import subproduct group.',
          );
          groupNameToId.set(key, created.id);
        }
        await requestJson(
          `${API}/subproducts`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: asStringOrEmpty(row.name) || 'New subproduct',
              groupId: groupNameToId.get(key),
              price: row.price === '' || row.price == null ? null : Number(row.price),
            }),
          },
          'Could not import subproduct.',
        );
      }
      return rows.length;
    }

    if (datasetKey === 'discounts') {
      const rows = getRows('Discounts');
      const normalized = rows.map((row, index) => ({
        id: asStringOrEmpty(row.id) || `d-import-${Date.now()}-${index}`,
        name: asStringOrEmpty(row.name) || 'New discount',
        trigger: asStringOrEmpty(row.trigger) || 'number',
        type: asStringOrEmpty(row.type) || 'amount',
        value: asStringOrEmpty(row.value),
        startDate: asStringOrEmpty(row.startDate),
        endDate: asStringOrEmpty(row.endDate),
        discountOn: asStringOrEmpty(row.discountOn) || 'products',
        targetId: asStringOrEmpty(row.targetId),
        targetIds: parseJsonArrayCell(row.targetIds).length > 0
          ? parseJsonArrayCell(row.targetIds)
          : (asStringOrEmpty(row.targetId) ? [asStringOrEmpty(row.targetId)] : []),
        pieces: asStringOrEmpty(row.pieces),
        combinable: readAsBoolean(row.combinable, false),
      }));
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('pos_discounts', JSON.stringify(normalized));
      }
      if (typeof setDiscounts === 'function') {
        setDiscounts(normalized);
      }
      return normalized.length;
    }

    if (datasetKey === 'kitchens') {
      const rows = getRows('Kitchen');
      const existing = await requestJson(`${API}/kitchens`, {}, 'Could not load kitchens.');
      await Promise.all(
        (Array.isArray(existing) ? existing : []).map((row) =>
          requestNoContent(`${API}/kitchens/${row.id}`, { method: 'DELETE' }, 'Could not delete kitchen.'),
        ),
      );
      for (const row of rows) {
        const created = await requestJson(
          `${API}/kitchens`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: asStringOrEmpty(row.name) || 'Kitchen',
              pin: asStringOrEmpty(row.pin) || '1234',
            }),
          },
          'Could not create kitchen.',
        );
        const productIds = parseJsonArrayCell(row.productIds);
        if (productIds.length > 0) {
          await requestJson(
            `${API}/kitchens/${created.id}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ productIds }),
            },
            'Could not assign kitchen products.',
          );
        }
      }
      return rows.length;
    }

    throw new Error('Unsupported import target.');
  }, [
    asStringOrEmpty,
    asStringOrNull,
    loadAllProducts,
    parseJsonArrayCell,
    readAsBoolean,
    requestJson,
    requestNoContent,
    setDiscounts,
  ]);

  const handleExportDatasetXlsx = useCallback(async () => {
    if (importExportBusy) return;
    setDatasetBusyAction('export-xlsx');
    setBackupStatusMessage('');
    setBackupErrorMessage('');
    try {
      const { workbook, label } = await exportSelectedDatasetToXlsx(selectedDatasetForExport);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `pos-${selectedDatasetForExport}-${stamp}.xlsx`;
      downloadWorkbook(workbook, fileName);
      setBackupStatusMessage(
        tr('control.importExport.xlsxExportSuccess', `${label} exported to XLSX successfully.`),
      );
    } catch (error) {
      setBackupErrorMessage(
        error?.message || tr('control.importExport.xlsxExportFailed', 'Could not export XLSX file.'),
      );
    } finally {
      setDatasetBusyAction(null);
    }
  }, [
    downloadWorkbook,
    exportSelectedDatasetToXlsx,
    importExportBusy,
    selectedDatasetForExport,
    tr,
  ]);

  const handleOpenXlsxImportPicker = useCallback(() => {
    if (importExportBusy) return;
    xlsxImportFileInputRef.current?.click();
  }, [importExportBusy]);

  const handleImportDatasetXlsxFileChange = useCallback(async (event) => {
    const file = event.target?.files?.[0];
    event.target.value = '';
    if (!file) return;
    setDatasetBusyAction('import-xlsx');
    setBackupStatusMessage('');
    setBackupErrorMessage('');
    try {
      const bytes = await file.arrayBuffer();
      const workbook = XLSX.read(bytes, { type: 'array' });
      const importedCount = await importSelectedDatasetFromWorkbook(selectedDatasetForImport, workbook);
      setBackupStatusMessage(
        tr(
          'control.importExport.xlsxImportSuccess',
          `Imported ${importedCount} row(s) from XLSX successfully.`,
        ),
      );
    } catch (error) {
      setBackupErrorMessage(
        error?.message || tr('control.importExport.xlsxImportFailed', 'Could not import XLSX file.'),
      );
    } finally {
      setDatasetBusyAction(null);
    }
  }, [importSelectedDatasetFromWorkbook, selectedDatasetForImport, tr]);

  const handleExportBackup = useCallback(async () => {
    if (importExportBusy) return;
    setBackupBusyAction('export');
    setBackupStatusMessage('');
    setBackupErrorMessage('');
    try {
      const res = await fetch(`${API}/backup/export`);
      if (!res.ok) {
        const message = await parseBackupError(res, tr('control.importExport.exportFailed', 'Could not export backup file.'));
        throw new Error(message);
      }
      const blob = await res.blob();
      const link = document.createElement('a');
      const objectUrl = URL.createObjectURL(blob);
      const fileNameHeader = String(res.headers.get('content-disposition') || '');
      const fallbackName = `pos-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
      const fileNameMatch = fileNameHeader.match(/filename="?([^"]+)"?/i);
      link.href = objectUrl;
      link.download = fileNameMatch?.[1] || fallbackName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setBackupStatusMessage(tr('control.importExport.exportSuccess', 'Backup exported successfully.'));
    } catch (error) {
      setBackupErrorMessage(error?.message || tr('control.importExport.exportFailed', 'Could not export backup file.'));
    } finally {
      setBackupBusyAction(null);
    }
  }, [importExportBusy, parseBackupError, tr]);

  const handleOpenImportPicker = useCallback(() => {
    if (importExportBusy) return;
    backupFileInputRef.current?.click();
  }, [importExportBusy]);

  const handleImportBackupFileChange = useCallback(async (event) => {
    const file = event.target?.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (importExportBusy) return;
    setBackupBusyAction('import');
    setBackupStatusMessage('');
    setBackupErrorMessage('');
    try {
      const bytes = await file.arrayBuffer();
      const res = await fetch(`${API}/backup/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: bytes,
      });
      if (!res.ok) {
        const message = await parseBackupError(res, tr('control.importExport.importFailed', 'Could not import backup file.'));
        throw new Error(message);
      }
      const data = await res.json();
      setBackupStatusMessage(
        data?.message ||
        tr(
          'control.importExport.importSuccess',
          'Backup imported successfully. Restart backend if data does not refresh immediately.',
        ),
      );
    } catch (error) {
      setBackupErrorMessage(error?.message || tr('control.importExport.importFailed', 'Could not import backup file.'));
    } finally {
      setBackupBusyAction(null);
    }
  }, [importExportBusy, parseBackupError, tr]);

  return (
    <div className="flex flex-col flex-1 min-w-0">
      {/* Top navigation - Personalize only */}
      {controlSidebarId === 'personalize' && (
        <div className="mx-4 my-2 flex justify-around max-w-full items-center gap-1 rounded-lg bg-pos-bg/50 p-1">
          {TOP_NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`flex items-center gap-2 px-2 py-3 rounded-lg text-lg transition-colors ${topNavId === item.id
                ? 'bg-pos-panel text-pos-text font-medium border border-pos-border'
                : 'text-pos-muted active:text-pos-text active:bg-green-500 border border-transparent'
                }`}
              onClick={() => {
                setTopNavId(item.id);
                if (item.id === 'categories-products') setSubNavId('');
                if (item.id === 'cash-register') {
                  setSubNavId('');
                }
                if (item.id === 'external-devices') setSubNavId('');
              }}
            >
              <TopNavIcon id={item.icon} className="w-6 h-6 shrink-0" />
              {tr(`control.topNav.${item.id}`, item.label)}
            </button>
          ))}
        </div>
      )}

      {/* Reports tabs - when Reports sidebar selected */}
      {controlSidebarId === 'reports' && (
        <div className="flex items-center gap-1 px-4 py-2 justify-around w-full bg-pos-bg/50">
          {REPORT_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${reportTabId === item.id
                ? 'bg-pos-panel text-pos-text font-medium border border-pos-border'
                : 'text-pos-muted active:text-pos-text active:bg-green-500 border border-transparent'
                }`}
              onClick={() => setReportTabId(item.id)}
            >
              <ReportTabIcon id={item.icon} className="w-5 h-5 shrink-0" />
              {tr(`control.reportTabs.${item.id}`, item.label)}
            </button>
          ))}
        </div>
      )}

      {/* Sub-navigation - Categories and products */}
      {controlSidebarId === 'personalize' && topNavId === 'categories-products' && (
        <div className="flex items-center w-full justify-between gap-1 px-4 bg-pos-bg">
          {SUB_NAV_ITEMS.map((label) => (
            <button
              key={label}
              type="button"
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${subNavId === label
                ? 'bg-pos-panel text-pos-text font-medium'
                : 'text-pos-muted active:text-pos-text active:bg-green-500'
                }`}
              onClick={() => setSubNavId(label)}
            >
              {tr(`control.subNav.${label}`, label)}
            </button>
          ))}
        </div>
      )}

      {/* Sub-navigation - Cash Register Settings */}
      {controlSidebarId === 'personalize' && topNavId === 'cash-register' && (
        <div className="flex items-center w-full justify-around gap-1 px-4 py-3 bg-pos-bg">
          {CASH_REGISTER_SUB_NAV_ITEMS.map((label) => (
            <button
              key={label}
              type="button"
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${subNavId === label
                ? 'bg-pos-panel text-pos-text font-medium'
                : 'text-pos-muted active:text-pos-text active:bg-green-500'
                }`}
              onClick={() => {
                setSubNavId(label);
                if (label === 'Device Settings') setShowDeviceSettingsModal(true);
                if (label === 'System Settings') setShowSystemSettingsModal(true);
                if (label === 'Production messages') setShowProductionMessagesModal(true);
              }}
            >
              {tr(`control.subNav.${label}`, label)}
            </button>
          ))}
        </div>
      )}

      {/* Sub-navigation - External Devices */}
      {controlSidebarId === 'personalize' && topNavId === 'external-devices' && (
        <div className="flex items-center w-full justify-between gap-1 px-4 bg-pos-bg">
          {EXTERNAL_DEVICES_SUB_NAV_ITEMS.map((label) => (
            <button
              key={label}
              type="button"
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${subNavId === label
                ? 'bg-pos-panel text-pos-text font-medium'
                : 'text-pos-muted active:text-pos-text active:bg-green-500'
                }`}
              onClick={() => setSubNavId(label)}
            >
              {tr(`control.subNav.${label}`, label)}
            </button>
          ))}
        </div>
      )}

      {/* Content area */}
      <main className="flex-1 overflow-hidden px-4 pt-2">
        {controlSidebarId === 'reports' ? (
          <div className="flex flex-col h-full gap-4">
            {reportTabId === 'financial' && (
              <div className="flex gap-4 flex-col min-h-0 flex-1 w-full">
                <div className="shrink-0 flex justify-around gap-2 h-[46px] w-full items-center px-2">
                  <button
                    type="button"
                    className={`px-4 py-2 rounded-lg text-sm font-medium min-w-[100px] transition-colors ${financialReportKind === 'z'
                      ? 'bg-green-600 text-white'
                      : 'text-pos-text active:bg-green-500 active:text-white'
                      }`}
                    onClick={() => setFinancialReportKind('z')}
                  >
                    Z
                  </button>
                  <button
                    type="button"
                    className={`px-4 py-2 rounded-lg text-sm font-medium min-w-[100px] transition-colors ${financialReportKind === 'x'
                      ? 'bg-green-600 text-white'
                      : 'text-pos-text active:bg-green-500 active:text-white'
                      }`}
                    onClick={() => setFinancialReportKind('x')}
                  >
                    X
                  </button>
                  <button
                    type="button"
                    className={`px-4 py-2 rounded-lg text-sm font-medium min-w-[100px] transition-colors ${financialReportKind === 'history'
                      ? 'bg-green-600 text-white'
                      : 'text-pos-text active:bg-green-500 active:text-white'
                      }`}
                    onClick={() => setFinancialReportKind('history')}
                  >
                    {tr('control.reports.history', 'History')}
                  </button>
                </div>
                <div className="relative grid grid-cols-2 flex-1 px-4 min-h-0 gap-4">
                  <div className="flex flex-col min-h-0 gap-3">
                    <div
                      key={financialReportKind}
                      id="financial-report-pospoint-scroll"
                      className="flex-1 overflow-auto rounded-xl border border-pos-border bg-white text-gray-800 p-4 min-h-[400px]"
                    >
                      <div className="text-sm font-mono space-y-1 whitespace-pre-wrap text-center">
                        {financialReportKind === 'history' ? (
                          <div className="text-left space-y-4">
                            <div className="text-center border-b border-dotted border-gray-400 pb-2 mb-4 font-semibold text-sm">
                              {tr('control.reports.financialHistoryTitle', 'Financial report history')}
                            </div>
                            {financialLoadError ? (
                              <p className="text-center text-red-600 text-sm">{financialLoadError}</p>
                            ) : null}
                            {financialRefreshing ? (
                              <p className="text-center text-gray-500">{tr('loading', 'Loading...')}</p>
                            ) : null}
                            <div className="font-medium">{tr('control.reports.zReports', 'Z reports (close of day)')}</div>
                            <ul className="space-y-3 text-left list-none pl-0">
                              {zHistoryList.map((z) => (
                                <li
                                  key={z.id}
                                  className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3"
                                >
                                  <div>
                                    <span className="font-semibold text-black">Z #{z.zNumber}</span>
                                    <div className="text-xs text-gray-600 mt-1">
                                      {new Date(z.periodStart).toLocaleString()} → {new Date(z.periodEnd).toLocaleString()}
                                    </div>
                                    {z.grossTotal != null ? (
                                      <div className="text-sm text-rose-600 mt-1">
                                        €{Number(z.grossTotal).toFixed(2)}
                                      </div>
                                    ) : null}
                                    {z.closedByName ? (
                                      <div className="text-xs text-gray-500">{z.closedByName}</div>
                                    ) : null}
                                  </div>
                                  <button
                                    type="button"
                                    disabled={reportPrintBusy !== null}
                                    className="shrink-0 px-3 py-1.5 rounded-lg border border-pos-border bg-pos-panel text-pos-text text-sm active:bg-green-500 disabled:opacity-40"
                                    onClick={async () => {
                                      if (reportPrintBusy != null) return;
                                      setReportPrintBusy('financial');
                                      try {
                                        const rec = await fetchZReportReceiptLines(z.id);
                                        await printPeriodicReportLines(rec.lines);
                                      } catch (e) {
                                        setReportPrintErrorMessage(
                                          e?.message ||
                                          tr('control.reports.printFailed', 'Could not print on the main printer.'),
                                        );
                                      } finally {
                                        setReportPrintBusy(null);
                                      }
                                    }}
                                  >
                                    {tr('control.reports.reprintZ', 'Reprint')}
                                  </button>
                                </li>
                              ))}
                            </ul>
                            {!financialRefreshing && zHistoryList.length === 0 && !financialLoadError ? (
                              <p className="text-center text-gray-500 text-sm">
                                {tr('control.reports.zHistoryEmpty', 'No Z reports have been closed yet.')}
                              </p>
                            ) : null}
                            <p className="text-xs text-gray-500 mt-4">
                              {tr(
                                'control.reports.xNotArchivedHint',
                                'Interim X reports are not stored; only Z (day close) reports appear here.',
                              )}
                            </p>
                          </div>
                        ) : (
                          <>
                            {financialLoadError ? (
                              <p className="text-center text-red-600 text-sm mb-4">{financialLoadError}</p>
                            ) : null}
                            {financialRefreshing && !financialLive ? (
                              <p className="text-center text-gray-500 py-8">{tr('loading', 'Loading...')}</p>
                            ) : null}
                            {Array.isArray(financialLive?.lines) && financialLive.lines.length > 0 ? (
                              <div className="text-left space-y-1 text-black text-sm font-mono whitespace-pre-wrap">
                                {financialLive.lines.map((line, idx) => (
                                  <div key={`financial-live-line-${idx}`}>{line}</div>
                                ))}
                                <p className="text-xs text-gray-500 mt-4 text-center font-sans">
                                  {financialReportKind === 'z'
                                    ? tr(
                                      'control.reports.zPreviewFooter',
                                      'Printing Z closes this period and assigns the next Z number.',
                                    )
                                    : tr(
                                      'control.reports.xPreviewFooter',
                                      'X is read-only; counters reset only after a Z report.',
                                    )}
                                </p>
                              </div>
                            ) : !financialRefreshing ? (
                              <p className="text-center text-gray-500 py-6">
                                {tr('control.reports.financialNoData', 'No data for this period yet.')}
                              </p>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-2 py-2 shrink-0">
                      <div className="flex-1" />
                      <PaginationArrows
                        canPrev={true}
                        canNext={true}
                        onPrev={() => {
                          const el = document.getElementById('financial-report-pospoint-scroll');
                          if (el) el.scrollBy({ top: -200, behavior: 'smooth' });
                        }}
                        onNext={() => {
                          const el = document.getElementById('financial-report-pospoint-scroll');
                          if (el) el.scrollBy({ top: 200, behavior: 'smooth' });
                        }}
                        className="relative py-0"
                      />
                      <div className="flex-1" />
                    </div>
                  </div>
                  <div className="flex flex-col h-full gap-3 shrink-0 justify-center items-center">
                    {financialReportKind === 'history' ? (
                      <p className="text-pos-text text-sm text-center max-w-[220px] px-2">
                        {tr(
                          'control.reports.historyReprintHint',
                          'Use Reprint next to each archived Z report.',
                        )}
                      </p>
                    ) : (
                      <>
                        <p className="text-pos-text text-xs text-center max-w-[220px] px-2">
                          {financialReportKind === 'z'
                            ? tr(
                              'control.reports.zPrintHint',
                              'Z report closes the current period and starts a new one.',
                            )
                            : tr(
                              'control.reports.xPrintHint',
                              'X report is a snapshot only; nothing is reset.',
                            )}
                        </p>
                        {zPrintBlocked ? (
                          <p className="text-red-500 text-xs text-center max-w-[220px] px-2">
                            {tr('control.reports.zZeroBlock', 'Cannot print/close Z report when gross total is €0.')}
                          </p>
                        ) : null}
                        <button
                          type="button"
                          disabled={financialRefreshing || reportPrintBusy !== null}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-pos-border bg-pos-panel text-pos-text justify-center text-sm active:bg-green-500 disabled:opacity-40 w-[min(200px,90%)]"
                          onClick={() => loadFinancialLive()}
                        >
                          {financialRefreshing ? (
                            <ReportPrintSpinner className="w-4 h-4" />
                          ) : null}
                          {tr('control.reports.refreshPreview', 'Refresh')}
                        </button>
                        <button
                          type="button"
                          disabled={reportPrintBusy !== null || zPrintBlocked}
                          className="flex mt-1 items-center gap-2 px-4 py-2 rounded-lg bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 text-sm justify-center w-[min(200px,90%)] disabled:opacity-50 disabled:pointer-events-none"
                          onClick={async () => {
                            if (reportPrintBusy != null) return;
                            if (financialReportKind === 'z') {
                              if (zPrintBlocked) {
                                setReportPrintErrorMessage(
                                  tr('control.reports.zZeroBlock', 'Cannot print/close Z report when gross total is €0.'),
                                );
                                return;
                              }
                              setShowZCloseConfirm(true);
                              return;
                            }
                            setReportPrintBusy('financial');
                            try {
                              const data = await fetchFinancialXReport({
                                lang: appLanguage,
                                userName: reportUserName,
                                storeName: '',
                                reportSettings,
                              });
                              setFinancialLive(data);
                              setFinancialPeriod(await fetchFinancialPeriod().catch(() => null));
                              await printPeriodicReportLines(data.lines);
                            } catch (e) {
                              setReportPrintErrorMessage(
                                e?.message ||
                                tr('control.reports.printFailed', 'Could not print on the main printer.'),
                              );
                            } finally {
                              setReportPrintBusy(null);
                            }
                          }}
                        >
                          {reportPrintBusy === 'financial' ? (
                            <ReportPrintSpinner className="w-4 h-4" />
                          ) : (
                            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                          )}
                          {reportPrintBusy === 'financial'
                            ? tr('control.reports.printing', 'Printing…')
                            : financialReportKind === 'z'
                              ? tr('control.reports.printZClose', 'Print Z (close day)')
                              : tr('control.reports.print', 'Print')}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
            {reportTabId === 'user' && (
              <div className="flex gap-4 flex-col min-h-0 flex-1 w-full">
                <div className="shrink-0 flex justify-around gap-2 h-[46px] w-full items-center px-2">
                  <button
                    type="button"
                    className={`px-4 py-2 rounded-lg text-sm font-medium min-w-[100px] transition-colors ${userReportKind === 'z'
                      ? 'bg-green-600 text-white'
                      : 'text-pos-text active:bg-green-500 active:text-white'
                      }`}
                    onClick={() => setUserReportKind('z')}
                  >
                    Z
                  </button>
                  <button
                    type="button"
                    className={`px-4 py-2 rounded-lg text-sm font-medium min-w-[100px] transition-colors ${userReportKind === 'x'
                      ? 'bg-green-600 text-white'
                      : 'text-pos-text active:bg-green-500 active:text-white'
                      }`}
                    onClick={() => setUserReportKind('x')}
                  >
                    X
                  </button>
                </div>
                <div className="relative grid grid-cols-2 flex-1 px-4 min-h-0 gap-4">
                  <div className="flex flex-col min-h-0 gap-3">
                    <div
                      key={userReportKind}
                      id="user-report-pospoint-scroll"
                      className="flex-1 overflow-auto rounded-xl border border-pos-border bg-white text-gray-800 p-4 min-h-[400px]"
                    >
                      <div className="text-sm font-mono space-y-1 whitespace-pre-wrap text-center">
                        <div className="text-base font-medium mb-2">Retail POS</div>
                        <div className="mb-2">BE.0.0.0</div>
                        <div className="flex justify-between border-b border-dotted border-gray-400 pb-1 mb-2 text-xs">
                          <span>Date : {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')}</span>
                          <span>Tijd: {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>
                        </div>
                        <div className="border-b border-dotted border-gray-400 pb-2 mb-4 font-semibold text-sm">
                          {userReportKind === 'z'
                            ? tr('control.reports.userZReportTitle', 'Z USER REPORT #1')
                            : tr('control.reports.userXReportTitle', 'X USER REPORT #3')}
                        </div>
                        <div className="text-left space-y-2 text-xs sm:text-sm">
                          {userReportLoading ? (
                            <div className="text-sm text-gray-500">{tr('loading', 'Loading...')}</div>
                          ) : (
                            userReportLines.map((line, idx) => (
                              <div key={`user-report-line-${idx}`}>{line}</div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-2 py-2 shrink-0">
                      <div className="flex-1" />
                      <PaginationArrows
                        canPrev={true}
                        canNext={true}
                        onPrev={() => {
                          const el = document.getElementById('user-report-pospoint-scroll');
                          if (el) el.scrollBy({ top: -200, behavior: 'smooth' });
                        }}
                        onNext={() => {
                          const el = document.getElementById('user-report-pospoint-scroll');
                          if (el) el.scrollBy({ top: 200, behavior: 'smooth' });
                        }}
                        className="relative py-0"
                      />
                      <div className="flex-1" />
                    </div>
                  </div>
                  <div className="flex flex-col h-full gap-3 shrink-0 justify-center items-center">
                    <button
                      type="button"
                      disabled={reportPrintBusy !== null}
                      className="flex items-center h-[40px] w-[120px] gap-2 px-4 py-2 rounded-lg bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 text-sm disabled:opacity-50 disabled:pointer-events-none"
                      onClick={async () => {
                        if (reportPrintBusy != null) return;
                        setReportPrintBusy('user');
                        try {
                          let lines = userReportLines;
                          if (!Array.isArray(lines) || lines.length === 0) {
                            const data = await fetchUserReport({
                              kind: userReportKind,
                              lang: appLanguage,
                              userName: reportUserName,
                              storeName: '',
                              registerId: String(currentRegisterId || '').trim() || null,
                              registerName: String(currentRegisterName || '').trim() || null,
                              reportSettings,
                            });
                            lines = Array.isArray(data?.lines) ? data.lines : [];
                            setUserReportLines(lines);
                          }
                          await printPeriodicReportLines(lines);
                        } catch (e) {
                          setReportPrintErrorMessage(
                            e?.message || tr('control.reports.printFailed', 'Could not print on the main printer.'),
                          );
                        } finally {
                          setReportPrintBusy(null);
                        }
                      }}
                    >
                      {reportPrintBusy === 'user' ? (
                        <ReportPrintSpinner className="w-4 h-4" />
                      ) : (
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                      )}
                      {reportPrintBusy === 'user' ? tr('control.reports.printing', 'Printing…') : tr('control.reports.print', 'Print')}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {reportTabId === 'periodic' && (
              <div className="flex flex-col gap-4 flex-1 min-h-0">
                {/* Date and time row */}
                <div className="flex flex-wrap items-center justify-around gap-3 shrink-0">
                  <Dropdown options={PERIODIC_REPORT_TIME_OPTIONS} value={periodicReportStartTime} onChange={setPeriodicReportStartTime} placeholder="00:00" className="text-sm min-w-[80px]" />
                  <input
                    type="date"
                    value={ddMmYyyyToDateInput(periodicReportStartDate)}
                    onChange={(e) => setPeriodicReportStartDate(dateInputToDdMmYyyy(e.target.value))}
                    className="w-[140px] px-3 py-2 rounded-lg bg-pos-panel border border-pos-border text-pos-text text-sm"
                  />
                  <span className="text-pos-text text-sm">{tr('control.reports.to', 'to')}</span>
                  <Dropdown options={PERIODIC_REPORT_TIME_OPTIONS} value={periodicReportEndTime} onChange={setPeriodicReportEndTime} placeholder="24:00" className="text-sm min-w-[80px]" />
                  <input
                    type="date"
                    value={ddMmYyyyToDateInput(periodicReportEndDate)}
                    onChange={(e) => setPeriodicReportEndDate(dateInputToDdMmYyyy(e.target.value))}
                    className="w-[140px] px-3 py-2 rounded-lg bg-pos-panel border border-pos-border text-pos-text text-sm"
                  />
                  <button
                    type="button"
                    disabled={periodicReportLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 text-sm font-medium disabled:opacity-50 disabled:pointer-events-none"
                    onClick={() => void handleMakePeriodicReport()}
                  >
                    {periodicReportLoading
                      ? tr('control.reports.generating', 'Generating…')
                      : tr('control.reports.makeReport', 'Make report')}
                  </button>
                </div>
                {/* Report area (left) + Info panel (right) */}
                <div className="flex gap-4 flex-1 min-h-0">
                  <div className="relative flex-1 min-w-0 flex flex-col rounded-xl border border-pos-border bg-white min-h-[400px] overflow-hidden">
                    <div
                      id="periodic-report-scroll"
                      className="flex-1 overflow-auto p-5 text-gray-800 min-h-[300px] flex flex-col"
                    >
                      {periodicReportLines == null ? (
                        <p className="text-gray-500 font-sans text-base">
                          {tr('control.reports.selectPeriodHint', 'Select period and click "Make report" to generate the report.')}
                        </p>
                      ) : (
                        <>
                          {periodicReportLines[0]?.trim() ? (
                            <div className="shrink-0 text-center font-sans font-bold text-gray-900 text-3xl sm:text-4xl md:text-[2.75rem] leading-tight tracking-tight py-3 px-2">
                              {periodicReportLines[0].trim()}
                            </div>
                          ) : null}
                          <div className="mt-1 flex-1 min-h-0 flex flex-col gap-1 text-left">
                            {splitPeriodicReportBodyIntoChunks(
                              periodicReportLines.length > 1 ? periodicReportLines.slice(1).join('\n') : '',
                            ).map((chunk, i) =>
                              chunk.kind === 'title' ? (
                                <div
                                  key={`pt-${i}`}
                                  className="shrink-0 text-center font-sans font-bold text-gray-900 text-2xl sm:text-3xl leading-tight tracking-tight py-2 px-2"
                                >
                                  {chunk.text}
                                </div>
                              ) : chunk.text ? (
                                <pre
                                  key={`pm-${i}`}
                                  className="font-mono text-base sm:text-lg leading-relaxed whitespace-pre-wrap tabular-nums text-gray-900 m-0 w-full text-left"
                                >
                                  {chunk.text}
                                </pre>
                              ) : null,
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-gray-50 shrink-0">
                      <div className="flex-1" />
                      <PaginationArrows
                        canPrev={true}
                        canNext={true}
                        onPrev={() => {
                          const el = document.getElementById('periodic-report-scroll');
                          if (el) el.scrollBy({ top: -200, behavior: 'smooth' });
                        }}
                        onNext={() => {
                          const el = document.getElementById('periodic-report-scroll');
                          if (el) el.scrollBy({ top: 200, behavior: 'smooth' });
                        }}
                        className="relative py-0"
                      />
                      <div className="flex-1 flex justify-end">
                        <button
                          type="button"
                          disabled={!periodicReportLines?.length || reportPrintBusy !== null}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 text-sm disabled:opacity-40 disabled:pointer-events-none"
                          onClick={async () => {
                            if (reportPrintBusy != null || !periodicReportLines?.length) return;
                            setReportPrintBusy('periodic');
                            try {
                              await printPeriodicReportLines(periodicReportLines);
                            } catch (e) {
                              setReportPrintErrorMessage(
                                e?.message || tr('control.reports.printFailed', 'Could not print on the main printer.'),
                              );
                            } finally {
                              setReportPrintBusy(null);
                            }
                          }}
                        >
                          {reportPrintBusy === 'periodic' ? (
                            <ReportPrintSpinner className="w-4 h-4" />
                          ) : (
                            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                          )}
                          {reportPrintBusy === 'periodic' ? tr('control.reports.printing', 'Printing…') : tr('control.reports.print', 'Print')}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 w-[280px] rounded-xl border border-pos-border bg-white p-4 text-gray-800 text-sm leading-relaxed">
                    <p className="font-medium text-gray-900 mb-2 text-sm">{tr('control.reports.periodicInfo1', 'In this new management system we work with 24:00 instead of 00:00 as the end point as in the web panel.')}</p>
                    <p className="mb-2">{tr('control.reports.periodicExample', 'Example,')}</p>
                    <p className="mb-2">{tr('control.reports.periodicExample2', 'all turnover of 27-02-2026')}</p>
                    <p className="font-medium mt-3">{tr('control.reports.periodicEarlier', 'Earlier:')}</p>
                    <p className="mb-2">{tr('control.reports.periodicEarlierExample', '00:00 27-02-2026 to 00:00 28-02-2026')}</p>
                    <p className="font-medium mt-3">{tr('control.reports.periodicNot', 'Not:')}</p>
                    <p>{tr('control.reports.periodicNotExample', '00:00 27-02-2026 to 24:00 27-02-2026')}</p>
                  </div>
                </div>
              </div>
            )}
            {reportTabId === 'settings' && (
              <div className="rounded-xl border border-pos-border bg-pos-panel/30 p-4 pb-[60px] min-h-[650px]">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-pos-border">
                        <th className="text-pos-text text-sm font-medium py-2 pr-4"></th>
                        <th className="text-pos-text text-sm font-medium py-2 px-3 text-center w-16">Z</th>
                        <th className="text-pos-text text-sm font-medium py-2 px-3 text-center w-16">X</th>
                        <th className="text-pos-text text-sm font-medium py-2 px-3 text-center w-20">{tr('control.reports.periodic', 'Periodic')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {REPORT_SETTINGS_ROWS.map((row) => (
                        <tr key={row.id} className="border-b border-pos-border/70">
                          <td className="text-pos-text text-sm py-2 pr-4">{tr(row.labelKey, row.fallback)}</td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={reportSettings[row.id]?.z ?? false}
                              onChange={(e) => setReportSetting(row.id, 'z', e.target.checked)}
                              className="w-5 h-5 rounded border-pos-border bg-pos-bg text-green-600 focus:ring-green-500"
                            />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={reportSettings[row.id]?.x ?? false}
                              onChange={(e) => setReportSetting(row.id, 'x', e.target.checked)}
                              className="w-5 h-5 rounded border-pos-border bg-pos-bg text-green-600 focus:ring-green-500"
                            />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={reportSettings[row.id]?.periodic ?? false}
                              onChange={(e) => setReportSetting(row.id, 'periodic', e.target.checked)}
                              className="w-5 h-5 rounded border-pos-border bg-pos-bg text-green-600 focus:ring-green-500"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-center mt-6">
                  <button
                    type="button"
                    className="flex items-center gap-2 px-6 py-3 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50 text-sm"
                    disabled={savingReportSettings}
                    onClick={handleSaveReportSettings}
                  >
                    <svg fill="currentColor" className="w-4 h-4" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" /></svg>
                    {tr('control.save', 'Save')}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : controlSidebarId === 'importExport' ? (
          <div className="rounded-xl border border-pos-border bg-pos-panel/30 p-8 min-h-[750px]">
            <h2 className="text-pos-text text-2xl font-medium mb-6">{tr('control.importExport.title', 'Import / Export')}</h2>
            <p className="text-pos-muted text-xl mb-10">
              {tr(
                'control.importExport.description',
                'Export a full database backup file or import an existing backup file.',
              )}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-xl border border-pos-border bg-pos-bg p-6 flex flex-col h-full">
                <h3 className="text-xl font-medium text-pos-text mb-2">{tr('control.importExport.exportTitle', 'Export backup')}</h3>
                <p className="text-pos-muted text-sm mb-5">
                  {tr('control.importExport.exportDescription', 'Download the current database as a backup file.')}
                </p>
                <button
                  type="button"
                  className="mt-auto px-6 py-3 rounded-lg bg-green-600 text-white font-medium text-sm active:bg-green-500 disabled:opacity-50"
                  disabled={importExportBusy}
                  onClick={handleExportBackup}
                >
                  {backupBusyAction === 'export'
                    ? tr('control.importExport.exporting', 'Exporting...')
                    : tr('control.importExport.exportButton', 'Export backup file')}
                </button>
              </div>
              <div className="rounded-xl border border-pos-border bg-pos-bg p-6 flex flex-col h-full">
                <h3 className="text-xl font-medium text-pos-text mb-2">{tr('control.importExport.importTitle', 'Import backup')}</h3>
                <p className="text-pos-muted text-sm mb-5">
                  {tr(
                    'control.importExport.importDescription',
                    'Select a backup file (.db) and import it into the POS database.',
                  )}
                </p>
                <button
                  type="button"
                  className="mt-auto px-6 py-3 rounded-lg bg-green-600 text-white font-medium text-sm active:bg-green-500 disabled:opacity-50"
                  disabled={importExportBusy}
                  onClick={handleOpenImportPicker}
                >
                  {backupBusyAction === 'import'
                    ? tr('control.importExport.importing', 'Importing...')
                    : tr('control.importExport.importButton', 'Import backup file')}
                </button>
                <input
                  ref={backupFileInputRef}
                  type="file"
                  accept=".db,application/octet-stream"
                  className="hidden"
                  onChange={handleImportBackupFileChange}
                />
              </div>
            </div>
            <h3 className="text-pos-text text-xl font-medium mt-10 mb-4">
              {tr('control.importExport.xlsxTitle', 'Page data (XLSX)')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-xl border border-pos-border bg-pos-bg p-6 flex flex-col h-full">
                <h4 className="text-lg font-medium text-pos-text mb-3">
                  {tr('control.importExport.xlsxExportCardTitle', 'Export selected page')}
                </h4>
                <label className="text-pos-muted text-sm mb-2">
                  {tr('control.importExport.selectExportLabel', 'Select data to export')}
                </label>
                <Dropdown
                  options={IMPORT_EXPORT_DATASET_OPTIONS.map((option) => ({
                    value: option.value,
                    label: tr(`control.importExport.dataset.${option.value}`, option.label),
                  }))}
                  value={selectedDatasetForExport}
                  onChange={setSelectedDatasetForExport}
                  disabled={importExportBusy}
                  openUp
                  className="mb-5"
                  labelClassName="border-pos-border"
                />
                <button
                  type="button"
                  className="mt-auto px-6 py-3 rounded-lg bg-green-600 text-white font-medium text-sm active:bg-green-500 disabled:opacity-50"
                  disabled={importExportBusy}
                  onClick={handleExportDatasetXlsx}
                >
                  {datasetBusyAction === 'export-xlsx'
                    ? tr('control.importExport.xlsxExporting', 'Exporting XLSX...')
                    : tr('control.importExport.xlsxExportButton', 'Export XLSX')}
                </button>
              </div>
              <div className="rounded-xl border border-pos-border bg-pos-bg p-6 flex flex-col h-full">
                <h4 className="text-lg font-medium text-pos-text mb-3">
                  {tr('control.importExport.xlsxImportCardTitle', 'Import selected page')}
                </h4>
                <label className="text-pos-muted text-sm mb-2">
                  {tr('control.importExport.selectImportLabel', 'Select data to import')}
                </label>
                <Dropdown
                  options={IMPORT_EXPORT_DATASET_OPTIONS.map((option) => ({
                    value: option.value,
                    label: tr(`control.importExport.dataset.${option.value}`, option.label),
                  }))}
                  value={selectedDatasetForImport}
                  onChange={setSelectedDatasetForImport}
                  disabled={importExportBusy}
                  openUp
                  className="mb-5"
                  labelClassName="border-pos-border"
                />
                <button
                  type="button"
                  className="mt-auto px-6 py-3 rounded-lg bg-green-600 text-white font-medium text-sm active:bg-green-500 disabled:opacity-50"
                  disabled={importExportBusy}
                  onClick={handleOpenXlsxImportPicker}
                >
                  {datasetBusyAction === 'import-xlsx'
                    ? tr('control.importExport.xlsxImporting', 'Importing XLSX...')
                    : tr('control.importExport.xlsxImportButton', 'Import XLSX')}
                </button>
                <input
                  ref={xlsxImportFileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleImportDatasetXlsxFileChange}
                />
              </div>
            </div>
            {backupStatusMessage ? (
              <div className="mt-8 rounded-lg border border-green-500/50 bg-green-500/10 px-4 py-3 text-green-300 text-sm">
                {backupStatusMessage}
              </div>
            ) : null}
            {backupErrorMessage ? (
              <div className="mt-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-red-300 text-sm">
                {backupErrorMessage}
              </div>
            ) : null}
          </div>
        ) : controlSidebarId === 'users' ? (
          <div className="relative min-h-[750px] rounded-xl border border-pos-border bg-pos-panel/30 p-4 pb-[60px]">
            <div className="flex items-center w-full justify-center mb-2">
              <button
                type="button"
                className="px-6 py-3 rounded-lg text-sm font-medium bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 active:border-white/30 transition-colors"
                onClick={openNewUserModal}
              >
                {tr('control.users.new', 'New user')}
              </button>
            </div>
            {usersLoading && users.length === 0 ? null : users.length === 0 ? (
              <ul className="w-full flex flex-col"><li className="text-pos-muted text-xl font-medium text-center py-4">{tr('control.users.empty', 'No users yet.')}</li></ul>
            ) : (
              <>
                <div
                  ref={usersListRef}
                  className="max-h-[610px] overflow-y-auto rounded-lg [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                  onScroll={updateUsersScrollState}
                >
                  <ul className="w-full flex flex-col">
                    {[...users].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((u) => (
                      <li
                        key={u.id}
                        className="flex items-center w-full gap-3 px-4 py-2 bg-pos-bg border-y border-pos-panel text-pos-text text-sm"
                      >
                        <span className="font-medium min-w-0 max-w-[38%] truncate shrink-0">{u.name || '—'}</span>
                        <span className="flex-1 text-center text-pos-muted text-sm truncate px-1">
                          {u?.role === 'admin'
                            ? tr('control.userModal.roleAdmin', 'Admin')
                            : tr('control.userModal.roleWaiter', 'Waiter')}
                        </span>
                        <div className="flex items-center gap-2 shrink-0 ml-auto">
                          <button
                            type="button"
                            className="p-2 rounded text-pos-text mr-5 active:text-green-500"
                            onClick={() => openEditUserModal(u)}
                            aria-label={tr('control.edit', 'Edit')}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button
                            type="button"
                            className="p-2 rounded text-pos-text active:text-rose-500"
                            onClick={() => setDeleteConfirmUserId(u.id)}
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
                  canPrev={canUsersScrollUp}
                  canNext={canUsersScrollDown}
                  onPrev={() => scrollUsersByPage('up')}
                  onNext={() => scrollUsersByPage('down')}
                />
              </>
            )}
          </div>
        ) : controlSidebarId === 'language' ? (
          <div className="rounded-xl border border-pos-border bg-pos-panel/30 p-8 min-h-[750px]">
            <h2 className="text-pos-text text-2xl font-medium mb-6">{tr('control.languageTitle', 'Language')}</h2>
            <p className="text-pos-muted text-xl mb-8">{tr('control.languageDescription', 'Select the language for the application.')}</p>
            <div className="flex flex-wrap gap-4 w-full flex justify-center min-h-[200px] items-center">
              {LANGUAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAppLanguage(opt.value)}
                  className={`px-8 py-4 rounded-xl text-xl font-medium border-2 transition-colors ${appLanguage === opt.value
                    ? 'bg-pos-panel border-green-500 text-green-400'
                    : 'bg-pos-bg border-pos-border text-pos-text active:border-pos-muted active:bg-green-500'
                    }`}
                >
                  {tr(`control.languageOption.${opt.value}`, opt.label)}
                </button>
              ))}
            </div>
            <div className="mt-10 flex w-full justify-center">
              <button
                type="button"
                className="flex items-center gap-4 px-6 py-3 rounded-lg bg-green-600 text-white font-medium active:bg-green-500 disabled:opacity-50 text-2xl"
                disabled={savingAppLanguage || appLanguage === lang}
                onClick={handleSaveAppLanguage}
              >
                <svg fill="currentColor" width="24" height="24" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M-5.732,2.97-7.97.732a2.474,2.474,0,0,0-1.483-.7A.491.491,0,0,0-9.591,0H-18.5A2.5,2.5,0,0,0-21,2.5v11A2.5,2.5,0,0,0-18.5,16h11A2.5,2.5,0,0,0-5,13.5V4.737A2.483,2.483,0,0,0-5.732,2.97ZM-13,1V5.455h-3.591V1Zm-4.272,14V10.545h8.544V15ZM-6,13.5A1.5,1.5,0,0,1-7.5,15h-.228V10.045a.5.5,0,0,0-.5-.5h-9.544a.5.5,0,0,0-.5.5V15H-18.5A1.5,1.5,0,0,1-20,13.5V2.5A1.5,1.5,0,0,1-18.5,1h.909V5.955a.5.5,0,0,0,.5.5h7.5a.5.5,0,0,0,.5-.5v-4.8a1.492,1.492,0,0,1,.414.285l2.238,2.238A1.511,1.511,0,0,1-6,4.737Z" transform="translate(21)" /></svg>
                {tr('control.save', 'Save')}
              </button>
            </div>
            <p className="text-pos-muted text-lg mt-8 text-center">{tr('control.currentLanguage', 'Current language')}: {tr(`control.languageOption.${appLanguage}`, LANGUAGE_OPTIONS.find((o) => o.value === appLanguage)?.label ?? 'English')}</p>
          </div>
        ) : topNavId === 'cash-register' ? (
          <div className="relative min-h-[580px] rounded-xl border border-pos-border bg-pos-panel/30 p-4 pb-[60px]">
            {subNavId === 'Payment types' && (
              <div className="relative flex flex-col min-h-[610px] pb-[60px]">
                <div className="flex items-center justify-center mb-2">
                  <button
                    type="button"
                    className="px-6 py-3 rounded-lg text-sm font-medium bg-pos-panel border border-pos-border text-pos-text active:bg-green-500 active:border-white/30 transition-colors disabled:opacity-50"
                    disabled={paymentTypesLoading}
                    onClick={openNewPaymentTypeModal}
                  >
                    {tr('control.paymentTypes.new', 'New Payment Method')}
                  </button>
                </div>
                {(() => {
                  if (paymentTypesLoading) {
                    return (
                      <ul className="w-full flex flex-col">
                        <li className="text-pos-muted text-xl py-4">{tr('control.paymentTypes.loading', 'Loading payment methods...')}</li>
                      </ul>
                    );
                  }
                  const sorted = [...paymentTypes].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
                  if (sorted.length === 0) {
                    return (
                      <ul className="w-full flex flex-col">
                        <li className="text-pos-muted text-xl font-medium text-center py-4">{tr('control.paymentTypes.empty', 'No payment methods yet.')}</li>
                      </ul>
                    );
                  }
                  return (
                    <>
                      <div
                        ref={paymentTypesListRef}
                        className="max-h-[510px] overflow-y-auto rounded-lg border border-pos-border [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                        onScroll={updatePaymentTypesScrollState}
                      >
                        <ul className="w-full flex flex-col">
                          {sorted.map((pt) => (
                            <li
                              key={pt.id}
                              className="flex items-center w-full px-4 py-1 border-b border-pos-border last:border-b-0 bg-pos-bg transition-colors"
                            >
                              <span className="flex-1 text-pos-text text-sm font-medium">{pt.name}</span>
                              <span className="w-[160px] shrink-0 text-pos-muted text-xs mr-2">
                                {tr(`control.paymentTypes.integration.${pt.integration}`, pt.integration || '—')}
                              </span>
                              <button
                                type="button"
                                className="p-2 rounded text-pos-text active:bg-green-500 shrink-0"
                                aria-label={pt.active ? tr('control.paymentTypes.deactivate', 'Deactivate') : tr('control.paymentTypes.activate', 'Activate')}
                                onClick={() => togglePaymentTypeActive(pt.id)}
                              >
                                {pt.active ? (
                                  <span className="w-4 h-4 inline-flex justify-center items-center text-green-500 text-sm">{'\u2713'}</span>
                                ) : (
                                  <span className="w-4 h-4 inline-block rounded-full border-2 border-pos-muted" />
                                )}
                              </button>
                              <button
                                type="button"
                                className="p-2 rounded text-pos-text active:bg-green-500 shrink-0"
                                onClick={() => openEditPaymentTypeModal(pt)}
                                aria-label={tr('control.edit', 'Edit')}
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                              <button
                                type="button"
                                className="p-2 mr-5 rounded text-pos-text active:bg-green-500 shrink-0"
                                onClick={() => setDeleteConfirmPaymentTypeId(pt.id)}
                                aria-label={tr('delete', 'Delete')}
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <PaginationArrows
                        canPrev={canPaymentTypesScrollUp}
                        canNext={canPaymentTypesScrollDown}
                        onPrev={() => scrollPaymentTypesByPage('up')}
                        onNext={() => scrollPaymentTypesByPage('down')}
                      />
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        ) : topNavId === 'categories-products' ? (
          <ControlViewCategoriesProductsContent
            tr={tr}
            subNavId={subNavId}
            priceGroupsLoading={priceGroupsLoading}
            openPriceGroupModal={openPriceGroupModal}
            priceGroups={priceGroups}
            priceGroupsListRef={priceGroupsListRef}
            updatePriceGroupsScrollState={updatePriceGroupsScrollState}
            openEditPriceGroupModal={openEditPriceGroupModal}
            setDeleteConfirmId={setDeleteConfirmId}
            canPriceGroupsScrollUp={canPriceGroupsScrollUp}
            canPriceGroupsScrollDown={canPriceGroupsScrollDown}
            scrollPriceGroupsByPage={scrollPriceGroupsByPage}
            categories={categories}
            categoriesLoading={categoriesLoading}
            openCategoryModal={openCategoryModal}
            categoriesListRef={categoriesListRef}
            updateCategoriesScrollState={updateCategoriesScrollState}
            handleMoveCategory={handleMoveCategory}
            openEditCategoryModal={openEditCategoryModal}
            setDeleteConfirmCategoryId={setDeleteConfirmCategoryId}
            canCategoriesScrollUp={canCategoriesScrollUp}
            canCategoriesScrollDown={canCategoriesScrollDown}
            scrollCategoriesByPage={scrollCategoriesByPage}
            selectedCategoryId={selectedCategoryId}
            productsLoading={productsLoading}
            openProductModal={openProductModal}
            openProductPositioningModal={openProductPositioningModal}
            productSearch={productSearch}
            setProductSearch={setProductSearch}
            setShowProductSearchKeyboard={setShowProductSearchKeyboard}
            setSelectedCategoryId={setSelectedCategoryId}
            setSelectedProductId={setSelectedProductId}
            selectedProductId={selectedProductId}
            productsCategoryTabsRef={productsCategoryTabsRef}
            productsListRef={productsListRef}
            updateProductsScrollState={updateProductsScrollState}
            filteredProducts={filteredProducts}
            productHasSubproductsById={productHasSubproductsById}
            openProductSubproductsModal={openProductSubproductsModal}
            openEditProductModal={openEditProductModal}
            setDeleteConfirmProductId={setDeleteConfirmProductId}
            canProductsScrollUp={canProductsScrollUp}
            canProductsScrollDown={canProductsScrollDown}
            scrollProductsByPage={scrollProductsByPage}
            subproductsLoading={subproductsLoading}
            openSubproductModal={openSubproductModal}
            setShowManageGroupsModal={setShowManageGroupsModal}
            subproductGroups={subproductGroups}
            selectedSubproductGroupId={selectedSubproductGroupId}
            setSelectedSubproductGroupId={setSelectedSubproductGroupId}
            setSelectedSubproductId={setSelectedSubproductId}
            subproductsGroupTabsRef={subproductsGroupTabsRef}
            subproductsListRef={subproductsListRef}
            updateSubproductsScrollState={updateSubproductsScrollState}
            subproductGroupsLoading={subproductGroupsLoading}
            subproducts={subproducts}
            selectedSubproductId={selectedSubproductId}
            openEditSubproductModal={openEditSubproductModal}
            setDeleteConfirmSubproductId={setDeleteConfirmSubproductId}
            canSubproductsScrollUp={canSubproductsScrollUp}
            canSubproductsScrollDown={canSubproductsScrollDown}
            scrollSubproductsByPage={scrollSubproductsByPage}
            openNewKitchenModal={openNewKitchenModal}
            kitchens={kitchens}
            kitchenListRef={kitchenListRef}
            updateKitchenScrollState={updateKitchenScrollState}
            openKitchenProductsModal={openKitchenProductsModal}
            openEditKitchenModal={openEditKitchenModal}
            setDeleteConfirmKitchenId={setDeleteConfirmKitchenId}
            canKitchenScrollUp={canKitchenScrollUp}
            canKitchenScrollDown={canKitchenScrollDown}
            scrollKitchenByPage={scrollKitchenByPage}
            openNewDiscountModal={openNewDiscountModal}
            discounts={discounts}
            discountsListRef={discountsListRef}
            updateDiscountsScrollState={updateDiscountsScrollState}
            openEditDiscountModal={openEditDiscountModal}
            setDeleteConfirmDiscountId={setDeleteConfirmDiscountId}
            canDiscountsScrollUp={canDiscountsScrollUp}
            canDiscountsScrollDown={canDiscountsScrollDown}
            scrollDiscountsByPage={scrollDiscountsByPage}
          />
        ) : topNavId === 'external-devices' ? (
          <div className="rounded-xl border border-pos-border bg-pos-panel/30 p-8 py-2 min-h-[650px] max-h-[550px]">
            {false && subNavId === 'Printer' && (
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
                                        <span className="w-4 h-4 inline-flex justify-center items-center text-green-500 text-sm">{'\u2713'}</span>
                                      ) : (
                                        <span className="w-4 h-4 inline-block rounded-full border-2 border-pos-muted" />
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
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    </button>
                                    <button
                                      type="button"
                                      className="p-2 rounded text-pos-text active:text-rose-500"
                                      onClick={() => setDeleteConfirmPrinterId(p.id)}
                                      aria-label={tr('delete', 'Delete')}
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                  </div>
                                  <PaginationArrows
                                    canPrev={canPrev}
                                    canNext={canNext}
                                    onPrev={() => setPrintersPage((p) => Math.max(0, p - 1))}
                                    onNext={() => setPrintersPage((p) => Math.min(totalPages - 1, p + 1))}
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
                    <div className="grid grid-cols-1 text-sm md:grid-cols-2 gap-x-10 gap-y-4 mb-6">
                      <div className="flex flex-col gap-4">
                        <div className='flex items-start gap-2'>
                          <label className="block text-pos-text font-medium min-w-[130px] max-w-[130px]">{tr('control.finalTickets.companyData', 'Company data:')}</label>
                          <div className='grid grid-cols-2 items-start gap-4'>
                            <input type="text" value={finalTicketsCompanyData1} onChange={(e) => setFinalTicketsCompanyData1(e.target.value)} onFocus={() => setFinalTicketsActiveField('companyData1')} className="px-4 min-w-[100px] max-w-[100px] flex py-3 bg-pos-panel h-[40px] border border-gray-300 rounded-lg justify-start items-start text-gray-200" />
                            {[2, 3, 4, 5].map((i) => (
                              <div key={i}>
                                <input type="text" value={i === 2 ? finalTicketsCompanyData2 : i === 3 ? finalTicketsCompanyData3 : i === 4 ? finalTicketsCompanyData4 : finalTicketsCompanyData5} onChange={(e) => { if (i === 2) setFinalTicketsCompanyData2(e.target.value); else if (i === 3) setFinalTicketsCompanyData3(e.target.value); else if (i === 4) setFinalTicketsCompanyData4(e.target.value); else setFinalTicketsCompanyData5(e.target.value); }} onFocus={() => setFinalTicketsActiveField('companyData' + i)} className="px-4 min-w-[100px] max-w-[100px] py-3 bg-pos-panel h-[40px] border border-gray-300 rounded-lg text-gray-200" placeholder="" />
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className='flex items-center gap-2'>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4 mb-6 text-sm">
                      <div className="flex flex-col gap-4">
                        <div className="flex gap-10 items-center">
                          <label className="block text-pos-text font-medium min-w-[200px] max-w-[200px]">{tr('control.prodTickets.displayCategories', 'Display categories on production ticket:')}</label>
                          <input type="checkbox" checked={prodTicketsDisplayCategories} onChange={(e) => setProdTicketsDisplayCategories(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                        </div>
                        <div className="flex gap-10 items-center">
                          <label className="block text-pos-text font-medium min-w-[200px] max-w-[200px]">{tr('control.prodTickets.spaceAbove', 'Space above ticket:')}</label>
                          <input type="checkbox" checked={prodTicketsSpaceAbove} onChange={(e) => setProdTicketsSpaceAbove(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                        </div>
                        <div className="flex gap-10 items-center">
                          <label className="block text-pos-text font-medium min-w-[200px] max-w-[200px]">{tr('control.finalTickets.ticketTearable', 'Ticket tearable:')}</label>
                          <input type="checkbox" checked={prodTicketsTicketTearable} onChange={(e) => setProdTicketsTicketTearable(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                        </div>
                        <div className="flex gap-10 items-center">
                          <label className="block text-pos-text font-medium min-w-[200px] max-w-[200px]">{tr('control.prodTickets.keukenprinterBuzzer', 'Kitchen printer buzzer:')}</label>
                          <input type="checkbox" checked={prodTicketsKeukenprinterBuzzer} onChange={(e) => setProdTicketsKeukenprinterBuzzer(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                        </div>
                        <div className="flex gap-10 items-center">
                          <label className="block text-pos-text font-medium min-w-[200px] max-w-[200px]">{tr('control.prodTickets.productsIndividually', 'Print products individually:')}</label>
                          <input type="checkbox" checked={prodTicketsProductenIndividueel} onChange={(e) => setProdTicketsProductenIndividueel(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                        </div>
                        <div className="flex gap-10 items-center">
                          <label className="block text-pos-text font-medium min-w-[200px] max-w-[200px]">{tr('control.prodTickets.eatInTakeOutBottom', 'Print Eat in / Take out at bottom:')}</label>
                          <input type="checkbox" checked={prodTicketsEatInTakeOutOnderaan} onChange={(e) => setProdTicketsEatInTakeOutOnderaan(e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                        </div>
                      </div>
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                          <label className="block text-pos-text font-medium min-w-[180px] max-w-[180px] shrink-0">{tr('control.prodTickets.nextCoursePrinter', 'Next course printer {n}:').replace('{n}', '1')}</label>
                          <Dropdown options={mapTranslatedOptions(productionTicketsPrinterOptions)} value={prodTicketsNextCoursePrinter1} onChange={setProdTicketsNextCoursePrinter1} placeholder={tr('control.external.disabled', 'Disabled')} className="min-w-[150px]" />
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="block text-pos-text font-medium min-w-[180px] max-w-[180px] shrink-0">{tr('control.prodTickets.nextCoursePrinter', 'Next course printer {n}:').replace('{n}', '2')}</label>
                          <Dropdown options={mapTranslatedOptions(productionTicketsPrinterOptions)} value={prodTicketsNextCoursePrinter2} onChange={setProdTicketsNextCoursePrinter2} placeholder={tr('control.external.disabled', 'Disabled')} className="min-w-[150px]" />
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="block text-pos-text font-medium min-w-[180px] max-w-[180px] shrink-0">{tr('control.prodTickets.nextCoursePrinter', 'Next course printer {n}:').replace('{n}', '3')}</label>
                          <Dropdown options={mapTranslatedOptions(productionTicketsPrinterOptions)} value={prodTicketsNextCoursePrinter3} onChange={setProdTicketsNextCoursePrinter3} placeholder={tr('control.external.disabled', 'Disabled')} className="min-w-[150px]" />
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="block text-pos-text font-medium min-w-[180px] max-w-[180px] shrink-0">{tr('control.prodTickets.nextCoursePrinter', 'Next course printer {n}:').replace('{n}', '4')}</label>
                          <Dropdown options={mapTranslatedOptions(productionTicketsPrinterOptions)} value={prodTicketsNextCoursePrinter4} onChange={setProdTicketsNextCoursePrinter4} placeholder={tr('control.external.disabled', 'Disabled')} className="min-w-[150px]" />
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="block text-pos-text font-medium min-w-[180px] max-w-[180px] shrink-0">{tr('control.prodTickets.printingOrder', 'Printing order of production ticket:')}</label>
                          <Dropdown options={mapTranslatedOptions(PRINTING_ORDER_OPTIONS)} value={prodTicketsPrintingOrder} onChange={setProdTicketsPrintingOrder} placeholder={tr('control.external.select', 'Select')} className="min-w-[150px]" />
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="block text-pos-text font-medium min-w-[180px] max-w-[180px] shrink-0">{tr('control.prodTickets.groupingReceipt', 'Grouping receipt:')}</label>
                          <Dropdown options={mapTranslatedOptions(GROUPING_RECEIPT_OPTIONS)} value={prodTicketsGroupingReceipt} onChange={setProdTicketsGroupingReceipt} placeholder={tr('control.external.select', 'Select')} className="min-w-[150px]" />
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="block text-pos-text font-medium min-w-[180px] max-w-[180px] shrink-0">{tr('control.prodTickets.transferPrinter', 'Transfer printer:')}</label>
                          <Dropdown options={mapTranslatedOptions(productionTicketsPrinterOptions)} value={prodTicketsPrinterOverboeken} onChange={setProdTicketsPrinterOverboeken} placeholder={tr('control.external.disabled', 'Disabled')} className="min-w-[150px]" />
                        </div>
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
                    <div className="relative min-h-[400px] max-h-[580px] rounded-xl border border-pos-border bg-pos-panel/30 p-4 pb-[60px]">
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
            )}
            {subNavId === 'Printer' && (
              <ControlViewExternalPrinter
                tr={tr}
                PRINTER_TAB_DEFS={PRINTER_TAB_DEFS}
                printerTab={printerTab}
                setPrinterTab={setPrinterTab}
                openNewPrinterModal={openNewPrinterModal}
                printers={printers}
                PRINTERS_PAGE_SIZE={PRINTERS_PAGE_SIZE}
                printersPage={printersPage}
                setDefaultPrinter={setDefaultPrinter}
                openEditPrinterModal={openEditPrinterModal}
                setDeleteConfirmPrinterId={setDeleteConfirmPrinterId}
                setPrintersPage={setPrintersPage}
                finalTicketsCompanyData1={finalTicketsCompanyData1}
                setFinalTicketsCompanyData1={setFinalTicketsCompanyData1}
                finalTicketsCompanyData2={finalTicketsCompanyData2}
                setFinalTicketsCompanyData2={setFinalTicketsCompanyData2}
                finalTicketsCompanyData3={finalTicketsCompanyData3}
                setFinalTicketsCompanyData3={setFinalTicketsCompanyData3}
                finalTicketsCompanyData4={finalTicketsCompanyData4}
                setFinalTicketsCompanyData4={setFinalTicketsCompanyData4}
                finalTicketsCompanyData5={finalTicketsCompanyData5}
                setFinalTicketsCompanyData5={setFinalTicketsCompanyData5}
                setFinalTicketsActiveField={setFinalTicketsActiveField}
                finalTicketsThankText={finalTicketsThankText}
                setFinalTicketsThankText={setFinalTicketsThankText}
                finalTicketsProforma={finalTicketsProforma}
                setFinalTicketsProforma={setFinalTicketsProforma}
                finalTicketsPrintPaymentType={finalTicketsPrintPaymentType}
                setFinalTicketsPrintPaymentType={setFinalTicketsPrintPaymentType}
                finalTicketsTicketTearable={finalTicketsTicketTearable}
                setFinalTicketsTicketTearable={setFinalTicketsTicketTearable}
                finalTicketsPrintLogo={finalTicketsPrintLogo}
                setFinalTicketsPrintLogo={setFinalTicketsPrintLogo}
                mapTranslatedOptions={mapTranslatedOptions}
                PRINTING_ORDER_OPTIONS={PRINTING_ORDER_OPTIONS}
                finalTicketsPrintingOrder={finalTicketsPrintingOrder}
                setFinalTicketsPrintingOrder={setFinalTicketsPrintingOrder}
                savingFinalTickets={savingFinalTickets}
                handleSaveFinalTickets={handleSaveFinalTickets}
                finalTicketsKeyboardValue={finalTicketsKeyboardValue}
                finalTicketsKeyboardOnChange={finalTicketsKeyboardOnChange}
                prodTicketsDisplayCategories={prodTicketsDisplayCategories}
                setProdTicketsDisplayCategories={setProdTicketsDisplayCategories}
                prodTicketsSpaceAbove={prodTicketsSpaceAbove}
                setProdTicketsSpaceAbove={setProdTicketsSpaceAbove}
                prodTicketsTicketTearable={prodTicketsTicketTearable}
                setProdTicketsTicketTearable={setProdTicketsTicketTearable}
                prodTicketsKeukenprinterBuzzer={prodTicketsKeukenprinterBuzzer}
                setProdTicketsKeukenprinterBuzzer={setProdTicketsKeukenprinterBuzzer}
                prodTicketsProductenIndividueel={prodTicketsProductenIndividueel}
                setProdTicketsProductenIndividueel={setProdTicketsProductenIndividueel}
                prodTicketsEatInTakeOutOnderaan={prodTicketsEatInTakeOutOnderaan}
                setProdTicketsEatInTakeOutOnderaan={setProdTicketsEatInTakeOutOnderaan}
                productionTicketsPrinterOptions={productionTicketsPrinterOptions}
                prodTicketsNextCoursePrinter1={prodTicketsNextCoursePrinter1}
                setProdTicketsNextCoursePrinter1={setProdTicketsNextCoursePrinter1}
                prodTicketsNextCoursePrinter2={prodTicketsNextCoursePrinter2}
                setProdTicketsNextCoursePrinter2={setProdTicketsNextCoursePrinter2}
                prodTicketsNextCoursePrinter3={prodTicketsNextCoursePrinter3}
                setProdTicketsNextCoursePrinter3={setProdTicketsNextCoursePrinter3}
                prodTicketsNextCoursePrinter4={prodTicketsNextCoursePrinter4}
                setProdTicketsNextCoursePrinter4={setProdTicketsNextCoursePrinter4}
                prodTicketsPrintingOrder={prodTicketsPrintingOrder}
                setProdTicketsPrintingOrder={setProdTicketsPrintingOrder}
                GROUPING_RECEIPT_OPTIONS={GROUPING_RECEIPT_OPTIONS}
                prodTicketsGroupingReceipt={prodTicketsGroupingReceipt}
                setProdTicketsGroupingReceipt={setProdTicketsGroupingReceipt}
                prodTicketsPrinterOverboeken={prodTicketsPrinterOverboeken}
                setProdTicketsPrinterOverboeken={setProdTicketsPrinterOverboeken}
                savingProdTickets={savingProdTickets}
                handleSaveProductionTickets={handleSaveProductionTickets}
                labelsList={labelsList}
                labelsTypeOptions={labelsTypeOptions}
                labelsType={labelsType}
                saveLabelsSettings={saveLabelsSettings}
                labelsPrinterOptions={labelsPrinterOptions}
                labelsPrinter={labelsPrinter}
                openNewLabelModal={openNewLabelModal}
                labelsListRef={labelsListRef}
                updateLabelsScrollState={updateLabelsScrollState}
                openEditLabelModal={openEditLabelModal}
                setDeleteConfirmLabelId={setDeleteConfirmLabelId}
                canLabelsScrollUp={canLabelsScrollUp}
                canLabelsScrollDown={canLabelsScrollDown}
                scrollLabelsByPage={scrollLabelsByPage}
              />
            )}
            {(subNavId === 'Price Display' || subNavId === 'RFID Reader' || subNavId === 'Barcode Scanner' || subNavId === 'Scale') && (
              <ControlViewExternalSimpleDevices
                subNavId={subNavId}
                tr={tr}
                mapTranslatedOptions={mapTranslatedOptions}
                PRICE_DISPLAY_TYPE_OPTIONS={PRICE_DISPLAY_TYPE_OPTIONS}
                RFID_READER_TYPE_OPTIONS={RFID_READER_TYPE_OPTIONS}
                BARCODE_SCANNER_TYPE_OPTIONS={BARCODE_SCANNER_TYPE_OPTIONS}
                SCALE_TYPE_OPTIONS={SCALE_TYPE_OPTIONS}
                SCALE_CONNECTION_MODE_OPTIONS={SCALE_CONNECTION_MODE_OPTIONS}
                SCALE_PORT_OPTIONS={SCALE_PORT_OPTIONS}
                priceDisplayType={priceDisplayType}
                setPriceDisplayType={setPriceDisplayType}
                savingPriceDisplay={savingPriceDisplay}
                handleSavePriceDisplay={handleSavePriceDisplay}
                rfidReaderType={rfidReaderType}
                setRfidReaderType={setRfidReaderType}
                savingRfidReader={savingRfidReader}
                handleSaveRfidReader={handleSaveRfidReader}
                barcodeScannerType={barcodeScannerType}
                setBarcodeScannerType={setBarcodeScannerType}
                savingBarcodeScanner={savingBarcodeScanner}
                handleSaveBarcodeScanner={handleSaveBarcodeScanner}
                scaleType={scaleType}
                setScaleType={setScaleType}
                scaleConnectionMode={scaleConnectionMode}
                setScaleConnectionMode={setScaleConnectionMode}
                scalePort={scalePort}
                setScalePort={setScalePort}
                scaleLsmIp={scaleLsmIp}
                setScaleLsmIp={setScaleLsmIp}
                scaleUseWeightLabels={scaleUseWeightLabels}
                setScaleUseWeightLabels={setScaleUseWeightLabels}
                scaleConfirmWeight={scaleConfirmWeight}
                setScaleConfirmWeight={setScaleConfirmWeight}
                savingScale={savingScale}
                handleSaveScale={handleSaveScale}
                testingScale={testingScale}
                handleTestScale={handleTestScale}
              />
            )}
            {subNavId === 'Cashmatic' && (
              <ControlViewCashmatic
                tr={tr}
                cashmaticName={cashmaticName}
                setCashmaticName={setCashmaticName}
                setCashmaticActiveField={setCashmaticActiveField}
                cashmaticConnectionType={cashmaticConnectionType}
                setCashmaticConnectionType={setCashmaticConnectionType}
                cashmaticIpAddress={cashmaticIpAddress}
                setCashmaticIpAddress={setCashmaticIpAddress}
                cashmaticPort={cashmaticPort}
                setCashmaticPort={setCashmaticPort}
                cashmaticUsername={cashmaticUsername}
                setCashmaticUsername={setCashmaticUsername}
                cashmaticPassword={cashmaticPassword}
                setCashmaticPassword={setCashmaticPassword}
                cashmaticUrl={cashmaticUrl}
                setCashmaticUrl={setCashmaticUrl}
                savingCashmatic={savingCashmatic}
                handleSaveCashmatic={handleSaveCashmatic}
                cashmaticKeyboardValue={cashmaticKeyboardValue}
                cashmaticKeyboardOnChange={cashmaticKeyboardOnChange}
              />
            )}
            {subNavId === 'Card' && (
              <div className="w-full">
                <div className="flex justify-center mb-4">
                  <div className="inline-flex rounded-lg border border-pos-border bg-pos-panel p-1 gap-1">
                    <button
                      type="button"
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        cardTerminalProvider === 'payworld'
                          ? 'bg-pos-bg text-pos-text'
                          : 'text-pos-muted active:text-pos-text'
                      }`}
                      onClick={() => setCardTerminalProvider('payworld')}
                    >
                      Payworld
                    </button>
                    <button
                      type="button"
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        cardTerminalProvider === 'ccv'
                          ? 'bg-pos-bg text-pos-text'
                          : 'text-pos-muted active:text-pos-text'
                      }`}
                      onClick={() => setCardTerminalProvider('ccv')}
                    >
                      CCV
                    </button>
                    <button
                      type="button"
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        cardTerminalProvider === 'viva'
                          ? 'bg-pos-bg text-pos-text'
                          : 'text-pos-muted active:text-pos-text'
                      }`}
                      onClick={() => setCardTerminalProvider('viva')}
                    >
                      VIVA
                    </button>
                    <button
                      type="button"
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        cardTerminalProvider === 'worldline'
                          ? 'bg-pos-bg text-pos-text'
                          : 'text-pos-muted active:text-pos-text'
                      }`}
                      onClick={() => setCardTerminalProvider('worldline')}
                    >
                      {tr('control.external.creditCardType.worldline', 'Worldline')}
                    </button>
                    <button
                      type="button"
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        cardTerminalProvider === 'bancontactpro'
                          ? 'bg-pos-bg text-pos-text'
                          : 'text-pos-muted active:text-pos-text'
                      }`}
                      onClick={() => setCardTerminalProvider('bancontactpro')}
                    >
                      {tr('control.external.creditCardType.bancontactpro', 'Bancontact QR')}
                    </button>
                  </div>
                </div>
                {cardTerminalProvider === 'ccv' ? (
                  <ControlViewCcv
                    tr={tr}
                    ccvName={ccvName}
                    setCcvName={setCcvName}
                    setCcvActiveField={setCcvActiveField}
                    ccvIpAddress={ccvIpAddress}
                    setCcvIpAddress={setCcvIpAddress}
                    ccvCommandPort={ccvCommandPort}
                    setCcvCommandPort={setCcvCommandPort}
                    ccvDevicePort={ccvDevicePort}
                    setCcvDevicePort={setCcvDevicePort}
                    ccvWorkstationId={ccvWorkstationId}
                    setCcvWorkstationId={setCcvWorkstationId}
                    savingCcv={savingCcv}
                    handleSaveCcv={handleSaveCcv}
                    ccvKeyboardValue={ccvKeyboardValue}
                    ccvKeyboardOnChange={ccvKeyboardOnChange}
                  />
                ) : cardTerminalProvider === 'viva' ? (
                  <div className="w-full">
                    <ControlViewPayworld
                      tr={tr}
                      payworldName={vivaName}
                      setPayworldName={setVivaName}
                      setPayworldActiveField={setVivaActiveField}
                      payworldIpAddress={vivaIpAddress}
                      setPayworldIpAddress={setVivaIpAddress}
                      payworldPort={vivaPort}
                      setPayworldPort={setVivaPort}
                      savingPayworld={savingViva}
                      handleSavePayworld={handleSaveViva}
                      payworldKeyboardValue={vivaKeyboardValue}
                      payworldKeyboardOnChange={vivaKeyboardOnChange}
                    />
                  </div>
                ) : cardTerminalProvider === 'worldline' ? (
                  <div className="w-full">
                    <ControlViewWorldlineCtep
                      tr={tr}
                      worldlineName={worldlineName}
                      setWorldlineName={setWorldlineName}
                      setWorldlineActiveField={setWorldlineActiveField}
                      worldlineHttpBaseUrl={worldlineHttpBaseUrl}
                      setWorldlineHttpBaseUrl={setWorldlineHttpBaseUrl}
                      savingWorldline={savingWorldline}
                      handleSaveWorldline={handleSaveWorldline}
                      worldlineKeyboardValue={worldlineKeyboardValue}
                      worldlineKeyboardOnChange={worldlineKeyboardOnChange}
                    />
                  </div>
                ) : cardTerminalProvider === 'bancontactpro' ? (
                  <div className="w-full">
                    <ControlViewBancontactPro
                      tr={tr}
                      bancontactProName={bancontactProName}
                      setBancontactProName={setBancontactProName}
                      setBancontactProActiveField={setBancontactProActiveField}
                      bancontactProApiKey={bancontactProApiKey}
                      setBancontactProApiKey={setBancontactProApiKey}
                      bancontactProSandbox={bancontactProSandbox}
                      setBancontactProSandbox={setBancontactProSandbox}
                      bancontactProCallbackUrl={bancontactProCallbackUrl}
                      setBancontactProCallbackUrl={setBancontactProCallbackUrl}
                      savingBancontactPro={savingBancontactPro}
                      handleSaveBancontactPro={handleSaveBancontactPro}
                      bancontactProKeyboardValue={bancontactProKeyboardValue}
                      bancontactProKeyboardOnChange={bancontactProKeyboardOnChange}
                    />
                  </div>
                ) : (
                  <ControlViewPayworld
                    tr={tr}
                    payworldName={payworldName}
                    setPayworldName={setPayworldName}
                    setPayworldActiveField={setPayworldActiveField}
                    payworldIpAddress={payworldIpAddress}
                    setPayworldIpAddress={setPayworldIpAddress}
                    payworldPort={payworldPort}
                    setPayworldPort={setPayworldPort}
                    savingPayworld={savingPayworld}
                    handleSavePayworld={handleSavePayworld}
                    payworldKeyboardValue={payworldKeyboardValue}
                    payworldKeyboardOnChange={payworldKeyboardOnChange}
                  />
                )}
              </div>
            )}
          </div>
        ) : null}
      </main>
      {showZCloseConfirm ? (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="z-close-confirm-title"
          onClick={() => setShowZCloseConfirm(false)}
        >
          <div
            className="bg-pos-panel rounded-xl border border-pos-border p-6 max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="z-close-confirm-title" className="text-lg font-semibold text-pos-text">
              {tr('control.reports.zCloseConfirmTitle', 'Close reporting period?')}
            </h3>
            <p className="mt-3 text-sm text-pos-text leading-relaxed">
              {tr(
                'control.reports.zCloseConfirmMessage',
                'The Z report will be saved, the current period will close, and the next sale will count toward a new period. This cannot be undone from here.',
              )}
            </p>
            <div className="mt-6 flex gap-3 justify-end flex-wrap">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-pos-border bg-pos-bg text-pos-text active:bg-green-500"
                onClick={() => setShowZCloseConfirm(false)}
              >
                {tr('cancel', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={zPrintBlocked}
                className="px-4 py-2 rounded-lg bg-green-600 text-white active:bg-green-500"
                onClick={() => void confirmZCloseAndPrint()}
              >
                {tr('control.reports.printZClose', 'Print Z (close day)')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <ReportPrintErrorModal
        open={!!reportPrintErrorMessage}
        message={reportPrintErrorMessage || ''}
        onClose={() => setReportPrintErrorMessage(null)}
      />
    </div>

  );
}
