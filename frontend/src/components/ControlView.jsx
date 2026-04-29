import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { KeyboardWithNumpad } from './KeyboardWithNumpad';
import { SmallKeyboardWithNumpad } from './SmallKeyboardWithNumpad';
import { PrinterModal } from './PrinterModal';
import { ControlViewDiscountModal } from './controlView/ControlViewDiscountModal';
import { ControlViewCategoryModal } from './controlView/ControlViewCategoryModal';
import { ControlViewProductModal } from './controlView/ControlViewProductModal';
import { ControlViewProductPositioningModal } from './controlView/ControlViewProductPositioningModal';
import { ControlViewProductSubproductsModal } from './controlView/ControlViewProductSubproductsModal';
import { ControlViewSubproductModal } from './controlView/ControlViewSubproductModal';
import { ControlViewManageGroupsModal } from './controlView/ControlViewManageGroupsModal';
import { ControlViewKitchenAssignProductsModal } from './controlView/ControlViewKitchenAssignProductsModal';
import { ControlViewProductionMessagesModal } from './controlView/ControlViewProductionMessagesModal';
import { ControlViewSystemSettingsModal } from './controlView/ControlViewSystemSettingsModal';
import { ControlViewDeviceSettingsModal } from './controlView/ControlViewDeviceSettingsModal';
import { ControlViewLabelModal } from './controlView/ControlViewLabelModal';
import { ControlViewPriceGroupModal } from './controlView/ControlViewPriceGroupModal';
import { ControlViewKitchenModal } from './controlView/ControlViewKitchenModal';
import { ControlViewPaymentTypeModal } from './controlView/ControlViewPaymentTypeModal';
import { ControlViewUserModal, DEFAULT_USER_PRIVILEGES } from './controlView/ControlViewUserModal';
import { IconChart } from './controlView/controlViewNavIcons';
import { ControlViewMainContentArea } from './controlView/ControlViewMainContentArea';
import { useLanguage } from '../contexts/LanguageContext';
import { POS_API_PREFIX as API } from '../lib/apiOrigin.js';
import { posTerminalAuthHeaders } from '../lib/posTerminalSession.js';
import { fetchPosOptionLayoutRegisterKey } from '../lib/posOptionLayoutRegisterKey.js';
import { LoadingSpinner } from './LoadingSpinner';
import { publicAssetUrl, resolveMediaSrc } from '../lib/publicAssetUrl.js';
import {
  OPTION_BUTTON_ITEMS,
  OPTION_BUTTON_SLOT_COUNT,
  OPTION_BUTTON_LOCKED_ID,
  OPTION_BUTTON_ITEM_IDS,
  OPTION_BUTTON_ITEM_BY_ID,
  normalizeOptionButtonSlots,
  pickOptionButtonLayoutFromDeviceSettings,
  DEFAULT_POS_REGISTER_NAME,
  OPTION_LAYOUT_POLL_MS,
  PRODUCTION_MESSAGES_MODAL_POLL_MS,
  SYSTEM_SETTINGS_MODAL_POLL_MS,
  DEVICE_SETTINGS_MODAL_POLL_MS,
  POS_DEVICE_SETTINGS_CHANGED_EVENT,
  POS_SYSTEM_SETTINGS_CHANGED_EVENT,
  POS_PRODUCTION_MESSAGES_CHANGED_EVENT,
  POS_PRODUCT_SUBPRODUCT_LINKS_CHANGED_EVENT,
  PRODUCT_SUBPRODUCT_LINKS_MODAL_POLL_MS,
} from '../lib/optionButtonLayout.ts';
import {
  FUNCTION_BUTTON_ITEMS,
  FUNCTION_BUTTON_SLOT_COUNT,
  FUNCTION_BUTTON_ITEM_IDS,
  FUNCTION_BUTTON_ITEM_BY_ID,
  normalizeFunctionButtonsLayout,
  POS_FUNCTION_BUTTONS_LAYOUT_CHANGED_EVENT,
} from '../lib/functionButtonLayout.ts';

/** Seeded kitchen admin credential (same id as `seed.js`); hidden from Configuration → Kitchen list. */
const KITCHEN_ADMIN_CREDENTIAL_ID = 'kitchen-kds-admin';

const CONTROL_SIDEBAR_ITEMS = [
  { id: 'personalize', label: 'Personalize Cash Register', icon: 'monitor' },
  { id: 'reports', label: 'Reports', icon: 'chart' },
  { id: 'importExport', label: 'Import / Export', icon: 'import-export' },
  { id: 'users', label: 'Users', icon: 'users' },
  { id: 'language', label: 'Language', icon: 'language' }
];

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'nl', label: 'Dutch' },
  { value: 'fr', label: 'French' },
  { value: 'tr', label: 'Turkish' }
];

const TOP_NAV_ITEMS = [
  { id: 'categories-products', label: 'Categories and products', icon: 'box' },
  { id: 'cash-register', label: 'Cash Register Settings', icon: 'gear' },
  { id: 'external-devices', label: 'External Devices', icon: 'printer' }
];

const SUB_NAV_ITEMS = [
  'Price Groups',
  'Categories',
  'Products',
  'Subproducts',
  'Discounts'
];

const CASH_REGISTER_SUB_NAV_ITEMS = ['Device Settings', 'System Settings', 'Payment types', 'Production messages'];

const EXTERNAL_DEVICES_SUB_NAV_ITEMS = [
  'Printer',
  'Price Display',
  'RFID Reader',
  'Barcode Scanner',
  'Credit Card',
  'Scale',
  'Cashmatic',
  'Card'
];

const PRINTER_TAB_DEFS = [
  { id: 'General', labelKey: 'control.printerTabs.general', fallback: 'General' },
  { id: 'Final tickets', labelKey: 'control.printerTabs.finalTickets', fallback: 'Final tickets' },
  { id: 'Production Tickets', labelKey: 'control.printerTabs.productionTickets', fallback: 'Production Tickets' },
  { id: 'Labels', labelKey: 'control.printerTabs.labels', fallback: 'Labels' },
];

const PRINTING_ORDER_OPTIONS = [
  { value: 'as-registered', labelKey: 'control.external.asRegistered', fallback: 'As Registered' },
  { value: 'reverse', labelKey: 'control.external.reverse', fallback: 'Reverse' }
];

const PRINTER_DISABLED_OPTIONS = [
  { value: 'disabled', labelKey: 'control.external.disabled', fallback: 'Disabled' }
];

const GROUPING_RECEIPT_OPTIONS = [
  { value: 'enable', labelKey: 'control.external.enable', fallback: 'Enable' },
  { value: 'disable', labelKey: 'control.external.disable', fallback: 'Disable' }
];

const PRICE_DISPLAY_TYPE_OPTIONS = [
  { value: 'disabled', labelKey: 'control.external.priceDisplayType.disabled', fallback: 'Disabled' },
  { value: 'two-line-display', labelKey: 'control.external.priceDisplayType.twoLineDisplay', fallback: 'Two-line display' },
  { value: 'color-display', labelKey: 'control.external.priceDisplayType.colorDisplay', fallback: 'Color display' }
];

const RFID_READER_TYPE_OPTIONS = [
  { value: 'disabled', labelKey: 'control.external.disabled', fallback: 'Disabled' },
  { value: 'serial', labelKey: 'control.external.serial', fallback: 'Serial' },
  { value: 'usb-nfc', labelKey: 'control.external.rfidReaderType.usbNfc', fallback: 'USB NFC' }
];

const BARCODE_SCANNER_TYPE_OPTIONS = [
  { value: 'disabled', labelKey: 'control.external.disabled', fallback: 'Disabled' },
  { value: 'serial', labelKey: 'control.external.serial', fallback: 'Serial' },
  { value: 'keyboard-input', labelKey: 'control.external.barcodeScannerType.keyboardInput', fallback: 'Keyboard input' },
  { value: 'tcp-ip', labelKey: 'control.external.barcodeScannerType.tcpIp', fallback: 'TCP / IP' }
];

const CREDIT_CARD_TYPE_OPTIONS = [
  { value: 'disabled', labelKey: 'control.external.disabled', fallback: 'Disabled' },
  { value: 'payworld', labelKey: 'control.external.creditCardType.payworld', fallback: 'Payworld' },
  { value: 'ccv', labelKey: 'control.external.creditCardType.ccv', fallback: 'CCV' },
  { value: 'worldline', labelKey: 'control.external.creditCardType.worldline', fallback: 'Worldline' },
  { value: 'viva-wallet', labelKey: 'control.external.creditCardType.vivaWallet', fallback: 'Viva wallet' }
];

const SCALE_TYPE_OPTIONS = [
  { value: 'aclas', label: 'Aclas' },
  { value: 'dialog-06', labelKey: 'control.external.scaleType.dialog06', fallback: 'Dialog 06' },
  { value: 'cas', labelKey: 'control.external.scaleType.casProtocol', fallback: 'CAS Protocol' }
];

const SCALE_PORT_OPTIONS = [
  { value: 'COM 1', label: 'COM 1' },
  { value: 'COM 2', label: 'COM 2' },
  { value: 'COM 3', label: 'COM 3' },
  { value: 'COM 4', label: 'COM 4' }
];

/** Connection mode for scales that support serial or TCP (e.g. Toshiba SL4700). */
const SCALE_CONNECTION_MODE_OPTIONS = [
  { value: 'serial', labelKey: 'control.external.scaleMode.serial', fallback: 'Serial' },
  { value: 'tcp-ip', labelKey: 'control.external.scaleMode.tcpIp', fallback: 'TCP / IP' }
];

const LABEL_TYPE_VALUES = new Set(['production-labels', 'article-label', 'scale-labels', 'pre-packaging-labels']);

function normalizeLabelType(raw, fallback = 'production-labels') {
  const value = String(raw ?? '').trim().toLowerCase();
  if (LABEL_TYPE_VALUES.has(value)) return value;
  const safeFallback = String(fallback ?? '').trim().toLowerCase();
  return LABEL_TYPE_VALUES.has(safeFallback) ? safeFallback : 'production-labels';
}

function normalizeScaleConnectionMode(mode) {
  let s = String(mode ?? '').replace(/^\uFEFF/, '').trim().toLowerCase();
  s = s.replace(/_/g, '-').replace(/\//g, '-');
  if (s === 'tcp-ip' || s === 'tcpip') return 'tcp-ip';
  return 'serial';
}

const REPORT_TABS = [
  { id: 'financial', label: 'Financial Reports', icon: 'document' },
  { id: 'user', label: 'User Reports', icon: 'person' },
  { id: 'periodic', label: 'Periodic Reports', icon: 'chart' },
  { id: 'settings', label: 'Settings', icon: 'gear' }
];

const REPORT_GENERATE_UNTIL_OPTIONS = [
  { value: 'current-time', labelKey: 'control.reports.currentTime', fallback: 'Current time' }
];

const PERIODIC_REPORT_TIME_OPTIONS = Array.from({ length: 25 }, (_, i) => {
  const h = i === 24 ? '24' : String(i).padStart(2, '0');
  const label = i === 24 ? '24:00' : `${h}:00`;
  return { value: label, label };
});


const DISCOUNT_TRIGGER_OPTIONS = [
  { value: 'number', label: 'Number' },
  { value: 'weight', label: 'Weight' },
  { value: 'min-amount', label: 'Minimum amount' },
  { value: 'time', label: 'Time' }
];

const DISCOUNT_TYPE_OPTIONS = [
  { value: 'amount', label: 'Amount' },
  { value: 'percent', label: 'Percent' },
  { value: 'free_products', label: 'Free products' },
  { value: 'number', label: '+ Number' },
  { value: 'weight', label: '+ Weight' },
  { value: 'different_price_group', label: 'Different price group' },
];

const DISCOUNT_ON_OPTIONS = [
  { value: 'products', label: 'Products' },
  { value: 'categories', label: 'Categories' },
  { value: 'all-products', label: 'All products' }
];

const REPORT_SETTINGS_ROWS = [
  { id: 'category-totals', labelKey: 'control.reports.settings.categoryTotals', fallback: 'Category totals:' },
  { id: 'product-totals', labelKey: 'control.reports.settings.productTotals', fallback: 'Product totals:' },
  { id: 'vat-totals', labelKey: 'control.reports.settings.vatTotals', fallback: 'VAT totals:' },
  { id: 'payments', labelKey: 'control.reports.settings.payments', fallback: 'Payments:' },
  { id: 'ticket-types', labelKey: 'control.reports.settings.ticketTypes', fallback: 'Ticket types:' },
  { id: 'eat-in-take-out', labelKey: 'control.reports.settings.eatInTakeOut', fallback: 'Take-out:' },
  { id: 'hour-totals', labelKey: 'control.reports.settings.hourTotals', fallback: 'Hour totals:' },
  { id: 'hour-totals-per-user', labelKey: 'control.reports.settings.hourTotalsPerUser', fallback: 'Hour totals per user:' }
];

const DEFAULT_REPORT_SETTINGS = Object.fromEntries(
  REPORT_SETTINGS_ROWS.map((row) => {
    const allChecked = ['vat-totals', 'payments', 'ticket-types', 'eat-in-take-out'].includes(row.id);
    return [row.id, { z: allChecked, x: allChecked, periodic: allChecked }];
  })
);

const DEFAULT_LABELS_LIST = [
  { id: 'lbl1', sizeLabel: '5.6cm x 3.5cm', sortOrder: 0 }
];

const DEFAULT_PRINTERS = [
  { id: 'p1', name: 'RP4xx Series 200DPI TSC', isDefault: false, sortOrder: 0 },
  { id: 'p2', name: 'ip printer', isDefault: true, sortOrder: 1 },
  { id: 'p3', name: 'Xprinter XP-420B', isDefault: false, sortOrder: 2 },
  { id: 'p4', name: 'bar printer', isDefault: false, sortOrder: 3 },
  { id: 'p5', name: 'extra kitchen printer', isDefault: false, sortOrder: 4 },
  { id: 'p6', name: 'extra printer', isDefault: false, sortOrder: 5 }
];

const VAT_OPTIONS = [
  { value: 'standard', labelKey: 'control.external.standard', fallback: 'Standard' },
  { value: 'take-out', labelKey: 'control.external.takeOut', fallback: 'Take-out' }
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

function IconMonitor({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function IconUsers({ className }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function IconLanguage({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
    </svg>
  );
}

function IconImportExport({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 17l-4-4m0 0l4-4m-4 4h14" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 7l4 4m0 0l-4 4m4-4H7" />
    </svg>
  );
}

function IconTrash({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function SidebarIcon({ id, className }) {
  if (id === 'monitor') return <IconMonitor className={className} />;
  if (id === 'chart') return <IconChart className={className} />;
  if (id === 'import-export') return <IconImportExport className={className} />;
  if (id === 'users') return <IconUsers className={className} />;
  if (id === 'language') return <IconLanguage className={className} />;
  if (id === 'trash') return <IconTrash className={className} />;
  return null;
}

export function ControlView({
  currentUser,
  realtimeSocket,
  currentRegisterId,
  currentRegisterName,
  onLogout,
  onBack,
  onFunctionButtonsSaved,
  onMenuCatalogRefresh,
}) {
  const { lang, setLang, t } = useLanguage();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [controlSidebarId, setControlSidebarId] = useState('personalize');
  /** Waiters may only use Language in Control; users without role (legacy session) are restricted. */
  const isWaiterControlUser = currentUser?.role !== 'admin';
  const effectiveControlSidebarId = isWaiterControlUser ? 'language' : controlSidebarId;
  const [appLanguage, setAppLanguage] = useState(() => (LANGUAGE_OPTIONS.some((o) => o.value === lang) ? lang : 'en'));
  const [savingAppLanguage, setSavingAppLanguage] = useState(false);
  const [topNavId, setTopNavId] = useState('categories-products');
  const [subNavId, setSubNavId] = useState('Price Groups');
  const [controlBootstrapReady, setControlBootstrapReady] = useState(false);
  const [reportTabId, setReportTabId] = useState('financial');
  /** Financial reports sub-view: Z (period close), X (interim), or history list. */
  const [financialReportKind, setFinancialReportKind] = useState('z');
  /** User reports sub-view: Z (close) or X (interim). */
  const [userReportKind, setUserReportKind] = useState('z');
  const [reportGenerateUntil, setReportGenerateUntil] = useState('current-time');
  const [periodicReportStartTime, setPeriodicReportStartTime] = useState('00:00');
  const [periodicReportStartDate, setPeriodicReportStartDate] = useState(() => {
    const d = new Date();
    return [String(d.getDate()).padStart(2, '0'), String(d.getMonth() + 1).padStart(2, '0'), d.getFullYear()].join('-');
  });
  const [periodicReportEndTime, setPeriodicReportEndTime] = useState('24:00');
  const [periodicReportEndDate, setPeriodicReportEndDate] = useState(() => {
    const d = new Date();
    return [String(d.getDate()).padStart(2, '0'), String(d.getMonth() + 1).padStart(2, '0'), d.getFullYear()].join('-');
  });
  const [reportSettings, setReportSettings] = useState(() => ({ ...DEFAULT_REPORT_SETTINGS }));
  const [savingReportSettings, setSavingReportSettings] = useState(false);
  const [periodicReportLines, setPeriodicReportLines] = useState(null);
  const [periodicReportLoading, setPeriodicReportLoading] = useState(false);

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const usersListRef = useRef(null);
  const [canUsersScrollUp, setCanUsersScrollUp] = useState(false);
  const [canUsersScrollDown, setCanUsersScrollDown] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [userName, setUserName] = useState('');
  const [userPin, setUserPin] = useState('');
  const [userRole, setUserRole] = useState('waiter');
  const [savingUser, setSavingUser] = useState(false);
  const [deleteConfirmUserId, setDeleteConfirmUserId] = useState(null);
  const [userModalTab, setUserModalTab] = useState('general');
  const [userAvatarColorIndex, setUserAvatarColorIndex] = useState(0);
  const [userModalActiveField, setUserModalActiveField] = useState(null);
  const [userPrivileges, setUserPrivileges] = useState(() => ({ ...DEFAULT_USER_PRIVILEGES }));

  const [discounts, setDiscounts] = useState([]);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [editingDiscountId, setEditingDiscountId] = useState(null);
  const [discountName, setDiscountName] = useState('');
  const [discountTrigger, setDiscountTrigger] = useState('number');
  const [discountType, setDiscountType] = useState('amount');
  const [discountValue, setDiscountValue] = useState('');
  const [discountStartDate, setDiscountStartDate] = useState('');
  const [discountEndDate, setDiscountEndDate] = useState('');
  const [discountOn, setDiscountOn] = useState('products');
  const [discountPieces, setDiscountPieces] = useState('');
  const [discountCombinable, setDiscountCombinable] = useState(false);
  const [discountTargetId, setDiscountTargetId] = useState('');
  const [discountTargetIds, setDiscountTargetIds] = useState([]);
  const [discountProductOptions, setDiscountProductOptions] = useState([]);
  const discountTargetListRef = useRef(null);
  const [canDiscountTargetScrollUp, setCanDiscountTargetScrollUp] = useState(false);
  const [canDiscountTargetScrollDown, setCanDiscountTargetScrollDown] = useState(false);
  const [discountKeyboardValue, setDiscountKeyboardValue] = useState('');
  const [savingDiscount, setSavingDiscount] = useState(false);
  const [deleteConfirmDiscountId, setDeleteConfirmDiscountId] = useState(null);
  const [discountCalendarField, setDiscountCalendarField] = useState(null); // 'start' | 'end' | null
  const discountsListRef = useRef(null);
  const [canDiscountsScrollUp, setCanDiscountsScrollUp] = useState(false);
  const [canDiscountsScrollDown, setCanDiscountsScrollDown] = useState(false);

  const [kitchens, setKitchens] = useState([]);
  const [deleteConfirmKitchenId, setDeleteConfirmKitchenId] = useState(null);
  const [showKitchenModal, setShowKitchenModal] = useState(false);
  const [editingKitchenId, setEditingKitchenId] = useState(null);
  const [kitchenModalName, setKitchenModalName] = useState('');
  const [savingKitchen, setSavingKitchen] = useState(false);
  const kitchenListRef = useRef(null);
  const [canKitchenScrollUp, setCanKitchenScrollUp] = useState(false);
  const [canKitchenScrollDown, setCanKitchenScrollDown] = useState(false);
  const [showKitchenProductsModal, setShowKitchenProductsModal] = useState(false);
  const [kitchenProductsKitchen, setKitchenProductsKitchen] = useState(null);
  const [kitchenProductsCatalog, setKitchenProductsCatalog] = useState([]);
  const [kitchenProductsModalCategories, setKitchenProductsModalCategories] = useState([]);
  const [kitchenProductsCategoryFilter, setKitchenProductsCategoryFilter] = useState('');
  const [kitchenProductsLinked, setKitchenProductsLinked] = useState([]);
  const [kitchenProductsLeftSelectedIds, setKitchenProductsLeftSelectedIds] = useState(() => new Set());
  const [kitchenProductsRightSelectedIds, setKitchenProductsRightSelectedIds] = useState(() => new Set());
  const [loadingKitchenProductsCatalog, setLoadingKitchenProductsCatalog] = useState(false);
  const [savingKitchenProducts, setSavingKitchenProducts] = useState(false);
  const kitchenProductsLeftListRef = useRef(null);
  const kitchenProductsRightListRef = useRef(null);

  const [priceGroups, setPriceGroups] = useState([]);
  const [priceGroupsLoading, setPriceGroupsLoading] = useState(false);
  const priceGroupsListRef = useRef(null);
  const [canPriceGroupsScrollUp, setCanPriceGroupsScrollUp] = useState(false);
  const [canPriceGroupsScrollDown, setCanPriceGroupsScrollDown] = useState(false);
  const [showPriceGroupModal, setShowPriceGroupModal] = useState(false);
  const [editingPriceGroupId, setEditingPriceGroupId] = useState(null);
  const [priceGroupName, setPriceGroupName] = useState('');
  const [priceGroupTax, setPriceGroupTax] = useState('standard');
  const [savingPriceGroup, setSavingPriceGroup] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryNextCourse, setCategoryNextCourse] = useState('');
  const [categoryInWebshop, setCategoryInWebshop] = useState(true);
  const [categoryDisplayOnCashRegister, setCategoryDisplayOnCashRegister] = useState(true);
  const [categoryActiveField, setCategoryActiveField] = useState('name');
  const [savingCategory, setSavingCategory] = useState(false);
  const [deleteConfirmCategoryId, setDeleteConfirmCategoryId] = useState(null);
  const categoriesListRef = useRef(null);
  const [canCategoriesScrollUp, setCanCategoriesScrollUp] = useState(false);
  const [canCategoriesScrollDown, setCanCategoriesScrollDown] = useState(false);
  const productsListRef = useRef(null);
  const productsCategoryTabsRef = useRef(null);
  const [canProductsScrollUp, setCanProductsScrollUp] = useState(false);
  const [canProductsScrollDown, setCanProductsScrollDown] = useState(false);
  const subproductsListRef = useRef(null);
  const subproductsGroupTabsRef = useRef(null);
  const [canSubproductsScrollUp, setCanSubproductsScrollUp] = useState(false);
  const [canSubproductsScrollDown, setCanSubproductsScrollDown] = useState(false);

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [productHasSubproductsById, setProductHasSubproductsById] = useState({});
  const [showProductSubproductsModal, setShowProductSubproductsModal] = useState(false);
  const [productSubproductsProduct, setProductSubproductsProduct] = useState(null);
  const [productSubproductsGroupId, setProductSubproductsGroupId] = useState('');
  const [productSubproductsOptions, setProductSubproductsOptions] = useState([]);
  const [productSubproductsByGroup, setProductSubproductsByGroup] = useState({});
  const [productSubproductsLeftSelectedIds, setProductSubproductsLeftSelectedIds] = useState(() => new Set());
  const [productSubproductsRightSelectedIds, setProductSubproductsRightSelectedIds] = useState(() => new Set());
  const [productSubproductsLinked, setProductSubproductsLinked] = useState([]);
  const productSubproductsLeftListRef = useRef(null);
  const productSubproductsListRef = useRef(null);
  const productSubproductsHasLocalEditsRef = useRef(false);
  const [loadingProductSubproductsLinked, setLoadingProductSubproductsLinked] = useState(false);
  const [savingProductSubproducts, setSavingProductSubproducts] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showProductPositioningModal, setShowProductPositioningModal] = useState(false);
  const [positioningCategoryId, setPositioningCategoryId] = useState(null);
  const [positioningSelectedProductId, setPositioningSelectedProductId] = useState(null);
  const [positioningSelectedCellIndex, setPositioningSelectedCellIndex] = useState(null);
  const [positioningSelectedPoolItemId, setPositioningSelectedPoolItemId] = useState(null);
  const [positioningSubproducts, setPositioningSubproducts] = useState([]);
  const [positioningLayoutByCategory, setPositioningLayoutByCategory] = useState({});
  const [positioningColorByCategory, setPositioningColorByCategory] = useState({});
  const positioningDirtyRef = useRef(false);
  const [savingPositioningLayout, setSavingPositioningLayout] = useState(false);
  const [positioningLayoutSaveMessage, setPositioningLayoutSaveMessage] = useState('');
  const [editingProductId, setEditingProductId] = useState(null);
  const [productTab, setProductTab] = useState('general');
  const [productTabsUnlocked, setProductTabsUnlocked] = useState(false);
  const [productDisplayNumber, setProductDisplayNumber] = useState(null);
  const [productName, setProductName] = useState('');
  const [productKeyName, setProductKeyName] = useState('');
  const [productProductionName, setProductProductionName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productVatTakeOut, setProductVatTakeOut] = useState('');
  const [productCategoryIds, setProductCategoryIds] = useState(['']);
  const [productAddition, setProductAddition] = useState('Subproducts');
  const [productBarcode, setProductBarcode] = useState('');
  const [productPrinter1, setProductPrinter1] = useState('');
  const [productPrinter2, setProductPrinter2] = useState('');
  const [productPrinter3, setProductPrinter3] = useState('');
  const [productActiveField, setProductActiveField] = useState('name');
  const [savingProduct, setSavingProduct] = useState(false);
  const [deleteConfirmProductId, setDeleteConfirmProductId] = useState(null);
  const [productSearch, setProductSearch] = useState('');
  const [showProductSearchKeyboard, setShowProductSearchKeyboard] = useState(false);
  const [barcodeButtonSpinning, setBarcodeButtonSpinning] = useState(false);
  const [productFieldErrors, setProductFieldErrors] = useState({ name: false, keyName: false, productionName: false, vatTakeOut: false });
  const [advancedOpenPrice, setAdvancedOpenPrice] = useState(false);
  const [advancedWeegschaal, setAdvancedWeegschaal] = useState(false);
  const [advancedSubproductRequires, setAdvancedSubproductRequires] = useState(false);
  const [advancedLeeggoedPrijs, setAdvancedLeeggoedPrijs] = useState('0.00');
  const [advancedPagerVerplicht, setAdvancedPagerVerplicht] = useState(false);
  const [advancedBoldPrint, setAdvancedBoldPrint] = useState(false);
  const [advancedGroupingReceipt, setAdvancedGroupingReceipt] = useState(true);
  const [advancedLabelExtraInfo, setAdvancedLabelExtraInfo] = useState('');
  const [advancedVoorverpakVervaltype, setAdvancedVoorverpakVervaltype] = useState('Shelf life');
  const [advancedHoudbareDagen, setAdvancedHoudbareDagen] = useState('0');
  const [advancedBewarenGebruik, setAdvancedBewarenGebruik] = useState('');
  const [advancedKassaPhotoPreview, setAdvancedKassaPhotoPreview] = useState(null);

  const [extraPricesRows, setExtraPricesRows] = useState([]);
  const [extraPricesSelectedIndex, setExtraPricesSelectedIndex] = useState(0);
  const extraPricesScrollRef = useRef(null);
  const [extraPricesScrollEdges, setExtraPricesScrollEdges] = useState({ atTop: true, atBottom: true });

  const syncExtraPricesScrollEdges = useCallback(() => {
    const el = extraPricesScrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight + 1) {
      setExtraPricesScrollEdges({ atTop: true, atBottom: true });
      return;
    }
    setExtraPricesScrollEdges({
      atTop: scrollTop <= 1,
      atBottom: scrollTop + clientHeight >= scrollHeight - 1
    });
  }, []);

  const [purchaseVat, setPurchaseVat] = useState('');
  const [purchasePriceExcl, setPurchasePriceExcl] = useState('0.00');
  const [purchasePriceIncl, setPurchasePriceIncl] = useState('0.00');
  const [profitPct, setProfitPct] = useState('0.00');
  const [purchaseUnit, setPurchaseUnit] = useState('Piece');
  const [unitContent, setUnitContent] = useState('0');
  const [stock, setStock] = useState('0');
  const [purchaseSupplier, setPurchaseSupplier] = useState('');
  const [supplierCode, setSupplierCode] = useState('');
  /** Loaded when product modal opens (`GET /api/suppliers`). */
  const [supplierDirectory, setSupplierDirectory] = useState([]);
  const [stockNotification, setStockNotification] = useState(true);
  const [expirationDate, setExpirationDate] = useState('');
  const [declarationExpiryDays, setDeclarationExpiryDays] = useState('0');
  const [notificationSoldOutPieces, setNotificationSoldOutPieces] = useState('');

  const parsePurchaseNumberInput = useCallback((raw) => {
    const normalized = String(raw ?? '').trim().replace(',', '.');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }, []);

  const computePurchaseInclFromExcl = useCallback((exclRaw, vatRaw) => {
    const excl = parsePurchaseNumberInput(exclRaw);
    if (excl == null) return '';
    const vat = parsePurchaseNumberInput(vatRaw) ?? 0;
    const incl = excl + (excl * vat / 100);
    return incl.toFixed(2);
  }, [parsePurchaseNumberInput]);

  const handlePurchaseVatChange = useCallback((nextVat) => {
    setPurchaseVat(nextVat);
    setPurchasePriceIncl(computePurchaseInclFromExcl(purchasePriceExcl, nextVat));
  }, [computePurchaseInclFromExcl, purchasePriceExcl]);

  const handlePurchasePriceExclChange = useCallback((nextExcl) => {
    setPurchasePriceExcl(nextExcl);
    setPurchasePriceIncl(computePurchaseInclFromExcl(nextExcl, purchaseVat));
  }, [computePurchaseInclFromExcl, purchaseVat]);

  const handlePurchasePriceInclChange = useCallback((nextIncl) => {
    setPurchasePriceIncl(nextIncl);
  }, []);

  const handleProfitPctChange = useCallback((nextProfitPct) => {
    setProfitPct(nextProfitPct);
  }, []);

  const isProductPriceLockedByProfit = useMemo(() => {
    const profit = parsePurchaseNumberInput(profitPct);
    return profit != null && Math.abs(profit) > 0.000001;
  }, [parsePurchaseNumberInput, profitPct]);

  useEffect(() => {
    if (!isProductPriceLockedByProfit) return;
    const purchaseInclValue = parsePurchaseNumberInput(purchasePriceIncl);
    const profitValue = parsePurchaseNumberInput(profitPct) ?? 0;
    if (purchaseInclValue == null) {
      setProductPrice('');
      return;
    }
    const computedPrice = (purchaseInclValue * (1 + profitValue / 100)).toFixed(2);
    setProductPrice(computedPrice);
  }, [isProductPriceLockedByProfit, parsePurchaseNumberInput, profitPct, purchasePriceIncl]);

  const [productInWebshop, setProductInWebshop] = useState(false);
  const [webshopOnlineOrderable, setWebshopOnlineOrderable] = useState(true);
  const [websiteRemark, setWebsiteRemark] = useState('');
  const [websiteOrder, setWebsiteOrder] = useState('0');
  const [shortWebText, setShortWebText] = useState('');
  const [websitePhotoFileName, setWebsitePhotoFileName] = useState('');

  const [kioskInfo, setKioskInfo] = useState('');
  const [kioskTakeAway, setKioskTakeAway] = useState(true);
  const [kioskEatIn, setKioskEatIn] = useState('');
  const [kioskSubtitle, setKioskSubtitle] = useState('');
  const [kioskPicturePreview, setKioskPicturePreview] = useState(null);
  const [kioskMinSubs, setKioskMinSubs] = useState('unlimited');
  const [kioskMaxSubs, setKioskMaxSubs] = useState('unlimited');

  const [showDeviceSettingsModal, setShowDeviceSettingsModal] = useState(false);
  const [deviceSettingsTab, setDeviceSettingsTab] = useState('General');
  const [deviceUseSubproducts, setDeviceUseSubproducts] = useState(true);
  const [deviceAutoLogoutAfterTransaction, setDeviceAutoLogoutAfterTransaction] = useState(false);
  const [deviceAutoReturnToTablePlan, setDeviceAutoReturnToTablePlan] = useState(false);
  const [deviceDisableCashButtonInPayment, setDeviceDisableCashButtonInPayment] = useState(false);
  const [deviceOpenPriceWithoutPopup, setDeviceOpenPriceWithoutPopup] = useState(false);
  const [deviceTurnOnStockWarning, setDeviceTurnOnStockWarning] = useState(true);
  const [deviceOpenCashDrawerAfterOrder, setDeviceOpenCashDrawerAfterOrder] = useState(true);
  const [deviceAutoReturnToCounterSale, setDeviceAutoReturnToCounterSale] = useState(false);
  const [deviceAskSendToKitchen, setDeviceAskSendToKitchen] = useState(false);
  const [deviceCounterSaleVat, setDeviceCounterSaleVat] = useState('take-out');
  const [deviceTableSaleVat, setDeviceTableSaleVat] = useState('take-out');
  const [deviceTimeoutLogout, setDeviceTimeoutLogout] = useState(0);
  const [deviceFixedBorder, setDeviceFixedBorder] = useState(true);
  const [deviceAlwaysOnTop, setDeviceAlwaysOnTop] = useState(true);
  const [deviceAskInvoiceOrTicket, setDeviceAskInvoiceOrTicket] = useState(false);
  const [savingDeviceSettings, setSavingDeviceSettings] = useState(false);
  const [devicePrinterGroupingProducts, setDevicePrinterGroupingProducts] = useState(true);
  const [devicePrinterShowErrorScreen, setDevicePrinterShowErrorScreen] = useState(true);
  const [devicePrinterProductionMessageOnVat, setDevicePrinterProductionMessageOnVat] = useState(false);
  const [devicePrinterNextCourseOrder, setDevicePrinterNextCourseOrder] = useState('as-registered');
  const [devicePrinterStandardMode, setDevicePrinterStandardMode] = useState('enable');
  const [devicePrinterQROrderPrinter, setDevicePrinterQROrderPrinter] = useState('');
  const [devicePrinterReprintWithNextCourse, setDevicePrinterReprintWithNextCourse] = useState(false);
  const [devicePrinterPrintZeroTickets, setDevicePrinterPrintZeroTickets] = useState(false);
  const [devicePrinterGiftVoucherAtMin, setDevicePrinterGiftVoucherAtMin] = useState(false);
  const [deviceCategoryDisplayIds, setDeviceCategoryDisplayIds] = useState([]); // empty = all categories displayed
  const [deviceOrdersConfirmOnHold, setDeviceOrdersConfirmOnHold] = useState(false);
  const [deviceOrdersPrintBarcodeAfterCreate, setDeviceOrdersPrintBarcodeAfterCreate] = useState(false);
  const [deviceOrdersCustomerCanBeModified, setDeviceOrdersCustomerCanBeModified] = useState(false);
  const [deviceOrdersBookTableToWaiting, setDeviceOrdersBookTableToWaiting] = useState(false);
  const [deviceOrdersFastCustomerName, setDeviceOrdersFastCustomerName] = useState(false);
  const [deviceScheduledPrinter, setDeviceScheduledPrinter] = useState('');
  const [deviceScheduledProductionFlow, setDeviceScheduledProductionFlow] = useState('scheduled-orders-print');
  const [deviceScheduledLoading, setDeviceScheduledLoading] = useState('0');
  const [deviceScheduledMode, setDeviceScheduledMode] = useState('labels');
  const [deviceScheduledInvoiceLayout, setDeviceScheduledInvoiceLayout] = useState('standard');
  const [deviceScheduledCheckoutAt, setDeviceScheduledCheckoutAt] = useState('delivery-note');
  const [deviceScheduledPrintBarcodeLabel, setDeviceScheduledPrintBarcodeLabel] = useState(true);
  const [deviceScheduledDeliveryNoteToTurnover, setDeviceScheduledDeliveryNoteToTurnover] = useState(true);
  const [deviceScheduledPrintProductionReceipt, setDeviceScheduledPrintProductionReceipt] = useState(true);
  const [deviceScheduledPrintCustomerProductionReceipt, setDeviceScheduledPrintCustomerProductionReceipt] = useState(true);
  const [deviceScheduledWebOrderAutoPrint, setDeviceScheduledWebOrderAutoPrint] = useState(true);
  const [functionButtonSlots, setFunctionButtonSlots] = useState(() =>
    Array(FUNCTION_BUTTON_SLOT_COUNT).fill('')
  );
  const [selectedFunctionButtonSlotIndex, setSelectedFunctionButtonSlotIndex] = useState(null);
  const [selectedFunctionButtonPoolItemId, setSelectedFunctionButtonPoolItemId] = useState(null);
  const [optionButtonSlots, setOptionButtonSlots] = useState(() =>
    normalizeOptionButtonSlots(null)
  );
  const [selectedOptionButtonSlotIndex, setSelectedOptionButtonSlotIndex] = useState(null);
  const [selectedOptionButtonPoolItemId, setSelectedOptionButtonPoolItemId] = useState(null);

  const [showSystemSettingsModal, setShowSystemSettingsModal] = useState(false);
  const [systemSettingsTab, setSystemSettingsTab] = useState('General');
  const [sysUseStockManagement, setSysUseStockManagement] = useState(true);
  const [sysUsePriceGroups, setSysUsePriceGroups] = useState(true);
  const [sysLoginWithoutCode, setSysLoginWithoutCode] = useState(true);
  const [sysCategorieenPerKassa, setSysCategorieenPerKassa] = useState(true);
  const [sysAutoAcceptQROrders, setSysAutoAcceptQROrders] = useState(false);
  const [sysQrOrdersAutomatischAfrekenen, setSysQrOrdersAutomatischAfrekenen] = useState(false);
  const [sysEnkelQROrdersKeukenscherm, setSysEnkelQROrdersKeukenscherm] = useState(false);
  const [sysAspect169Windows, setSysAspect169Windows] = useState(false);
  const [sysVatRateVariousProducts, setSysVatRateVariousProducts] = useState('12');
  const [sysArrangeProductsManually, setSysArrangeProductsManually] = useState(true);
  const [sysLimitOneUserPerTable, setSysLimitOneUserPerTable] = useState(false);
  const [sysOneWachtorderPerKlant, setSysOneWachtorderPerKlant] = useState(false);
  const [sysCashButtonVisibleMultiplePayment, setSysCashButtonVisibleMultiplePayment] = useState(true);
  const [sysUsePlaceSettings, setSysUsePlaceSettings] = useState(false);
  const [sysTegoedAutomatischInladen, setSysTegoedAutomatischInladen] = useState(true);
  const [sysNieuwstePrijsGebruiken, setSysNieuwstePrijsGebruiken] = useState(true);
  const [sysLeeggoedTerugname, setSysLeeggoedTerugname] = useState('by-customers-name');
  const [sysKlantgegevensQRAfdrukken, setSysKlantgegevensQRAfdrukken] = useState(false);
  const [savingSystemSettings, setSavingSystemSettings] = useState(false);
  const [sysPriceTakeAway, setSysPriceTakeAway] = useState('');
  const [sysPriceDelivery, setSysPriceDelivery] = useState('');
  const [sysPriceCounterSale, setSysPriceCounterSale] = useState('');
  const [sysPriceTableSale, setSysPriceTableSale] = useState('');
  const [sysSavingsPointsPerEuro, setSysSavingsPointsPerEuro] = useState(0);
  const [sysSavingsPointsPerDiscount, setSysSavingsPointsPerDiscount] = useState(0);
  const [sysSavingsDiscount, setSysSavingsDiscount] = useState('');
  const [sysTicketVoucherValidity, setSysTicketVoucherValidity] = useState('3');
  const [sysTicketScheduledPrintMode, setSysTicketScheduledPrintMode] = useState('label-large');
  const [sysTicketScheduledCustomerSort, setSysTicketScheduledCustomerSort] = useState('as-registered');
  const [sysBarcodeType, setSysBarcodeType] = useState('Code39');

  const [paymentTypes, setPaymentTypes] = useState([]);
  const [paymentTypesLoading, setPaymentTypesLoading] = useState(false);
  const paymentTypesListRef = useRef(null);
  const [canPaymentTypesScrollUp, setCanPaymentTypesScrollUp] = useState(false);
  const [canPaymentTypesScrollDown, setCanPaymentTypesScrollDown] = useState(false);
  const [showPaymentTypeModal, setShowPaymentTypeModal] = useState(false);
  const [editingPaymentTypeId, setEditingPaymentTypeId] = useState(null);
  const [paymentTypeName, setPaymentTypeName] = useState('');
  const [paymentTypeActive, setPaymentTypeActive] = useState(true);
  const [paymentTypeIntegration, setPaymentTypeIntegration] = useState('generic');
  const [savingPaymentType, setSavingPaymentType] = useState(false);
  const [deleteConfirmPaymentTypeId, setDeleteConfirmPaymentTypeId] = useState(null);

  const [showProductionMessagesModal, setShowProductionMessagesModal] = useState(false);
  const [productionMessages, setProductionMessages] = useState([]);
  const [productionMessageInput, setProductionMessageInput] = useState('');
  const [productionMessagesPage, setProductionMessagesPage] = useState(0);
  const PRODUCTION_MESSAGES_PAGE_SIZE = 5;
  const PRODUCTION_MESSAGES_PAGE_SIZE1 = 8;
  const [editingProductionMessageId, setEditingProductionMessageId] = useState(null);
  const [deleteConfirmProductionMessageId, setDeleteConfirmProductionMessageId] = useState(null);
  const productionMessagesListRef = useRef(null);
  const [canProductionMessagesScrollUp, setCanProductionMessagesScrollUp] = useState(false);
  const [canProductionMessagesScrollDown, setCanProductionMessagesScrollDown] = useState(false);

  const [printerTab, setPrinterTab] = useState('General');
  const [printers, setPrinters] = useState(() => {
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem('pos_printers');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (_) { }
    return DEFAULT_PRINTERS.map((p, i) => ({ ...p, sortOrder: i }));
  });
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [editingPrinterId, setEditingPrinterId] = useState(null);
  const [deleteConfirmPrinterId, setDeleteConfirmPrinterId] = useState(null);
  const [printersPage, setPrintersPage] = useState(0);
  const PRINTERS_PAGE_SIZE = 7;

  const [finalTicketsCompanyData1, setFinalTicketsCompanyData1] = useState('');
  const [finalTicketsCompanyData2, setFinalTicketsCompanyData2] = useState('');
  const [finalTicketsCompanyData3, setFinalTicketsCompanyData3] = useState('');
  const [finalTicketsCompanyData4, setFinalTicketsCompanyData4] = useState('');
  const [finalTicketsCompanyData5, setFinalTicketsCompanyData5] = useState('');
  const [finalTicketsThankText, setFinalTicketsThankText] = useState('Thank you and goodbye');
  const [finalTicketsProforma, setFinalTicketsProforma] = useState(false);
  const [finalTicketsPrintPaymentType, setFinalTicketsPrintPaymentType] = useState(false);
  const [finalTicketsTicketTearable, setFinalTicketsTicketTearable] = useState(false);
  const [finalTicketsPrintLogo, setFinalTicketsPrintLogo] = useState(false);
  const [finalTicketsPrintingOrder, setFinalTicketsPrintingOrder] = useState('as-registered');
  const [finalTicketsActiveField, setFinalTicketsActiveField] = useState(null);
  const [savingFinalTickets, setSavingFinalTickets] = useState(false);

  const [prodTicketsDisplayCategories, setProdTicketsDisplayCategories] = useState(false);
  const [prodTicketsSpaceAbove, setProdTicketsSpaceAbove] = useState(false);
  const [prodTicketsTicketTearable, setProdTicketsTicketTearable] = useState(false);
  const [prodTicketsKeukenprinterBuzzer, setProdTicketsKeukenprinterBuzzer] = useState(false);
  const [prodTicketsProductenIndividueel, setProdTicketsProductenIndividueel] = useState(false);
  const [prodTicketsEatInTakeOutOnderaan, setProdTicketsEatInTakeOutOnderaan] = useState(false);
  const [prodTicketsNextCoursePrinter1, setProdTicketsNextCoursePrinter1] = useState('disabled');
  const [prodTicketsNextCoursePrinter2, setProdTicketsNextCoursePrinter2] = useState('disabled');
  const [prodTicketsNextCoursePrinter3, setProdTicketsNextCoursePrinter3] = useState('disabled');
  const [prodTicketsNextCoursePrinter4, setProdTicketsNextCoursePrinter4] = useState('disabled');
  const [prodTicketsPrintingOrder, setProdTicketsPrintingOrder] = useState('as-registered');
  const [prodTicketsGroupingReceipt, setProdTicketsGroupingReceipt] = useState('enable');
  const [prodTicketsPrinterOverboeken, setProdTicketsPrinterOverboeken] = useState('disabled');
  const [savingProdTickets, setSavingProdTickets] = useState(false);

  const [labelsType, setLabelsType] = useState(() => {
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem('pos_printer_labels');
      if (raw) {
        const parsed = JSON.parse(raw);
        return normalizeLabelType(parsed?.type, 'production-labels');
      }
    } catch (_) { }
    return 'production-labels';
  });
  const [labelsPrinter, setLabelsPrinter] = useState(() => {
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem('pos_printer_labels');
      if (raw) {
        const parsed = JSON.parse(raw);
        return String(parsed?.printer || '').trim();
      }
    } catch (_) { }
    return '';
  });
  const [labelsList, setLabelsList] = useState(() => {
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem('pos_printer_labels_list');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (_) { }
    return DEFAULT_LABELS_LIST.map((l, i) => ({ ...l, sortOrder: i }));
  });
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState(null);
  const [labelName, setLabelName] = useState('');
  const [labelHeight, setLabelHeight] = useState('');
  const [labelWidth, setLabelWidth] = useState('');
  const [labelStandard, setLabelStandard] = useState(false);
  const [labelMarginLeft, setLabelMarginLeft] = useState('0');
  const [labelMarginRight, setLabelMarginRight] = useState('0');
  const [labelMarginBottom, setLabelMarginBottom] = useState('0');
  const [labelMarginTop, setLabelMarginTop] = useState('0');
  const [deleteConfirmLabelId, setDeleteConfirmLabelId] = useState(null);
  const labelsListRef = useRef(null);
  const labelsTypeRef = useRef(labelsType);
  const labelsPrinterRef = useRef(labelsPrinter);
  const [canLabelsScrollUp, setCanLabelsScrollUp] = useState(false);
  const [canLabelsScrollDown, setCanLabelsScrollDown] = useState(false);
  const [labelsListPage, setLabelsListPage] = useState(0);

  const [priceDisplayType, setPriceDisplayType] = useState('disabled');
  const [priceDisplayKeyboardValue, setPriceDisplayKeyboardValue] = useState('');
  const [savingPriceDisplay, setSavingPriceDisplay] = useState(false);

  const [rfidReaderType, setRfidReaderType] = useState('disabled');
  const [rfidReaderKeyboardValue, setRfidReaderKeyboardValue] = useState('');
  const [savingRfidReader, setSavingRfidReader] = useState(false);

  const [barcodeScannerType, setBarcodeScannerType] = useState('disabled');
  const [barcodeScannerKeyboardValue, setBarcodeScannerKeyboardValue] = useState('');
  const [savingBarcodeScanner, setSavingBarcodeScanner] = useState(false);

  const [creditCardType, setCreditCardType] = useState('disabled');
  const [creditCardKeyboardValue, setCreditCardKeyboardValue] = useState('');
  const [savingCreditCard, setSavingCreditCard] = useState(false);

  const [scaleType, setScaleType] = useState('disabled');
  const [scalePort, setScalePort] = useState('');
  const [scaleConnectionMode, setScaleConnectionMode] = useState('serial');
  const [scaleLsmIp, setScaleLsmIp] = useState('');
  const [scaleUseWeightLabels, setScaleUseWeightLabels] = useState(false);
  const [scaleConfirmWeight, setScaleConfirmWeight] = useState(true);
  const [savingScale, setSavingScale] = useState(false);
  const [testingScale, setTestingScale] = useState(false);

  const [cashmaticName, setCashmaticName] = useState('Cashmatic Terminal');
  const [cashmaticConnectionType, setCashmaticConnectionType] = useState('tcp');
  const [cashmaticIpAddress, setCashmaticIpAddress] = useState('');
  const [cashmaticPort, setCashmaticPort] = useState('');
  const [cashmaticUsername, setCashmaticUsername] = useState('');
  const [cashmaticPassword, setCashmaticPassword] = useState('');
  const [cashmaticUrl, setCashmaticUrl] = useState('');
  const [cashmaticActiveField, setCashmaticActiveField] = useState('name');
  const [savingCashmatic, setSavingCashmatic] = useState(false);
  const [cashmaticTerminalId, setCashmaticTerminalId] = useState(null);

  const [payworldName, setPayworldName] = useState('Payworld Terminal');
  const [payworldIpAddress, setPayworldIpAddress] = useState('');
  const [payworldPort, setPayworldPort] = useState('5015');
  const [payworldActiveField, setPayworldActiveField] = useState('name');
  const [savingPayworld, setSavingPayworld] = useState(false);
  const [payworldTerminalId, setPayworldTerminalId] = useState(null);
  const [cardTerminalProvider, setCardTerminalProvider] = useState('payworld');
  const [vivaName, setVivaName] = useState('Viva Terminal');
  const [vivaIpAddress, setVivaIpAddress] = useState('');
  const [vivaPort, setVivaPort] = useState('9564');
  const [vivaActiveField, setVivaActiveField] = useState('name');
  const [savingViva, setSavingViva] = useState(false);
  const [vivaTerminalId, setVivaTerminalId] = useState(null);

  const [ccvName, setCcvName] = useState('CCV Terminal');
  const [ccvIpAddress, setCcvIpAddress] = useState('');
  const [ccvCommandPort, setCcvCommandPort] = useState('4100');
  const [ccvDevicePort, setCcvDevicePort] = useState('4102');
  const [ccvWorkstationId, setCcvWorkstationId] = useState('POS');
  const [ccvActiveField, setCcvActiveField] = useState('name');
  const [savingCcv, setSavingCcv] = useState(false);
  const [ccvTerminalId, setCcvTerminalId] = useState(null);

  const [worldlineName, setWorldlineName] = useState('Worldline RX5000');
  const [worldlineIpAddress, setWorldlineIpAddress] = useState('');
  const [worldlinePort, setWorldlinePort] = useState('9001');
  const [worldlineTerminalConnectsToPos, setWorldlineTerminalConnectsToPos] = useState(true);
  const [worldlineSimulate, setWorldlineSimulate] = useState(true);
  const [worldlineActiveField, setWorldlineActiveField] = useState('name');
  const [savingWorldline, setSavingWorldline] = useState(false);
  const [worldlineTerminalId, setWorldlineTerminalId] = useState(null);

  const [bancontactProName, setBancontactProName] = useState('Bancontact Pro QR');
  const [bancontactProApiKey, setBancontactProApiKey] = useState('');
  const [bancontactProSandbox, setBancontactProSandbox] = useState(true);
  const [bancontactProCallbackUrl, setBancontactProCallbackUrl] = useState('');
  const [bancontactProActiveField, setBancontactProActiveField] = useState('name');
  const [savingBancontactPro, setSavingBancontactPro] = useState(false);
  const [bancontactProTerminalId, setBancontactProTerminalId] = useState(null);

  useEffect(() => {
    if (topNavId === 'external-devices' && (subNavId === 'Payworld' || subNavId === 'CCV')) {
      setSubNavId('Card');
    }
  }, [topNavId, subNavId]);

  const [subproductGroups, setSubproductGroups] = useState([]);
  const [subproductGroupsLoading, setSubproductGroupsLoading] = useState(false);
  const [selectedSubproductGroupId, setSelectedSubproductGroupId] = useState(null);
  const [selectedSubproductId, setSelectedSubproductId] = useState(null);
  const [subproducts, setSubproducts] = useState([]);
  const [subproductsLoading, setSubproductsLoading] = useState(false);
  const [subproductSearch, setSubproductSearch] = useState('');
  const [showSubproductModal, setShowSubproductModal] = useState(false);
  const [showManageGroupsModal, setShowManageGroupsModal] = useState(false);
  const [editingSubproductId, setEditingSubproductId] = useState(null);
  const [subproductName, setSubproductName] = useState('');
  const [subproductKeyName, setSubproductKeyName] = useState('');
  const [subproductProductionName, setSubproductProductionName] = useState('');
  const [subproductActiveField, setSubproductActiveField] = useState('name');
  const [subproductPrice, setSubproductPrice] = useState('');
  const [subproductVatTakeOut, setSubproductVatTakeOut] = useState('');
  const [subproductModalGroupId, setSubproductModalGroupId] = useState(null);
  const [subproductKioskPicture, setSubproductKioskPicture] = useState('');
  const [subproductAttachToCategoryIds, setSubproductAttachToCategoryIds] = useState([]);
  const subproductAttachToListRef = useRef(null);
  const [subproductAddCategoryId, setSubproductAddCategoryId] = useState('');
  const [savingSubproduct, setSavingSubproduct] = useState(false);
  const [deleteConfirmSubproductId, setDeleteConfirmSubproductId] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [showAddGroupInline, setShowAddGroupInline] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [deleteConfirmGroupId, setDeleteConfirmGroupId] = useState(null);
  const [savingGroup, setSavingGroup] = useState(false);
  const [selectedManageGroupId, setSelectedManageGroupId] = useState(null);
  const manageGroupsListRef = useRef(null);
  const manageGroupsDragRef = useRef({ active: false, startY: 0, startScrollTop: 0, pointerId: null });
  const positioningCategoryTabsRef = useRef(null);
  const [canManageGroupsPageUp, setCanManageGroupsPageUp] = useState(false);
  const [canManageGroupsPageDown, setCanManageGroupsPageDown] = useState(false);
  const LOCALE_BY_LANG = { en: 'en-US', nl: 'nl-NL', fr: 'fr-FR', tr: 'tr-TR' };

  const showToast = useCallback((type, text) => {
    setToast({ id: Date.now(), type, text });
  }, []);

  const fetchPaymentTypes = useCallback(async () => {
    setPaymentTypesLoading(true);
    try {
      const res = await fetch(`${API}/payment-methods`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data?.data)) setPaymentTypes(data.data);
      else throw new Error(data?.error || 'Failed to load payment methods');
    } catch (e) {
      showToast('error', e?.message || 'Failed to load payment methods');
    } finally {
      setPaymentTypesLoading(false);
    }
  }, [showToast]);

  const updateManageGroupsPaginationState = useCallback(() => {
    const el = manageGroupsListRef.current;
    if (!el) {
      setCanManageGroupsPageUp(false);
      setCanManageGroupsPageDown(false);
      return;
    }
    const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
    setCanManageGroupsPageUp(el.scrollTop > 0);
    setCanManageGroupsPageDown(el.scrollTop < maxScrollTop - 1);
  }, []);

  const pageManageGroups = useCallback((direction) => {
    const el = manageGroupsListRef.current;
    if (!el) return;
    const pageHeight = Math.max(120, Math.floor(el.clientHeight * 0.92));
    const delta = direction === 'down' ? pageHeight : -pageHeight;
    el.scrollBy({ top: delta, behavior: 'smooth' });
  }, []);

  const updateDiscountsScrollState = useCallback(() => {
    const el = discountsListRef.current;
    if (!el) {
      setCanDiscountsScrollUp(false);
      setCanDiscountsScrollDown(false);
      return;
    }
    const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
    setCanDiscountsScrollUp(el.scrollTop > 0);
    setCanDiscountsScrollDown(el.scrollTop < maxScrollTop - 1);
  }, []);

  const scrollDiscountsByPage = useCallback((direction) => {
    const el = discountsListRef.current;
    if (!el) return;
    const pageHeight = Math.max(120, Math.floor(el.clientHeight * 0.92));
    const delta = direction === 'down' ? pageHeight : -pageHeight;
    el.scrollBy({ top: delta, behavior: 'smooth' });
  }, []);

  const updateKitchenScrollState = useCallback(() => {
    const el = kitchenListRef.current;
    if (!el) {
      setCanKitchenScrollUp(false);
      setCanKitchenScrollDown(false);
      return;
    }
    const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
    setCanKitchenScrollUp(el.scrollTop > 0);
    setCanKitchenScrollDown(el.scrollTop < maxScrollTop - 1);
  }, []);

  const scrollKitchenByPage = useCallback((direction) => {
    const el = kitchenListRef.current;
    if (!el) return;
    const pageHeight = Math.max(120, Math.floor(el.clientHeight * 0.92));
    const delta = direction === 'down' ? pageHeight : -pageHeight;
    el.scrollBy({ top: delta, behavior: 'smooth' });
  }, []);

  const updateCategoriesScrollState = useCallback(() => {
    const el = categoriesListRef.current;
    if (!el) {
      setCanCategoriesScrollUp(false);
      setCanCategoriesScrollDown(false);
      return;
    }
    const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
    setCanCategoriesScrollUp(el.scrollTop > 0);
    setCanCategoriesScrollDown(el.scrollTop < maxScrollTop - 1);
  }, []);

  const scrollCategoriesByPage = useCallback((direction) => {
    const el = categoriesListRef.current;
    if (!el) return;
    const pageHeight = Math.max(120, Math.floor(el.clientHeight * 0.92));
    const delta = direction === 'down' ? pageHeight : -pageHeight;
    el.scrollBy({ top: delta, behavior: 'smooth' });
  }, []);

  const updateProductsScrollState = useCallback(() => {
    const el = productsListRef.current;
    if (!el) {
      setCanProductsScrollUp(false);
      setCanProductsScrollDown(false);
      return;
    }
    const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
    setCanProductsScrollUp(el.scrollTop > 0);
    setCanProductsScrollDown(el.scrollTop < maxScrollTop - 1);
  }, []);

  const scrollProductsByPage = useCallback((direction) => {
    const el = productsListRef.current;
    if (!el) return;
    const pageHeight = Math.max(120, Math.floor(el.clientHeight * 0.92));
    const delta = direction === 'down' ? pageHeight : -pageHeight;
    el.scrollBy({ top: delta, behavior: 'smooth' });
  }, []);

  const updateSubproductsScrollState = useCallback(() => {
    const el = subproductsListRef.current;
    if (!el) {
      setCanSubproductsScrollUp(false);
      setCanSubproductsScrollDown(false);
      return;
    }
    const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
    setCanSubproductsScrollUp(el.scrollTop > 0);
    setCanSubproductsScrollDown(el.scrollTop < maxScrollTop - 1);
  }, []);

  const scrollSubproductsByPage = useCallback((direction) => {
    const el = subproductsListRef.current;
    if (!el) return;
    const pageHeight = Math.max(120, Math.floor(el.clientHeight * 0.92));
    const delta = direction === 'down' ? pageHeight : -pageHeight;
    el.scrollBy({ top: delta, behavior: 'smooth' });
  }, []);

  const scrollSubproductAttachToByPage = useCallback((direction) => {
    const el = subproductAttachToListRef.current;
    if (!el) return;
    const pageHeight = Math.max(80, Math.floor(el.clientHeight * 0.9));
    const delta = direction === 'down' ? pageHeight : -pageHeight;
    el.scrollBy({ top: delta, behavior: 'smooth' });
  }, []);

  const updateProductionMessagesScrollState = useCallback(() => {
    const el = productionMessagesListRef.current;
    if (!el) {
      setCanProductionMessagesScrollUp(false);
      setCanProductionMessagesScrollDown(false);
      return;
    }
    const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
    setCanProductionMessagesScrollUp(el.scrollTop > 0);
    setCanProductionMessagesScrollDown(el.scrollTop < maxScrollTop - 1);
  }, []);

  const updateDiscountTargetScrollState = useCallback(() => {
    const el = discountTargetListRef.current;
    if (!el) {
      setCanDiscountTargetScrollUp(false);
      setCanDiscountTargetScrollDown(false);
      return;
    }
    const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
    setCanDiscountTargetScrollUp(el.scrollTop > 0);
    setCanDiscountTargetScrollDown(el.scrollTop < maxScrollTop - 1);
  }, []);

  const scrollDiscountTargetByPage = useCallback((direction) => {
    const el = discountTargetListRef.current;
    if (!el) return;
    const pageHeight = Math.max(80, Math.floor(el.clientHeight * 0.9));
    const delta = direction === 'down' ? pageHeight : -pageHeight;
    el.scrollBy({ top: delta, behavior: 'smooth' });
  }, []);

  const updatePriceGroupsScrollState = useCallback(() => {
    const el = priceGroupsListRef.current;
    if (!el) {
      setCanPriceGroupsScrollUp(false);
      setCanPriceGroupsScrollDown(false);
      return;
    }
    const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
    setCanPriceGroupsScrollUp(el.scrollTop > 0);
    setCanPriceGroupsScrollDown(el.scrollTop < maxScrollTop - 1);
  }, []);

  const scrollPriceGroupsByPage = useCallback((direction) => {
    const el = priceGroupsListRef.current;
    if (!el) return;
    const pageHeight = Math.max(120, Math.floor(el.clientHeight * 0.92));
    const delta = direction === 'down' ? pageHeight : -pageHeight;
    el.scrollBy({ top: delta, behavior: 'smooth' });
  }, []);

  const updatePaymentTypesScrollState = useCallback(() => {
    const el = paymentTypesListRef.current;
    if (!el) {
      setCanPaymentTypesScrollUp(false);
      setCanPaymentTypesScrollDown(false);
      return;
    }
    const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
    setCanPaymentTypesScrollUp(el.scrollTop > 0);
    setCanPaymentTypesScrollDown(el.scrollTop < maxScrollTop - 1);
  }, []);

  const scrollPaymentTypesByPage = useCallback((direction) => {
    const el = paymentTypesListRef.current;
    if (!el) return;
    const pageHeight = Math.max(120, Math.floor(el.clientHeight * 0.92));
    const delta = direction === 'down' ? pageHeight : -pageHeight;
    el.scrollBy({ top: delta, behavior: 'smooth' });
  }, []);

  const updateUsersScrollState = useCallback(() => {
    const el = usersListRef.current;
    if (!el) {
      setCanUsersScrollUp(false);
      setCanUsersScrollDown(false);
      return;
    }
    const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
    setCanUsersScrollUp(el.scrollTop > 0);
    setCanUsersScrollDown(el.scrollTop < maxScrollTop - 1);
  }, []);

  const scrollUsersByPage = useCallback((direction) => {
    const el = usersListRef.current;
    if (!el) return;
    const pageHeight = Math.max(120, Math.floor(el.clientHeight * 0.92));
    const delta = direction === 'down' ? pageHeight : -pageHeight;
    el.scrollBy({ top: delta, behavior: 'smooth' });
  }, []);

  const updateLabelsScrollState = useCallback(() => {
    const el = labelsListRef.current;
    if (!el) {
      setCanLabelsScrollUp(false);
      setCanLabelsScrollDown(false);
      return;
    }
    const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
    setCanLabelsScrollUp(el.scrollTop > 0);
    setCanLabelsScrollDown(el.scrollTop < maxScrollTop - 1);
  }, []);

  const scrollLabelsByPage = useCallback((direction) => {
    const el = labelsListRef.current;
    if (!el) return;
    const pageHeight = Math.max(120, Math.floor(el.clientHeight * 0.92));
    const delta = direction === 'down' ? pageHeight : -pageHeight;
    el.scrollBy({ top: delta, behavior: 'smooth' });
  }, []);

  const formatDateForCurrentLanguage = useCallback((isoDate) => {
    if (!isoDate) return '';
    const s = String(isoDate).trim();
    const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    let d;
    if (ymd) {
      d = new Date(Number(ymd[1], 10), Number(ymd[2], 10) - 1, Number(ymd[3], 10));
    } else {
      const parsed = new Date(isoDate);
      if (Number.isNaN(parsed.getTime())) return isoDate;
      d = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }
    if (Number.isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString(LOCALE_BY_LANG[lang] || 'en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  }, [lang]);

  useEffect(() => {
    if (!showManageGroupsModal) return;
    updateManageGroupsPaginationState();
  }, [showManageGroupsModal, subproductGroups, updateManageGroupsPaginationState]);

  useEffect(() => {
    if (topNavId !== 'categories-products' || subNavId !== 'Discounts') return;
    updateDiscountsScrollState();
  }, [topNavId, subNavId, discounts, updateDiscountsScrollState]);

  useEffect(() => {
    if (topNavId !== 'categories-products' || subNavId !== 'Kitchen') return;
    updateKitchenScrollState();
  }, [topNavId, subNavId, kitchens, updateKitchenScrollState]);

  useEffect(() => {
    if (!showDiscountModal) return;
    updateDiscountTargetScrollState();
  }, [showDiscountModal, discountTargetIds, updateDiscountTargetScrollState]);

  useEffect(() => {
    if (topNavId !== 'categories-products' || subNavId !== 'Categories') return;
    updateCategoriesScrollState();
  }, [topNavId, subNavId, categories, updateCategoriesScrollState]);

  useEffect(() => {
    if (topNavId !== 'categories-products' || subNavId !== 'Products') return;
    updateProductsScrollState();
  }, [topNavId, subNavId, selectedCategoryId, products, productSearch, updateProductsScrollState]);

  useEffect(() => {
    if (topNavId !== 'categories-products' || subNavId !== 'Subproducts') return;
    updateSubproductsScrollState();
  }, [topNavId, subNavId, selectedSubproductGroupId, subproducts, updateSubproductsScrollState]);

  useEffect(() => {
    if (topNavId !== 'categories-products' || subNavId !== 'Price Groups') return;
    updatePriceGroupsScrollState();
  }, [topNavId, subNavId, priceGroups, updatePriceGroupsScrollState]);

  useEffect(() => {
    if (topNavId !== 'cash-register' || subNavId !== 'Payment types') return;
    updatePaymentTypesScrollState();
  }, [topNavId, subNavId, paymentTypes, updatePaymentTypesScrollState]);

  useEffect(() => {
    if (effectiveControlSidebarId !== 'users') return;
    updateUsersScrollState();
  }, [effectiveControlSidebarId, users, updateUsersScrollState]);

  useEffect(() => {
    if (!showProductionMessagesModal) return;
    updateProductionMessagesScrollState();
  }, [showProductionMessagesModal, productionMessages, updateProductionMessagesScrollState]);

  useEffect(() => {
    if (topNavId !== 'cash-register' || subNavId !== 'Printer' || printerTab !== 'Labels') return;
    updateLabelsScrollState();
  }, [topNavId, subNavId, printerTab, labelsList, updateLabelsScrollState]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchPriceGroups = useCallback(async (opts = {}) => {
    const silent = opts.silent === true;
    if (!silent) setPriceGroupsLoading(true);
    try {
      const res = await fetch(`${API}/price-groups`);
      const data = await res.json();
      setPriceGroups(Array.isArray(data) ? data : []);
    } catch {
      if (!silent) setPriceGroups([]);
    } finally {
      if (!silent) setPriceGroupsLoading(false);
    }
  }, []);

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/suppliers`);
      const data = res.ok ? await res.json() : [];
      setSupplierDirectory(
        Array.isArray(data)
          ? data.map((r) => ({ id: String(r.id ?? ''), companyName: String(r.companyName ?? '') })).filter((s) => s.id)
          : [],
      );
    } catch {
      setSupplierDirectory([]);
    }
  }, []);

  const fetchCategories = useCallback(async (opts = {}) => {
    const silent = opts.silent === true;
    if (!silent) setCategoriesLoading(true);
    let list = [];
    try {
      const res = await fetch(`${API}/categories`);
      const data = await res.json();
      list = Array.isArray(data) ? data : [];
      setCategories(list);
    } catch {
      if (!silent) setCategories([]);
      list = [];
    } finally {
      if (!silent) setCategoriesLoading(false);
    }
    return list;
  }, []);

  useEffect(() => {
    if (subNavId === 'Price Groups') fetchPriceGroups();
  }, [subNavId, fetchPriceGroups]);

  useEffect(() => {
    if (subNavId !== 'Price Groups') return undefined;
    const id = window.setInterval(() => {
      void fetchPriceGroups({ silent: true });
    }, 2500);
    return () => window.clearInterval(id);
  }, [subNavId, fetchPriceGroups]);

  useEffect(() => {
    if (subNavId === 'Categories') fetchCategories();
  }, [subNavId, fetchCategories]);

  const [discountsPage, setDiscountsPage] = useState(0);
  useEffect(() => {
    if (topNavId !== 'categories-products' || subNavId !== 'Discounts') setDiscountsPage(0);
  }, [topNavId, subNavId]);

  useEffect(() => {
    if (subNavId === 'Products') fetchCategories();
  }, [subNavId, fetchCategories]);

  useEffect(() => {
    if (showProductModal) {
      void fetchPriceGroups();
      void fetchSuppliers();
    }
  }, [showProductModal, fetchPriceGroups, fetchSuppliers]);

  const purchaseSupplierDropdownOptions = useMemo(() => {
    const sorted = [...supplierDirectory]
      .sort((a, b) => (a.companyName || '').localeCompare(b.companyName || '', undefined, { sensitivity: 'base' }))
      .map((s) => ({ value: s.id, label: s.companyName || '—' }));
    const opts = [{ value: '', label: '--' }, ...sorted];
    if (purchaseSupplier && !opts.some((o) => o.value === purchaseSupplier)) {
      const unk = t('control.productModal.purchase.supplierUnknown');
      opts.push({ value: purchaseSupplier, label: unk === 'control.productModal.purchase.supplierUnknown' ? 'Unknown supplier' : unk });
    }
    return opts;
  }, [supplierDirectory, purchaseSupplier, t]);

  useEffect(() => {
    if (!showProductModal || !priceGroups.length) return;
    setExtraPricesRows((prev) => {
      const byId = new Map(prev.filter((r) => r.priceGroupId).map((r) => [r.priceGroupId, r]));
      return priceGroups.map((pg) => {
        const ex = byId.get(pg.id);
        return {
          priceGroupId: pg.id,
          priceGroupLabel: pg.name,
          otherName: ex?.otherName ?? '',
          otherPrinter: ex?.otherPrinter ?? '',
          otherPrice: ex?.otherPrice ?? ''
        };
      });
    });
  }, [showProductModal, priceGroups]);

  const fetchProducts = useCallback(async (categoryId) => {
    if (!categoryId) {
      setProducts([]);
      return;
    }
    setProductsLoading(true);
    try {
      const res = await fetch(`${API}/categories/${categoryId}/products`);
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (subNavId === 'Products' && selectedCategoryId) fetchProducts(selectedCategoryId);
  }, [subNavId, selectedCategoryId, fetchProducts]);

  // Keep categories/products in sync with mobile edits without manual refresh.
  useEffect(() => {
    if (topNavId !== 'categories-products') return undefined;
    if (subNavId !== 'Products' && subNavId !== 'Categories') return undefined;

    const intervalId = setInterval(() => {
      if (subNavId === 'Products') {
        void fetchCategories({ silent: true });
        if (selectedCategoryId) fetchProducts(selectedCategoryId);
        return;
      }
      void fetchCategories({ silent: true });
    }, 2500);

    return () => clearInterval(intervalId);
  }, [topNavId, subNavId, selectedCategoryId, fetchCategories, fetchProducts]);

  useEffect(() => {
    if (subNavId !== 'Products') return;
    if (!Array.isArray(products) || products.length === 0) return;

    let cancelled = false;
    const toCheck = products
      .map((p) => p?.id)
      .filter((id) => id != null && productHasSubproductsById[id] == null);
    if (toCheck.length === 0) return;

    (async () => {
      for (const id of toCheck) {
        if (cancelled) return;
        try {
          const res = await fetch(`${API}/products/${id}/subproduct-links`);
          const data = await res.json().catch(() => ({}));
          const links = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
          const hasAny = links.length > 0;
          if (!cancelled) {
            setProductHasSubproductsById((prev) => (prev[id] === hasAny ? prev : { ...prev, [id]: hasAny }));
          }
        } catch {
          // ignore
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [subNavId, products, productHasSubproductsById]);

  useEffect(() => {
    if (subNavId === 'Products' && categories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [subNavId, categories, selectedCategoryId]);

  useEffect(() => {
    if (topNavId !== 'categories-products' || subNavId !== 'Products') return;
    if (!selectedCategoryId || !productsCategoryTabsRef.current) return;
    const selectedTab = productsCategoryTabsRef.current.querySelector(`[data-category-id="${String(selectedCategoryId)}"]`);
    if (selectedTab && typeof selectedTab.scrollIntoView === 'function') {
      selectedTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [topNavId, subNavId, selectedCategoryId, categories]);

  useEffect(() => {
    if (!showProductPositioningModal) return;
    if (!positioningCategoryId && categories.length > 0) {
      setPositioningCategoryId(selectedCategoryId || categories[0].id);
    }
  }, [showProductPositioningModal, positioningCategoryId, categories, selectedCategoryId]);

  useEffect(() => {
    if (!showProductModal || productTab !== 'extra_prices') return;
    const id = requestAnimationFrame(() => {
      syncExtraPricesScrollEdges();
    });
    return () => cancelAnimationFrame(id);
  }, [showProductModal, productTab, extraPricesRows.length, syncExtraPricesScrollEdges]);

  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('pos_product_positioning_layout', JSON.stringify(positioningLayoutByCategory));
      }
    } catch {
      // ignore localStorage write failures
    }
  }, [positioningLayoutByCategory]);

  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('pos_product_positioning_colors', JSON.stringify(positioningColorByCategory));
      }
    } catch {
      // ignore localStorage write failures
    }
  }, [positioningColorByCategory]);

  const fetchPositioningSubproducts = useCallback(async (categoryId) => {
    if (!categoryId) {
      setPositioningSubproducts([]);
      return;
    }
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('pos_subproduct_extra') : null;
      const extraMap = raw ? JSON.parse(raw) : {};
      const attachedIds = Object.entries(extraMap || {})
        .filter(([, value]) => Array.isArray(value?.attachToCategoryIds) && value.attachToCategoryIds.includes(categoryId))
        .map(([id]) => id);
      if (attachedIds.length === 0) {
        setPositioningSubproducts([]);
        return;
      }
      const groupsRes = await fetch(`${API}/subproduct-groups`);
      const groups = await groupsRes.json().catch(() => []);
      const safeGroups = Array.isArray(groups) ? groups : [];
      const listNested = await Promise.all(
        safeGroups.map(async (g) => {
          const res = await fetch(`${API}/subproduct-groups/${g.id}/subproducts`);
          const data = await res.json().catch(() => []);
          return Array.isArray(data) ? data : [];
        })
      );
      const allSubproducts = listNested.flat();
      const filtered = allSubproducts
        .filter((sp) => attachedIds.includes(sp.id))
        .map((sp) => {
          const ex = extraMap?.[sp.id] || {};
          const parsedPrice = parseFloat(ex?.price);
          return {
            ...sp,
            type: 'subproduct',
            _positioningId: `s:${sp.id}`,
            _positioningPrice: Number.isFinite(parsedPrice) ? parsedPrice : Number(sp.price ?? 0),
          };
        });
      setPositioningSubproducts(filtered);
    } catch {
      setPositioningSubproducts([]);
    }
  }, []);

  useEffect(() => {
    if (!showProductPositioningModal) return;
    const categoryId = positioningCategoryId || selectedCategoryId || categories[0]?.id || null;
    if (!categoryId) return;
    fetchProducts(categoryId);
    fetchPositioningSubproducts(categoryId);
  }, [showProductPositioningModal, positioningCategoryId, selectedCategoryId, categories, fetchProducts, fetchPositioningSubproducts]);

  useEffect(() => {
    if (!showProductPositioningModal) return;
    const categoryId = positioningCategoryId || selectedCategoryId || categories[0]?.id || null;
    if (!categoryId) return;
    setPositioningLayoutByCategory((prev) => {
      if (Array.isArray(prev?.[categoryId])) return prev;
      // Persist explicit empty layout so POS does not auto-fallback to full product list.
      return { ...prev, [categoryId]: Array.from({ length: 25 }, () => null) };
    });
  }, [showProductPositioningModal, positioningCategoryId, selectedCategoryId, categories]);

  useEffect(() => {
    if (!showProductPositioningModal) return;
    const categoryId = positioningCategoryId || selectedCategoryId || categories[0]?.id || null;
    if (!categoryId || !positioningCategoryTabsRef.current) return;
    const selectedTab = positioningCategoryTabsRef.current.querySelector(`[data-category-id="${String(categoryId)}"]`);
    if (selectedTab && typeof selectedTab.scrollIntoView === 'function') {
      selectedTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [showProductPositioningModal, positioningCategoryId, selectedCategoryId, categories]);

  const setPositioningLayoutForModal = useCallback((action) => {
    positioningDirtyRef.current = true;
    setPositioningLayoutByCategory(action);
  }, []);

  const setPositioningColorForModal = useCallback((action) => {
    positioningDirtyRef.current = true;
    setPositioningColorByCategory(action);
  }, []);

  const openProductPositioningModal = () => {
    positioningDirtyRef.current = false;
    setPositioningCategoryId(selectedCategoryId || categories[0]?.id || null);
    setPositioningSelectedProductId(null);
    setPositioningSelectedCellIndex(null);
    setPositioningSelectedPoolItemId(null);
    setShowProductPositioningModal(true);
  };

  const closeProductPositioningModal = () => {
    positioningDirtyRef.current = false;
    setShowProductPositioningModal(false);
    setPositioningSelectedProductId(null);
    setPositioningSelectedCellIndex(null);
    setPositioningSelectedPoolItemId(null);
    setPositioningLayoutSaveMessage('');
  };

  const saveProductPositioningLayout = useCallback(async () => {
    setSavingPositioningLayout(true);
    setPositioningLayoutSaveMessage('');
    try {
      const [layoutRes, colorRes] = await Promise.all([
        fetch(`${API}/settings/product-positioning-layout`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: positioningLayoutByCategory || {} })
        }),
        fetch(`${API}/settings/product-positioning-colors`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: positioningColorByCategory || {} })
        })
      ]);
      if (!layoutRes.ok || !colorRes.ok) {
        const layoutErr = layoutRes.ok ? null : await layoutRes.json().catch(() => null);
        const colorErr = colorRes.ok ? null : await colorRes.json().catch(() => null);
        throw new Error(layoutErr?.error || colorErr?.error || 'Failed to save positioning layout');
      }
      positioningDirtyRef.current = false;
      showToast('success', 'Layout and colors saved.');
      closeProductPositioningModal();
    } catch (err) {
      showToast('error', err?.message || 'Failed to save layout');
    } finally {
      setSavingPositioningLayout(false);
    }
  }, [positioningLayoutByCategory, positioningColorByCategory, showToast, closeProductPositioningModal]);

  useEffect(() => {
    if (!showProductPositioningModal) return undefined;
    const tick = async () => {
      if (positioningDirtyRef.current) return;
      try {
        const [layoutRes, colorRes] = await Promise.all([
          fetch(`${API}/settings/product-positioning-layout`),
          fetch(`${API}/settings/product-positioning-colors`),
        ]);
        const layoutData = await layoutRes.json().catch(() => null);
        const colorData = await colorRes.json().catch(() => null);
        if (layoutRes.ok && layoutData?.value && typeof layoutData.value === 'object') {
          setPositioningLayoutByCategory(layoutData.value);
        }
        if (colorRes.ok && colorData?.value && typeof colorData.value === 'object') {
          setPositioningColorByCategory(colorData.value);
        }
      } catch {
        // ignore transient poll failures
      }
    };
    const id = window.setInterval(tick, 2500);
    return () => window.clearInterval(id);
  }, [showProductPositioningModal]);

  const fetchSubproductGroups = useCallback(async (silent = false) => {
    if (!silent) setSubproductGroupsLoading(true);
    let list = [];
    try {
      const res = await fetch(`${API}/subproduct-groups`);
      const data = await res.json();
      list = Array.isArray(data) ? data : [];
      setSubproductGroups(list);
    } catch {
      if (!silent) setSubproductGroups([]);
      list = [];
    } finally {
      if (!silent) setSubproductGroupsLoading(false);
    }
    return list;
  }, []);

  useEffect(() => {
    if (subNavId === 'Subproducts') {
      fetchSubproductGroups();
      fetchCategories();
    }
  }, [subNavId, fetchSubproductGroups, fetchCategories]);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await fetch(`${API}/users`, {
        headers: { ...posTerminalAuthHeaders() },
      });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const resolveCurrentRegisterIdForUserWrite = useCallback(async () => {
    const fromProp = String(currentRegisterId || '').trim();
    if (fromProp) return fromProp;
    try {
      const res = await fetch(`${API}/pos-registers/current-device`, {
        headers: { ...posTerminalAuthHeaders() },
      });
      const data = await res.json().catch(() => ({}));
      const fromDevice = String(data?.register?.id || '').trim();
      if (fromDevice) return fromDevice;
    } catch {
      // Ignore and continue with empty fallback.
    }
    return '';
  }, [API, currentRegisterId]);

  useEffect(() => {
    if (effectiveControlSidebarId === 'users') fetchUsers();
  }, [effectiveControlSidebarId, fetchUsers]);

  useEffect(() => {
    if (!realtimeSocket?.on) return undefined;
    const handleUsersChanged = () => {
      void fetchUsers();
    };
    realtimeSocket.on('pos-users:changed', handleUsersChanged);
    return () => {
      realtimeSocket.off('pos-users:changed', handleUsersChanged);
    };
  }, [realtimeSocket, fetchUsers]);

  const fetchSubproducts = useCallback(async (groupId, silent = false) => {
    if (!groupId) {
      setSubproducts([]);
      return;
    }
    if (!silent) setSubproductsLoading(true);
    try {
      const res = await fetch(`${API}/subproduct-groups/${groupId}/subproducts`);
      const data = await res.json();
      setSubproducts(Array.isArray(data) ? data : []);
    } catch {
      setSubproducts([]);
    } finally {
      if (!silent) setSubproductsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (subNavId === 'Subproducts' && selectedSubproductGroupId) fetchSubproducts(selectedSubproductGroupId);
  }, [subNavId, selectedSubproductGroupId, fetchSubproducts]);

  useEffect(() => {
    if (subNavId !== 'Subproducts') return undefined;
    const timer = window.setInterval(() => {
      void (async () => {
        // Groups + subproducts: webpanel (or another client) may add/edit while this screen is open.
        await fetchSubproductGroups(true);
        if (selectedSubproductGroupId) fetchSubproducts(selectedSubproductGroupId, true);
      })();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [subNavId, selectedSubproductGroupId, fetchSubproducts, fetchSubproductGroups]);

  useEffect(() => {
    if (subNavId === 'Subproducts' && subproductGroups.length > 0 && !selectedSubproductGroupId) {
      setSelectedSubproductGroupId(subproductGroups[0].id);
    }
  }, [subNavId, subproductGroups, selectedSubproductGroupId]);

  useEffect(() => {
    if (topNavId !== 'categories-products' || subNavId !== 'Subproducts') return;
    if (!selectedSubproductGroupId || !subproductsGroupTabsRef.current) return;
    const selectedTab = subproductsGroupTabsRef.current.querySelector(`[data-group-id="${String(selectedSubproductGroupId)}"]`);
    if (selectedTab && typeof selectedTab.scrollIntoView === 'function') {
      selectedTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [topNavId, subNavId, selectedSubproductGroupId, subproductGroups]);

  const openProductSubproductsModal = useCallback(async (product) => {
    productSubproductsHasLocalEditsRef.current = false;
    setProductSubproductsProduct(product);
    setShowProductSubproductsModal(true);
    let groups = subproductGroups;
    if (!groups.length) {
      try {
        const res = await fetch(`${API}/subproduct-groups`);
        const data = await res.json().catch(() => []);
        groups = Array.isArray(data) ? data : [];
        setSubproductGroups(groups);
      } catch {
        groups = [];
      }
    }
    setProductSubproductsGroupId('');
    setProductSubproductsLeftSelectedIds(new Set());
    setProductSubproductsRightSelectedIds(new Set());
    setProductSubproductsOptions([]);
    setProductSubproductsLinked([]);
    setLoadingProductSubproductsLinked(true);
    try {
      const res = await fetch(`${API}/products/${product.id}/subproduct-links`);
      const data = await res.json().catch(() => []);
      const links = Array.isArray(data) ? data : [];
      setProductSubproductsLinked(links.map((l) => ({
        subproductId: l.subproductId,
        subproductName: l.subproductName,
        groupId: l.groupId || '',
        groupName: l.groupName || ''
      })));
      // Only preselect group when this product already has linked subproducts.
      const firstLinkedGroupId = links.find((l) => l?.groupId)?.groupId || '';
      if (firstLinkedGroupId && groups.some((g) => g.id === firstLinkedGroupId)) {
        setProductSubproductsGroupId(firstLinkedGroupId);
      }
    } catch {
      setProductSubproductsLinked([]);
    } finally {
      setLoadingProductSubproductsLinked(false);
    }
  }, [subproductGroups]);

  const closeProductSubproductsModal = useCallback(() => {
    productSubproductsHasLocalEditsRef.current = false;
    setShowProductSubproductsModal(false);
    setProductSubproductsProduct(null);
    setProductSubproductsGroupId('');
    setProductSubproductsLeftSelectedIds(new Set());
    setProductSubproductsRightSelectedIds(new Set());
    setProductSubproductsOptions([]);
    setProductSubproductsLinked([]);
    setLoadingProductSubproductsLinked(false);
    setSavingProductSubproducts(false);
  }, []);

  useEffect(() => {
    if (!showProductSubproductsModal || !productSubproductsGroupId) {
      setProductSubproductsOptions([]);
      setProductSubproductsLeftSelectedIds(new Set());
      return;
    }
    let alive = true;
    const loadGroupSubproducts = async () => {
      try {
        const res = await fetch(`${API}/subproduct-groups/${productSubproductsGroupId}/subproducts`);
        const data = await res.json().catch(() => []);
        if (!alive) return;
        const list = Array.isArray(data) ? data : [];
        setProductSubproductsOptions(list);
        setProductSubproductsLeftSelectedIds(new Set());
      } catch {
        if (!alive) return;
        setProductSubproductsOptions([]);
        setProductSubproductsLeftSelectedIds(new Set());
      }
    };
    loadGroupSubproducts();
    return () => {
      alive = false;
    };
  }, [showProductSubproductsModal, productSubproductsGroupId]);

  useEffect(() => {
    if (!showProductSubproductsModal || !productSubproductsProduct?.id || loadingProductSubproductsLinked || savingProductSubproducts) return;
    const productId = productSubproductsProduct.id;
    const linksSig = (rows) =>
      JSON.stringify(
        [...(Array.isArray(rows) ? rows : [])]
          .map((r) => ({
            i: String(r.subproductId),
            g: String(r.groupId ?? ''),
            n: String(r.subproductName ?? '')
          }))
          .sort((a, b) => a.i.localeCompare(b.i))
      );
    const pull = async () => {
      if (productSubproductsHasLocalEditsRef.current) return;
      try {
        const res = await fetch(`${API}/products/${productId}/subproduct-links`);
        const data = await res.json().catch(() => []);
        const links = Array.isArray(data) ? data : [];
        const mapped = links.map((l) => ({
          subproductId: String(l.subproductId),
          subproductName: String(l.subproductName ?? ''),
          groupId: String(l.groupId ?? ''),
          groupName: String(l.groupName ?? '')
        }));
        setProductSubproductsLinked((prev) => (linksSig(prev) === linksSig(mapped) ? prev : mapped));
        setProductHasSubproductsById((prev) => {
          const hasAny = mapped.length > 0;
          return prev[productId] === hasAny ? prev : { ...prev, [productId]: hasAny };
        });
      } catch {
        // ignore poll errors
      }
    };
    void pull();
    const intervalId = window.setInterval(() => {
      void pull();
    }, PRODUCT_SUBPRODUCT_LINKS_MODAL_POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void pull();
    };
    const onLinksChanged = (e) => {
      if (e?.detail?.productId === productId) void pull();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener(POS_PRODUCT_SUBPRODUCT_LINKS_CHANGED_EVENT, onLinksChanged);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener(POS_PRODUCT_SUBPRODUCT_LINKS_CHANGED_EVENT, onLinksChanged);
    };
  }, [
    showProductSubproductsModal,
    productSubproductsProduct?.id,
    loadingProductSubproductsLinked,
    savingProductSubproducts
  ]);

  const productSubproductsAvailable = useMemo(() => {
    const linkedIds = new Set(productSubproductsLinked.map((l) => l.subproductId));
    return productSubproductsOptions.filter((sp) => !linkedIds.has(sp.id));
  }, [productSubproductsOptions, productSubproductsLinked]);

  const handleAddProductSubproductLinks = useCallback(() => {
    if (!productSubproductsLeftSelectedIds.size) return;
    productSubproductsHasLocalEditsRef.current = true;
    const group = subproductGroups.find((g) => g.id === productSubproductsGroupId);
    const toAdd = productSubproductsAvailable.filter((sp) => productSubproductsLeftSelectedIds.has(sp.id));
    if (!toAdd.length) return;
    setProductSubproductsLinked((prev) => {
      const existingIds = new Set(prev.map((l) => l.subproductId));
      const newLinks = toAdd
        .filter((sp) => !existingIds.has(sp.id))
        .map((sp) => ({
          subproductId: sp.id,
          subproductName: sp.name,
          groupId: group?.id || productSubproductsGroupId || '',
          groupName: group?.name || ''
        }));
      return [...prev, ...newLinks];
    });
    setProductSubproductsLeftSelectedIds(new Set());
  }, [productSubproductsLeftSelectedIds, productSubproductsAvailable, subproductGroups, productSubproductsGroupId]);

  const handleRemoveProductSubproductLinks = useCallback(() => {
    if (!productSubproductsRightSelectedIds.size) return;
    productSubproductsHasLocalEditsRef.current = true;
    setProductSubproductsLinked((prev) =>
      prev.filter((l) => !productSubproductsRightSelectedIds.has(l.subproductId))
    );
    setProductSubproductsRightSelectedIds(new Set());
  }, [productSubproductsRightSelectedIds]);

  const removeProductSubproductLink = useCallback((subproductId) => {
    productSubproductsHasLocalEditsRef.current = true;
    setProductSubproductsLinked((prev) => prev.filter((x) => x.subproductId !== subproductId));
  }, []);

  const handleLogoutConfirm = () => {
    setShowLogoutModal(false);
    onLogout?.();
  };

  const tr = useCallback((key, fallback) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  }, [t]);

  const handleMakePeriodicReport = useCallback(async () => {
    setPeriodicReportLoading(true);
    try {
      const qs = new URLSearchParams({
        startDate: periodicReportStartDate,
        startTime: periodicReportStartTime,
        endDate: periodicReportEndDate,
        endTime: periodicReportEndTime,
        lang: lang || 'en',
        userName: String(currentUser?.label ?? currentUser?.name ?? '').trim(),
        storeName: String(finalTicketsCompanyData1 ?? '')
          .trim()
          .slice(0, 120),
        reportSettings: JSON.stringify(reportSettings || {}),
      });
      const res = await fetch(`${API}/reports/periodic?${qs}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || tr('control.reports.generateFailed', 'Could not generate report.'));
      }
      setPeriodicReportLines(Array.isArray(data.lines) ? data.lines : []);
    } catch (e) {
      setPeriodicReportLines(null);
      showToast('error', e?.message || tr('control.reports.generateFailed', 'Could not generate report.'));
    } finally {
      setPeriodicReportLoading(false);
    }
  }, [
    API,
    currentUser?.label,
    currentUser?.name,
    finalTicketsCompanyData1,
    lang,
    periodicReportEndDate,
    periodicReportEndTime,
    periodicReportStartDate,
    periodicReportStartTime,
    reportSettings,
    showToast,
    tr,
  ]);

  const handleSaveProductSubproducts = useCallback(async () => {
    if (!productSubproductsProduct?.id) return;
    setSavingProductSubproducts(true);
    try {
      const linksPayload = productSubproductsLinked.map((l) => ({
        groupId: l.groupId || '',
        subproductId: l.subproductId
      }));
      const res = await fetch(`${API}/products/${productSubproductsProduct.id}/subproduct-links`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links: linksPayload })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || tr('control.productSubproducts.saveFailed', 'Failed to save product subproducts'));
      }
      // Reflect linked-subproducts state immediately in the products list UI.
      setProductHasSubproductsById((prev) => ({
        ...prev,
        [productSubproductsProduct.id]: linksPayload.length > 0
      }));
      productSubproductsHasLocalEditsRef.current = false;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(POS_PRODUCT_SUBPRODUCT_LINKS_CHANGED_EVENT, { detail: { productId: productSubproductsProduct.id } })
        );
      }
      showToast('success', tr('control.productSubproducts.saved', 'Product subproducts saved.'));
      onMenuCatalogRefresh?.();
      closeProductSubproductsModal();
    } catch (err) {
      showToast('error', err?.message || tr('control.productSubproducts.saveFailed', 'Failed to save product subproducts.'));
    } finally {
      setSavingProductSubproducts(false);
    }
  }, [closeProductSubproductsModal, onMenuCatalogRefresh, productSubproductsLinked, productSubproductsProduct, showToast, tr]);

  const mapTranslatedOptions = useCallback((opts) =>
    opts.map((o) => ({ value: o.value, label: o.labelKey ? tr(o.labelKey, o.fallback) : o.label }))
    , [tr]);
  const getFunctionButtonLabel = useCallback((id) => {
    const item = FUNCTION_BUTTON_ITEM_BY_ID[id];
    if (!item) return '';
    return tr(item.labelKey, item.fallbackLabel);
  }, [tr]);
  const getOptionButtonLabel = useCallback((id) => {
    const item = OPTION_BUTTON_ITEM_BY_ID[id];
    if (!item) return '';
    return tr(item.labelKey, item.fallbackLabel);
  }, [tr]);

  useEffect(() => {
    if (LANGUAGE_OPTIONS.some((o) => o.value === lang)) setAppLanguage(lang);
  }, [lang]);

  const handleSaveAppLanguage = () => {
    setSavingAppLanguage(true);
    try {
      setLang(appLanguage);
      showToast('success', tr('control.languageUpdated', 'Language updated.'));
    } finally {
      setSavingAppLanguage(false);
    }
  };

  const openPriceGroupModal = () => {
    setEditingPriceGroupId(null);
    setPriceGroupName('');
    setPriceGroupTax('standard');
    setShowPriceGroupModal(true);
  };

  const openEditPriceGroupModal = (pg) => {
    setEditingPriceGroupId(pg.id);
    setPriceGroupName(pg.name || '');
    setPriceGroupTax(pg.tax && VAT_OPTIONS.some((o) => o.value === pg.tax) ? pg.tax : 'standard');
    setShowPriceGroupModal(true);
  };

  const closePriceGroupModal = () => {
    setShowPriceGroupModal(false);
    setEditingPriceGroupId(null);
  };

  const handleSavePriceGroup = async () => {
    setSavingPriceGroup(true);
    const payload = { name: priceGroupName.trim() || 'New price group', tax: priceGroupTax };
    try {
      if (editingPriceGroupId) {
        const res = await fetch(`${API}/price-groups/${editingPriceGroupId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const updated = await res.json();
        if (res.ok && updated) {
          setPriceGroups((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          closePriceGroupModal();
        } else fetchPriceGroups();
      } else {
        const res = await fetch(`${API}/price-groups`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const created = await res.json();
        if (res.ok && created) {
          setPriceGroups((prev) => [...prev, created]);
          closePriceGroupModal();
        } else fetchPriceGroups();
      }
    } catch {
      fetchPriceGroups();
    } finally {
      setSavingPriceGroup(false);
    }
  };

  const handleDeletePriceGroup = async (id) => {
    try {
      const res = await fetch(`${API}/price-groups/${id}`, { method: 'DELETE' });
      if (res.ok) setPriceGroups((prev) => prev.filter((p) => p.id !== id));
      else fetchPriceGroups();
    } catch {
      fetchPriceGroups();
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const openCategoryModal = () => {
    setEditingCategoryId(null);
    setCategoryName('');
    setCategoryNextCourse('');
    setCategoryInWebshop(true);
    setCategoryDisplayOnCashRegister(true);
    setCategoryActiveField('name');
    setShowCategoryModal(true);
  };

  const openEditCategoryModal = (cat) => {
    setEditingCategoryId(cat.id);
    setCategoryName(cat.name || '');
    setCategoryNextCourse(cat.nextCourse || '');
    setCategoryInWebshop(cat.inWebshop !== false);
    setCategoryDisplayOnCashRegister(cat.displayOnCashRegister !== false);
    setCategoryActiveField('name');
    setShowCategoryModal(true);
  };

  const closeCategoryModal = () => {
    setShowCategoryModal(false);
    setEditingCategoryId(null);
  };

  const handleSaveCategory = async () => {
    setSavingCategory(true);
    const payload = {
      name: categoryName.trim() || 'New category',
      inWebshop: categoryInWebshop,
      displayOnCashRegister: categoryDisplayOnCashRegister,
      nextCourse: categoryNextCourse.trim() || null
    };
    try {
      if (editingCategoryId) {
        const res = await fetch(`${API}/categories/${editingCategoryId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const updated = await res.json();
        if (res.ok && updated) {
          setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          closeCategoryModal();
        } else fetchCategories();
      } else {
        const res = await fetch(`${API}/categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const created = await res.json();
        if (res.ok && created) {
          setCategories((prev) => [...prev, created]);
          closeCategoryModal();
        } else fetchCategories();
      }
    } catch {
      fetchCategories();
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id) => {
    try {
      const res = await fetch(`${API}/categories/${id}`, { method: 'DELETE' });
      if (res.ok) setCategories((prev) => prev.filter((c) => c.id !== id));
      else fetchCategories();
    } catch {
      fetchCategories();
    } finally {
      setDeleteConfirmCategoryId(null);
    }
  };

  const handleMoveCategory = async (id, direction) => {
    const idx = categories.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const nextIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= categories.length) return;
    const curr = categories[idx];
    const other = categories[nextIdx];
    const currOrder = curr.sortOrder;
    const otherOrder = other.sortOrder;
    try {
      await fetch(`${API}/categories/${curr.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: otherOrder })
      });
      await fetch(`${API}/categories/${other.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: currOrder })
      });
      setCategories((prev) => {
        const list = [...prev];
        list[idx] = { ...list[idx], sortOrder: otherOrder };
        list[nextIdx] = { ...list[nextIdx], sortOrder: currOrder };
        return list.sort((a, b) => a.sortOrder - b.sortOrder);
      });
    } catch {
      fetchCategories();
    }
  };

  const openProductModal = () => {
    setEditingProductId(null);
    setProductTab('general');
    setProductName('');
    setProductKeyName('');
    setProductProductionName('');
    setProductPrice('');
    setProductVatTakeOut('');
    setProductCategoryIds([selectedCategoryId || '']);
    setProductAddition('Subproducts');
    setProductBarcode('');
    setProductPrinter1('');
    setProductPrinter2('');
    setProductPrinter3('');
    setProductActiveField('name');
    setProductFieldErrors({ name: false, keyName: false, productionName: false, vatTakeOut: false });
    setProductTabsUnlocked(true);
    setProductDisplayNumber(null);
    setAdvancedKassaPhotoPreview(null);
    setAdvancedOpenPrice(false);
    setAdvancedWeegschaal(false);
    setAdvancedSubproductRequires(false);
    setAdvancedLeeggoedPrijs('0.00');
    setAdvancedPagerVerplicht(false);
    setAdvancedBoldPrint(false);
    setAdvancedGroupingReceipt(true);
    setAdvancedLabelExtraInfo('');
    setAdvancedVoorverpakVervaltype('Shelf life');
    setAdvancedHoudbareDagen('0');
    setAdvancedBewarenGebruik('');
    setExtraPricesRows([]);
    setExtraPricesSelectedIndex(0);
    setPurchaseVat('');
    setPurchasePriceExcl('0.00');
    setPurchasePriceIncl('0.00');
    setProfitPct('0.00');
    setPurchaseUnit('Piece');
    setUnitContent('0');
    setStock('0');
    setPurchaseSupplier('');
    setSupplierCode('');
    setStockNotification(true);
    setExpirationDate('');
    setDeclarationExpiryDays('0');
    setNotificationSoldOutPieces('');
    setProductInWebshop(false);
    setWebshopOnlineOrderable(true);
    setWebsiteRemark('');
    setWebsiteOrder('0');
    setShortWebText('');
    setWebsitePhotoFileName('');
    setKioskInfo('');
    setKioskTakeAway(true);
    setKioskEatIn('');
    setKioskSubtitle('');
    setKioskPicturePreview(null);
    setKioskMinSubs('unlimited');
    setKioskMaxSubs('unlimited');
    setShowProductModal(true);
  };

  const openEditProductModal = (product) => {
    setEditingProductId(product.id);
    setProductTab('general');
    setProductName(product.name || '');
    setProductKeyName(product.keyName ?? '');
    setProductProductionName(product.productionName ?? '');
    setProductPrice(String(product.price ?? ''));
    setProductVatTakeOut(product.vatTakeOut ?? '');
    let categoryIds = [product.categoryId || selectedCategoryId || ''];
    if (product.categoryIdsJson) {
      try {
        const parsed = JSON.parse(product.categoryIdsJson);
        if (Array.isArray(parsed) && parsed.length) categoryIds = parsed;
      } catch (_) { }
    }
    setProductCategoryIds(categoryIds);
    setProductAddition(product.addition ?? 'Subproducts');
    setProductBarcode(product.barcode ?? '');
    setProductPrinter1(product.printer1 || '');
    setProductPrinter2(product.printer2 || '');
    setProductPrinter3(product.printer3 || '');
    setProductActiveField('name');
    setProductFieldErrors({ name: false, keyName: false, productionName: false, vatTakeOut: false });
    setProductTabsUnlocked(true);
    setProductDisplayNumber(product.number != null ? product.number : null);

    setAdvancedOpenPrice(!!product.openPrice);
    setAdvancedWeegschaal(!!product.weegschaal);
    setAdvancedSubproductRequires(!!product.subproductRequires);
    setAdvancedLeeggoedPrijs(product.leeggoedPrijs ?? '0.00');
    setAdvancedPagerVerplicht(!!product.pagerVerplicht);
    setAdvancedBoldPrint(!!product.boldPrint);
    setAdvancedGroupingReceipt(product.groupingReceipt !== false);
    setAdvancedLabelExtraInfo(product.labelExtraInfo ?? '');
    setAdvancedVoorverpakVervaltype(product.voorverpakVervaltype ?? 'Shelf life');
    setAdvancedHoudbareDagen(product.houdbareDagen ?? '0');
    setAdvancedBewarenGebruik(product.bewarenGebruik ?? '');
    setAdvancedKassaPhotoPreview(product.kassaPhotoPath ?? null);

    let rows = [];
    if (product.extraPricesJson) {
      try {
        const parsed = JSON.parse(product.extraPricesJson);
        if (Array.isArray(parsed)) rows = parsed;
      } catch (_) { }
    }
    setExtraPricesRows(rows);
    setExtraPricesSelectedIndex(0);

    setPurchaseVat(product.purchaseVat ?? '');
    setPurchasePriceExcl(product.purchasePriceExcl ?? '0.00');
    setPurchasePriceIncl(product.purchasePriceIncl ?? '0.00');
    setProfitPct(product.profitPct ?? '0.00');
    setPurchaseUnit(product.unit ?? 'Piece');
    setUnitContent(product.unitContent ?? '0');
    setStock(product.stock ?? '0');
    setPurchaseSupplier(product.supplierId != null ? String(product.supplierId) : '');
    setSupplierCode(product.supplierCode ?? '');
    setStockNotification(product.stockNotification !== false);
    setExpirationDate(product.expirationDate ?? '');
    setDeclarationExpiryDays(product.declarationExpiryDays ?? '0');
    setNotificationSoldOutPieces(product.notificationSoldOutPieces ?? '');

    setProductInWebshop(!!product.inWebshop);
    setWebshopOnlineOrderable(product.onlineOrderable !== false);
    setWebsiteRemark(product.websiteRemark ?? '');
    setWebsiteOrder(product.websiteOrder ?? '0');
    setShortWebText(product.shortWebText ?? '');
    setWebsitePhotoFileName(product.websitePhotoPath ?? '');

    setKioskInfo(product.kioskInfo ?? '');
    setKioskTakeAway(product.kioskTakeAway !== false);
    setKioskEatIn(product.kioskEatIn ?? '');
    setKioskSubtitle(product.kioskSubtitle ?? '');
    setKioskMinSubs(product.kioskMinSubs ?? 'unlimited');
    setKioskMaxSubs(product.kioskMaxSubs ?? 'unlimited');
    setKioskPicturePreview(product.kioskPicturePath ?? null);

    setShowProductModal(true);
  };

  const closeProductModal = () => {
    setAdvancedKassaPhotoPreview(null);
    setKioskPicturePreview(null);
    setExtraPricesRows([]);
    setExtraPricesSelectedIndex(0);
    setProductCategoryIds(['']);
    setShowProductModal(false);
    setEditingProductId(null);
  };

  const validateProductRequired = () => {
    const name = !productName.trim();
    const keyName = !productKeyName.trim();
    const productionName = !productProductionName.trim();
    const vatTakeOut = !productVatTakeOut;
    setProductFieldErrors({ name, keyName, productionName, vatTakeOut });
    return !name && !keyName && !productionName && !vatTakeOut;
  };

  const buildProductPayload = () => {
    const categoryId = (productCategoryIds[0] || '') || selectedCategoryId;
    const payload = {
      name: productName.trim() || 'New product',
      price: parseFloat(productPrice) || 0,
      categoryId: categoryId || undefined,
      keyName: productKeyName.trim() || null,
      productionName: productProductionName.trim() || null,
      vatTakeOut: productVatTakeOut || null,
      barcode: productBarcode.trim() || null,
      printer1: productPrinter1 || null,
      printer2: productPrinter2 || null,
      printer3: productPrinter3 || null,
      addition: productAddition || null,
      categoryIdsJson: JSON.stringify(productCategoryIds.filter(Boolean)),
      openPrice: advancedOpenPrice,
      weegschaal: advancedWeegschaal,
      subproductRequires: advancedSubproductRequires,
      leeggoedPrijs: advancedLeeggoedPrijs || null,
      pagerVerplicht: advancedPagerVerplicht,
      boldPrint: advancedBoldPrint,
      groupingReceipt: advancedGroupingReceipt,
      labelExtraInfo: advancedLabelExtraInfo.trim() || null,
      kassaPhotoPath: advancedKassaPhotoPreview || null,
      voorverpakVervaltype: advancedVoorverpakVervaltype || null,
      houdbareDagen: advancedHoudbareDagen || null,
      bewarenGebruik: advancedBewarenGebruik.trim() || null,
      extraPricesJson: JSON.stringify(extraPricesRows.map((r) => ({ priceGroupId: r.priceGroupId, priceGroupLabel: r.priceGroupLabel, otherName: r.otherName || '', otherPrinter: r.otherPrinter || '', otherPrice: r.otherPrice || '' }))),
      purchaseVat: purchaseVat || null,
      purchasePriceExcl: purchasePriceExcl || null,
      purchasePriceIncl: purchasePriceIncl || null,
      profitPct: profitPct || null,
      unit: purchaseUnit || null,
      unitContent: unitContent || null,
      stock: stock || null,
      supplierId: purchaseSupplier.trim() || null,
      supplierCode: supplierCode.trim() || null,
      stockNotification: stockNotification,
      expirationDate: expirationDate || null,
      declarationExpiryDays: declarationExpiryDays || null,
      notificationSoldOutPieces: notificationSoldOutPieces || null,
      inWebshop: productInWebshop,
      onlineOrderable: webshopOnlineOrderable,
      websiteRemark: websiteRemark.trim() || null,
      websiteOrder: websiteOrder || null,
      shortWebText: shortWebText.trim() || null,
      websitePhotoPath: websitePhotoFileName || null,
      kioskInfo: kioskInfo.trim() || null,
      kioskTakeAway: kioskTakeAway,
      kioskEatIn: kioskEatIn.trim() || null,
      kioskSubtitle: kioskSubtitle.trim() || null,
      kioskMinSubs: kioskMinSubs || null,
      kioskMaxSubs: kioskMaxSubs || null,
      kioskPicturePath: kioskPicturePreview || null
    };
    return payload;
  };

  const handleSaveProduct = async () => {
    if (!validateProductRequired()) return;
    const categoryId = (productCategoryIds[0] || '') || selectedCategoryId;
    if (!categoryId) return;
    setSavingProduct(true);
    const payload = buildProductPayload();
    try {
      if (editingProductId) {
        const res = await fetch(`${API}/products/${editingProductId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const updated = await res.json();
        if (res.ok && updated) {
          setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          const refreshCats = productCategoryIds.filter(Boolean);
          if (refreshCats.length > 0) onMenuCatalogRefresh?.(refreshCats);
          else if (categoryId) onMenuCatalogRefresh?.([categoryId]);
          closeProductModal();
        } else fetchProducts(selectedCategoryId);
      } else {
        const res = await fetch(`${API}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, categoryId })
        });
        const created = await res.json();
        if (res.ok && created) {
          setProducts((prev) => [...prev, created].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
          const refreshCats = productCategoryIds.filter(Boolean);
          if (refreshCats.length > 0) onMenuCatalogRefresh?.(refreshCats);
          else if (categoryId) onMenuCatalogRefresh?.([categoryId]);
          closeProductModal();
        } else fetchProducts(selectedCategoryId);
      }
    } catch {
      fetchProducts(selectedCategoryId);
    } finally {
      setSavingProduct(false);
    }
  };

  const handleProductGeneralNameSynced = useCallback((v) => {
    // Name, Test name, and Production name stay aligned (on-screen + physical keyboard).
    setProductName(v);
    setProductKeyName(v);
    setProductProductionName(v);
    setProductFieldErrors((e) => ({ ...e, name: false, keyName: false, productionName: false }));
  }, []);

  const productKeyboardValue = productActiveField === 'name' ? productName : productActiveField === 'keyName' ? productKeyName : productActiveField === 'productionName' ? productProductionName : productActiveField === 'price' ? productPrice : productActiveField === 'barcode' ? productBarcode : productActiveField === 'leeggoedPrijs' ? advancedLeeggoedPrijs : productActiveField === 'labelExtraInfo' ? advancedLabelExtraInfo : productActiveField === 'houdbareDagen' ? advancedHoudbareDagen : productActiveField === 'bewarenGebruik' ? advancedBewarenGebruik : productActiveField === 'extraOtherName' ? (extraPricesRows[extraPricesSelectedIndex]?.otherName ?? '') : productActiveField === 'extraOtherPrice' ? (extraPricesRows[extraPricesSelectedIndex]?.otherPrice ?? '') : productActiveField === 'purchasePriceExcl' ? purchasePriceExcl : productActiveField === 'purchasePriceIncl' ? purchasePriceIncl : productActiveField === 'profitPct' ? profitPct : productActiveField === 'unitContent' ? unitContent : productActiveField === 'stock' ? stock : productActiveField === 'supplierCode' ? supplierCode : productActiveField === 'expirationDate' ? expirationDate : productActiveField === 'declarationExpiryDays' ? declarationExpiryDays : productActiveField === 'notificationSoldOutPieces' ? notificationSoldOutPieces : productActiveField === 'websiteRemark' ? websiteRemark : productActiveField === 'websiteOrder' ? websiteOrder : productActiveField === 'shortWebText' ? shortWebText : productActiveField === 'kioskInfo' ? kioskInfo : productActiveField === 'kioskEatIn' ? kioskEatIn : productActiveField === 'kioskSubtitle' ? kioskSubtitle : '';
  const productKeyboardOnChange = productActiveField === 'name'
    ? handleProductGeneralNameSynced
    : productActiveField === 'keyName'
      ? (v) => { setProductKeyName(v); setProductFieldErrors((e) => ({ ...e, keyName: false })); }
      : productActiveField === 'productionName'
        ? (v) => { setProductProductionName(v); setProductFieldErrors((e) => ({ ...e, productionName: false })); }
        : productActiveField === 'price'
          ? (isProductPriceLockedByProfit ? () => {} : setProductPrice)
          : productActiveField === 'barcode'
            ? setProductBarcode
            : productActiveField === 'leeggoedPrijs'
              ? setAdvancedLeeggoedPrijs
              : productActiveField === 'labelExtraInfo'
                ? setAdvancedLabelExtraInfo
                : productActiveField === 'houdbareDagen'
                  ? setAdvancedHoudbareDagen
                  : productActiveField === 'bewarenGebruik'
                    ? setAdvancedBewarenGebruik
                    : productActiveField === 'extraOtherName'
                      ? (v) => setExtraPricesRows((prev) => { const next = prev.map((r, i) => i === extraPricesSelectedIndex ? { ...r, otherName: v } : r); return next; })
                      : productActiveField === 'extraOtherPrice'
                        ? (v) => setExtraPricesRows((prev) => { const next = prev.map((r, i) => i === extraPricesSelectedIndex ? { ...r, otherPrice: v } : r); return next; })
                        : productActiveField === 'purchasePriceExcl'
                          ? handlePurchasePriceExclChange
                          : productActiveField === 'purchasePriceIncl'
                            ? setPurchasePriceIncl
                            : productActiveField === 'profitPct'
                              ? setProfitPct
                              : productActiveField === 'unitContent'
                                ? setUnitContent
                                : productActiveField === 'stock'
                                  ? setStock
                                  : productActiveField === 'supplierCode'
                                    ? setSupplierCode
                                    : productActiveField === 'expirationDate'
                                      ? setExpirationDate
                                      : productActiveField === 'declarationExpiryDays'
                                        ? setDeclarationExpiryDays
                                        : productActiveField === 'notificationSoldOutPieces'
                                          ? setNotificationSoldOutPieces
                                          : productActiveField === 'websiteRemark'
                                            ? setWebsiteRemark
                                            : productActiveField === 'websiteOrder'
                                              ? setWebsiteOrder
                                              : productActiveField === 'shortWebText'
                                                ? setShortWebText
                                                : productActiveField === 'kioskInfo'
                                                  ? setKioskInfo
                                                  : productActiveField === 'kioskEatIn'
                                                    ? setKioskEatIn
                                                    : productActiveField === 'kioskSubtitle'
                                                      ? setKioskSubtitle
                                                      : () => { };

  const handleGenerateBarcode = () => {
    const digits = Array.from({ length: 13 }, () => Math.floor(Math.random() * 10)).join('');
    setProductBarcode(digits);
    setBarcodeButtonSpinning(true);
    setTimeout(() => setBarcodeButtonSpinning(false), 600);
  };

  const handleDeleteProduct = async (id) => {
    try {
      const res = await fetch(`${API}/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== id));
        if (selectedProductId === id) setSelectedProductId(null);
        if (selectedCategoryId) onMenuCatalogRefresh?.([selectedCategoryId]);
      } else fetchProducts(selectedCategoryId);
    } catch {
      fetchProducts(selectedCategoryId);
    } finally {
      setDeleteConfirmProductId(null);
    }
  };

  const handleMoveProduct = async (direction) => {
    if (!selectedProductId) return;
    const idx = products.findIndex((p) => p.id === selectedProductId);
    if (idx < 0) return;
    const nextIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= products.length) return;
    const curr = products[idx];
    const other = products[nextIdx];
    const currOrder = curr.sortOrder ?? idx;
    const otherOrder = other.sortOrder ?? nextIdx;
    try {
      await fetch(`${API}/products/${curr.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: otherOrder })
      });
      await fetch(`${API}/products/${other.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: currOrder })
      });
      setProducts((prev) => {
        const list = [...prev];
        list[idx] = { ...list[idx], sortOrder: otherOrder };
        list[nextIdx] = { ...list[nextIdx], sortOrder: currOrder };
        return list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      });
    } catch {
      fetchProducts(selectedCategoryId);
    }
  };

  const filteredProducts = productSearch.trim()
    ? products.filter((p) => (p.name || '').toLowerCase().includes(productSearch.trim().toLowerCase()))
    : products;

  const filteredSubproducts = subproductSearch.trim()
    ? subproducts.filter((s) => (s.name || '').toLowerCase().includes(subproductSearch.trim().toLowerCase()))
    : subproducts;

  const handleSubproductNameChange = useCallback((value) => {
    setSubproductName(value);
    setSubproductKeyName(value);
    setSubproductProductionName(value);
  }, []);

  const subproductKeyboardValue = subproductActiveField === 'name'
    ? subproductName
    : subproductActiveField === 'keyName'
      ? subproductKeyName
      : subproductActiveField === 'productionName'
        ? subproductProductionName
        : subproductActiveField === 'price'
          ? subproductPrice
          : '';

  const subproductKeyboardOnChange = subproductActiveField === 'name'
    ? handleSubproductNameChange
    : subproductActiveField === 'keyName'
      ? setSubproductKeyName
      : subproductActiveField === 'productionName'
        ? setSubproductProductionName
        : subproductActiveField === 'price'
          ? setSubproductPrice
          : () => { };

  const openSubproductModal = () => {
    setEditingSubproductId(null);
    setSubproductName('');
    setSubproductKeyName('');
    setSubproductProductionName('');
    setSubproductActiveField('name');
    setSubproductPrice('');
    setSubproductVatTakeOut('');
    setSubproductModalGroupId(selectedSubproductGroupId || (subproductGroups[0]?.id ?? null));
    setSubproductKioskPicture('');
    setSubproductAttachToCategoryIds([]);
    setSubproductAddCategoryId('');
    setShowSubproductModal(true);
  };

  const openEditSubproductModal = (sp) => {
    setEditingSubproductId(sp.id);
    setSubproductName(sp.name || '');
    setSubproductActiveField('name');
    setSubproductModalGroupId(selectedSubproductGroupId);
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem('pos_subproduct_extra');
      const extra = raw ? JSON.parse(raw) : {};
      const e = extra[sp.id] || {};
      setSubproductKeyName((sp.keyName ?? e.keyName ?? '').toString());
      setSubproductProductionName(e.productionName || '');
      const dbPrice = sp.price;
      if (dbPrice != null && dbPrice !== '' && Number.isFinite(Number(dbPrice))) {
        setSubproductPrice(String(dbPrice));
      } else if (e.price != null && e.price !== '') {
        setSubproductPrice(String(e.price));
      } else {
        setSubproductPrice('');
      }
      setSubproductVatTakeOut((sp.vatTakeOut ?? e.vatTakeOut ?? '').toString());
      setSubproductKioskPicture(e.kioskPicture || '');
      setSubproductAttachToCategoryIds(Array.isArray(e.attachToCategoryIds) ? e.attachToCategoryIds : []);
    } catch {
      setSubproductKeyName('');
      setSubproductProductionName('');
      setSubproductPrice('');
      setSubproductVatTakeOut('');
      setSubproductKioskPicture('');
      setSubproductAttachToCategoryIds([]);
    }
    setShowSubproductModal(true);
  };

  const closeSubproductModal = () => {
    setShowSubproductModal(false);
    setEditingSubproductId(null);
    setSubproductName('');
    setSubproductKeyName('');
    setSubproductProductionName('');
    setSubproductActiveField('name');
    setSubproductPrice('');
    setSubproductAttachToCategoryIds([]);
    setSubproductAddCategoryId('');
  };

  const persistSubproductExtra = (id, data) => {
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem('pos_subproduct_extra');
      const extra = raw ? JSON.parse(raw) : {};
      extra[id] = data;
      if (typeof localStorage !== 'undefined') localStorage.setItem('pos_subproduct_extra', JSON.stringify(extra));
    } catch (_) { }
  };

  const handleSaveSubproduct = async () => {
    const groupId = subproductModalGroupId || selectedSubproductGroupId;
    if (!groupId && !editingSubproductId) return;
    setSavingSubproduct(true);
    const name = subproductName.trim() || 'New subproduct';
    const priceTrim = subproductPrice.trim().replace(/,/g, '.');
    const priceParsed = priceTrim === '' ? null : parseFloat(priceTrim);
    const priceForApi = priceTrim !== '' && Number.isFinite(priceParsed) ? Math.round(priceParsed * 100) / 100 : null;
    const extraData = {
      keyName: subproductKeyName.trim(),
      productionName: subproductProductionName.trim(),
      price: priceTrim === '' ? '' : String(priceForApi ?? ''),
      vatTakeOut: subproductVatTakeOut,
      kioskPicture: subproductKioskPicture.trim(),
      attachToCategoryIds: subproductAttachToCategoryIds
    };
    try {
      if (editingSubproductId) {
        const res = await fetch(`${API}/subproducts/${editingSubproductId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            price: priceForApi,
            keyName: subproductKeyName.trim() || null,
            vatTakeOut: subproductVatTakeOut || null
          })
        });
        const updated = await res.json();
        if (res.ok && updated) {
          setSubproducts((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
          persistSubproductExtra(editingSubproductId, extraData);
          onMenuCatalogRefresh?.();
          closeSubproductModal();
        } else fetchSubproducts(selectedSubproductGroupId);
      } else {
        const res = await fetch(`${API}/subproducts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            groupId,
            price: priceForApi,
            keyName: subproductKeyName.trim() || null,
            vatTakeOut: subproductVatTakeOut || null
          })
        });
        const created = await res.json();
        if (res.ok && created) {
          setSubproducts((prev) => [...prev, created].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
          persistSubproductExtra(created.id, extraData);
          onMenuCatalogRefresh?.();
          closeSubproductModal();
        } else fetchSubproducts(selectedSubproductGroupId);
      }
    } catch {
      fetchSubproducts(selectedSubproductGroupId);
    } finally {
      setSavingSubproduct(false);
    }
  };

  const handleDeleteSubproduct = async (id) => {
    try {
      const res = await fetch(`${API}/subproducts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSubproducts((prev) => prev.filter((s) => s.id !== id));
        if (selectedSubproductId === id) setSelectedSubproductId(null);
        onMenuCatalogRefresh?.();
      } else fetchSubproducts(selectedSubproductGroupId);
    } catch {
      fetchSubproducts(selectedSubproductGroupId);
    } finally {
      setDeleteConfirmSubproductId(null);
    }
  };

  const handleMoveSubproduct = async (direction) => {
    if (!selectedSubproductId) return;
    const idx = subproducts.findIndex((s) => s.id === selectedSubproductId);
    if (idx < 0) return;
    const nextIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= subproducts.length) return;
    const curr = subproducts[idx];
    const other = subproducts[nextIdx];
    const currOrder = curr.sortOrder ?? idx;
    const otherOrder = other.sortOrder ?? nextIdx;
    try {
      await fetch(`${API}/subproducts/${curr.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: otherOrder })
      });
      await fetch(`${API}/subproducts/${other.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: currOrder })
      });
      setSubproducts((prev) => {
        const list = [...prev];
        list[idx] = { ...list[idx], sortOrder: otherOrder };
        list[nextIdx] = { ...list[nextIdx], sortOrder: currOrder };
        return list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      });
    } catch {
      fetchSubproducts(selectedSubproductGroupId);
    }
  };

  const handleAddGroup = async () => {
    const name = newGroupName.trim() || 'New group';
    setSavingGroup(true);
    try {
      const res = await fetch(`${API}/subproduct-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const created = await res.json();
      if (res.ok && created) {
        setSubproductGroups((prev) => [...prev, created].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
        setNewGroupName('');
        setShowAddGroupInline(false);
      } else fetchSubproductGroups();
    } catch {
      fetchSubproductGroups();
    } finally {
      setSavingGroup(false);
    }
  };

  const handleSaveEditGroup = async () => {
    if (!editingGroupId) return;
    const name = editingGroupName.trim() || 'New group';
    setSavingGroup(true);
    try {
      const res = await fetch(`${API}/subproduct-groups/${editingGroupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const updated = await res.json();
      if (res.ok && updated) {
        setSubproductGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
        setEditingGroupId(null);
        setEditingGroupName('');
      } else fetchSubproductGroups();
    } catch {
      fetchSubproductGroups();
    } finally {
      setSavingGroup(false);
    }
  };

  const handleMoveGroup = async (groupId, direction) => {
    const sorted = [...subproductGroups].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const idx = sorted.findIndex((g) => g.id === groupId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const curr = sorted[idx];
    const other = sorted[swapIdx];
    const currOrder = curr.sortOrder ?? idx;
    const otherOrder = other.sortOrder ?? swapIdx;
    setSavingGroup(true);
    try {
      await fetch(`${API}/subproduct-groups/${curr.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sortOrder: otherOrder }) });
      await fetch(`${API}/subproduct-groups/${other.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sortOrder: currOrder }) });
      setSubproductGroups((prev) => prev.map((g) => (g.id === curr.id ? { ...g, sortOrder: otherOrder } : g.id === other.id ? { ...g, sortOrder: currOrder } : g)).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
    } catch {
      fetchSubproductGroups();
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (id) => {
    try {
      const res = await fetch(`${API}/subproduct-groups/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSubproductGroups((prev) => prev.filter((g) => g.id !== id));
        if (selectedSubproductGroupId === id) setSelectedSubproductGroupId(null);
      } else fetchSubproductGroups();
    } catch {
      fetchSubproductGroups();
    } finally {
      setDeleteConfirmGroupId(null);
    }
  };

  const posOptionLayoutRegisterKeyRef = useRef(DEFAULT_POS_REGISTER_NAME);

  const applyDeviceSettingsToState = (saved) => {
    if (!saved || typeof saved !== 'object') return;
    if (saved.useSubproducts != null) setDeviceUseSubproducts(!!saved.useSubproducts);
    if (saved.autoLogoutAfterTransaction != null) setDeviceAutoLogoutAfterTransaction(!!saved.autoLogoutAfterTransaction);
    if (saved.autoReturnToTablePlan != null) setDeviceAutoReturnToTablePlan(!!saved.autoReturnToTablePlan);
    if (saved.disableCashButtonInPayment != null) setDeviceDisableCashButtonInPayment(!!saved.disableCashButtonInPayment);
    if (saved.openPriceWithoutPopup != null) setDeviceOpenPriceWithoutPopup(!!saved.openPriceWithoutPopup);
    if (saved.turnOnStockWarning != null) setDeviceTurnOnStockWarning(!!saved.turnOnStockWarning);
    if (saved.openCashDrawerAfterOrder != null) setDeviceOpenCashDrawerAfterOrder(!!saved.openCashDrawerAfterOrder);
    if (saved.autoReturnToCounterSale != null) setDeviceAutoReturnToCounterSale(!!saved.autoReturnToCounterSale);
    if (saved.askSendToKitchen != null) setDeviceAskSendToKitchen(!!saved.askSendToKitchen);
    if (saved.counterSaleVat != null) setDeviceCounterSaleVat(saved.counterSaleVat);
    if (saved.tableSaleVat != null) setDeviceTableSaleVat(saved.tableSaleVat);
    if (saved.timeoutLogout != null) setDeviceTimeoutLogout(Number(saved.timeoutLogout) || 0);
    if (saved.fixedBorder != null) setDeviceFixedBorder(!!saved.fixedBorder);
    if (saved.alwaysOnTop != null) setDeviceAlwaysOnTop(!!saved.alwaysOnTop);
    if (saved.askInvoiceOrTicket != null) setDeviceAskInvoiceOrTicket(!!saved.askInvoiceOrTicket);
    if (saved.printerGroupingProducts != null) setDevicePrinterGroupingProducts(!!saved.printerGroupingProducts);
    if (saved.printerShowErrorScreen != null) setDevicePrinterShowErrorScreen(!!saved.printerShowErrorScreen);
    if (saved.printerProductionMessageOnVat != null) setDevicePrinterProductionMessageOnVat(!!saved.printerProductionMessageOnVat);
    if (saved.printerNextCourseOrder != null) setDevicePrinterNextCourseOrder(saved.printerNextCourseOrder);
    if (saved.printerStandardMode != null) setDevicePrinterStandardMode(saved.printerStandardMode);
    if (saved.printerQROrderPrinter != null) setDevicePrinterQROrderPrinter(saved.printerQROrderPrinter || '');
    if (saved.printerReprintWithNextCourse != null) setDevicePrinterReprintWithNextCourse(!!saved.printerReprintWithNextCourse);
    if (saved.printerPrintZeroTickets != null) setDevicePrinterPrintZeroTickets(!!saved.printerPrintZeroTickets);
    if (saved.printerGiftVoucherAtMin != null) setDevicePrinterGiftVoucherAtMin(!!saved.printerGiftVoucherAtMin);
    if (Array.isArray(saved.categoryDisplayIds)) setDeviceCategoryDisplayIds(saved.categoryDisplayIds);
    if (saved.ordersConfirmOnHold != null) setDeviceOrdersConfirmOnHold(!!saved.ordersConfirmOnHold);
    if (saved.ordersPrintBarcodeAfterCreate != null) setDeviceOrdersPrintBarcodeAfterCreate(!!saved.ordersPrintBarcodeAfterCreate);
    if (saved.ordersCustomerCanBeModified != null) setDeviceOrdersCustomerCanBeModified(!!saved.ordersCustomerCanBeModified);
    if (saved.ordersBookTableToWaiting != null) setDeviceOrdersBookTableToWaiting(!!saved.ordersBookTableToWaiting);
    if (saved.ordersFastCustomerName != null) setDeviceOrdersFastCustomerName(!!saved.ordersFastCustomerName);
    if (saved.scheduledPrinter != null) setDeviceScheduledPrinter(saved.scheduledPrinter || '');
    if (saved.scheduledProductionFlow != null) setDeviceScheduledProductionFlow(saved.scheduledProductionFlow);
    if (saved.scheduledLoading != null) setDeviceScheduledLoading(saved.scheduledLoading);
    if (saved.scheduledMode != null) setDeviceScheduledMode(saved.scheduledMode);
    if (saved.scheduledInvoiceLayout != null) setDeviceScheduledInvoiceLayout(saved.scheduledInvoiceLayout);
    if (saved.scheduledCheckoutAt != null) setDeviceScheduledCheckoutAt(saved.scheduledCheckoutAt);
    if (saved.scheduledPrintBarcodeLabel != null) setDeviceScheduledPrintBarcodeLabel(!!saved.scheduledPrintBarcodeLabel);
    if (saved.scheduledDeliveryNoteToTurnover != null) setDeviceScheduledDeliveryNoteToTurnover(!!saved.scheduledDeliveryNoteToTurnover);
    if (saved.scheduledPrintProductionReceipt != null) setDeviceScheduledPrintProductionReceipt(!!saved.scheduledPrintProductionReceipt);
    if (saved.scheduledPrintCustomerProductionReceipt != null) setDeviceScheduledPrintCustomerProductionReceipt(!!saved.scheduledPrintCustomerProductionReceipt);
    if (saved.scheduledWebOrderAutoPrint != null) setDeviceScheduledWebOrderAutoPrint(!!saved.scheduledWebOrderAutoPrint);
    const rawOptLayout =
      pickOptionButtonLayoutFromDeviceSettings(saved, posOptionLayoutRegisterKeyRef.current) ?? saved.optionButtonLayout;
    if (rawOptLayout != null) setOptionButtonSlots(normalizeOptionButtonSlots(rawOptLayout));
  };

  const applyDeviceSettingsRef = useRef(applyDeviceSettingsToState);
  applyDeviceSettingsRef.current = applyDeviceSettingsToState;
  const deviceSettingsHasLocalEditsRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const k = await fetchPosOptionLayoutRegisterKey();
        if (!cancelled) posOptionLayoutRegisterKeyRef.current = k;
      } catch {
        /* ignore */
      }
    };
    void tick();
    const id = window.setInterval(tick, OPTION_LAYOUT_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!showDeviceSettingsModal) return;
    deviceSettingsHasLocalEditsRef.current = false;
    fetchCategories();
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem('pos_device_settings');
      const saved = raw ? JSON.parse(raw) : {};
      applyDeviceSettingsToState(saved);
    } catch (_) { }
    let cancelled = false;
    (async () => {
      try {
        const [deviceRes, layoutRes] = await Promise.all([
          fetch(`${API}/settings/device-settings`),
          fetch(`${API}/settings/function-buttons-layout`)
        ]);
        if (cancelled) return;
        if (deviceRes.ok) {
          const deviceData = await deviceRes.json().catch(() => ({}));
          const saved = deviceData?.value;
          if (saved && typeof saved === 'object') {
            applyDeviceSettingsToState(saved);
            if (typeof localStorage !== 'undefined') localStorage.setItem('pos_device_settings', JSON.stringify(saved));
          }
        }
        if (layoutRes.ok) {
          const layoutData = await layoutRes.json().catch(() => ({}));
          setFunctionButtonSlots(normalizeFunctionButtonsLayout(layoutData?.value));
        } else if (!cancelled) {
          setFunctionButtonSlots(normalizeFunctionButtonsLayout([]));
        }
      } catch {
        if (!cancelled) setFunctionButtonSlots(normalizeFunctionButtonsLayout([]));
      }
    })();
    return () => { cancelled = true; };
  }, [showDeviceSettingsModal, fetchCategories]);

  /**
   * Keep device settings in sync with the server (webpanel / other tabs).
   * CustomEvent does not cross tabs, so we poll; faster while the modal is open.
   * When the user returns to this tab, pull once so webpanel edits show immediately.
   */
  useEffect(() => {
    const pull = async () => {
      if (showDeviceSettingsModal && deviceSettingsHasLocalEditsRef.current) return;
      try {
        const res = await fetch(`${API}/settings/device-settings`);
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        const saved = data?.value;
        if (saved && typeof saved === 'object') {
          applyDeviceSettingsRef.current(saved);
          if (typeof localStorage !== 'undefined') localStorage.setItem('pos_device_settings', JSON.stringify(saved));
        }
      } catch (_) { /* ignore */ }
    };
    const onPush = () => {
      void pull();
    };
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') void pull();
    };
    void pull();
    window.addEventListener(POS_DEVICE_SETTINGS_CHANGED_EVENT, onPush);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    const pollMs = showDeviceSettingsModal ? DEVICE_SETTINGS_MODAL_POLL_MS : OPTION_LAYOUT_POLL_MS;
    const id = window.setInterval(() => {
      void pull();
    }, pollMs);
    return () => {
      window.removeEventListener(POS_DEVICE_SETTINGS_CHANGED_EVENT, onPush);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
      window.clearInterval(id);
    };
  }, [showDeviceSettingsModal]);

  const handleSaveDeviceSettings = async () => {
    setSavingDeviceSettings(true);
    try {
      const payload = {
        useSubproducts: deviceUseSubproducts,
        autoLogoutAfterTransaction: deviceAutoLogoutAfterTransaction,
        autoReturnToTablePlan: deviceAutoReturnToTablePlan,
        disableCashButtonInPayment: deviceDisableCashButtonInPayment,
        openPriceWithoutPopup: deviceOpenPriceWithoutPopup,
        turnOnStockWarning: deviceTurnOnStockWarning,
        openCashDrawerAfterOrder: deviceOpenCashDrawerAfterOrder,
        autoReturnToCounterSale: deviceAutoReturnToCounterSale,
        askSendToKitchen: deviceAskSendToKitchen,
        counterSaleVat: deviceCounterSaleVat,
        tableSaleVat: deviceTableSaleVat,
        timeoutLogout: deviceTimeoutLogout,
        fixedBorder: deviceFixedBorder,
        alwaysOnTop: deviceAlwaysOnTop,
        askInvoiceOrTicket: deviceAskInvoiceOrTicket,
        printerGroupingProducts: devicePrinterGroupingProducts,
        printerShowErrorScreen: devicePrinterShowErrorScreen,
        printerProductionMessageOnVat: devicePrinterProductionMessageOnVat,
        printerNextCourseOrder: devicePrinterNextCourseOrder,
        printerStandardMode: devicePrinterStandardMode,
        printerQROrderPrinter: devicePrinterQROrderPrinter,
        printerReprintWithNextCourse: devicePrinterReprintWithNextCourse,
        printerPrintZeroTickets: devicePrinterPrintZeroTickets,
        printerGiftVoucherAtMin: devicePrinterGiftVoucherAtMin,
        categoryDisplayIds: deviceCategoryDisplayIds,
        ordersConfirmOnHold: deviceOrdersConfirmOnHold,
        ordersPrintBarcodeAfterCreate: deviceOrdersPrintBarcodeAfterCreate,
        ordersCustomerCanBeModified: deviceOrdersCustomerCanBeModified,
        ordersBookTableToWaiting: deviceOrdersBookTableToWaiting,
        ordersFastCustomerName: deviceOrdersFastCustomerName,
        scheduledPrinter: deviceScheduledPrinter,
        scheduledProductionFlow: deviceScheduledProductionFlow,
        scheduledLoading: deviceScheduledLoading,
        scheduledMode: deviceScheduledMode,
        scheduledInvoiceLayout: deviceScheduledInvoiceLayout,
        scheduledCheckoutAt: deviceScheduledCheckoutAt,
        scheduledPrintBarcodeLabel: deviceScheduledPrintBarcodeLabel,
        scheduledDeliveryNoteToTurnover: deviceScheduledDeliveryNoteToTurnover,
        scheduledPrintProductionReceipt: deviceScheduledPrintProductionReceipt,
        scheduledPrintCustomerProductionReceipt: deviceScheduledPrintCustomerProductionReceipt,
        scheduledWebOrderAutoPrint: deviceScheduledWebOrderAutoPrint,
        optionButtonLayout: optionButtonSlots
      };
      let serverValue = {};
      try {
        const prevRes = await fetch(`${API}/settings/device-settings`);
        if (prevRes.ok) {
          const prevJson = await prevRes.json().catch(() => ({}));
          if (prevJson?.value && typeof prevJson.value === 'object') serverValue = prevJson.value;
        }
      } catch (_) { /* use empty merge */ }
      const merged = { ...serverValue, ...payload };
      const normSlots = normalizeOptionButtonSlots(optionButtonSlots);
      const regKey = await fetchPosOptionLayoutRegisterKey();
      posOptionLayoutRegisterKeyRef.current = regKey;
      merged.optionButtonLayout = normSlots;
      const prevByReg = merged.optionButtonLayoutByRegister;
      merged.optionButtonLayoutByRegister = {
        ...(prevByReg && typeof prevByReg === 'object' && !Array.isArray(prevByReg) ? prevByReg : {}),
        [regKey]: normSlots,
      };
      const deviceRes = await fetch(`${API}/settings/device-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: merged })
      });
      if (!deviceRes.ok) {
        const errData = await deviceRes.json().catch(() => ({}));
        throw new Error(errData?.error || 'Failed to save device settings');
      }
      if (typeof localStorage !== 'undefined') localStorage.setItem('pos_device_settings', JSON.stringify(merged));
      deviceSettingsHasLocalEditsRef.current = false;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(POS_DEVICE_SETTINGS_CHANGED_EVENT));
      }
      const layoutRes = await fetch(`${API}/settings/function-buttons-layout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: functionButtonSlots })
      });
      const layoutData = await layoutRes.json().catch(() => ({}));
      if (!layoutRes.ok) {
        throw new Error(layoutData?.error || 'Failed to save function buttons layout');
      }
      setFunctionButtonSlots(normalizeFunctionButtonsLayout(layoutData?.value));
      setSelectedFunctionButtonSlotIndex(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(POS_FUNCTION_BUTTONS_LAYOUT_CHANGED_EVENT));
      }
      setShowDeviceSettingsModal(false);
      if (typeof onFunctionButtonsSaved === 'function') onFunctionButtonsSaved();
      showToast('success', 'Device settings saved.');
    } catch (err) {
      showToast('error', err?.message || 'Failed to save device settings.');
    } finally {
      setSavingDeviceSettings(false);
    }
  };

  const handleFunctionButtonDragStart = (event, itemId) => {
    if (!itemId) return;
    event.dataTransfer.setData('text/plain', itemId);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleFunctionButtonDropOnSlot = (event, slotIndex) => {
    event.preventDefault();
    if (slotIndex < 0 || slotIndex >= FUNCTION_BUTTON_SLOT_COUNT) return;
    const droppedId = String(event.dataTransfer.getData('text/plain') || '').trim();
    if (!FUNCTION_BUTTON_ITEM_IDS.includes(droppedId)) return;
    setFunctionButtonSlots((prev) => {
      const next = [...prev];
      const existingIndex = next.findIndex((id) => id === droppedId);
      if (existingIndex >= 0) next[existingIndex] = '';
      next[slotIndex] = droppedId;
      return normalizeFunctionButtonsLayout(next);
    });
    setSelectedFunctionButtonSlotIndex(slotIndex);
  };

  const handleRemoveFunctionButtonFromSlot = () => {
    if (!Number.isInteger(selectedFunctionButtonSlotIndex)) return;
    setFunctionButtonSlots((prev) => {
      const next = [...prev];
      if (!next[selectedFunctionButtonSlotIndex]) return prev;
      next[selectedFunctionButtonSlotIndex] = '';
      return normalizeFunctionButtonsLayout(next);
    });
    setSelectedFunctionButtonPoolItemId(null);
  };

  const hasSelectedFunctionButton = Number.isInteger(selectedFunctionButtonSlotIndex)
    && !!functionButtonSlots[selectedFunctionButtonSlotIndex];
  const assignedFunctionButtonIds = new Set(functionButtonSlots.filter(Boolean));
  const assignedOptionButtonIds = new Set(optionButtonSlots.filter(Boolean));
  const unassignedOptionButtons = OPTION_BUTTON_ITEMS.filter((item) => !assignedOptionButtonIds.has(item.id));

  const handleOptionButtonDragStart = (event, itemId) => {
    if (!itemId) return;
    event.dataTransfer.setData('text/plain', itemId);
    event.dataTransfer.effectAllowed = 'move';
  };
  const handleOptionButtonDragStartFromSlot = (event, slotIndex) => {
    const itemId = String(optionButtonSlots[slotIndex] || '').trim();
    if (!itemId || itemId === OPTION_BUTTON_LOCKED_ID) return;
    event.dataTransfer.setData('text/plain', itemId);
    event.dataTransfer.effectAllowed = 'move';
    setSelectedOptionButtonSlotIndex(slotIndex);
  };

  const handleOptionButtonDropOnSlot = (event, slotIndex) => {
    event.preventDefault();
    if (slotIndex < 0 || slotIndex >= OPTION_BUTTON_SLOT_COUNT) return;
    const droppedId = String(event.dataTransfer.getData('text/plain') || '').trim();
    if (!OPTION_BUTTON_ITEM_IDS.includes(droppedId)) return;
    setOptionButtonSlots((prev) => {
      const next = [...prev];
      if (next[slotIndex] === OPTION_BUTTON_LOCKED_ID && droppedId !== OPTION_BUTTON_LOCKED_ID) {
        return prev;
      }
      const existingIndex = next.findIndex((id) => id === droppedId);
      if (existingIndex >= 0) next[existingIndex] = '';
      next[slotIndex] = droppedId;
      return next;
    });
    setSelectedOptionButtonSlotIndex(slotIndex);
  };

  const handleRemoveOptionButtonFromSlot = () => {
    if (!Number.isInteger(selectedOptionButtonSlotIndex)) return;
    setOptionButtonSlots((prev) => {
      const next = [...prev];
      if (!next[selectedOptionButtonSlotIndex]) return prev;
      if (next[selectedOptionButtonSlotIndex] === OPTION_BUTTON_LOCKED_ID) return prev;
      next[selectedOptionButtonSlotIndex] = '';
      return next;
    });
    setSelectedOptionButtonPoolItemId(null);
  };

  const handleOptionButtonSlotClick = (slotIndex) => {
    const assignedId = optionButtonSlots[slotIndex];
    const hasPoolSelection = selectedOptionButtonPoolItemId && OPTION_BUTTON_ITEM_IDS.includes(selectedOptionButtonPoolItemId);
    const hasGridSelection = Number.isInteger(selectedOptionButtonSlotIndex) && optionButtonSlots[selectedOptionButtonSlotIndex];

    if (hasPoolSelection && !assignedId) {
      setOptionButtonSlots((prev) => {
        const next = [...prev];
        next[slotIndex] = selectedOptionButtonPoolItemId;
        return next;
      });
      setSelectedOptionButtonPoolItemId(null);
      setSelectedOptionButtonSlotIndex(null);
      return;
    }
    if (hasGridSelection && selectedOptionButtonSlotIndex !== slotIndex && optionButtonSlots[selectedOptionButtonSlotIndex] !== OPTION_BUTTON_LOCKED_ID) {
      const sourceId = optionButtonSlots[selectedOptionButtonSlotIndex];
      if (optionButtonSlots[slotIndex] === OPTION_BUTTON_LOCKED_ID && sourceId !== OPTION_BUTTON_LOCKED_ID) return;
      setOptionButtonSlots((prev) => {
        const next = [...prev];
        const targetId = next[slotIndex];
        next[selectedOptionButtonSlotIndex] = targetId || '';
        next[slotIndex] = sourceId;
        return next;
      });
      setSelectedOptionButtonSlotIndex(null);
      setSelectedOptionButtonPoolItemId(null);
      return;
    }
    if (assignedId) {
      setSelectedOptionButtonSlotIndex(slotIndex);
      setSelectedOptionButtonPoolItemId(null);
    }
  };

  const handleFunctionButtonSlotClick = (slotIndex) => {
    const assignedId = functionButtonSlots[slotIndex];
    const hasPoolSelection = selectedFunctionButtonPoolItemId && FUNCTION_BUTTON_ITEM_IDS.includes(selectedFunctionButtonPoolItemId);
    const hasGridSelection = Number.isInteger(selectedFunctionButtonSlotIndex) && functionButtonSlots[selectedFunctionButtonSlotIndex];

    if (hasPoolSelection && !assignedId) {
      setFunctionButtonSlots((prev) => {
        const next = [...prev];
        next[slotIndex] = selectedFunctionButtonPoolItemId;
        return normalizeFunctionButtonsLayout(next);
      });
      setSelectedFunctionButtonPoolItemId(null);
      setSelectedFunctionButtonSlotIndex(null);
      return;
    }
    if (hasGridSelection && selectedFunctionButtonSlotIndex !== slotIndex) {
      const sourceId = functionButtonSlots[selectedFunctionButtonSlotIndex];
      setFunctionButtonSlots((prev) => {
        const next = [...prev];
        const targetId = next[slotIndex];
        next[selectedFunctionButtonSlotIndex] = targetId || '';
        next[slotIndex] = sourceId;
        return normalizeFunctionButtonsLayout(next);
      });
      setSelectedFunctionButtonSlotIndex(null);
      setSelectedFunctionButtonPoolItemId(null);
      return;
    }
    if (assignedId) {
      setSelectedFunctionButtonSlotIndex(slotIndex);
      setSelectedFunctionButtonPoolItemId(null);
    }
  };

  const hasSelectedOptionButton = Number.isInteger(selectedOptionButtonSlotIndex)
    && !!optionButtonSlots[selectedOptionButtonSlotIndex];
  const hasSelectedRemovableOptionButton = Number.isInteger(selectedOptionButtonSlotIndex)
    && !!optionButtonSlots[selectedOptionButtonSlotIndex]
    && optionButtonSlots[selectedOptionButtonSlotIndex] !== OPTION_BUTTON_LOCKED_ID;

  const applySystemSettingsFromSaved = useCallback((saved) => {
    if (!saved || typeof saved !== 'object') return;
    if (saved.useStockManagement != null) setSysUseStockManagement(!!saved.useStockManagement);
    if (saved.usePriceGroups != null) setSysUsePriceGroups(!!saved.usePriceGroups);
    if (saved.loginWithoutCode != null) setSysLoginWithoutCode(!!saved.loginWithoutCode);
    if (saved.categorieenPerKassa != null) setSysCategorieenPerKassa(!!saved.categorieenPerKassa);
    if (saved.autoAcceptQROrders != null) setSysAutoAcceptQROrders(!!saved.autoAcceptQROrders);
    if (saved.qrOrdersAutomatischAfrekenen != null) setSysQrOrdersAutomatischAfrekenen(!!saved.qrOrdersAutomatischAfrekenen);
    if (saved.enkelQROrdersKeukenscherm != null) setSysEnkelQROrdersKeukenscherm(!!saved.enkelQROrdersKeukenscherm);
    if (saved.aspect169Windows != null) setSysAspect169Windows(!!saved.aspect169Windows);
    if (saved.vatRateVariousProducts != null) setSysVatRateVariousProducts(saved.vatRateVariousProducts);
    if (saved.arrangeProductsManually != null) setSysArrangeProductsManually(!!saved.arrangeProductsManually);
    if (saved.limitOneUserPerTable != null) setSysLimitOneUserPerTable(!!saved.limitOneUserPerTable);
    if (saved.oneWachtorderPerKlant != null) setSysOneWachtorderPerKlant(!!saved.oneWachtorderPerKlant);
    if (saved.cashButtonVisibleMultiplePayment != null) setSysCashButtonVisibleMultiplePayment(!!saved.cashButtonVisibleMultiplePayment);
    if (saved.usePlaceSettings != null) setSysUsePlaceSettings(!!saved.usePlaceSettings);
    if (saved.tegoedAutomatischInladen != null) setSysTegoedAutomatischInladen(!!saved.tegoedAutomatischInladen);
    if (saved.nieuwstePrijsGebruiken != null) setSysNieuwstePrijsGebruiken(!!saved.nieuwstePrijsGebruiken);
    if (saved.leeggoedTerugname != null) setSysLeeggoedTerugname(saved.leeggoedTerugname);
    if (saved.klantgegevensQRAfdrukken != null) setSysKlantgegevensQRAfdrukken(!!saved.klantgegevensQRAfdrukken);
    if (saved.priceTakeAway != null) setSysPriceTakeAway(saved.priceTakeAway || '');
    if (saved.priceDelivery != null) setSysPriceDelivery(saved.priceDelivery || '');
    if (saved.priceCounterSale != null) setSysPriceCounterSale(saved.priceCounterSale || '');
    if (saved.priceTableSale != null) setSysPriceTableSale(saved.priceTableSale || '');
    if (saved.savingsPointsPerEuro != null) setSysSavingsPointsPerEuro(Number(saved.savingsPointsPerEuro) || 0);
    if (saved.savingsPointsPerDiscount != null) setSysSavingsPointsPerDiscount(Number(saved.savingsPointsPerDiscount) || 0);
    if (saved.savingsDiscount != null) setSysSavingsDiscount(saved.savingsDiscount || '');
    if (saved.ticketVoucherValidity != null) setSysTicketVoucherValidity(saved.ticketVoucherValidity);
    if (saved.ticketScheduledPrintMode != null) setSysTicketScheduledPrintMode(saved.ticketScheduledPrintMode);
    if (saved.ticketScheduledCustomerSort != null) setSysTicketScheduledCustomerSort(saved.ticketScheduledCustomerSort);
    if (saved.barcodeType != null) setSysBarcodeType(saved.barcodeType);
  }, []);

  const applySystemSettingsRef = useRef(applySystemSettingsFromSaved);
  applySystemSettingsRef.current = applySystemSettingsFromSaved;
  const systemSettingsHasLocalEditsRef = useRef(false);

  useEffect(() => {
    if (!showSystemSettingsModal) return;
    systemSettingsHasLocalEditsRef.current = false;
    fetchPriceGroups();
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem('pos_system_settings');
      const saved = raw ? JSON.parse(raw) : {};
      applySystemSettingsRef.current(saved);
    } catch (_) { }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/settings/system-settings`);
        if (cancelled || !res.ok) return;
        const data = await res.json().catch(() => ({}));
        const saved = data?.value;
        if (saved && typeof saved === 'object') {
          applySystemSettingsRef.current(saved);
          if (typeof localStorage !== 'undefined') localStorage.setItem('pos_system_settings', JSON.stringify(saved));
        }
      } catch (_) { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [showSystemSettingsModal, fetchPriceGroups]);

  /**
   * Keep system settings in sync with the server (webpanel / other tabs).
   * CustomEvent does not cross tabs, so we poll; faster while the modal is open.
   * When the user returns to this tab, pull once so webpanel edits show immediately.
   */
  useEffect(() => {
    const pull = async () => {
      if (showSystemSettingsModal && systemSettingsHasLocalEditsRef.current) return;
      try {
        const res = await fetch(`${API}/settings/system-settings`);
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        const saved = data?.value;
        if (saved && typeof saved === 'object') {
          applySystemSettingsRef.current(saved);
          if (typeof localStorage !== 'undefined') localStorage.setItem('pos_system_settings', JSON.stringify(saved));
        }
      } catch (_) { /* ignore */ }
    };
    const onPush = () => {
      void pull();
    };
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') void pull();
    };
    void pull();
    window.addEventListener(POS_SYSTEM_SETTINGS_CHANGED_EVENT, onPush);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    const pollMs = showSystemSettingsModal ? SYSTEM_SETTINGS_MODAL_POLL_MS : OPTION_LAYOUT_POLL_MS;
    const id = window.setInterval(() => {
      void pull();
    }, pollMs);
    return () => {
      window.removeEventListener(POS_SYSTEM_SETTINGS_CHANGED_EVENT, onPush);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
      window.clearInterval(id);
    };
  }, [showSystemSettingsModal]);

  const handleSaveSystemSettings = async () => {
    setSavingSystemSettings(true);
    try {
      const payload = {
        useStockManagement: sysUseStockManagement,
        usePriceGroups: sysUsePriceGroups,
        loginWithoutCode: sysLoginWithoutCode,
        categorieenPerKassa: sysCategorieenPerKassa,
        autoAcceptQROrders: sysAutoAcceptQROrders,
        qrOrdersAutomatischAfrekenen: sysQrOrdersAutomatischAfrekenen,
        enkelQROrdersKeukenscherm: sysEnkelQROrdersKeukenscherm,
        aspect169Windows: sysAspect169Windows,
        vatRateVariousProducts: sysVatRateVariousProducts,
        arrangeProductsManually: sysArrangeProductsManually,
        limitOneUserPerTable: sysLimitOneUserPerTable,
        oneWachtorderPerKlant: sysOneWachtorderPerKlant,
        cashButtonVisibleMultiplePayment: sysCashButtonVisibleMultiplePayment,
        usePlaceSettings: sysUsePlaceSettings,
        tegoedAutomatischInladen: sysTegoedAutomatischInladen,
        nieuwstePrijsGebruiken: sysNieuwstePrijsGebruiken,
        leeggoedTerugname: sysLeeggoedTerugname,
        klantgegevensQRAfdrukken: sysKlantgegevensQRAfdrukken,
        priceTakeAway: sysPriceTakeAway,
        priceDelivery: sysPriceDelivery,
        priceCounterSale: sysPriceCounterSale,
        priceTableSale: sysPriceTableSale,
        savingsPointsPerEuro: sysSavingsPointsPerEuro,
        savingsPointsPerDiscount: sysSavingsPointsPerDiscount,
        savingsDiscount: sysSavingsDiscount,
        ticketVoucherValidity: sysTicketVoucherValidity,
        ticketScheduledPrintMode: sysTicketScheduledPrintMode,
        ticketScheduledCustomerSort: sysTicketScheduledCustomerSort,
        barcodeType: sysBarcodeType
      };
      let serverValue = {};
      try {
        const prevRes = await fetch(`${API}/settings/system-settings`);
        if (prevRes.ok) {
          const prevJson = await prevRes.json().catch(() => ({}));
          if (prevJson?.value && typeof prevJson.value === 'object') serverValue = prevJson.value;
        }
      } catch (_) { /* ignore */ }
      const merged = { ...serverValue, ...payload };
      const saveRes = await fetch(`${API}/settings/system-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: merged }),
      });
      if (!saveRes.ok) {
        const errData = await saveRes.json().catch(() => ({}));
        throw new Error(errData?.error || 'Failed to save system settings');
      }
      if (typeof localStorage !== 'undefined') localStorage.setItem('pos_system_settings', JSON.stringify(merged));
      systemSettingsHasLocalEditsRef.current = false;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(POS_SYSTEM_SETTINGS_CHANGED_EVENT));
      }
      setShowSystemSettingsModal(false);
      showToast('success', 'System settings saved.');
    } catch (err) {
      showToast('error', err?.message || 'Failed to save system settings.');
    } finally {
      setSavingSystemSettings(false);
    }
  };

  const openNewPaymentTypeModal = () => {
    setEditingPaymentTypeId(null);
    setPaymentTypeName('');
    setPaymentTypeActive(true);
    setPaymentTypeIntegration('generic');
    setShowPaymentTypeModal(true);
  };

  const openEditPaymentTypeModal = (pt) => {
    setEditingPaymentTypeId(pt.id);
    setPaymentTypeName(pt.name || '');
    setPaymentTypeActive(pt.active !== false);
    setPaymentTypeIntegration(pt.integration || 'generic');
    setShowPaymentTypeModal(true);
  };

  const closePaymentTypeModal = () => {
    setShowPaymentTypeModal(false);
    setEditingPaymentTypeId(null);
    setPaymentTypeName('');
    setPaymentTypeActive(true);
    setPaymentTypeIntegration('generic');
  };

  const handleSavePaymentType = async () => {
    const name = (paymentTypeName || '').trim();
    if (!name) return;
    setSavingPaymentType(true);
    try {
      const body = { name, active: paymentTypeActive, integration: paymentTypeIntegration };
      if (editingPaymentTypeId) {
        const res = await fetch(`${API}/payment-methods/${editingPaymentTypeId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Failed to save payment method');
      } else {
        const res = await fetch(`${API}/payment-methods`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Failed to create payment method');
      }
      await fetchPaymentTypes();
      closePaymentTypeModal();
    } catch (e) {
      showToast('error', e?.message || 'Save failed');
    } finally {
      setSavingPaymentType(false);
    }
  };

  const togglePaymentTypeActive = async (id) => {
    const pt = paymentTypes.find((p) => p.id === id);
    if (!pt) return;
    try {
      const res = await fetch(`${API}/payment-methods/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !pt.active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to update');
      await fetchPaymentTypes();
    } catch (e) {
      showToast('error', e?.message || 'Update failed');
    }
  };

  const handleDeletePaymentType = async (id) => {
    try {
      const res = await fetch(`${API}/payment-methods/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to delete');
      }
      await fetchPaymentTypes();
      if (editingPaymentTypeId === id) {
        setShowPaymentTypeModal(false);
        setEditingPaymentTypeId(null);
      }
      showToast('success', tr('control.paymentTypes.deleted', 'Payment method deleted.'));
    } catch (e) {
      showToast('error', e?.message || 'Delete failed');
    } finally {
      setDeleteConfirmPaymentTypeId(null);
    }
  };

  const movePaymentType = async (id, direction) => {
    const sorted = [...paymentTypes].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const idx = sorted.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const swap = direction === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= sorted.length) return;
    [sorted[idx], sorted[swap]] = [sorted[swap], sorted[idx]];
    const orderedIds = sorted.map((p) => p.id);
    try {
      const res = await fetch(`${API}/payment-methods/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to reorder');
      await fetchPaymentTypes();
    } catch (e) {
      showToast('error', e?.message || 'Reorder failed');
    }
  };

  const applyProductionMessagesFromSaved = useCallback((arr) => {
    const list = Array.isArray(arr) ? arr : [];
    const normalized = list
      .filter((m) => m && typeof m === 'object')
      .map((m, i) => ({
        id: String(m.id != null && String(m.id).trim() !== '' ? m.id : `pm-${i}`),
        text: String(m.text != null ? m.text : ''),
        sortOrder: typeof m.sortOrder === 'number' && Number.isFinite(m.sortOrder) ? m.sortOrder : i,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m, i) => ({ ...m, sortOrder: i }));
    setProductionMessages(normalized);
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem('pos_production_messages', JSON.stringify(normalized));
    } catch (_) { /* ignore */ }
  }, []);

  const applyProductionMessagesRef = useRef(applyProductionMessagesFromSaved);
  applyProductionMessagesRef.current = applyProductionMessagesFromSaved;

  const persistProductionMessages = (next) => {
    const raw = Array.isArray(next) ? next : [];
    const sorted = [...raw].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const withOrder = sorted.map((m, i) => ({
      id: String(m.id != null && String(m.id).trim() !== '' ? m.id : `pm-${Date.now()}-${i}`),
      text: String(m.text != null ? m.text : ''),
      sortOrder: i,
    }));
    setProductionMessages(withOrder);
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem('pos_production_messages', JSON.stringify(withOrder));
    } catch (_) { /* ignore */ }
    void (async () => {
      try {
        const saveRes = await fetch(`${API}/settings/production-messages`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: withOrder }),
        });
        if (!saveRes.ok) {
          const errData = await saveRes.json().catch(() => ({}));
          throw new Error(errData?.error || 'Failed to save production messages');
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(POS_PRODUCTION_MESSAGES_CHANGED_EVENT));
        }
      } catch (e) {
        showToast('error', e?.message || 'Failed to save production messages');
      }
    })();
  };

  useEffect(() => {
    if (!showProductionMessagesModal) return;
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem('pos_production_messages');
      const list = raw ? JSON.parse(raw) : [];
      applyProductionMessagesRef.current(Array.isArray(list) ? list : []);
    } catch (_) {
      applyProductionMessagesRef.current([]);
    }
    setProductionMessageInput('');
    setEditingProductionMessageId(null);
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${API}/settings/production-messages`);
        if (cancelled || !res.ok) return;
        const data = await res.json().catch(() => ({}));
        const arr = Array.isArray(data?.value) ? data.value : [];
        if (!cancelled) applyProductionMessagesRef.current(arr);
      } catch (_) { /* ignore */ }
    })();
    return () => {
      cancelled = true;
    };
  }, [showProductionMessagesModal]);

  /**
   * Keep production messages in sync with the server (webpanel / other tabs).
   * CustomEvent does not cross tabs, so we poll; faster while the modal is open so webpanel edits appear quickly.
   * When the user returns to this tab (e.g. from the webpanel), pull once so the list updates immediately.
   */
  useEffect(() => {
    const pull = async () => {
      try {
        const res = await fetch(`${API}/settings/production-messages`);
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        const arr = Array.isArray(data?.value) ? data.value : [];
        applyProductionMessagesRef.current(arr);
      } catch (_) { /* ignore */ }
    };
    const onPush = () => {
      void pull();
    };
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') void pull();
    };
    void pull();
    window.addEventListener(POS_PRODUCTION_MESSAGES_CHANGED_EVENT, onPush);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    const pollMs = showProductionMessagesModal ? PRODUCTION_MESSAGES_MODAL_POLL_MS : OPTION_LAYOUT_POLL_MS;
    const id = window.setInterval(() => {
      void pull();
    }, pollMs);
    return () => {
      window.removeEventListener(POS_PRODUCTION_MESSAGES_CHANGED_EVENT, onPush);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
      window.clearInterval(id);
    };
  }, [showProductionMessagesModal]);

  const handleAddOrUpdateProductionMessage = () => {
    const text = (productionMessageInput || '').trim();
    if (!text) return;
    const sorted = [...productionMessages].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    if (editingProductionMessageId) {
      const next = sorted.map((m) => (m.id === editingProductionMessageId ? { ...m, text } : m));
      persistProductionMessages(next);
      setEditingProductionMessageId(null);
    } else {
      const newId = 'pm-' + Date.now();
      const next = [...sorted, { id: newId, text, sortOrder: sorted.length }];
      persistProductionMessages(next);
    }
    setProductionMessageInput('');
  };

  const startEditProductionMessage = (m) => {
    setEditingProductionMessageId(m.id);
    setProductionMessageInput(m.text || '');
  };

  const cancelEditProductionMessage = () => {
    setEditingProductionMessageId(null);
    setProductionMessageInput('');
  };

  const handleDeleteProductionMessage = (id) => {
    const next = productionMessages.filter((m) => m.id !== id).map((m, i) => ({ ...m, sortOrder: i }));
    persistProductionMessages(next);
    setDeleteConfirmProductionMessageId(null);
    if (editingProductionMessageId === id) cancelEditProductionMessage();
  };

  const moveProductionMessage = (id, direction) => {
    const sorted = [...productionMessages].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const idx = sorted.findIndex((m) => m.id === id);
    if (idx < 0) return;
    const swap = direction === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= sorted.length) return;
    [sorted[idx], sorted[swap]] = [sorted[swap], sorted[idx]];
    const withOrder = sorted.map((m, i) => ({ ...m, sortOrder: i }));
    persistProductionMessages(withOrder);
  };

  const persistPrinters = (next) => {
    setPrinters(next);
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem('pos_printers', JSON.stringify(next));
    } catch (_) { }
  };

  const parseSerialComPort = (connectionString = '') => {
    const s = String(connectionString || '').trim();
    if (!s) return '';
    if (s.startsWith('serial://')) return (s.substring(9).split('?')[0] || '').trim().toUpperCase();
    if (s.startsWith('\\\\.\\')) return s.substring(4).trim().toUpperCase();
    return s.trim().toUpperCase();
  };

  const parseNetworkAddress = (connectionString = '') => {
    const s = String(connectionString || '').trim();
    if (!s.startsWith('tcp://')) return { ipAddress: '', port: '9100' };
    const [ipAddress = '', port = '9100'] = s.substring(6).split(':');
    return { ipAddress: ipAddress.trim(), port: String(port || '9100').trim() };
  };

  const parseCashmaticConnectionString = (connectionString = '') => {
    const pickFromConfig = (config, keys) => {
      for (const key of keys) {
        if (config[key] != null && String(config[key]).trim() !== '') return String(config[key]).trim();
        const lower = key.toLowerCase();
        const match = Object.keys(config).find((k) => k.toLowerCase() === lower && config[k] != null && String(config[k]).trim() !== '');
        if (match) return String(config[match]).trim();
      }
      return '';
    };

    const raw = String(connectionString || '').trim();
    if (!raw) {
      return { ip: '', port: '', username: '', password: '', url: '' };
    }

    let config = {};
    try {
      config = JSON.parse(raw);
    } catch {
      if (raw.startsWith('tcp://')) {
        const [ip = '', port = '50301'] = raw.substring(6).split(':');
        return { ip: ip.trim(), port: String(port || '50301').trim(), username: '', password: '', url: '' };
      }
      return { ip: raw, port: '', username: '', password: '', url: '' };
    }

    const url = pickFromConfig(config, ['url', 'apiUrl', 'api_url', 'endpoint']);
    const ip = pickFromConfig(config, ['ip', 'ipAddress', 'ip_address']) || (() => {
      if (!url) return '';
      try {
        return new URL(url).hostname || '';
      } catch {
        return '';
      }
    })();
    const port = pickFromConfig(config, ['port']) || (() => {
      if (!url) return '';
      try {
        return String(new URL(url).port || '');
      } catch {
        return '';
      }
    })();
    const username =
      pickFromConfig(config, ['username', 'userName', 'user_name', 'user', 'login']) ||
      (() => {
        if (!url) return '';
        try {
          return new URL(url).username || '';
        } catch {
          return '';
        }
      })();
    const password =
      pickFromConfig(config, ['password', 'pass', 'pwd']) ||
      (() => {
        if (!url) return '';
        try {
          return new URL(url).password || '';
        } catch {
          return '';
        }
      })();

    return { ip, port, username, password, url };
  };

  const mapApiPrinterToUi = (p, index) => {
    const apiType = String(p?.type || '').toLowerCase();
    const connection = String(p?.connection_string || '');
    if (apiType === 'serial') {
      return {
        id: p.id,
        name: p.name || '',
        type: 'COM',
        comPort: parseSerialComPort(connection),
        baudrate: String(p?.baud_rate ?? '9600'),
        characters: '48',
        printerName: '',
        ipAddress: '',
        port: '',
        standard: p?.is_main === 1,
        isDefault: p?.is_main === 1,
        numberOfPrints: 1,
        productionTicketSize: 'normal',
        vatTicketSize: 'normal',
        spaceBetweenProducts: 'none',
        logo: 'disable',
        printerType: 'Esc',
        sortOrder: index,
      };
    }
    if (apiType === 'windows') {
      if (connection.startsWith('tcp://')) {
        const { ipAddress, port } = parseNetworkAddress(connection);
        return {
          id: p.id,
          name: p.name || '',
          type: 'Network',
          comPort: '',
          baudrate: '9600',
          characters: '48',
          printerName: '',
          ipAddress,
          port,
          standard: p?.is_main === 1,
          isDefault: p?.is_main === 1,
          numberOfPrints: 1,
          productionTicketSize: 'normal',
          vatTicketSize: 'normal',
          spaceBetweenProducts: 'none',
          logo: 'disable',
          printerType: 'Esc',
          sortOrder: index,
        };
      }
      return {
        id: p.id,
        name: p.name || '',
        type: 'USB',
        comPort: '',
        baudrate: '9600',
        characters: '48',
        printerName: connection || '',
        ipAddress: '',
        port: '',
        standard: p?.is_main === 1,
        isDefault: p?.is_main === 1,
        numberOfPrints: 1,
        productionTicketSize: 'normal',
        vatTicketSize: 'normal',
        spaceBetweenProducts: 'none',
        logo: 'disable',
        printerType: 'Esc',
        sortOrder: index,
      };
    }
    return {
      id: p?.id ?? `p-${index}`,
      name: p?.name || '',
      type: 'COM',
      comPort: '',
      baudrate: '9600',
      characters: '48',
      printerName: '',
      ipAddress: '',
      port: '',
      standard: false,
      isDefault: false,
      numberOfPrints: 1,
      productionTicketSize: 'normal',
      vatTicketSize: 'normal',
      spaceBetweenProducts: 'none',
      logo: 'disable',
      printerType: 'Esc',
      sortOrder: index,
    };
  };

  const fetchPrintersFromDb = useCallback(async () => {
    try {
      const res = await fetch(`${API}/printers`);
      const data = await res.json().catch(() => null);
      const list = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
      if (!Array.isArray(list)) return;
      const mapped = list.map((p, i) => mapApiPrinterToUi(p, i));
      if (mapped.length) {
        persistPrinters(mapped);
      } else {
        persistPrinters([]);
      }
    } catch {
      // Keep existing local state when backend is unavailable.
    }
  }, []);

  const openNewPrinterModal = () => {
    setEditingPrinterId(null);
    setShowPrinterModal(true);
  };

  const openEditPrinterModal = (p) => {
    setEditingPrinterId(p.id);
    setShowPrinterModal(true);
  };

  const closePrinterModal = () => {
    setShowPrinterModal(false);
    setEditingPrinterId(null);
  };

  const handleSavePrinterPayload = async (payload) => {
    const sorted = [...printers].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const type = String(payload?.type || 'COM');
    const apiType = type === 'COM' ? 'serial' : 'windows';
    const connectionString =
      type === 'COM'
        ? `serial://${(payload?.comPort || '').trim().toUpperCase()}`
        : type === 'USB'
          ? String(payload?.printerName || '').trim()
          : `tcp://${String(payload?.ipAddress || '').trim()}:${String(payload?.port || '9100').trim()}`;
    const requestBody = {
      name: String(payload?.name || '').trim(),
      type: apiType,
      connection_string: connectionString,
      baud_rate: type === 'COM' ? payload?.baudrate : null,
      data_bits: null,
      parity: null,
      stop_bits: null,
      is_main: payload?.standard ? 1 : 0,
      enabled: 1,
    };
    try {
      const endpoint = editingPrinterId ? `${API}/printers/${editingPrinterId}` : `${API}/printers`;
      const method = editingPrinterId ? 'PUT' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchPrintersFromDb();
      showToast('success', 'Printer saved to database.');
      closePrinterModal();
    } catch {
      // Fallback to old local-only behavior if DB save fails.
      if (editingPrinterId) {
        const next = sorted.map((p) => (p.id === editingPrinterId ? { ...p, ...payload } : p));
        persistPrinters(next);
      } else {
        const newId = 'prn-' + Date.now();
        const next = [...sorted, { id: newId, ...payload, isDefault: false, sortOrder: sorted.length }];
        persistPrinters(next);
      }
      showToast('error', 'Failed to save printer to database. Saved locally only.');
      closePrinterModal();
    }
  };

  const setDefaultPrinter = async (id) => {
    try {
      const res = await fetch(`${API}/printers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_main: 1 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchPrintersFromDb();
      showToast('success', 'Default printer updated.');
    } catch {
      const next = printers.map((p) => ({ ...p, isDefault: p.id === id }));
      persistPrinters(next);
      showToast('error', 'Failed to update default printer in database. Updated locally only.');
    }
  };

  const handleDeletePrinter = async (id) => {
    try {
      const res = await fetch(`${API}/printers/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
      await fetchPrintersFromDb();
      setDeleteConfirmPrinterId(null);
      showToast('success', 'Printer deleted.');
    } catch {
      const next = printers.filter((p) => p.id !== id).map((p, i) => ({ ...p, sortOrder: i }));
      persistPrinters(next);
      setDeleteConfirmPrinterId(null);
      showToast('error', 'Failed to delete printer from database. Deleted locally only.');
    }
  };

  const movePrinter = (id, direction) => {
    const sorted = [...printers].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const idx = sorted.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const swap = direction === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= sorted.length) return;
    [sorted[idx], sorted[swap]] = [sorted[swap], sorted[idx]];
    const withOrder = sorted.map((p, i) => ({ ...p, sortOrder: i }));
    persistPrinters(withOrder);
  };

  useEffect(() => {
    if (printerTab !== 'Final tickets') return;
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem('pos_printer_final_tickets');
      if (raw) {
        const s = JSON.parse(raw);
        if (s.companyData1 != null) setFinalTicketsCompanyData1(s.companyData1);
        if (s.companyData2 != null) setFinalTicketsCompanyData2(s.companyData2);
        if (s.companyData3 != null) setFinalTicketsCompanyData3(s.companyData3);
        if (s.companyData4 != null) setFinalTicketsCompanyData4(s.companyData4);
        if (s.companyData5 != null) setFinalTicketsCompanyData5(s.companyData5);
        if (s.thankText != null) setFinalTicketsThankText(s.thankText);
        if (s.proforma != null) setFinalTicketsProforma(!!s.proforma);
        if (s.printPaymentType != null) setFinalTicketsPrintPaymentType(!!s.printPaymentType);
        if (s.ticketTearable != null) setFinalTicketsTicketTearable(!!s.ticketTearable);
        if (s.printLogo != null) setFinalTicketsPrintLogo(!!s.printLogo);
        if (s.printingOrder != null) setFinalTicketsPrintingOrder(s.printingOrder);
      }
    } catch (_) { }
  }, [printerTab]);

  const finalTicketsKeyboardValue = finalTicketsActiveField === 'companyData1' ? finalTicketsCompanyData1
    : finalTicketsActiveField === 'companyData2' ? finalTicketsCompanyData2
      : finalTicketsActiveField === 'companyData3' ? finalTicketsCompanyData3
        : finalTicketsActiveField === 'companyData4' ? finalTicketsCompanyData4
          : finalTicketsActiveField === 'companyData5' ? finalTicketsCompanyData5
            : finalTicketsActiveField === 'thankText' ? finalTicketsThankText
              : '';

  const finalTicketsKeyboardOnChange = (v) => {
    if (finalTicketsActiveField === 'companyData1') setFinalTicketsCompanyData1(v);
    else if (finalTicketsActiveField === 'companyData2') setFinalTicketsCompanyData2(v);
    else if (finalTicketsActiveField === 'companyData3') setFinalTicketsCompanyData3(v);
    else if (finalTicketsActiveField === 'companyData4') setFinalTicketsCompanyData4(v);
    else if (finalTicketsActiveField === 'companyData5') setFinalTicketsCompanyData5(v);
    else if (finalTicketsActiveField === 'thankText') setFinalTicketsThankText(v);
  };

  const handleSaveFinalTickets = () => {
    setSavingFinalTickets(true);
    try {
      const payload = {
        companyData1: finalTicketsCompanyData1,
        companyData2: finalTicketsCompanyData2,
        companyData3: finalTicketsCompanyData3,
        companyData4: finalTicketsCompanyData4,
        companyData5: finalTicketsCompanyData5,
        thankText: finalTicketsThankText,
        proforma: finalTicketsProforma,
        printPaymentType: finalTicketsPrintPaymentType,
        ticketTearable: finalTicketsTicketTearable,
        printLogo: finalTicketsPrintLogo,
        printingOrder: finalTicketsPrintingOrder
      };
      if (typeof localStorage !== 'undefined') localStorage.setItem('pos_printer_final_tickets', JSON.stringify(payload));
    } finally {
      setSavingFinalTickets(false);
    }
  };

  useEffect(() => {
    if (printerTab !== 'Production Tickets') return;
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem('pos_printer_production_tickets');
      if (raw) {
        const s = JSON.parse(raw);
        if (s.displayCategories != null) setProdTicketsDisplayCategories(!!s.displayCategories);
        if (s.spaceAbove != null) setProdTicketsSpaceAbove(!!s.spaceAbove);
        if (s.ticketTearable != null) setProdTicketsTicketTearable(!!s.ticketTearable);
        if (s.keukenprinterBuzzer != null) setProdTicketsKeukenprinterBuzzer(!!s.keukenprinterBuzzer);
        if (s.productenIndividueel != null) setProdTicketsProductenIndividueel(!!s.productenIndividueel);
        if (s.eatInTakeOutOnderaan != null) setProdTicketsEatInTakeOutOnderaan(!!s.eatInTakeOutOnderaan);
        if (s.nextCoursePrinter1 != null) setProdTicketsNextCoursePrinter1(s.nextCoursePrinter1);
        if (s.nextCoursePrinter2 != null) setProdTicketsNextCoursePrinter2(s.nextCoursePrinter2);
        if (s.nextCoursePrinter3 != null) setProdTicketsNextCoursePrinter3(s.nextCoursePrinter3);
        if (s.nextCoursePrinter4 != null) setProdTicketsNextCoursePrinter4(s.nextCoursePrinter4);
        if (s.printingOrder != null) setProdTicketsPrintingOrder(s.printingOrder);
        if (s.groupingReceipt != null) setProdTicketsGroupingReceipt(s.groupingReceipt);
        if (s.printerOverboeken != null) setProdTicketsPrinterOverboeken(s.printerOverboeken);
      }
    } catch (_) { }
  }, [printerTab]);

  const handleSaveProductionTickets = () => {
    setSavingProdTickets(true);
    try {
      const payload = {
        displayCategories: prodTicketsDisplayCategories,
        spaceAbove: prodTicketsSpaceAbove,
        ticketTearable: prodTicketsTicketTearable,
        keukenprinterBuzzer: prodTicketsKeukenprinterBuzzer,
        productenIndividueel: prodTicketsProductenIndividueel,
        eatInTakeOutOnderaan: prodTicketsEatInTakeOutOnderaan,
        nextCoursePrinter1: prodTicketsNextCoursePrinter1,
        nextCoursePrinter2: prodTicketsNextCoursePrinter2,
        nextCoursePrinter3: prodTicketsNextCoursePrinter3,
        nextCoursePrinter4: prodTicketsNextCoursePrinter4,
        printingOrder: prodTicketsPrintingOrder,
        groupingReceipt: prodTicketsGroupingReceipt,
        printerOverboeken: prodTicketsPrinterOverboeken
      };
      if (typeof localStorage !== 'undefined') localStorage.setItem('pos_printer_production_tickets', JSON.stringify(payload));
    } finally {
      setSavingProdTickets(false);
    }
  };

  const getPrinterOptionLabel = useCallback((printer) => {
    const p = printer && typeof printer === 'object' ? printer : {};
    const byName = String(p.name || '').trim();
    if (byName) return byName;
    const byPrinterName = String(p.printerName || '').trim();
    if (byPrinterName) return byPrinterName;
    const byCom = String(p.comPort || '').trim();
    if (byCom) return byCom;
    const byIp = String(p.ipAddress || '').trim();
    const byPort = String(p.port || '').trim();
    if (byIp && byPort) return `${byIp}:${byPort}`;
    if (byIp) return byIp;
    const byId = String(p.id || '').trim();
    if (byId) return `${tr('control.printer.printer', 'Printer')} ${byId}`;
    return tr('control.printer.printer', 'Printer');
  }, [tr]);

  const productionTicketsPrinterOptions = [
    ...PRINTER_DISABLED_OPTIONS,
    ...[...printers]
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((p) => ({ value: p.id, label: getPrinterOptionLabel(p) }))
  ];

  const sortedPrintersForProductModal = [...printers].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const getUniqueProductPrinterOptions = (currentPrinterId, otherPrinterIds = []) => {
    const usedIds = new Set(
      (Array.isArray(otherPrinterIds) ? otherPrinterIds : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    );
    return [
      { value: '', label: tr('control.productModal.disabled', 'Disabled') },
      ...sortedPrintersForProductModal
        .filter((p) => p.id === currentPrinterId || !usedIds.has(p.id))
        .map((p) => ({ value: p.id, label: getPrinterOptionLabel(p) }))
    ];
  };

  const labelsPrinterOptions = [...printers]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((p) => ({ value: p.id, label: getPrinterOptionLabel(p) }));

  const labelsTypeOptions = useMemo(
    () => [
      { value: 'production-labels', label: tr('control.labels.type.productionLabels', 'Production labels') },
      { value: 'article-label', label: tr('control.labels.type.articleLabel', 'Article label') },
      { value: 'scale-labels', label: tr('control.labels.type.scaleLabels', 'Scale labels') },
      { value: 'pre-packaging-labels', label: tr('control.labels.type.prePackagingLabels', 'Pre-packaging labels') },
    ],
    [tr]
  );

  useEffect(() => {
    if (printerTab !== 'Labels') return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${API}/settings/printer-labels`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) {
          if (data?.type != null) setLabelsType(normalizeLabelType(data.type, 'production-labels'));
          if (data?.printer != null) setLabelsPrinter(String(data.printer));
          try {
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('pos_printer_labels', JSON.stringify({
                type: normalizeLabelType(data?.type, 'production-labels'),
                printer: data?.printer ?? '',
              }));
            }
          } catch (_) { /* ignore cache write */ }
          return;
        }
      } catch (_) { /* fallback below */ }
      try {
        const raw = typeof localStorage !== 'undefined' && localStorage.getItem('pos_printer_labels');
        if (raw) {
          const s = JSON.parse(raw);
          if (!cancelled && s.type != null) setLabelsType(normalizeLabelType(s.type, 'production-labels'));
          if (!cancelled && s.printer != null) setLabelsPrinter(s.printer);
        }
      } catch (_) { /* ignore cache read */ }

      try {
        const labelsRes = await fetch(`${API}/printer-labels`);
        const labelsData = await labelsRes.json().catch(() => []);
        if (!cancelled && labelsRes.ok && Array.isArray(labelsData)) {
          const mapped = labelsData
            .map((item, i) => ({
              id: item?.id,
              name: item?.name ?? item?.sizeLabel ?? '',
              sizeLabel: item?.sizeLabel ?? item?.name ?? '',
              height: item?.height ?? '',
              width: item?.width ?? '',
              standard: !!item?.standard,
              marginLeft: Number(item?.marginLeft) || 0,
              marginRight: Number(item?.marginRight) || 0,
              marginBottom: Number(item?.marginBottom) || 0,
              marginTop: Number(item?.marginTop) || 0,
              sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : i,
            }))
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          if (mapped.length > 0) persistLabelsList(mapped);
        }
      } catch (_) { /* keep cache fallback */ }
    };
    load();
    try {
      const rawList = typeof localStorage !== 'undefined' && localStorage.getItem('pos_printer_labels_list');
      if (rawList) {
        const list = JSON.parse(rawList);
        if (Array.isArray(list) && list.length) setLabelsList(list);
      }
    } catch (_) { }
    return () => {
      cancelled = true;
    };
  }, [printerTab]);

  useEffect(() => {
    if (printerTab !== 'Labels') setLabelsListPage(0);
  }, [printerTab]);

  useEffect(() => {
    labelsTypeRef.current = labelsType;
  }, [labelsType]);

  useEffect(() => {
    labelsPrinterRef.current = labelsPrinter;
  }, [labelsPrinter]);

  const persistLabelsList = (next) => {
    setLabelsList(next);
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem('pos_printer_labels_list', JSON.stringify(next));
    } catch (_) { }
  };

  const saveLabelsSettings = async (updates) => {
    const currentType = String(labelsTypeRef.current || '').trim();
    const currentPrinter = String(labelsPrinterRef.current || '').trim();
    const nextType = updates?.type != null ? normalizeLabelType(updates.type, currentType || 'production-labels') : normalizeLabelType(currentType || 'production-labels');
    const nextPrinter = updates?.printer != null ? String(updates.printer || '').trim() : currentPrinter;
    const next = {
      type: nextType || 'production-labels',
      printer: nextPrinter,
    };
    labelsTypeRef.current = next.type;
    labelsPrinterRef.current = next.printer;
    setLabelsType(next.type);
    setLabelsPrinter(next.printer);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('pos_printer_labels', JSON.stringify(next));
      }
    } catch (_) { /* ignore cache write */ }
    try {
      const res = await fetch(`${API}/settings/printer-labels`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data?.type != null) setLabelsType(String(data.type));
        if (data?.printer != null) setLabelsPrinter(String(data.printer));
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('pos_printer_labels', JSON.stringify({
              type: data?.type ?? next.type,
              printer: data?.printer ?? next.printer,
            }));
          }
        } catch (_) { /* ignore cache write */ }
      }
    } catch (_) { /* keep local fallback state */ }
  };

  useEffect(() => {
    if (printerTab !== 'Labels') return;
    const validIds = new Set(labelsPrinterOptions.map((opt) => String(opt.value || '').trim()).filter(Boolean));
    const current = String(labelsPrinter || '').trim();
    if (current && validIds.has(current)) return;
    const fallback = labelsPrinterOptions.length > 0 ? String(labelsPrinterOptions[0].value || '').trim() : '';
    if (current === fallback) return;
    void saveLabelsSettings({ printer: fallback });
  }, [printerTab, labelsPrinterOptions, labelsPrinter]);

  const openNewLabelModal = () => {
    setEditingLabelId(null);
    setLabelName('');
    setLabelHeight('');
    setLabelWidth('');
    setLabelStandard(false);
    setLabelMarginLeft('0');
    setLabelMarginRight('0');
    setLabelMarginBottom('0');
    setLabelMarginTop('0');
    setShowLabelModal(true);
  };

  const openEditLabelModal = (item) => {
    setEditingLabelId(item.id);
    setLabelName(item.name ?? item.sizeLabel ?? '');
    setLabelHeight(String(item.height ?? ''));
    setLabelWidth(String(item.width ?? ''));
    setLabelStandard(!!item.standard);
    setLabelMarginLeft(String(item.marginLeft ?? '0'));
    setLabelMarginRight(String(item.marginRight ?? '0'));
    setLabelMarginBottom(String(item.marginBottom ?? '0'));
    setLabelMarginTop(String(item.marginTop ?? '0'));
    setShowLabelModal(true);
  };

  const closeLabelModal = () => {
    setShowLabelModal(false);
    setEditingLabelId(null);
    setLabelName('');
    setLabelHeight('');
    setLabelWidth('');
    setLabelStandard(false);
    setLabelMarginLeft('0');
    setLabelMarginRight('0');
    setLabelMarginBottom('0');
    setLabelMarginTop('0');
  };

  const handleSaveLabel = () => {
    const name = (labelName || '').trim();
    if (!name) return;
    const sorted = [...labelsList].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const payload = {
      name,
      sizeLabel: name,
      height: labelHeight.trim() || undefined,
      width: labelWidth.trim() || undefined,
      standard: labelStandard,
      marginLeft: Number(labelMarginLeft) || 0,
      marginRight: Number(labelMarginRight) || 0,
      marginBottom: Number(labelMarginBottom) || 0,
      marginTop: Number(labelMarginTop) || 0
    };
    const save = async () => {
      try {
        if (editingLabelId) {
          const res = await fetch(`${API}/printer-labels/${editingLabelId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error || 'Failed to update label');
          const next = sorted
            .map((l) => (l.id === editingLabelId ? { ...l, ...data } : l))
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          persistLabelsList(next);
        } else {
          const res = await fetch(`${API}/printer-labels`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error || 'Failed to create label');
          const next = [...sorted, data].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          persistLabelsList(next);
        }
        closeLabelModal();
      } catch (_) {
        // Fallback to local save when backend is unavailable.
        if (editingLabelId) {
          const next = sorted.map((l) => (l.id === editingLabelId ? { ...l, ...payload } : l));
          persistLabelsList(next);
        } else {
          const newId = 'lbl-' + Date.now();
          const next = [...sorted, { id: newId, ...payload, sortOrder: sorted.length }];
          persistLabelsList(next);
        }
        closeLabelModal();
      }
    };
    void save();
  };

  const handleDeleteLabel = (id) => {
    const remove = async () => {
      try {
        await fetch(`${API}/printer-labels/${id}`, { method: 'DELETE' });
      } catch (_) { /* ignore and keep local fallback */ }
      const next = labelsList.filter((l) => l.id !== id).map((l, i) => ({ ...l, sortOrder: i }));
      persistLabelsList(next);
      setDeleteConfirmLabelId(null);
    };
    void remove();
  };

  const moveLabel = (id, direction) => {
    const sorted = [...labelsList].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const idx = sorted.findIndex((l) => l.id === id);
    if (idx < 0) return;
    const swap = direction === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= sorted.length) return;
    const current = sorted[idx];
    const other = sorted[swap];
    [sorted[idx], sorted[swap]] = [sorted[swap], sorted[idx]];
    const withOrder = sorted.map((l, i) => ({ ...l, sortOrder: i }));
    persistLabelsList(withOrder);
    const syncSortOrder = async () => {
      try {
        await fetch(`${API}/printer-labels/${current.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sortOrder: swap }),
        });
        await fetch(`${API}/printer-labels/${other.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sortOrder: idx }),
        });
      } catch (_) { /* local fallback already applied */ }
    };
    void syncSortOrder();
  };

  useEffect(() => {
    if (topNavId !== 'external-devices' || subNavId !== 'Price Display') return;
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem('pos_price_display');
      if (raw) {
        const s = JSON.parse(raw);
        if (s.type != null) setPriceDisplayType(s.type);
      }
    } catch (_) { }
  }, [topNavId, subNavId]);

  useEffect(() => {
    if (topNavId !== 'external-devices' || subNavId !== 'RFID Reader') return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${API}/settings/rfid-reader`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data.type != null) {
          setRfidReaderType(data.type);
          return;
        }
      } catch (_) { }
      try {
        const raw = typeof localStorage !== 'undefined' && localStorage.getItem('pos_rfid_reader');
        if (raw && !cancelled) {
          const s = JSON.parse(raw);
          if (s.type != null) setRfidReaderType(s.type);
        }
      } catch (_) { }
    };
    load();
    return () => { cancelled = true; };
  }, [topNavId, subNavId]);

  useEffect(() => {
    if (topNavId !== 'external-devices' || subNavId !== 'Barcode Scanner') return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${API}/settings/barcode-scanner`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data.type != null) {
          setBarcodeScannerType(data.type);
          return;
        }
      } catch (_) { }
      try {
        const raw = typeof localStorage !== 'undefined' && localStorage.getItem('pos_barcode_scanner');
        if (raw && !cancelled) {
          const s = JSON.parse(raw);
          if (s.type != null) setBarcodeScannerType(s.type);
        }
      } catch (_) { }
    };
    load();
    return () => { cancelled = true; };
  }, [topNavId, subNavId]);

  useEffect(() => {
    if (topNavId !== 'external-devices' || subNavId !== 'Credit Card') return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${API}/settings/credit-card`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data.type != null) {
          setCreditCardType(data.type);
          return;
        }
      } catch (_) { }
      try {
        const raw = typeof localStorage !== 'undefined' && localStorage.getItem('pos_credit_card');
        if (raw && !cancelled) {
          const s = JSON.parse(raw);
          if (s.type != null) setCreditCardType(s.type);
        }
      } catch (_) { }
    };
    load();
    return () => { cancelled = true; };
  }, [topNavId, subNavId]);

  useEffect(() => {
    if (topNavId !== 'external-devices' || subNavId !== 'Scale') return;
    let cancelled = false;
    const applyScaleSettings = (s) => {
      if (!s || typeof s !== 'object') return;
      if (s.type != null) setScaleType(String(s.type));
      if (s.port != null) setScalePort(String(s.port));
      if (s.mode != null) setScaleConnectionMode(normalizeScaleConnectionMode(s.mode));
      if (s.lsmIp != null) setScaleLsmIp(String(s.lsmIp));
      if (typeof s.useWeightScaleLabels === 'boolean') setScaleUseWeightLabels(s.useWeightScaleLabels);
      if (typeof s.confirmWeight === 'boolean') setScaleConfirmWeight(s.confirmWeight);
    };
    const loadFromBackend = async () => {
      try {
        const res = await fetch(`${API}/settings/scale`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return false;
        applyScaleSettings(data);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('pos_scale', JSON.stringify(data));
        }
        return true;
      } catch {
        return false;
      }
    };
    const loadFallback = () => {
      try {
        const raw = typeof localStorage !== 'undefined' && localStorage.getItem('pos_scale');
        if (!raw || cancelled) return;
        applyScaleSettings(JSON.parse(raw));
      } catch (_) { }
    };
    loadFromBackend().then((ok) => {
      if (!ok) loadFallback();
    });
    return () => { cancelled = true; };
  }, [topNavId, subNavId]);

  useEffect(() => {
    if (topNavId !== 'external-devices' || subNavId !== 'Cashmatic') return;
    let cancelled = false;
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem('pos_cashmatic');
      if (raw) {
        const s = JSON.parse(raw);
        if (s.name != null) setCashmaticName(String(s.name));
        if (s.connectionType != null) setCashmaticConnectionType(String(s.connectionType).toLowerCase() === 'api' ? 'api' : 'tcp');
        if (s.ip != null) setCashmaticIpAddress(String(s.ip));
        if (s.port != null) setCashmaticPort(String(s.port));
        if (s.username != null) setCashmaticUsername(String(s.username));
        if (s.password != null) setCashmaticPassword(String(s.password));
        if (s.url != null) setCashmaticUrl(String(s.url));
        // Backward compatibility with old "ipPort" format
        if ((s.ip == null || s.port == null) && s.ipPort) {
          const [ip, port] = String(s.ipPort).split(':');
          if (ip && s.ip == null) setCashmaticIpAddress(ip);
          if (port && s.port == null) setCashmaticPort(port);
        }
      }
    } catch (_) { }
    const loadCashmaticFromDb = async () => {
      try {
        const res = await fetch(`${API}/payment-terminals`);
        const data = await res.json().catch(() => null);
        if (!res.ok) return;
        const terminals = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
        const cashmatic = terminals.find((t) => String(t?.type || '').toLowerCase() === 'cashmatic');
        if (!cashmatic || cancelled) return;
        const parsed = parseCashmaticConnectionString(cashmatic.connection_string);
        setCashmaticTerminalId(cashmatic.id || null);
        if (cashmatic.name != null) setCashmaticName(String(cashmatic.name));
        if (cashmatic.connection_type != null) {
          setCashmaticConnectionType(String(cashmatic.connection_type).toLowerCase() === 'api' ? 'api' : 'tcp');
        }
        if (parsed.ip) setCashmaticIpAddress(parsed.ip);
        if (parsed.port) setCashmaticPort(parsed.port);
        if (parsed.username) setCashmaticUsername(parsed.username);
        if (parsed.password) setCashmaticPassword(parsed.password);
        if (parsed.url) setCashmaticUrl(parsed.url);
      } catch {
        // Keep local values if backend is unavailable.
      }
    };
    loadCashmaticFromDb();
    return () => {
      cancelled = true;
    };
  }, [topNavId, subNavId]);

  useEffect(() => {
    if (topNavId !== 'external-devices' || subNavId !== 'Card') return;
    let cancelled = false;
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem('pos_payworld');
      if (raw) {
        const s = JSON.parse(raw);
        if (s.name != null) setPayworldName(String(s.name));
        if (s.ip != null) setPayworldIpAddress(String(s.ip));
        if (s.port != null) setPayworldPort(String(s.port));
      }
    } catch (_) { }
    const loadPayworldFromDb = async () => {
      try {
        const res = await fetch(`${API}/payment-terminals`);
        const data = await res.json().catch(() => null);
        if (!res.ok) return;
        const terminals = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
        const payworld = terminals.find((t) => String(t?.type || '').toLowerCase() === 'payworld');
        if (!payworld || cancelled) return;
        let parsed = {};
        try {
          parsed = typeof payworld.connection_string === 'string' ? JSON.parse(payworld.connection_string) : (payworld.connection_string || {});
        } catch (_) { }
        setPayworldTerminalId(payworld.id || null);
        if (payworld.name != null) setPayworldName(String(payworld.name));
        if (parsed.ip != null) setPayworldIpAddress(String(parsed.ip));
        if (parsed.port != null) setPayworldPort(String(parsed.port));
      } catch {
        // Keep local values if backend is unavailable.
      }
    };
    loadPayworldFromDb();
    return () => { cancelled = true; };
  }, [topNavId, subNavId]);

  useEffect(() => {
    if (topNavId !== 'external-devices' || subNavId !== 'Card') return;
    let cancelled = false;
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem('pos_viva');
      if (raw) {
        const s = JSON.parse(raw);
        if (s.name != null) setVivaName(String(s.name));
        if (s.ip != null) setVivaIpAddress(String(s.ip));
        if (s.port != null) setVivaPort(String(s.port));
      }
    } catch (_) { }
    const loadVivaFromDb = async () => {
      try {
        const res = await fetch(`${API}/payment-terminals`);
        const data = await res.json().catch(() => null);
        if (!res.ok) return;
        const terminals = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
        const viva = terminals.find((t) => ['viva', 'viva-wallet'].includes(String(t?.type || '').toLowerCase()));
        if (!viva || cancelled) return;
        let parsed = {};
        try {
          parsed = typeof viva.connection_string === 'string' ? JSON.parse(viva.connection_string) : (viva.connection_string || {});
        } catch (_) { }
        setVivaTerminalId(viva.id || null);
        if (viva.name != null) setVivaName(String(viva.name));
        if (parsed.ip != null) setVivaIpAddress(String(parsed.ip));
        if (parsed.port != null) setVivaPort(String(parsed.port));
      } catch {
        // Keep local values if backend is unavailable.
      }
    };
    loadVivaFromDb();
    return () => { cancelled = true; };
  }, [topNavId, subNavId]);

  useEffect(() => {
    if (topNavId !== 'external-devices' || subNavId !== 'Card') return;
    let cancelled = false;
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem('pos_ccv');
      if (raw) {
        const s = JSON.parse(raw);
        if (s.name != null) setCcvName(String(s.name));
        if (s.ip != null) setCcvIpAddress(String(s.ip));
        if (s.commandPort != null) setCcvCommandPort(String(s.commandPort));
        if (s.devicePort != null) setCcvDevicePort(String(s.devicePort));
        if (s.workstationId != null) setCcvWorkstationId(String(s.workstationId));
      }
    } catch (_) { }
    const loadCcvFromDb = async () => {
      try {
        const res = await fetch(`${API}/payment-terminals`);
        const data = await res.json().catch(() => null);
        if (!res.ok) return;
        const terminals = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
        const ccv = terminals.find((t) => ['ccv'].includes(String(t?.type || '').toLowerCase()));
        if (!ccv || cancelled) return;
        let parsed = {};
        try {
          parsed = typeof ccv.connection_string === 'string' ? JSON.parse(ccv.connection_string) : (ccv.connection_string || {});
        } catch (_) { }
        setCcvTerminalId(ccv.id || null);
        if (ccv.name != null) setCcvName(String(ccv.name));
        if (parsed.ip != null) setCcvIpAddress(String(parsed.ip));
        if (parsed.commandPort != null) setCcvCommandPort(String(parsed.commandPort));
        else if (parsed.port != null) setCcvCommandPort(String(parsed.port));
        if (parsed.devicePort != null) setCcvDevicePort(String(parsed.devicePort));
        if (parsed.workstationId != null) setCcvWorkstationId(String(parsed.workstationId));
      } catch {
        // Keep local values if backend is unavailable.
      }
    };
    loadCcvFromDb();
    return () => { cancelled = true; };
  }, [topNavId, subNavId]);

  useEffect(() => {
    if (topNavId !== 'external-devices' || subNavId !== 'Card') return;
    let cancelled = false;
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem('pos_worldline');
      if (raw) {
        const s = JSON.parse(raw);
        if (s.name != null) setWorldlineName(String(s.name));
        if (s.ip != null) setWorldlineIpAddress(String(s.ip));
        if (s.port != null) setWorldlinePort(String(s.port));
        if (s.simulate != null) setWorldlineSimulate(!!s.simulate);
        if (s.terminalConnectsToPos != null) setWorldlineTerminalConnectsToPos(!!s.terminalConnectsToPos);
      }
    } catch (_) { }
    const loadWorldlineFromDb = async () => {
      try {
        const res = await fetch(`${API}/payment-terminals`);
        const data = await res.json().catch(() => null);
        if (!res.ok) return;
        const terminals = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
        const wl = terminals.find((t) => String(t?.type || '').toLowerCase() === 'worldline');
        if (!wl || cancelled) return;
        let parsed = {};
        try {
          parsed = typeof wl.connection_string === 'string' ? JSON.parse(wl.connection_string) : (wl.connection_string || {});
        } catch (_) { }
        setWorldlineTerminalId(wl.id || null);
        if (wl.name != null) setWorldlineName(String(wl.name));
        if (parsed.terminalConnectsToPos === false) {
          setWorldlineTerminalConnectsToPos(false);
          if (parsed.ip != null) setWorldlineIpAddress(String(parsed.ip));
        } else if (parsed.terminalConnectsToPos === true || parsed.terminalConnectsToPos === 1) {
          setWorldlineTerminalConnectsToPos(true);
        } else if (parsed.ip && String(parsed.ip).trim()) {
          setWorldlineTerminalConnectsToPos(false);
          setWorldlineIpAddress(String(parsed.ip).trim());
        } else {
          setWorldlineTerminalConnectsToPos(true);
        }
        if (parsed.port != null) setWorldlinePort(String(parsed.port));
        if (parsed.simulate != null) setWorldlineSimulate(!!parsed.simulate);
      } catch {
        // Keep local values if backend is unavailable.
      }
    };
    loadWorldlineFromDb();
    return () => { cancelled = true; };
  }, [topNavId, subNavId]);

  useEffect(() => {
    if (topNavId !== 'external-devices' || subNavId !== 'Card') return;
    let cancelled = false;
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem('pos_bancontact_pro');
      if (raw) {
        const s = JSON.parse(raw);
        if (s.name != null) setBancontactProName(String(s.name));
        if (s.sandbox != null) setBancontactProSandbox(!!s.sandbox);
      }
    } catch (_) { }
    const loadBancontactProFromDb = async () => {
      try {
        const res = await fetch(`${API}/payment-terminals`);
        const data = await res.json().catch(() => null);
        if (!res.ok) return;
        const terminals = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
        const row = terminals.find((t) => String(t?.type || '').toLowerCase() === 'bancontact_pro');
        if (!row || cancelled) return;
        let parsed = {};
        try {
          parsed = typeof row.connection_string === 'string' ? JSON.parse(row.connection_string) : (row.connection_string || {});
        } catch (_) { }
        setBancontactProTerminalId(row.id || null);
        if (row.name != null) setBancontactProName(String(row.name));
        if (parsed.apiKey != null) setBancontactProApiKey(String(parsed.apiKey));
        else if (parsed.api_key != null) setBancontactProApiKey(String(parsed.api_key));
        if (parsed.sandbox != null) setBancontactProSandbox(!!parsed.sandbox);
        if (parsed.callbackUrl != null) setBancontactProCallbackUrl(String(parsed.callbackUrl));
        else if (parsed.callback_url != null) setBancontactProCallbackUrl(String(parsed.callback_url));
      } catch {
        // Keep local values if backend is unavailable.
      }
    };
    loadBancontactProFromDb();
    return () => { cancelled = true; };
  }, [topNavId, subNavId]);

  useEffect(() => {
    if (topNavId !== 'external-devices' || subNavId !== 'Card') return;
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem('pos_card_terminal_provider');
      if (!raw) return;
      const provider = String(raw).trim().toLowerCase();
      if (provider === 'payworld' || provider === 'ccv' || provider === 'viva' || provider === 'worldline' || provider === 'bancontactpro') {
        setCardTerminalProvider(provider);
      }
    } catch (_) {
      // ignore
    }
  }, [topNavId, subNavId]);

  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('pos_card_terminal_provider', cardTerminalProvider);
      }
    } catch (_) {
      // ignore
    }
  }, [cardTerminalProvider]);

  useEffect(() => {
    if (effectiveControlSidebarId !== 'reports' || reportTabId !== 'settings') return;
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem('pos_report_settings');
      if (raw) {
        const s = JSON.parse(raw);
        if (s && typeof s === 'object') setReportSettings((prev) => ({ ...prev, ...s }));
      }
    } catch (_) { }
  }, [effectiveControlSidebarId, reportTabId]);

  const handleSavePriceDisplay = () => {
    setSavingPriceDisplay(true);
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem('pos_price_display', JSON.stringify({ type: priceDisplayType }));
    } finally {
      setSavingPriceDisplay(false);
    }
  };

  const handleSaveRfidReader = async () => {
    setSavingRfidReader(true);
    try {
      const res = await fetch(`${API}/settings/rfid-reader`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: rfidReaderType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save');
      if (typeof localStorage !== 'undefined') localStorage.setItem('pos_rfid_reader', JSON.stringify({ type: rfidReaderType }));
      showToast('success', tr('control.saved', 'Saved.'));
    } catch (e) {
      showToast('error', e?.message || tr('control.saveFailed', 'Save failed.'));
    } finally {
      setSavingRfidReader(false);
    }
  };

  const handleSaveBarcodeScanner = async () => {
    setSavingBarcodeScanner(true);
    try {
      const res = await fetch(`${API}/settings/barcode-scanner`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: barcodeScannerType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save');
      if (typeof localStorage !== 'undefined') localStorage.setItem('pos_barcode_scanner', JSON.stringify({ type: barcodeScannerType }));
      showToast('success', tr('control.saved', 'Saved.'));
    } catch (e) {
      showToast('error', e?.message || tr('control.saveFailed', 'Save failed.'));
    } finally {
      setSavingBarcodeScanner(false);
    }
  };

  const handleSaveCreditCard = async () => {
    setSavingCreditCard(true);
    try {
      const res = await fetch(`${API}/settings/credit-card`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: creditCardType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save');
      if (typeof localStorage !== 'undefined') localStorage.setItem('pos_credit_card', JSON.stringify({ type: creditCardType }));
      showToast('success', tr('control.saved', 'Saved.'));
    } catch (e) {
      showToast('error', e?.message || tr('control.saveFailed', 'Save failed.'));
    } finally {
      setSavingCreditCard(false);
    }
  };

  const handleSaveScale = async () => {
    setSavingScale(true);
    try {
      const payload = {
        type: scaleType,
        port: scalePort,
        mode: normalizeScaleConnectionMode(scaleConnectionMode),
        lsmIp: String(scaleLsmIp || '').trim(),
        useWeightScaleLabels: scaleUseWeightLabels,
        confirmWeight: scaleConfirmWeight
      };
      const res = await fetch(`${API}/settings/scale`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save scale setting');
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('pos_scale', JSON.stringify(data));
      }
      showToast('success', tr('control.saved', 'Saved.'));
    } catch (e) {
      showToast('error', e?.message || tr('control.saveFailed', 'Save failed.'));
    } finally {
      setSavingScale(false);
    }
  };

  const handleTestScale = async () => {
    setTestingScale(true);
    try {
      const res = await fetch(`${API}/scale/live-weight?force=1`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Scale test failed.');
      if (data?.configured === false) {
        throw new Error(tr('control.external.scaleDisabled', 'Scale is disabled. Select a protocol/type first.'));
      }
      if (!data?.connected) {
        throw new Error(data?.error || tr('control.external.scaleNotConnected', 'Scale device is not connected.'));
      }
      const grams = Math.max(0, Math.floor(Number(data?.grams) || 0));
      const source = String(data?.source || '').trim();
      const suffix = source ? ` (${source})` : '';
      showToast('success', `${tr('control.external.scaleRead', 'Scale read')}: ${grams} g${suffix}`);
    } catch (e) {
      const raw = String(e?.message || '').trim();
      const low = raw.toLowerCase();
      const looksLikePortAccessError =
        low.includes('access denied') ||
        low.includes('permission denied') ||
        low.includes('ebusy') ||
        low.includes('opening \\\\.\\com');
      if (looksLikePortAccessError) {
        const portLabel = String(scalePort || '').trim();
        showToast(
          'error',
          tr(
            'control.external.scalePortBusy',
            `Scale port${portLabel ? ` ${portLabel}` : ''} is busy or access denied. Close other apps and select the correct COM port.`
          )
        );
      } else {
        showToast('error', raw || tr('control.external.scaleReadFailed', 'Scale read failed.'));
      }
    } finally {
      setTestingScale(false);
    }
  };

  const handleSaveCashmatic = async () => {
    setSavingCashmatic(true);
    try {
      const trimmedUsername = String(cashmaticUsername || '').trim();
      const trimmedPassword = String(cashmaticPassword || '').trim();
      const trimmedIp = String(cashmaticIpAddress || '').trim();
      const trimmedUrl = String(cashmaticUrl || '').trim();
      const trimmedPort = String(cashmaticPort || '').trim();
      const resolvedPort = trimmedPort || '50301';
      const validPort = Number.parseInt(resolvedPort, 10);
      if (!trimmedUsername || !trimmedPassword) {
        throw new Error('Cashmatic username and password are required.');
      }
      if (cashmaticConnectionType === 'tcp' && !trimmedIp) {
        throw new Error('Cashmatic IP address is required for TCP/IP.');
      }
      if (cashmaticConnectionType === 'tcp' && /^[0-9]+$/.test(trimmedIp)) {
        throw new Error('Cashmatic IP address is invalid. Please enter a full IP like 192.168.1.60.');
      }
      if (cashmaticConnectionType === 'api' && !trimmedUrl && !trimmedIp) {
        throw new Error('Cashmatic URL or IP address is required for API mode.');
      }
      if (!Number.isInteger(validPort) || validPort < 1 || validPort > 65535) {
        throw new Error('Cashmatic port must be a number between 1 and 65535.');
      }

      const connectionConfig = cashmaticConnectionType === 'api'
        ? {
          url: trimmedUrl,
          ip: trimmedIp,
          port: resolvedPort,
          username: trimmedUsername,
          password: trimmedPassword,
        }
        : {
          ip: trimmedIp,
          port: resolvedPort,
          username: trimmedUsername,
          password: trimmedPassword,
        };

      const terminalPayload = {
        name: String(cashmaticName || '').trim() || 'Cashmatic Terminal',
        type: 'cashmatic',
        connection_type: cashmaticConnectionType === 'api' ? 'api' : 'tcp',
        connection_string: JSON.stringify(connectionConfig),
        enabled: 1,
        is_main: 1,
      };

      let terminalId = cashmaticTerminalId;
      if (!terminalId) {
        const listRes = await fetch(`${API}/payment-terminals`);
        const listData = await listRes.json().catch(() => null);
        const list = Array.isArray(listData?.data) ? listData.data : (Array.isArray(listData) ? listData : []);
        const existing = list.find((t) => String(t?.type || '').toLowerCase() === 'cashmatic');
        if (existing?.id) terminalId = existing.id;
      }

      const endpoint = terminalId ? `${API}/payment-terminals/${terminalId}` : `${API}/payment-terminals`;
      const method = terminalId ? 'PUT' : 'POST';
      const saveRes = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(terminalPayload),
      });
      const saved = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) {
        throw new Error(saved?.error || `Failed to save Cashmatic terminal (HTTP ${saveRes.status})`);
      }
      if (saved?.id) setCashmaticTerminalId(saved.id);

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('pos_cashmatic', JSON.stringify({
          name: terminalPayload.name,
          connectionType: cashmaticConnectionType,
          ip: connectionConfig.ip,
          port: connectionConfig.port,
          username: connectionConfig.username,
          password: connectionConfig.password,
          url: connectionConfig.url || '',
          ipPort: `${connectionConfig.ip}${connectionConfig.port ? `:${connectionConfig.port}` : ''}`,
        }));
      }
      showToast('success', 'Cashmatic settings saved.');
    } catch (err) {
      showToast('error', err?.message || 'Failed to save Cashmatic settings.');
    } finally {
      setSavingCashmatic(false);
    }
  };

  const handleSavePayworld = async () => {
    setSavingPayworld(true);
    try {
      const trimmedIp = String(payworldIpAddress || '').trim();
      const trimmedPort = String(payworldPort || '').trim();
      const resolvedPort = trimmedPort || '5015';
      const validPort = Number.parseInt(resolvedPort, 10);
      if (!trimmedIp) {
        throw new Error('Payworld IP address is required.');
      }
      if (/^[0-9]+$/.test(trimmedIp)) {
        throw new Error('Payworld IP address is invalid. Please enter a full IP like 192.168.1.60.');
      }
      if (!Number.isInteger(validPort) || validPort < 1 || validPort > 65535) {
        throw new Error('Payworld port must be a number between 1 and 65535.');
      }
      const connectionConfig = { ip: trimmedIp, port: resolvedPort };
      const terminalPayload = {
        name: String(payworldName || '').trim() || 'Payworld Terminal',
        type: 'payworld',
        connection_type: 'tcp',
        connection_string: JSON.stringify(connectionConfig),
        enabled: 1,
        is_main: 1,
      };
      let terminalId = payworldTerminalId;
      if (!terminalId) {
        const listRes = await fetch(`${API}/payment-terminals`);
        const listData = await listRes.json().catch(() => null);
        const list = Array.isArray(listData?.data) ? listData.data : (Array.isArray(listData) ? listData : []);
        const existing = list.find((t) => String(t?.type || '').toLowerCase() === 'payworld');
        if (existing?.id) terminalId = existing.id;
      }
      const endpoint = terminalId ? `${API}/payment-terminals/${terminalId}` : `${API}/payment-terminals`;
      const method = terminalId ? 'PUT' : 'POST';
      const saveRes = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(terminalPayload),
      });
      const saved = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) {
        throw new Error(saved?.error || `Failed to save Payworld terminal (HTTP ${saveRes.status})`);
      }
      if (saved?.id) setPayworldTerminalId(saved.id);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('pos_payworld', JSON.stringify({
          name: terminalPayload.name,
          ip: connectionConfig.ip,
          port: connectionConfig.port,
        }));
      }
      showToast('success', 'Payworld settings saved.');
    } catch (err) {
      showToast('error', err?.message || 'Failed to save Payworld settings.');
    } finally {
      setSavingPayworld(false);
    }
  };

  const handleSaveCcv = async () => {
    setSavingCcv(true);
    try {
      const trimmedIp = String(ccvIpAddress || '').trim();
      const trimmedCommandPort = String(ccvCommandPort || '').trim() || '4100';
      const trimmedDevicePort = String(ccvDevicePort || '').trim() || '4102';
      const trimmedWorkstationId = String(ccvWorkstationId || '').trim() || 'POS';
      const commandPort = Number.parseInt(trimmedCommandPort, 10);
      const devicePort = Number.parseInt(trimmedDevicePort, 10);
      if (!trimmedIp) throw new Error('CCV IP address is required.');
      if (/^[0-9]+$/.test(trimmedIp)) {
        throw new Error('CCV IP address is invalid. Please enter a full IP like 192.168.1.60.');
      }
      if (!Number.isInteger(commandPort) || commandPort < 1 || commandPort > 65535) {
        throw new Error('CCV command port must be a number between 1 and 65535.');
      }
      if (!Number.isInteger(devicePort) || devicePort < 1 || devicePort > 65535) {
        throw new Error('CCV device port must be a number between 1 and 65535.');
      }

      const connectionConfig = {
        ip: trimmedIp,
        commandPort: String(commandPort),
        devicePort: String(devicePort),
        workstationId: trimmedWorkstationId,
      };
      const terminalPayload = {
        name: String(ccvName || '').trim() || 'CCV Terminal',
        type: 'ccv',
        connection_type: 'tcp',
        connection_string: JSON.stringify(connectionConfig),
        enabled: 1,
        is_main: 1,
      };

      let terminalId = ccvTerminalId;
      if (!terminalId) {
        const listRes = await fetch(`${API}/payment-terminals`);
        const listData = await listRes.json().catch(() => null);
        const list = Array.isArray(listData?.data) ? listData.data : (Array.isArray(listData) ? listData : []);
        const existing = list.find((t) => ['ccv'].includes(String(t?.type || '').toLowerCase()));
        if (existing?.id) terminalId = existing.id;
      }
      const endpoint = terminalId ? `${API}/payment-terminals/${terminalId}` : `${API}/payment-terminals`;
      const method = terminalId ? 'PUT' : 'POST';
      const saveRes = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(terminalPayload),
      });
      const saved = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) {
        throw new Error(saved?.error || `Failed to save CCV terminal (HTTP ${saveRes.status})`);
      }
      if (saved?.id) setCcvTerminalId(saved.id);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('pos_ccv', JSON.stringify({
          name: terminalPayload.name,
          ip: connectionConfig.ip,
          commandPort: connectionConfig.commandPort,
          devicePort: connectionConfig.devicePort,
          workstationId: connectionConfig.workstationId,
        }));
      }
      showToast('success', 'CCV settings saved.');
    } catch (err) {
      showToast('error', err?.message || 'Failed to save CCV settings.');
    } finally {
      setSavingCcv(false);
    }
  };

  const handleSaveViva = async () => {
    setSavingViva(true);
    try {
      const trimmedIp = String(vivaIpAddress || '').trim();
      const trimmedPort = String(vivaPort || '').trim();
      const resolvedPort = trimmedPort || '5015';
      const validPort = Number.parseInt(resolvedPort, 10);
      if (!trimmedIp) {
        throw new Error('Viva IP address is required.');
      }
      if (/^[0-9]+$/.test(trimmedIp)) {
        throw new Error('Viva IP address is invalid. Please enter a full IP like 192.168.1.60.');
      }
      if (!Number.isInteger(validPort) || validPort < 1 || validPort > 65535) {
        throw new Error('Viva port must be a number between 1 and 65535.');
      }
      const connectionConfig = { ip: trimmedIp, port: resolvedPort };
      const terminalPayload = {
        name: String(vivaName || '').trim() || 'Viva Terminal',
        type: 'viva',
        connection_type: 'tcp',
        connection_string: JSON.stringify(connectionConfig),
        enabled: 1,
        is_main: 1,
      };
      let terminalId = vivaTerminalId;
      if (!terminalId) {
        const listRes = await fetch(`${API}/payment-terminals`);
        const listData = await listRes.json().catch(() => null);
        const list = Array.isArray(listData?.data) ? listData.data : (Array.isArray(listData) ? listData : []);
        const existing = list.find((t) => ['viva', 'viva-wallet'].includes(String(t?.type || '').toLowerCase()));
        if (existing?.id) terminalId = existing.id;
      }
      const endpoint = terminalId ? `${API}/payment-terminals/${terminalId}` : `${API}/payment-terminals`;
      const method = terminalId ? 'PUT' : 'POST';
      const saveRes = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(terminalPayload),
      });
      const saved = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) {
        throw new Error(saved?.error || `Failed to save Viva terminal (HTTP ${saveRes.status})`);
      }
      if (saved?.id) setVivaTerminalId(saved.id);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('pos_viva', JSON.stringify({
          name: terminalPayload.name,
          ip: connectionConfig.ip,
          port: connectionConfig.port,
        }));
      }
      showToast('success', 'Viva settings saved.');
    } catch (err) {
      showToast('error', err?.message || 'Failed to save Viva settings.');
    } finally {
      setSavingViva(false);
    }
  };

  const handleSaveWorldline = async () => {
    setSavingWorldline(true);
    try {
      const trimmedIp = String(worldlineIpAddress || '').trim();
      const trimmedPort = String(worldlinePort || '').trim();
      const resolvedPort = trimmedPort || '9001';
      const validPort = Number.parseInt(resolvedPort, 10);
      if (!Number.isInteger(validPort) || validPort < 1 || validPort > 65535) {
        throw new Error('Worldline port must be a number between 1 and 65535.');
      }
      if (!worldlineTerminalConnectsToPos) {
        if (!trimmedIp) {
          throw new Error('Worldline terminal IP is required when the POS connects to the terminal.');
        }
        if (/^[0-9]+$/.test(trimmedIp)) {
          throw new Error('Worldline terminal IP is invalid. Please enter a full IP like 192.168.1.60.');
        }
      }

      let merged = {};
      try {
        const listRes = await fetch(`${API}/payment-terminals`);
        const listData = await listRes.json().catch(() => null);
        const list = Array.isArray(listData?.data) ? listData.data : (Array.isArray(listData) ? listData : []);
        const existingWl = list.find((t) => String(t?.type || '').toLowerCase() === 'worldline');
        if (existingWl?.connection_string) {
          try {
            merged = typeof existingWl.connection_string === 'string'
              ? JSON.parse(existingWl.connection_string)
              : (existingWl.connection_string || {});
          } catch (_) {
            merged = {};
          }
        }
      } catch (_) { }

      const connectionConfig = {
        ...merged,
        model: 'RX5000',
        protocol: 'ctep',
        simulate: !!worldlineSimulate,
        terminalConnectsToPos: !!worldlineTerminalConnectsToPos,
        listenHost: '0.0.0.0',
        port: resolvedPort,
      };
      if (worldlineTerminalConnectsToPos) {
        delete connectionConfig.ip;
      } else {
        connectionConfig.ip = trimmedIp;
      }
      const terminalPayload = {
        name: String(worldlineName || '').trim() || 'Worldline Terminal',
        type: 'worldline',
        connection_type: 'tcp',
        connection_string: JSON.stringify(connectionConfig),
        enabled: 1,
        is_main: 1,
      };
      let terminalId = worldlineTerminalId;
      if (!terminalId) {
        const listRes = await fetch(`${API}/payment-terminals`);
        const listData = await listRes.json().catch(() => null);
        const list = Array.isArray(listData?.data) ? listData.data : (Array.isArray(listData) ? listData : []);
        const existing = list.find((t) => String(t?.type || '').toLowerCase() === 'worldline');
        if (existing?.id) terminalId = existing.id;
      }
      const endpoint = terminalId ? `${API}/payment-terminals/${terminalId}` : `${API}/payment-terminals`;
      const method = terminalId ? 'PUT' : 'POST';
      const saveRes = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(terminalPayload),
      });
      const saved = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) {
        throw new Error(saved?.error || `Failed to save Worldline terminal (HTTP ${saveRes.status})`);
      }
      if (saved?.id) setWorldlineTerminalId(saved.id);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('pos_worldline', JSON.stringify({
          name: terminalPayload.name,
          ip: connectionConfig.ip,
          port: connectionConfig.port,
          simulate: !!worldlineSimulate,
          terminalConnectsToPos: !!worldlineTerminalConnectsToPos,
        }));
      }
      showToast('success', 'Worldline settings saved.');
    } catch (err) {
      showToast('error', err?.message || 'Failed to save Worldline settings.');
    } finally {
      setSavingWorldline(false);
    }
  };

  const handleSaveBancontactPro = async () => {
    setSavingBancontactPro(true);
    try {
      const apiKey = String(bancontactProApiKey || '').trim();
      if (!apiKey) {
        throw new Error('Bancontact Pro API key is required.');
      }
      const callbackTrim = String(bancontactProCallbackUrl || '').trim();
      const connectionConfig = {
        apiKey,
        sandbox: !!bancontactProSandbox,
        ...(callbackTrim ? { callbackUrl: callbackTrim } : {}),
      };
      const terminalPayload = {
        name: String(bancontactProName || '').trim() || 'Bancontact Pro QR',
        type: 'bancontact_pro',
        connection_type: 'https',
        connection_string: JSON.stringify(connectionConfig),
        enabled: 1,
        is_main: 1,
      };
      let terminalId = bancontactProTerminalId;
      if (!terminalId) {
        const listRes = await fetch(`${API}/payment-terminals`);
        const listData = await listRes.json().catch(() => null);
        const list = Array.isArray(listData?.data) ? listData.data : (Array.isArray(listData) ? listData : []);
        const existing = list.find((t) => String(t?.type || '').toLowerCase() === 'bancontact_pro');
        if (existing?.id) terminalId = existing.id;
      }
      const endpoint = terminalId ? `${API}/payment-terminals/${terminalId}` : `${API}/payment-terminals`;
      const method = terminalId ? 'PUT' : 'POST';
      const saveRes = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(terminalPayload),
      });
      const saved = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) {
        throw new Error(saved?.error || `Failed to save Bancontact Pro terminal (HTTP ${saveRes.status})`);
      }
      if (saved?.id) setBancontactProTerminalId(saved.id);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('pos_bancontact_pro', JSON.stringify({
          name: terminalPayload.name,
          sandbox: !!bancontactProSandbox,
          hasApiKey: true,
        }));
      }
      showToast('success', 'Bancontact Pro QR settings saved.');
    } catch (err) {
      showToast('error', err?.message || 'Failed to save Bancontact Pro settings.');
    } finally {
      setSavingBancontactPro(false);
    }
  };

  const cashmaticKeyboardValue =
    cashmaticActiveField === 'name' ? cashmaticName
      : cashmaticActiveField === 'ip' ? cashmaticIpAddress
        : cashmaticActiveField === 'port' ? cashmaticPort
          : cashmaticActiveField === 'username' ? cashmaticUsername
            : cashmaticActiveField === 'password' ? cashmaticPassword
              : cashmaticActiveField === 'url' ? cashmaticUrl
                : '';

  const cashmaticKeyboardOnChange = (v) => {
    if (cashmaticActiveField === 'name') setCashmaticName(v);
    else if (cashmaticActiveField === 'ip') setCashmaticIpAddress(v);
    else if (cashmaticActiveField === 'port') setCashmaticPort(v);
    else if (cashmaticActiveField === 'username') setCashmaticUsername(v);
    else if (cashmaticActiveField === 'password') setCashmaticPassword(v);
    else if (cashmaticActiveField === 'url') setCashmaticUrl(v);
  };

  const payworldKeyboardValue =
    payworldActiveField === 'name' ? payworldName
      : payworldActiveField === 'ip' ? payworldIpAddress
        : payworldActiveField === 'port' ? payworldPort
          : '';

  const payworldKeyboardOnChange = (v) => {
    if (payworldActiveField === 'name') setPayworldName(v);
    else if (payworldActiveField === 'ip') setPayworldIpAddress(v);
    else if (payworldActiveField === 'port') setPayworldPort(v);
  };

  const vivaKeyboardValue =
    vivaActiveField === 'name' ? vivaName
      : vivaActiveField === 'ip' ? vivaIpAddress
        : vivaActiveField === 'port' ? vivaPort
          : '';

  const vivaKeyboardOnChange = (v) => {
    if (vivaActiveField === 'name') setVivaName(v);
    else if (vivaActiveField === 'ip') setVivaIpAddress(v);
    else if (vivaActiveField === 'port') setVivaPort(v);
  };

  const worldlineKeyboardValue =
    worldlineActiveField === 'name' ? worldlineName
      : worldlineActiveField === 'ip' && !worldlineTerminalConnectsToPos ? worldlineIpAddress
        : worldlineActiveField === 'port' ? worldlinePort
          : '';

  const worldlineKeyboardOnChange = (v) => {
    if (worldlineActiveField === 'name') setWorldlineName(v);
    else if (worldlineActiveField === 'ip' && !worldlineTerminalConnectsToPos) setWorldlineIpAddress(v);
    else if (worldlineActiveField === 'port') setWorldlinePort(v);
  };

  const bancontactProKeyboardValue =
    bancontactProActiveField === 'name' ? bancontactProName
      : bancontactProActiveField === 'apiKey' ? bancontactProApiKey
        : bancontactProActiveField === 'callback' ? bancontactProCallbackUrl
          : '';

  const bancontactProKeyboardOnChange = (v) => {
    if (bancontactProActiveField === 'name') setBancontactProName(v);
    else if (bancontactProActiveField === 'apiKey') setBancontactProApiKey(v);
    else if (bancontactProActiveField === 'callback') setBancontactProCallbackUrl(v);
  };

  const ccvKeyboardValue =
    ccvActiveField === 'name' ? ccvName
      : ccvActiveField === 'ip' ? ccvIpAddress
        : ccvActiveField === 'commandPort' ? ccvCommandPort
          : ccvActiveField === 'devicePort' ? ccvDevicePort
            : ccvActiveField === 'workstationId' ? ccvWorkstationId
              : '';

  const ccvKeyboardOnChange = (v) => {
    if (ccvActiveField === 'name') setCcvName(v);
    else if (ccvActiveField === 'ip') setCcvIpAddress(v);
    else if (ccvActiveField === 'commandPort') setCcvCommandPort(v);
    else if (ccvActiveField === 'devicePort') setCcvDevicePort(v);
    else if (ccvActiveField === 'workstationId') setCcvWorkstationId(v);
  };

  const setReportSetting = (rowId, column, value) => {
    setReportSettings((prev) => ({
      ...prev,
      [rowId]: { ...prev[rowId], [column]: value }
    }));
  };

  const handleSaveReportSettings = () => {
    setSavingReportSettings(true);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('pos_report_settings', JSON.stringify(reportSettings));
      }
      showToast('success', tr('control.saved', 'Saved.'));
    } catch (e) {
      showToast('error', e?.message || tr('control.saveFailed', 'Save failed.'));
    } finally {
      setSavingReportSettings(false);
    }
  };

  const openNewUserModal = () => {
    setEditingUserId(null);
    setUserName('');
    setUserPin('');
    setUserRole('waiter');
    setUserModalTab('general');
    setUserAvatarColorIndex(0);
    setUserModalActiveField(null);
    setUserPrivileges({ ...DEFAULT_USER_PRIVILEGES });
    setShowUserModal(true);
  };

  const openEditUserModal = async (u) => {
    setEditingUserId(u.id);
    setUserName(u.name || '');
    setUserPin('');
    setUserRole(u?.role === 'admin' ? 'admin' : 'waiter');
    setUserModalTab('general');
    setUserAvatarColorIndex(0);
    setUserModalActiveField(null);
    setUserPrivileges({ ...DEFAULT_USER_PRIVILEGES });
    try {
      const res = await fetch(`${API}/users/${u.id}`, {
        headers: { ...posTerminalAuthHeaders() },
      });
      const data = await res.json();
      if (res.ok && data) {
        setUserName(data.name || '');
        setUserPin(data.pin != null ? String(data.pin) : '');
        setUserRole(data.role === 'admin' ? 'admin' : 'waiter');
      } else {
        showToast('error', data?.error || 'Failed to load user details');
      }
    } catch {
      showToast('error', 'Failed to load user details');
    }
    setShowUserModal(true);
  };

  const closeUserModal = () => {
    setShowUserModal(false);
    setEditingUserId(null);
    setUserName('');
    setUserPin('');
    setUserRole('waiter');
    setUserModalTab('general');
    setUserAvatarColorIndex(0);
    setUserModalActiveField(null);
    setUserPrivileges({ ...DEFAULT_USER_PRIVILEGES });
  };

  const handleSaveUser = async () => {
    const normalizedPin = String(userPin ?? '').replace(/\D/g, '').slice(0, 4);
    if (!editingUserId && normalizedPin.length !== 4) {
      showToast('error', 'PIN must be exactly 4 digits');
      return;
    }
    if (editingUserId && normalizedPin !== '' && normalizedPin.length !== 4) {
      showToast('error', 'PIN must be exactly 4 digits');
      return;
    }
    setSavingUser(true);
    try {
      if (editingUserId) {
        const body = { name: userName.trim() || 'New user', role: userRole === 'admin' ? 'admin' : 'waiter' };
        if (normalizedPin !== '') body.pin = normalizedPin;
        const res = await fetch(`${API}/users/${editingUserId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...posTerminalAuthHeaders() },
          body: JSON.stringify(body)
        });
        const updated = await res.json().catch(() => ({}));
        if (res.ok && updated) {
          setUsers((prev) => prev.map((u) => (u.id === editingUserId ? { ...u, ...updated } : u)));
          closeUserModal();
          fetchUsers();
        } else {
          showToast('error', updated?.error || 'Failed to update user');
        }
      } else {
        const resolvedRegisterId = await resolveCurrentRegisterIdForUserWrite();
        const res = await fetch(`${API}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...posTerminalAuthHeaders() },
          body: JSON.stringify({
            name: userName.trim() || 'New user',
            pin: normalizedPin || '1234',
            role: userRole === 'admin' ? 'admin' : 'waiter',
            registerId: resolvedRegisterId || undefined,
            registerName: String(currentRegisterName || '').trim() || undefined,
          })
        });
        const created = await res.json().catch(() => ({}));
        if (res.ok && created) {
          setUsers((prev) => [...prev, created].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
          closeUserModal();
          fetchUsers();
        } else {
          showToast('error', created?.error || 'Failed to create user');
        }
      }
    } catch {
      showToast('error', 'Failed to save user');
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (id) => {
    try {
      const res = await fetch(`${API}/users/${id}`, {
        method: 'DELETE',
        headers: { ...posTerminalAuthHeaders() },
      });
      if (res.ok) setUsers((prev) => prev.filter((u) => u.id !== id));
      else fetchUsers();
    } catch {
      fetchUsers();
    }
    setDeleteConfirmUserId(null);
  };

  const parseLegacyDiscounts = () => {
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem('pos_discounts');
      if (!raw) return [];
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  };

  const normalizeDiscountFromApi = (d) => {
    let targetIds = [];
    try {
      targetIds = d?.targetIdsJson ? JSON.parse(d.targetIdsJson) : [];
    } catch (_) {
      targetIds = [];
    }
    return {
      id: d.id,
      name: d.name || '',
      trigger: d.trigger || 'number',
      type: d.type || 'amount',
      value: d.value != null ? String(d.value) : '',
      startDate: d.startDate || '',
      endDate: d.endDate || '',
      discountOn: d.discountOn || 'products',
      targetId: targetIds[0] || '',
      targetIds,
      pieces: d.pieces != null ? String(d.pieces) : '',
      combinable: !!d.combinable
    };
  };

  const buildDiscountApiPayload = (discount) => ({
    name: discount.name || 'New discount',
    trigger: discount.trigger || 'number',
    type: discount.type || 'amount',
    value: discount.value != null && String(discount.value).trim() !== '' ? String(discount.value) : null,
    startDate: discount.startDate || null,
    endDate: discount.endDate || null,
    discountOn: discount.discountOn || 'products',
    pieces: discount.pieces != null && String(discount.pieces).trim() !== '' ? String(discount.pieces) : null,
    combinable: !!discount.combinable,
    targetIds: Array.isArray(discount.targetIds) ? discount.targetIds.filter(Boolean) : []
  });

  const syncLegacyDiscountsToApi = async (legacyList) => {
    if (!Array.isArray(legacyList) || legacyList.length === 0) return;
    await Promise.allSettled(
      legacyList.map((d) =>
        fetch(`${API}/discounts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildDiscountApiPayload(d))
        })
      )
    );
  };

  const fetchDiscounts = useCallback(async (opts = {}) => {
    const pollOnly = opts.pollOnly === true;
    try {
      const res = await fetch(`${API}/discounts`);
      const data = await res.json().catch(() => []);
      if (res.ok && Array.isArray(data)) {
        const list = data.map(normalizeDiscountFromApi);
        setDiscounts(list);
        if (typeof localStorage !== 'undefined') localStorage.setItem('pos_discounts', JSON.stringify(list));
        if (data.length > 0 || pollOnly) return;
      }
      if (pollOnly) {
        setDiscounts(Array.isArray(data) ? data.map(normalizeDiscountFromApi) : []);
        return;
      }
      const legacy = parseLegacyDiscounts();
      if (legacy.length > 0) {
        await syncLegacyDiscountsToApi(legacy);
        const retryRes = await fetch(`${API}/discounts`);
        const retryData = await retryRes.json().catch(() => []);
        if (retryRes.ok && Array.isArray(retryData)) {
          const list = retryData.map(normalizeDiscountFromApi);
          setDiscounts(list);
          if (typeof localStorage !== 'undefined') localStorage.setItem('pos_discounts', JSON.stringify(list));
          return;
        }
      }
      setDiscounts(Array.isArray(data) ? data.map(normalizeDiscountFromApi) : []);
    } catch {
      if (!pollOnly) setDiscounts(parseLegacyDiscounts());
    }
  }, []);

  useEffect(() => {
    if (topNavId !== 'categories-products' || subNavId !== 'Discounts') return;
    void fetchDiscounts();
  }, [topNavId, subNavId, fetchDiscounts]);

  useEffect(() => {
    if (topNavId !== 'categories-products' || subNavId !== 'Discounts') return undefined;
    const timer = window.setInterval(() => {
      void fetchDiscounts({ pollOnly: true });
    }, 2500);
    return () => window.clearInterval(timer);
  }, [topNavId, subNavId, fetchDiscounts]);

  useEffect(() => {
    if (!showDiscountModal) return;
    let alive = true;
    const loadProductsForDiscounts = async () => {
      const normalizeOptions = (list) => {
        const seen = new Set();
        return list
          .filter((p) => p && p.id != null)
          .map((p) => ({ value: p.id, label: p.name || `#${p.id}` }))
          .filter((opt) => {
            const key = String(opt.value);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .sort((a, b) => (a.label || '').localeCompare(b.label || ''));
      };
      // Load through categories endpoints to avoid /api/products 404 noise
      try {
        const categoriesRes = await fetch(`${API}/categories`);
        const categoriesData = await categoriesRes.json();
        const cats = Array.isArray(categoriesData) ? categoriesData : [];
        const settled = await Promise.allSettled(
          cats
            .filter((c) => c?.id != null)
            .map((c) =>
              fetch(`${API}/categories/${c.id}/products`)
                .then((r) => (r.ok ? r.json() : []))
                .catch(() => [])
            )
        );
        if (!alive) return;
        const merged = settled
          .filter((x) => x.status === 'fulfilled')
          .flatMap((x) => (Array.isArray(x.value) ? x.value : []));
        setDiscountProductOptions(normalizeOptions(merged));
      } catch {
        if (alive) setDiscountProductOptions([]);
      }
    };
    loadProductsForDiscounts();
    return () => { alive = false; };
  }, [showDiscountModal]);

  const openNewDiscountModal = () => {
    setEditingDiscountId(null);
    setDiscountName('');
    setDiscountTrigger('number');
    setDiscountType('amount');
    setDiscountValue('');
    const today = new Date().toISOString().slice(0, 10);
    setDiscountStartDate(today);
    setDiscountEndDate(today);
    setDiscountOn('products');
    setDiscountTargetId('');
    setDiscountTargetIds([]);
    setDiscountPieces('');
    setDiscountCombinable(false);
    setDiscountKeyboardValue('');
    setShowDiscountModal(true);
  };

  const openEditDiscountModal = (d) => {
    setEditingDiscountId(d.id);
    setDiscountName(d.name || '');
    setDiscountTrigger(d.trigger || 'number');
    setDiscountType(d.type || 'amount');
    setDiscountValue(String(d.value ?? ''));
    setDiscountStartDate(d.startDate || '');
    setDiscountEndDate(d.endDate || '');
    setDiscountOn(d.discountOn || 'products');
    const ids = Array.isArray(d.targetIds) ? d.targetIds.filter(Boolean) : (d.targetId ? [d.targetId] : []);
    setDiscountTargetIds(ids);
    setDiscountTargetId('');
    setDiscountPieces(String(d.pieces ?? ''));
    setDiscountCombinable(!!d.combinable);
    setDiscountKeyboardValue('');
    setShowDiscountModal(true);
  };

  const closeDiscountModal = () => {
    setShowDiscountModal(false);
    setEditingDiscountId(null);
    setDiscountName('');
    setDiscountTargetId('');
    setDiscountTargetIds([]);
    setDiscountKeyboardValue('');
    setDiscountCalendarField(null);
  };

  const persistDiscounts = (list) => {
    setDiscounts(list);
    if (typeof localStorage !== 'undefined') localStorage.setItem('pos_discounts', JSON.stringify(list));
  };

  const handleSaveDiscount = async () => {
    setSavingDiscount(true);
    try {
      const payload = {
        id: editingDiscountId || '',
        name: discountName.trim() || 'New discount',
        trigger: discountTrigger,
        type: discountType,
        value: discountValue.trim(),
        startDate: discountStartDate,
        endDate: discountEndDate,
        discountOn,
        targetId: discountTargetIds[0] || '',
        targetIds: discountTargetIds,
        pieces: discountPieces.trim(),
        combinable: discountCombinable
      };
      const apiPayload = buildDiscountApiPayload(payload);
      if (editingDiscountId) {
        const res = await fetch(`${API}/discounts/${editingDiscountId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiPayload)
        });
        if (!res.ok) {
          const message = await res.text().catch(() => '');
          throw new Error(message || 'Failed to update discount');
        }
      } else {
        const res = await fetch(`${API}/discounts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiPayload)
        });
        if (!res.ok) {
          const message = await res.text().catch(() => '');
          throw new Error(message || 'Failed to create discount');
        }
      }
      await fetchDiscounts();
      closeDiscountModal();
      showToast('success', editingDiscountId ? 'Discount updated.' : 'Discount created.');
    } catch (e) {
      showToast('error', e?.message || 'Failed to save discount.');
    } finally {
      setSavingDiscount(false);
    }
  };

  const handleDeleteDiscount = async (id) => {
    try {
      const res = await fetch(`${API}/discounts/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const message = await res.text().catch(() => '');
        throw new Error(message || 'Failed to delete discount');
      }
      await fetchDiscounts();
      showToast('success', 'Discount deleted.');
    } catch (e) {
      showToast('error', e?.message || 'Failed to delete discount.');
    }
    setDeleteConfirmDiscountId(null);
  };

  const fetchKitchens = useCallback(async () => {
    try {
      const res = await fetch(`${API}/kitchens`);
      const data = await res.json().catch(() => []);
      if (!res.ok) return;
      const list = Array.isArray(data) ? data : [];
      setKitchens(list.filter((k) => k?.id !== KITCHEN_ADMIN_CREDENTIAL_ID));
    } catch {
      setKitchens([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadSavedPositioningLayout = async () => {
      try {
        const res = await fetch(`${API}/settings/product-positioning-layout`);
        const data = await res.json().catch(() => null);
        const value = data?.value;
        if (!cancelled && value && typeof value === 'object') {
          setPositioningLayoutByCategory(value);
          return;
        }
      } catch {
        // fallback to local draft when api is unavailable
      }
      try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('pos_product_positioning_layout') : null;
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') setPositioningLayoutByCategory(parsed);
        }
      } catch {
        // ignore broken local positioning data
      }
    };
    const loadSavedPositioningColors = async () => {
      try {
        const res = await fetch(`${API}/settings/product-positioning-colors`);
        const data = await res.json().catch(() => null);
        const value = data?.value;
        if (!cancelled && value && typeof value === 'object') {
          setPositioningColorByCategory(value);
          return;
        }
      } catch {
        // fallback to local draft when api is unavailable
      }
      try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('pos_product_positioning_colors') : null;
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') setPositioningColorByCategory(parsed);
        }
      } catch {
        // ignore broken local color data
      }
    };
    (async () => {
      try {
        const [, , categoriesList, , subproductGroupsList] = await Promise.all([
          fetchPaymentTypes(),
          fetchPriceGroups(),
          fetchCategories(),
          fetchUsers(),
          fetchSubproductGroups(),
          fetchKitchens(),
          fetchPrintersFromDb(),
          loadSavedPositioningLayout(),
          loadSavedPositioningColors()
        ]);

        const safeCats = Array.isArray(categoriesList) ? categoriesList : [];
        const safeGroups = Array.isArray(subproductGroupsList) ? subproductGroupsList : [];

        await Promise.all(
          safeGroups.map(async (g) => {
            if (cancelled || !g?.id) return;
            try {
              const res = await fetch(`${API}/subproduct-groups/${g.id}/subproducts`);
              await res.json().catch(() => []);
            } catch {
              // ignore
            }
          })
        );

        if (cancelled) return;

        const productsPerCategory = await Promise.all(
          safeCats.map(async (cat) => {
            if (cancelled || !cat?.id) return [];
            try {
              const res = await fetch(`${API}/categories/${cat.id}/products`);
              const data = await res.json();
              return Array.isArray(data) ? data : [];
            } catch {
              return [];
            }
          })
        );

        if (cancelled) return;

        const allProductIds = [
          ...new Set(
            productsPerCategory
              .flat()
              .map((p) => p?.id)
              .filter((id) => id != null)
          )
        ];

        const linkPairs = await Promise.all(
          allProductIds.map(async (id) => {
            if (cancelled) return null;
            try {
              const res = await fetch(`${API}/products/${id}/subproduct-links`);
              const data = await res.json().catch(() => ({}));
              const links = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
              return [id, links.length > 0];
            } catch {
              return [id, false];
            }
          })
        );

        if (cancelled) return;

        const subproductFlags = {};
        for (const pair of linkPairs) {
          if (!pair) continue;
          subproductFlags[pair[0]] = pair[1];
        }
        if (Object.keys(subproductFlags).length > 0) {
          setProductHasSubproductsById((prev) => ({ ...prev, ...subproductFlags }));
        }
      } finally {
        if (!cancelled) setControlBootstrapReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    fetchPaymentTypes,
    fetchPriceGroups,
    fetchCategories,
    fetchUsers,
    fetchSubproductGroups,
    fetchKitchens,
    fetchPrintersFromDb
  ]);

  useEffect(() => {
    if (topNavId !== 'categories-products' || subNavId !== 'Kitchen') return;
    fetchKitchens();
  }, [topNavId, subNavId, fetchKitchens]);

  const openNewKitchenModal = () => {
    setEditingKitchenId(null);
    setKitchenModalName('');
    setShowKitchenModal(true);
  };

  const openEditKitchenModal = (m) => {
    setEditingKitchenId(m?.id ?? null);
    setKitchenModalName(m?.name || '');
    setShowKitchenModal(true);
  };

  const closeKitchenModal = () => {
    setShowKitchenModal(false);
    setEditingKitchenId(null);
    setKitchenModalName('');
  };

  const handleSaveKitchen = async () => {
    setSavingKitchen(true);
    try {
      const name = kitchenModalName.trim() || tr('control.kitchen.defaultNewName', 'New Kitchen');
      if (editingKitchenId) {
        const res = await fetch(`${API}/kitchens/${editingKitchenId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        if (!res.ok) throw new Error('save failed');
        const updated = await res.json();
        setKitchens((prev) =>
          prev
            .map((k) =>
              k.id === updated.id
                ? { ...k, id: updated.id, name: updated.name, productIds: updated.productIds ?? k.productIds ?? [] }
                : k
            )
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        );
      } else {
        const res = await fetch(`${API}/kitchens`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        if (!res.ok) throw new Error('save failed');
        const created = await res.json();
        setKitchens((prev) =>
          [...prev, { ...created, productIds: created.productIds ?? [] }].sort((a, b) =>
            (a.name || '').localeCompare(b.name || '')
          )
        );
      }
      closeKitchenModal();
    } catch {
      await fetchKitchens();
    } finally {
      setSavingKitchen(false);
    }
  };

  const handleDeleteKitchen = async (id) => {
    try {
      const res = await fetch(`${API}/kitchens/${id}`, { method: 'DELETE' });
      if (res.ok) setKitchens((prev) => prev.filter((k) => k.id !== id));
      else await fetchKitchens();
    } catch {
      await fetchKitchens();
    }
    setDeleteConfirmKitchenId(null);
  };

  const closeKitchenProductsModal = useCallback(() => {
    setShowKitchenProductsModal(false);
    setKitchenProductsKitchen(null);
    setKitchenProductsCatalog([]);
    setKitchenProductsModalCategories([]);
    setKitchenProductsCategoryFilter('');
    setKitchenProductsLinked([]);
    setKitchenProductsLeftSelectedIds(new Set());
    setKitchenProductsRightSelectedIds(new Set());
  }, []);

  const openKitchenProductsModal = useCallback(async (kitchen) => {
    if (!kitchen?.id) return;
    setKitchenProductsKitchen(kitchen);
    setKitchenProductsCategoryFilter('');
    setKitchenProductsLeftSelectedIds(new Set());
    setKitchenProductsRightSelectedIds(new Set());
    setShowKitchenProductsModal(true);
    setLoadingKitchenProductsCatalog(true);
    setKitchenProductsCatalog([]);
    setKitchenProductsModalCategories([]);
    setKitchenProductsLinked([]);
    try {
      const [catRes, prodRes] = await Promise.all([
        fetch(`${API}/categories`),
        fetch(`${API}/products/catalog`)
      ]);
      const catsRaw = await catRes.json().catch(() => []);
      const data = await prodRes.json().catch(() => []);
      const catalog = prodRes.ok && Array.isArray(data) ? data : [];
      setKitchenProductsCatalog(catalog);
      const catOpts = Array.isArray(catsRaw)
        ? catsRaw.map((c) => ({ id: c.id, name: c.name || c.id })).filter((c) => c.id)
        : [];
      setKitchenProductsModalCategories(catOpts);
      const linkedIds = Array.isArray(kitchen.productIds) ? kitchen.productIds : [];
      const linked = linkedIds.map((id) => {
        const p = catalog.find((x) => x.id === id);
        return {
          productId: id,
          productName: p?.name || id,
          categoryName: p?.categoryName || ''
        };
      });
      setKitchenProductsLinked(linked);
    } catch {
      setKitchenProductsCatalog([]);
      setKitchenProductsModalCategories([]);
    } finally {
      setLoadingKitchenProductsCatalog(false);
    }
  }, []);

  useEffect(() => {
    if (!showKitchenProductsModal) return;
    setKitchenProductsLeftSelectedIds(new Set());
  }, [showKitchenProductsModal, kitchenProductsCategoryFilter]);

  const kitchenProductsOptionsFiltered = useMemo(() => {
    if (!kitchenProductsCategoryFilter) return kitchenProductsCatalog;
    return kitchenProductsCatalog.filter((p) => p.categoryId === kitchenProductsCategoryFilter);
  }, [kitchenProductsCatalog, kitchenProductsCategoryFilter]);

  const kitchenProductsAvailable = useMemo(() => {
    const linkedIds = new Set(kitchenProductsLinked.map((l) => l.productId));
    const takenByOtherKitchen = new Set();
    const currentKitchenId = kitchenProductsKitchen?.id;
    for (const k of kitchens) {
      if (!k?.id || k.id === currentKitchenId) continue;
      for (const pid of Array.isArray(k.productIds) ? k.productIds : []) {
        if (pid) takenByOtherKitchen.add(pid);
      }
    }
    return kitchenProductsOptionsFiltered.filter(
      (p) => p?.id && !linkedIds.has(p.id) && !takenByOtherKitchen.has(p.id)
    );
  }, [kitchenProductsOptionsFiltered, kitchenProductsLinked, kitchens, kitchenProductsKitchen?.id]);

  const handleAddKitchenProductLinks = useCallback(() => {
    if (!kitchenProductsLeftSelectedIds.size) return;
    const toAdd = kitchenProductsAvailable.filter((p) => kitchenProductsLeftSelectedIds.has(p.id));
    if (!toAdd.length) return;
    setKitchenProductsLinked((prev) => {
      const existing = new Set(prev.map((l) => l.productId));
      const newRows = toAdd
        .filter((p) => !existing.has(p.id))
        .map((p) => ({
          productId: p.id,
          productName: p.name || p.id,
          categoryName: p.categoryName || ''
        }));
      return [...prev, ...newRows];
    });
    setKitchenProductsLeftSelectedIds(new Set());
  }, [kitchenProductsLeftSelectedIds, kitchenProductsAvailable]);

  const handleRemoveKitchenProductLinks = useCallback(() => {
    if (!kitchenProductsRightSelectedIds.size) return;
    setKitchenProductsLinked((prev) => prev.filter((l) => !kitchenProductsRightSelectedIds.has(l.productId)));
    setKitchenProductsRightSelectedIds(new Set());
  }, [kitchenProductsRightSelectedIds]);

  const removeKitchenProductLink = useCallback((productId) => {
    setKitchenProductsLinked((prev) => prev.filter((l) => l.productId !== productId));
  }, []);

  const handleSaveKitchenProducts = useCallback(async () => {
    if (!kitchenProductsKitchen?.id) return;
    setSavingKitchenProducts(true);
    try {
      const productIds = kitchenProductsLinked.map((l) => l.productId);
      const res = await fetch(`${API}/kitchens/${kitchenProductsKitchen.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds })
      });
      if (!res.ok) throw new Error('save failed');
      await res.json();
      await fetchKitchens();
      closeKitchenProductsModal();
    } catch {
      await fetchKitchens();
    } finally {
      setSavingKitchenProducts(false);
    }
  }, [kitchenProductsKitchen, kitchenProductsLinked, closeKitchenProductsModal, fetchKitchens]);

  return (
    <div className="relative h-full w-full min-h-0">
      <div className="flex h-full bg-pos-bg text-pos-text">
      {/* Control left sidebar */}
      <aside className="w-1/5 shrink-0 flex flex-col bg-pos-panel border-r border-pos-border">
        <nav className="flex flex-col gap-0.5 flex-1 p-3">
          {CONTROL_SIDEBAR_ITEMS.map((item) => {
            const sidebarDisabled = isWaiterControlUser && item.id !== 'language';
            return (
              <button
                key={item.id}
                type="button"
                disabled={sidebarDisabled}
                className={`flex items-center gap-3 px-2 py-3 rounded-lg text-left text-md transition-colors ${effectiveControlSidebarId === item.id
                  ? 'bg-pos-bg text-pos-text font-medium'
                  : 'text-pos-muted active:bg-green-500 active:text-pos-text'
                  } ${sidebarDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                onClick={() => {
                  if (sidebarDisabled) return;
                  setControlSidebarId(item.id);
                }}
              >
                <SidebarIcon id={item.icon} className="w-6 h-6 shrink-0" />
                {tr(`control.sidebar.${item.id}`, item.label)}
              </button>
            );
          })}
        </nav>
        <div className="p-4 w-full flex flex-col items-center gap-2">
          {currentRegisterName && (
            <p className="text-pos-text text-xl font-medium truncate px-1">{currentRegisterName}</p>
          )}
          {currentUser && (
            <p className="text-pos-text text-xl font-medium truncate px-1">{currentUser.label}</p>
          )}
          <div className="flex flex-col">
            <button
              type="button"
              className="px-3 py-1 rounded-lg text-pos-muted active:text-pos-text active:bg-green-500 text-2xl"
              onClick={() => onBack?.()}
            >
              {tr('backName', 'Back')}
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-lg text-rose-500 active:text-pos-text active:bg-green-500 text-2xl font-medium"
              onClick={() => setShowLogoutModal(true)}
            >
              {tr('logOut', 'Log out')}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <ControlViewMainContentArea
        ctx={{
          currentUser,
          currentRegisterId,
          currentRegisterName,
          realtimeSocket,
          BARCODE_SCANNER_TYPE_OPTIONS,
          CASH_REGISTER_SUB_NAV_ITEMS,
          CREDIT_CARD_TYPE_OPTIONS,
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
          controlSidebarId: effectiveControlSidebarId,
          creditCardType,
          discounts,
          setDiscounts,
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
          handleSaveCreditCard,
          handleSaveFinalTickets,
          handleSavePayworld,
          handleSaveCcv,
          handleSaveViva,
          handleSaveWorldline,
          handleSaveBancontactPro,
          handleSavePriceDisplay,
          handleSaveProductionTickets,
          handleSaveReportSettings,
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
          worldlineIpAddress,
          worldlinePort,
          worldlineTerminalConnectsToPos,
          setWorldlineTerminalConnectsToPos,
          worldlineSimulate,
          setWorldlineSimulate,
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
          handleMakePeriodicReport,
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
          savingCreditCard,
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
          setCreditCardType,
          setDefaultPrinter,
          setDeleteConfirmCategoryId,
          setDeleteConfirmDiscountId,
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
          setWorldlineActiveField,
          setWorldlineName,
          setWorldlineIpAddress,
          setWorldlinePort,
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
          usersLoading,
        }}
      />
      <DeleteConfirmModal
        open={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => handleDeletePriceGroup(deleteConfirmId)}
        message={tr('control.confirm.deletePriceGroup', 'Are you sure you want to delete this price group?')}
      />
      <DeleteConfirmModal
        open={deleteConfirmCategoryId !== null}
        onClose={() => setDeleteConfirmCategoryId(null)}
        onConfirm={() => handleDeleteCategory(deleteConfirmCategoryId)}
        message={tr('control.confirm.deleteCategory', 'Are you sure you want to delete this category?')}
      />
      <DeleteConfirmModal
        open={deleteConfirmProductId !== null}
        onClose={() => setDeleteConfirmProductId(null)}
        onConfirm={() => handleDeleteProduct(deleteConfirmProductId)}
        message={tr('control.confirm.deleteProduct', 'Are you sure you want to delete this product?')}
      />
      <DeleteConfirmModal
        open={deleteConfirmSubproductId !== null}
        onClose={() => setDeleteConfirmSubproductId(null)}
        onConfirm={() => handleDeleteSubproduct(deleteConfirmSubproductId)}
        message={tr('control.confirm.deleteSubproduct', 'Are you sure you want to delete this subproduct?')}
      />
      <DeleteConfirmModal
        open={deleteConfirmGroupId !== null}
        onClose={() => setDeleteConfirmGroupId(null)}
        onConfirm={() => handleDeleteGroup(deleteConfirmGroupId)}
        message={tr('control.confirm.deleteGroup', 'Are you sure you want to delete this group? Subproducts in it will also be deleted.')}
      />
      <DeleteConfirmModal
        open={deleteConfirmProductionMessageId !== null}
        onClose={() => setDeleteConfirmProductionMessageId(null)}
        onConfirm={() => handleDeleteProductionMessage(deleteConfirmProductionMessageId)}
        message={tr('control.confirm.deleteProductionMessage', 'Are you sure you want to delete this production message?')}
      />
      <DeleteConfirmModal
        open={deleteConfirmPaymentTypeId !== null}
        onClose={() => setDeleteConfirmPaymentTypeId(null)}
        onConfirm={() => handleDeletePaymentType(deleteConfirmPaymentTypeId)}
        message={tr('control.confirm.deletePaymentType', 'Are you sure you want to delete this payment method?')}
      />
      <DeleteConfirmModal
        open={deleteConfirmPrinterId !== null}
        onClose={() => setDeleteConfirmPrinterId(null)}
        onConfirm={() => handleDeletePrinter(deleteConfirmPrinterId)}
        message={tr('control.confirm.deletePrinter', 'Are you sure you want to delete this printer?')}
      />
      <DeleteConfirmModal
        open={deleteConfirmLabelId !== null}
        onClose={() => setDeleteConfirmLabelId(null)}
        onConfirm={() => handleDeleteLabel(deleteConfirmLabelId)}
        message={tr('control.confirm.deleteLabel', 'Are you sure you want to delete this label?')}
      />
      <DeleteConfirmModal
        open={deleteConfirmUserId !== null}
        onClose={() => setDeleteConfirmUserId(null)}
        onConfirm={() => handleDeleteUser(deleteConfirmUserId)}
        message={tr('control.confirm.deleteUser', 'Are you sure you want to delete this user?')}
      />
      <DeleteConfirmModal
        open={deleteConfirmDiscountId !== null}
        onClose={() => setDeleteConfirmDiscountId(null)}
        onConfirm={() => handleDeleteDiscount(deleteConfirmDiscountId)}
        message={tr('control.confirm.deleteDiscount', 'Are you sure you want to delete this discount?')}
      />
      <DeleteConfirmModal
        open={deleteConfirmKitchenId !== null}
        onClose={() => setDeleteConfirmKitchenId(null)}
        onConfirm={() => handleDeleteKitchen(deleteConfirmKitchenId)}
        message={tr('control.confirm.deleteKitchen', 'Are you sure you want to delete this kitchen?')}
      />

      <ControlViewUserModal
        tr={tr}
        showUserModal={showUserModal}
        closeUserModal={closeUserModal}
        userModalTab={userModalTab}
        setUserModalTab={setUserModalTab}
        userName={userName}
        setUserName={setUserName}
        userPin={userPin}
        setUserPin={setUserPin}
        userRole={userRole}
        setUserRole={setUserRole}
        userModalActiveField={userModalActiveField}
        setUserModalActiveField={setUserModalActiveField}
        userAvatarColorIndex={userAvatarColorIndex}
        setUserAvatarColorIndex={setUserAvatarColorIndex}
        userPrivileges={userPrivileges}
        setUserPrivileges={setUserPrivileges}
        savingUser={savingUser}
        handleSaveUser={handleSaveUser}
      />

      {/* New / Edit discount modal */}
      <ControlViewDiscountModal
        tr={tr}
        showDiscountModal={showDiscountModal}
        closeDiscountModal={closeDiscountModal}
        categories={categories}
        discountProductOptions={discountProductOptions}
        discountTargetIds={discountTargetIds}
        discountOn={discountOn}
        discountTargetId={discountTargetId}
        setDiscountTargetId={setDiscountTargetId}
        setDiscountTargetIds={setDiscountTargetIds}
        discountName={discountName}
        setDiscountName={setDiscountName}
        discountOnOptions={DISCOUNT_ON_OPTIONS}
        setDiscountOn={setDiscountOn}
        discountTriggerOptions={DISCOUNT_TRIGGER_OPTIONS}
        discountTrigger={discountTrigger}
        setDiscountTrigger={setDiscountTrigger}
        discountPieces={discountPieces}
        setDiscountPieces={setDiscountPieces}
        discountCombinable={discountCombinable}
        setDiscountCombinable={setDiscountCombinable}
        discountTypeOptions={DISCOUNT_TYPE_OPTIONS}
        discountType={discountType}
        setDiscountType={setDiscountType}
        discountValue={discountValue}
        setDiscountValue={setDiscountValue}
        formatDateForCurrentLanguage={formatDateForCurrentLanguage}
        discountStartDate={discountStartDate}
        discountEndDate={discountEndDate}
        setDiscountCalendarField={setDiscountCalendarField}
        discountTargetListRef={discountTargetListRef}
        updateDiscountTargetScrollState={updateDiscountTargetScrollState}
        canDiscountTargetScrollUp={canDiscountTargetScrollUp}
        canDiscountTargetScrollDown={canDiscountTargetScrollDown}
        scrollDiscountTargetByPage={scrollDiscountTargetByPage}
        savingDiscount={savingDiscount}
        handleSaveDiscount={handleSaveDiscount}
        discountKeyboardValue={discountKeyboardValue}
        setDiscountKeyboardValue={setDiscountKeyboardValue}
        discountCalendarField={discountCalendarField}
        setDiscountStartDate={setDiscountStartDate}
        setDiscountEndDate={setDiscountEndDate}
      />

      {/* Device Settings modal */}
      <ControlViewDeviceSettingsModal
        tr={tr}
        mapTranslatedOptions={mapTranslatedOptions}
        vatOptions={VAT_OPTIONS}
        printingOrderOptions={PRINTING_ORDER_OPTIONS}
        groupingReceiptOptions={GROUPING_RECEIPT_OPTIONS}
        showDeviceSettingsModal={showDeviceSettingsModal}
        closeDeviceSettingsModal={() => setShowDeviceSettingsModal(false)}
        deviceSettingsTab={deviceSettingsTab}
        onSelectDeviceSettingsTab={(tab) => {
          setDeviceSettingsTab(tab);
          setSelectedOptionButtonPoolItemId(null);
          setSelectedFunctionButtonPoolItemId(null);
        }}
        printers={printers}
        categories={categories}
        categoriesLoading={categoriesLoading}
        savingDeviceSettings={savingDeviceSettings}
        handleSaveDeviceSettings={handleSaveDeviceSettings}
        onDeviceSettingsEdited={() => { deviceSettingsHasLocalEditsRef.current = true; }}
        optionButtonItems={OPTION_BUTTON_ITEMS}
        functionButtonItems={FUNCTION_BUTTON_ITEMS}
        optionButtonSlots={optionButtonSlots}
        functionButtonSlots={functionButtonSlots}
        getOptionButtonLabel={getOptionButtonLabel}
        getFunctionButtonLabel={getFunctionButtonLabel}
        selectedOptionButtonSlotIndex={selectedOptionButtonSlotIndex}
        setSelectedOptionButtonSlotIndex={setSelectedOptionButtonSlotIndex}
        selectedOptionButtonPoolItemId={selectedOptionButtonPoolItemId}
        setSelectedOptionButtonPoolItemId={setSelectedOptionButtonPoolItemId}
        handleOptionButtonSlotClick={handleOptionButtonSlotClick}
        handleOptionButtonDragStartFromSlot={handleOptionButtonDragStartFromSlot}
        handleOptionButtonDropOnSlot={handleOptionButtonDropOnSlot}
        handleRemoveOptionButtonFromSlot={handleRemoveOptionButtonFromSlot}
        handleOptionButtonDragStart={handleOptionButtonDragStart}
        selectedFunctionButtonSlotIndex={selectedFunctionButtonSlotIndex}
        setSelectedFunctionButtonSlotIndex={setSelectedFunctionButtonSlotIndex}
        selectedFunctionButtonPoolItemId={selectedFunctionButtonPoolItemId}
        setSelectedFunctionButtonPoolItemId={setSelectedFunctionButtonPoolItemId}
        handleFunctionButtonSlotClick={handleFunctionButtonSlotClick}
        handleFunctionButtonDropOnSlot={handleFunctionButtonDropOnSlot}
        handleRemoveFunctionButtonFromSlot={handleRemoveFunctionButtonFromSlot}
        handleFunctionButtonDragStart={handleFunctionButtonDragStart}
        deviceUseSubproducts={deviceUseSubproducts}
        setDeviceUseSubproducts={setDeviceUseSubproducts}
        deviceAutoLogoutAfterTransaction={deviceAutoLogoutAfterTransaction}
        setDeviceAutoLogoutAfterTransaction={setDeviceAutoLogoutAfterTransaction}
        deviceAutoReturnToTablePlan={deviceAutoReturnToTablePlan}
        setDeviceAutoReturnToTablePlan={setDeviceAutoReturnToTablePlan}
        deviceDisableCashButtonInPayment={deviceDisableCashButtonInPayment}
        setDeviceDisableCashButtonInPayment={setDeviceDisableCashButtonInPayment}
        deviceOpenPriceWithoutPopup={deviceOpenPriceWithoutPopup}
        setDeviceOpenPriceWithoutPopup={setDeviceOpenPriceWithoutPopup}
        deviceTurnOnStockWarning={deviceTurnOnStockWarning}
        setDeviceTurnOnStockWarning={setDeviceTurnOnStockWarning}
        deviceOpenCashDrawerAfterOrder={deviceOpenCashDrawerAfterOrder}
        setDeviceOpenCashDrawerAfterOrder={setDeviceOpenCashDrawerAfterOrder}
        deviceAutoReturnToCounterSale={deviceAutoReturnToCounterSale}
        setDeviceAutoReturnToCounterSale={setDeviceAutoReturnToCounterSale}
        deviceAskSendToKitchen={deviceAskSendToKitchen}
        setDeviceAskSendToKitchen={setDeviceAskSendToKitchen}
        deviceCounterSaleVat={deviceCounterSaleVat}
        setDeviceCounterSaleVat={setDeviceCounterSaleVat}
        deviceTableSaleVat={deviceTableSaleVat}
        setDeviceTableSaleVat={setDeviceTableSaleVat}
        deviceTimeoutLogout={deviceTimeoutLogout}
        setDeviceTimeoutLogout={setDeviceTimeoutLogout}
        deviceFixedBorder={deviceFixedBorder}
        setDeviceFixedBorder={setDeviceFixedBorder}
        deviceAlwaysOnTop={deviceAlwaysOnTop}
        setDeviceAlwaysOnTop={setDeviceAlwaysOnTop}
        deviceAskInvoiceOrTicket={deviceAskInvoiceOrTicket}
        setDeviceAskInvoiceOrTicket={setDeviceAskInvoiceOrTicket}
        devicePrinterGroupingProducts={devicePrinterGroupingProducts}
        setDevicePrinterGroupingProducts={setDevicePrinterGroupingProducts}
        devicePrinterShowErrorScreen={devicePrinterShowErrorScreen}
        setDevicePrinterShowErrorScreen={setDevicePrinterShowErrorScreen}
        devicePrinterProductionMessageOnVat={devicePrinterProductionMessageOnVat}
        setDevicePrinterProductionMessageOnVat={setDevicePrinterProductionMessageOnVat}
        devicePrinterNextCourseOrder={devicePrinterNextCourseOrder}
        setDevicePrinterNextCourseOrder={setDevicePrinterNextCourseOrder}
        devicePrinterStandardMode={devicePrinterStandardMode}
        setDevicePrinterStandardMode={setDevicePrinterStandardMode}
        devicePrinterQROrderPrinter={devicePrinterQROrderPrinter}
        setDevicePrinterQROrderPrinter={setDevicePrinterQROrderPrinter}
        devicePrinterReprintWithNextCourse={devicePrinterReprintWithNextCourse}
        setDevicePrinterReprintWithNextCourse={setDevicePrinterReprintWithNextCourse}
        devicePrinterPrintZeroTickets={devicePrinterPrintZeroTickets}
        setDevicePrinterPrintZeroTickets={setDevicePrinterPrintZeroTickets}
        devicePrinterGiftVoucherAtMin={devicePrinterGiftVoucherAtMin}
        setDevicePrinterGiftVoucherAtMin={setDevicePrinterGiftVoucherAtMin}
        deviceCategoryDisplayIds={deviceCategoryDisplayIds}
        setDeviceCategoryDisplayIds={setDeviceCategoryDisplayIds}
        deviceOrdersConfirmOnHold={deviceOrdersConfirmOnHold}
        setDeviceOrdersConfirmOnHold={setDeviceOrdersConfirmOnHold}
        deviceOrdersPrintBarcodeAfterCreate={deviceOrdersPrintBarcodeAfterCreate}
        setDeviceOrdersPrintBarcodeAfterCreate={setDeviceOrdersPrintBarcodeAfterCreate}
        deviceOrdersCustomerCanBeModified={deviceOrdersCustomerCanBeModified}
        setDeviceOrdersCustomerCanBeModified={setDeviceOrdersCustomerCanBeModified}
        deviceOrdersBookTableToWaiting={deviceOrdersBookTableToWaiting}
        setDeviceOrdersBookTableToWaiting={setDeviceOrdersBookTableToWaiting}
        deviceOrdersFastCustomerName={deviceOrdersFastCustomerName}
        setDeviceOrdersFastCustomerName={setDeviceOrdersFastCustomerName}
        deviceScheduledPrinter={deviceScheduledPrinter}
        setDeviceScheduledPrinter={setDeviceScheduledPrinter}
        deviceScheduledProductionFlow={deviceScheduledProductionFlow}
        setDeviceScheduledProductionFlow={setDeviceScheduledProductionFlow}
        deviceScheduledLoading={deviceScheduledLoading}
        setDeviceScheduledLoading={setDeviceScheduledLoading}
        deviceScheduledMode={deviceScheduledMode}
        setDeviceScheduledMode={setDeviceScheduledMode}
        deviceScheduledInvoiceLayout={deviceScheduledInvoiceLayout}
        setDeviceScheduledInvoiceLayout={setDeviceScheduledInvoiceLayout}
        deviceScheduledCheckoutAt={deviceScheduledCheckoutAt}
        setDeviceScheduledCheckoutAt={setDeviceScheduledCheckoutAt}
        deviceScheduledPrintBarcodeLabel={deviceScheduledPrintBarcodeLabel}
        setDeviceScheduledPrintBarcodeLabel={setDeviceScheduledPrintBarcodeLabel}
        deviceScheduledDeliveryNoteToTurnover={deviceScheduledDeliveryNoteToTurnover}
        setDeviceScheduledDeliveryNoteToTurnover={setDeviceScheduledDeliveryNoteToTurnover}
        deviceScheduledPrintProductionReceipt={deviceScheduledPrintProductionReceipt}
        setDeviceScheduledPrintProductionReceipt={setDeviceScheduledPrintProductionReceipt}
        deviceScheduledPrintCustomerProductionReceipt={deviceScheduledPrintCustomerProductionReceipt}
        setDeviceScheduledPrintCustomerProductionReceipt={setDeviceScheduledPrintCustomerProductionReceipt}
        deviceScheduledWebOrderAutoPrint={deviceScheduledWebOrderAutoPrint}
        setDeviceScheduledWebOrderAutoPrint={setDeviceScheduledWebOrderAutoPrint}
      />

      {/* System Settings modal */}
      <ControlViewSystemSettingsModal
        tr={tr}
        mapTranslatedOptions={mapTranslatedOptions}
        showSystemSettingsModal={showSystemSettingsModal}
        closeSystemSettingsModal={() => setShowSystemSettingsModal(false)}
        systemSettingsTab={systemSettingsTab}
        setSystemSettingsTab={setSystemSettingsTab}
        priceGroups={priceGroups}
        savingSystemSettings={savingSystemSettings}
        handleSaveSystemSettings={handleSaveSystemSettings}
        onSystemSettingsEdited={() => { systemSettingsHasLocalEditsRef.current = true; }}
        sysUseStockManagement={sysUseStockManagement}
        setSysUseStockManagement={setSysUseStockManagement}
        sysUsePriceGroups={sysUsePriceGroups}
        setSysUsePriceGroups={setSysUsePriceGroups}
        sysLoginWithoutCode={sysLoginWithoutCode}
        setSysLoginWithoutCode={setSysLoginWithoutCode}
        sysCategorieenPerKassa={sysCategorieenPerKassa}
        setSysCategorieenPerKassa={setSysCategorieenPerKassa}
        sysAutoAcceptQROrders={sysAutoAcceptQROrders}
        setSysAutoAcceptQROrders={setSysAutoAcceptQROrders}
        sysQrOrdersAutomatischAfrekenen={sysQrOrdersAutomatischAfrekenen}
        setSysQrOrdersAutomatischAfrekenen={setSysQrOrdersAutomatischAfrekenen}
        sysEnkelQROrdersKeukenscherm={sysEnkelQROrdersKeukenscherm}
        setSysEnkelQROrdersKeukenscherm={setSysEnkelQROrdersKeukenscherm}
        sysAspect169Windows={sysAspect169Windows}
        setSysAspect169Windows={setSysAspect169Windows}
        sysVatRateVariousProducts={sysVatRateVariousProducts}
        setSysVatRateVariousProducts={setSysVatRateVariousProducts}
        sysArrangeProductsManually={sysArrangeProductsManually}
        setSysArrangeProductsManually={setSysArrangeProductsManually}
        sysLimitOneUserPerTable={sysLimitOneUserPerTable}
        setSysLimitOneUserPerTable={setSysLimitOneUserPerTable}
        sysOneWachtorderPerKlant={sysOneWachtorderPerKlant}
        setSysOneWachtorderPerKlant={setSysOneWachtorderPerKlant}
        sysCashButtonVisibleMultiplePayment={sysCashButtonVisibleMultiplePayment}
        setSysCashButtonVisibleMultiplePayment={setSysCashButtonVisibleMultiplePayment}
        sysUsePlaceSettings={sysUsePlaceSettings}
        setSysUsePlaceSettings={setSysUsePlaceSettings}
        sysTegoedAutomatischInladen={sysTegoedAutomatischInladen}
        setSysTegoedAutomatischInladen={setSysTegoedAutomatischInladen}
        sysNieuwstePrijsGebruiken={sysNieuwstePrijsGebruiken}
        setSysNieuwstePrijsGebruiken={setSysNieuwstePrijsGebruiken}
        sysLeeggoedTerugname={sysLeeggoedTerugname}
        setSysLeeggoedTerugname={setSysLeeggoedTerugname}
        sysKlantgegevensQRAfdrukken={sysKlantgegevensQRAfdrukken}
        setSysKlantgegevensQRAfdrukken={setSysKlantgegevensQRAfdrukken}
        sysPriceTakeAway={sysPriceTakeAway}
        setSysPriceTakeAway={setSysPriceTakeAway}
        sysPriceDelivery={sysPriceDelivery}
        setSysPriceDelivery={setSysPriceDelivery}
        sysPriceCounterSale={sysPriceCounterSale}
        setSysPriceCounterSale={setSysPriceCounterSale}
        sysPriceTableSale={sysPriceTableSale}
        setSysPriceTableSale={setSysPriceTableSale}
        sysSavingsPointsPerEuro={sysSavingsPointsPerEuro}
        setSysSavingsPointsPerEuro={setSysSavingsPointsPerEuro}
        sysSavingsPointsPerDiscount={sysSavingsPointsPerDiscount}
        setSysSavingsPointsPerDiscount={setSysSavingsPointsPerDiscount}
        sysSavingsDiscount={sysSavingsDiscount}
        setSysSavingsDiscount={setSysSavingsDiscount}
        sysBarcodeType={sysBarcodeType}
        setSysBarcodeType={setSysBarcodeType}
        sysTicketVoucherValidity={sysTicketVoucherValidity}
        setSysTicketVoucherValidity={setSysTicketVoucherValidity}
        sysTicketScheduledPrintMode={sysTicketScheduledPrintMode}
        setSysTicketScheduledPrintMode={setSysTicketScheduledPrintMode}
        sysTicketScheduledCustomerSort={sysTicketScheduledCustomerSort}
        setSysTicketScheduledCustomerSort={setSysTicketScheduledCustomerSort}
      />

      {/* New / Edit payment type modal */}
      <ControlViewPaymentTypeModal
        tr={tr}
        mapTranslatedOptions={mapTranslatedOptions}
        showPaymentTypeModal={showPaymentTypeModal}
        closePaymentTypeModal={closePaymentTypeModal}
        paymentTypeName={paymentTypeName}
        setPaymentTypeName={setPaymentTypeName}
        paymentTypeActive={paymentTypeActive}
        setPaymentTypeActive={setPaymentTypeActive}
        paymentTypeIntegration={paymentTypeIntegration}
        setPaymentTypeIntegration={setPaymentTypeIntegration}
        savingPaymentType={savingPaymentType}
        handleSavePaymentType={handleSavePaymentType}
      />

      {toast ? (
        <div className="fixed top-6 right-6 z-[100] pointer-events-none">
          <div
            className={`min-w-[320px] max-w-[520px] px-4 py-3 rounded-lg shadow-xl border text-xl ${toast.type === 'success'
              ? 'bg-emerald-700/90 border-emerald-500 text-emerald-100'
              : 'bg-rose-700/90 border-rose-500 text-rose-100'
              }`}
          >
            {toast.text}
          </div>
        </div>
      ) : null}

      <PrinterModal
        open={showPrinterModal}
        initialPrinter={editingPrinterId ? (printers.find((p) => p.id === editingPrinterId) ?? null) : null}
        onClose={closePrinterModal}
        onSave={handleSavePrinterPayload}
        onNotify={showToast}
      />

      {/* New / Edit label modal */}
      <ControlViewLabelModal
        tr={tr}
        showLabelModal={showLabelModal}
        closeLabelModal={closeLabelModal}
        labelName={labelName}
        setLabelName={setLabelName}
        labelHeight={labelHeight}
        setLabelHeight={setLabelHeight}
        labelWidth={labelWidth}
        setLabelWidth={setLabelWidth}
        labelStandard={labelStandard}
        setLabelStandard={setLabelStandard}
        labelMarginLeft={labelMarginLeft}
        setLabelMarginLeft={setLabelMarginLeft}
        labelMarginRight={labelMarginRight}
        setLabelMarginRight={setLabelMarginRight}
        labelMarginBottom={labelMarginBottom}
        setLabelMarginBottom={setLabelMarginBottom}
        labelMarginTop={labelMarginTop}
        setLabelMarginTop={setLabelMarginTop}
        handleSaveLabel={handleSaveLabel}
      />

      {/* Production messages modal */}
      <ControlViewProductionMessagesModal
        tr={tr}
        showProductionMessagesModal={showProductionMessagesModal}
        closeProductionMessagesModal={() => { setShowProductionMessagesModal(false); setProductionMessagesPage(0); cancelEditProductionMessage(); }}
        productionMessageInput={productionMessageInput}
        setProductionMessageInput={setProductionMessageInput}
        editingProductionMessageId={editingProductionMessageId}
        handleAddOrUpdateProductionMessage={handleAddOrUpdateProductionMessage}
        productionMessages={productionMessages}
        productionMessagesListRef={productionMessagesListRef}
        updateProductionMessagesScrollState={updateProductionMessagesScrollState}
        canProductionMessagesScrollUp={canProductionMessagesScrollUp}
        canProductionMessagesScrollDown={canProductionMessagesScrollDown}
        startEditProductionMessage={startEditProductionMessage}
        setDeleteConfirmProductionMessageId={setDeleteConfirmProductionMessageId}
      />

      {/* New price group modal */}
      <ControlViewPriceGroupModal
        tr={tr}
        vatOptions={VAT_OPTIONS}
        showPriceGroupModal={showPriceGroupModal}
        closePriceGroupModal={closePriceGroupModal}
        priceGroupName={priceGroupName}
        setPriceGroupName={setPriceGroupName}
        priceGroupTax={priceGroupTax}
        setPriceGroupTax={setPriceGroupTax}
        savingPriceGroup={savingPriceGroup}
        handleSavePriceGroup={handleSavePriceGroup}
      />

      {/* New / Edit kitchen modal */}
      <ControlViewKitchenModal
        tr={tr}
        showKitchenModal={showKitchenModal}
        closeKitchenModal={closeKitchenModal}
        kitchenModalName={kitchenModalName}
        setKitchenModalName={setKitchenModalName}
        savingKitchen={savingKitchen}
        handleSaveKitchen={handleSaveKitchen}
      />

      {/* Kitchen — assign products (same pattern as Product → Subproducts modal) */}
      <ControlViewKitchenAssignProductsModal
        tr={tr}
        showKitchenProductsModal={showKitchenProductsModal}
        kitchenProductsKitchen={kitchenProductsKitchen}
        closeKitchenProductsModal={closeKitchenProductsModal}
        loadingKitchenProductsCatalog={loadingKitchenProductsCatalog}
        kitchenProductsModalCategories={kitchenProductsModalCategories}
        kitchenProductsCategoryFilter={kitchenProductsCategoryFilter}
        setKitchenProductsCategoryFilter={setKitchenProductsCategoryFilter}
        kitchenProductsCatalog={kitchenProductsCatalog}
        kitchenProductsAvailable={kitchenProductsAvailable}
        kitchenProductsLeftSelectedIds={kitchenProductsLeftSelectedIds}
        setKitchenProductsLeftSelectedIds={setKitchenProductsLeftSelectedIds}
        kitchenProductsLeftListRef={kitchenProductsLeftListRef}
        handleAddKitchenProductLinks={handleAddKitchenProductLinks}
        kitchenProductsLinked={kitchenProductsLinked}
        kitchenProductsRightSelectedIds={kitchenProductsRightSelectedIds}
        setKitchenProductsRightSelectedIds={setKitchenProductsRightSelectedIds}
        kitchenProductsRightListRef={kitchenProductsRightListRef}
        removeKitchenProductLink={removeKitchenProductLink}
        handleRemoveKitchenProductLinks={handleRemoveKitchenProductLinks}
        handleSaveKitchenProducts={handleSaveKitchenProducts}
        savingKitchenProducts={savingKitchenProducts}
      />

      {/* Add / Edit category modal */}
      <ControlViewCategoryModal
        tr={tr}
        showCategoryModal={showCategoryModal}
        closeCategoryModal={closeCategoryModal}
        categoryName={categoryName}
        setCategoryName={setCategoryName}
        setCategoryActiveField={setCategoryActiveField}
        categoryInWebshop={categoryInWebshop}
        setCategoryInWebshop={setCategoryInWebshop}
        categoryDisplayOnCashRegister={categoryDisplayOnCashRegister}
        setCategoryDisplayOnCashRegister={setCategoryDisplayOnCashRegister}
        categoryNextCourse={categoryNextCourse}
        setCategoryNextCourse={setCategoryNextCourse}
        savingCategory={savingCategory}
        handleSaveCategory={handleSaveCategory}
        categoryActiveField={categoryActiveField}
      />

      {/* New / Edit product modal */}
      <ControlViewProductModal
        tr={tr}
        showProductModal={showProductModal}
        closeProductModal={closeProductModal}
        productTab={productTab}
        setProductTab={setProductTab}
        productTabsUnlocked={productTabsUnlocked}
        productName={productName}
        setProductName={setProductName}
        onProductNameInputSynced={handleProductGeneralNameSynced}
        productFieldErrors={productFieldErrors}
        setProductFieldErrors={setProductFieldErrors}
        productKeyName={productKeyName}
        setProductKeyName={setProductKeyName}
        productProductionName={productProductionName}
        setProductProductionName={setProductProductionName}
        productPrice={productPrice}
        setProductPrice={setProductPrice}
        productPriceLockedByProfit={isProductPriceLockedByProfit}
        productVatTakeOut={productVatTakeOut}
        setProductVatTakeOut={setProductVatTakeOut}
        productDisplayNumber={productDisplayNumber}
        productCategoryIds={productCategoryIds}
        setProductCategoryIds={setProductCategoryIds}
        categories={categories}
        productAddition={productAddition}
        setProductAddition={setProductAddition}
        productBarcode={productBarcode}
        setProductBarcode={setProductBarcode}
        handleGenerateBarcode={handleGenerateBarcode}
        barcodeButtonSpinning={barcodeButtonSpinning}
        getUniqueProductPrinterOptions={getUniqueProductPrinterOptions}
        productPrinter1={productPrinter1}
        productPrinter2={productPrinter2}
        productPrinter3={productPrinter3}
        setProductPrinter1={setProductPrinter1}
        setProductPrinter2={setProductPrinter2}
        setProductPrinter3={setProductPrinter3}
        savingProduct={savingProduct}
        handleSaveProduct={handleSaveProduct}
        setProductActiveField={setProductActiveField}
        advancedOpenPrice={advancedOpenPrice}
        setAdvancedOpenPrice={setAdvancedOpenPrice}
        advancedWeegschaal={advancedWeegschaal}
        setAdvancedWeegschaal={setAdvancedWeegschaal}
        advancedSubproductRequires={advancedSubproductRequires}
        setAdvancedSubproductRequires={setAdvancedSubproductRequires}
        advancedLeeggoedPrijs={advancedLeeggoedPrijs}
        setAdvancedLeeggoedPrijs={setAdvancedLeeggoedPrijs}
        advancedPagerVerplicht={advancedPagerVerplicht}
        setAdvancedPagerVerplicht={setAdvancedPagerVerplicht}
        advancedBoldPrint={advancedBoldPrint}
        setAdvancedBoldPrint={setAdvancedBoldPrint}
        advancedGroupingReceipt={advancedGroupingReceipt}
        setAdvancedGroupingReceipt={setAdvancedGroupingReceipt}
        advancedLabelExtraInfo={advancedLabelExtraInfo}
        setAdvancedLabelExtraInfo={setAdvancedLabelExtraInfo}
        advancedKassaPhotoPreview={advancedKassaPhotoPreview}
        setAdvancedKassaPhotoPreview={setAdvancedKassaPhotoPreview}
        advancedVoorverpakVervaltype={advancedVoorverpakVervaltype}
        setAdvancedVoorverpakVervaltype={setAdvancedVoorverpakVervaltype}
        advancedHoudbareDagen={advancedHoudbareDagen}
        setAdvancedHoudbareDagen={setAdvancedHoudbareDagen}
        advancedBewarenGebruik={advancedBewarenGebruik}
        setAdvancedBewarenGebruik={setAdvancedBewarenGebruik}
        extraPricesScrollRef={extraPricesScrollRef}
        syncExtraPricesScrollEdges={syncExtraPricesScrollEdges}
        extraPricesRows={extraPricesRows}
        setExtraPricesRows={setExtraPricesRows}
        setExtraPricesSelectedIndex={setExtraPricesSelectedIndex}
        extraPricesScrollEdges={extraPricesScrollEdges}
        purchaseVat={purchaseVat}
        setPurchaseVat={handlePurchaseVatChange}
        purchasePriceExcl={purchasePriceExcl}
        setPurchasePriceExcl={handlePurchasePriceExclChange}
        purchasePriceIncl={purchasePriceIncl}
        setPurchasePriceIncl={handlePurchasePriceInclChange}
        profitPct={profitPct}
        setProfitPct={handleProfitPctChange}
        purchaseUnit={purchaseUnit}
        setPurchaseUnit={setPurchaseUnit}
        unitContent={unitContent}
        setUnitContent={setUnitContent}
        stock={stock}
        setStock={setStock}
        purchaseSupplier={purchaseSupplier}
        setPurchaseSupplier={setPurchaseSupplier}
        purchaseSupplierOptions={purchaseSupplierDropdownOptions}
        supplierCode={supplierCode}
        setSupplierCode={setSupplierCode}
        stockNotification={stockNotification}
        setStockNotification={setStockNotification}
        expirationDate={expirationDate}
        setExpirationDate={setExpirationDate}
        declarationExpiryDays={declarationExpiryDays}
        setDeclarationExpiryDays={setDeclarationExpiryDays}
        notificationSoldOutPieces={notificationSoldOutPieces}
        setNotificationSoldOutPieces={setNotificationSoldOutPieces}
        productInWebshop={productInWebshop}
        setProductInWebshop={setProductInWebshop}
        webshopOnlineOrderable={webshopOnlineOrderable}
        setWebshopOnlineOrderable={setWebshopOnlineOrderable}
        websiteRemark={websiteRemark}
        setWebsiteRemark={setWebsiteRemark}
        websiteOrder={websiteOrder}
        setWebsiteOrder={setWebsiteOrder}
        shortWebText={shortWebText}
        setShortWebText={setShortWebText}
        websitePhotoFileName={websitePhotoFileName}
        setWebsitePhotoFileName={setWebsitePhotoFileName}
        kioskInfo={kioskInfo}
        setKioskInfo={setKioskInfo}
        kioskTakeAway={kioskTakeAway}
        setKioskTakeAway={setKioskTakeAway}
        kioskEatIn={kioskEatIn}
        setKioskEatIn={setKioskEatIn}
        kioskSubtitle={kioskSubtitle}
        setKioskSubtitle={setKioskSubtitle}
        kioskMinSubs={kioskMinSubs}
        setKioskMinSubs={setKioskMinSubs}
        kioskMaxSubs={kioskMaxSubs}
        setKioskMaxSubs={setKioskMaxSubs}
        kioskPicturePreview={kioskPicturePreview}
        setKioskPicturePreview={setKioskPicturePreview}
        productKeyboardValue={productKeyboardValue}
        productKeyboardOnChange={productKeyboardOnChange}
      />

      {/* Product positioning modal */}
      <ControlViewProductPositioningModal
        tr={tr}
        showProductPositioningModal={showProductPositioningModal}
        closeProductPositioningModal={closeProductPositioningModal}
        positioningCategoryId={positioningCategoryId}
        setPositioningCategoryId={setPositioningCategoryId}
        selectedCategoryId={selectedCategoryId}
        categories={categories}
        products={products}
        positioningSubproducts={positioningSubproducts}
        positioningLayoutByCategory={positioningLayoutByCategory}
        setPositioningLayoutByCategory={setPositioningLayoutForModal}
        positioningColorByCategory={positioningColorByCategory}
        setPositioningColorByCategory={setPositioningColorForModal}
        positioningSelectedProductId={positioningSelectedProductId}
        setPositioningSelectedProductId={setPositioningSelectedProductId}
        positioningSelectedCellIndex={positioningSelectedCellIndex}
        setPositioningSelectedCellIndex={setPositioningSelectedCellIndex}
        positioningSelectedPoolItemId={positioningSelectedPoolItemId}
        setPositioningSelectedPoolItemId={setPositioningSelectedPoolItemId}
        positioningCategoryTabsRef={positioningCategoryTabsRef}
        saveProductPositioningLayout={saveProductPositioningLayout}
        savingPositioningLayout={savingPositioningLayout}
      />

      {/* Product search keyboard modal */}
      {showProductSearchKeyboard && subNavId === 'Products' && (
        <div className="fixed inset-0 z-10 flex items-end justify-center">
          <div className="relative bg-pos-bg rounded-t-xl shadow-2xl w-[90%] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="absolute top-1 right-4 z-10 p-2 rounded text-pos-muted active:text-pos-text active:bg-green-500" onClick={() => setShowProductSearchKeyboard(false)} aria-label="Close">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="p-2 shrink-0 pt-10 flex w-full justify-center">
              <KeyboardWithNumpad value={productSearch} onChange={setProductSearch} />
            </div>
          </div>
        </div>
      )}

      {/* Product row -> Subproducts modal */}
      <ControlViewProductSubproductsModal
        tr={tr}
        showProductSubproductsModal={showProductSubproductsModal}
        closeProductSubproductsModal={closeProductSubproductsModal}
        loadingProductSubproductsLinked={loadingProductSubproductsLinked}
        subproductGroups={subproductGroups}
        productSubproductsGroupId={productSubproductsGroupId}
        setProductSubproductsGroupId={setProductSubproductsGroupId}
        productSubproductsAvailable={productSubproductsAvailable}
        productSubproductsLeftSelectedIds={productSubproductsLeftSelectedIds}
        setProductSubproductsLeftSelectedIds={setProductSubproductsLeftSelectedIds}
        productSubproductsLeftListRef={productSubproductsLeftListRef}
        handleAddProductSubproductLinks={handleAddProductSubproductLinks}
        productSubproductsLinked={productSubproductsLinked}
        productSubproductsRightSelectedIds={productSubproductsRightSelectedIds}
        setProductSubproductsRightSelectedIds={setProductSubproductsRightSelectedIds}
        productSubproductsListRef={productSubproductsListRef}
        removeProductSubproductLink={removeProductSubproductLink}
        handleRemoveProductSubproductLinks={handleRemoveProductSubproductLinks}
        handleSaveProductSubproducts={handleSaveProductSubproducts}
        savingProductSubproducts={savingProductSubproducts}
        productSubproductsProduct={productSubproductsProduct}
        onUserEdited={() => {
          productSubproductsHasLocalEditsRef.current = true;
        }}
      />

      {/* New / Edit subproduct modal */}
      <ControlViewSubproductModal
        tr={tr}
        showSubproductModal={showSubproductModal}
        closeSubproductModal={closeSubproductModal}
        subproductName={subproductName}
        handleSubproductNameChange={handleSubproductNameChange}
        setSubproductActiveField={setSubproductActiveField}
        subproductKeyName={subproductKeyName}
        setSubproductKeyName={setSubproductKeyName}
        subproductProductionName={subproductProductionName}
        setSubproductProductionName={setSubproductProductionName}
        subproductPrice={subproductPrice}
        setSubproductPrice={setSubproductPrice}
        subproductVatTakeOut={subproductVatTakeOut}
        setSubproductVatTakeOut={setSubproductVatTakeOut}
        subproductGroups={subproductGroups}
        subproductModalGroupId={subproductModalGroupId}
        setSubproductModalGroupId={setSubproductModalGroupId}
        subproductKioskPicture={subproductKioskPicture}
        setSubproductKioskPicture={setSubproductKioskPicture}
        categories={categories}
        subproductAttachToCategoryIds={subproductAttachToCategoryIds}
        setSubproductAttachToCategoryIds={setSubproductAttachToCategoryIds}
        subproductAttachToListRef={subproductAttachToListRef}
        scrollSubproductAttachToByPage={scrollSubproductAttachToByPage}
        savingSubproduct={savingSubproduct}
        handleSaveSubproduct={handleSaveSubproduct}
        subproductKeyboardValue={subproductKeyboardValue}
        subproductKeyboardOnChange={subproductKeyboardOnChange}
      />

      {/* Manage Groups modal */}
      <ControlViewManageGroupsModal
        tr={tr}
        showManageGroupsModal={showManageGroupsModal}
        closeManageGroupsModal={() => { setShowManageGroupsModal(false); setSelectedManageGroupId(null); }}
        subproductGroups={subproductGroups}
        newGroupName={newGroupName}
        setNewGroupName={setNewGroupName}
        savingGroup={savingGroup}
        handleAddGroup={handleAddGroup}
        manageGroupsListRef={manageGroupsListRef}
        manageGroupsDragRef={manageGroupsDragRef}
        updateManageGroupsPaginationState={updateManageGroupsPaginationState}
        selectedManageGroupId={selectedManageGroupId}
        setSelectedManageGroupId={setSelectedManageGroupId}
        editingGroupId={editingGroupId}
        setEditingGroupId={setEditingGroupId}
        editingGroupName={editingGroupName}
        setEditingGroupName={setEditingGroupName}
        handleSaveEditGroup={handleSaveEditGroup}
        setDeleteConfirmGroupId={setDeleteConfirmGroupId}
        canManageGroupsPageUp={canManageGroupsPageUp}
        canManageGroupsPageDown={canManageGroupsPageDown}
        pageManageGroups={pageManageGroups}
      />

      {/* Logout confirmation modal — same style as delete modal */}
      <DeleteConfirmModal
        open={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogoutConfirm}
        message={tr('logoutConfirm', 'Are you sure you want to log out?')}
      />
      </div>
      {!controlBootstrapReady && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-pos-bg">
          <LoadingSpinner label={tr('control.loadingConfiguration', 'Loading configuration...')} />
        </div>
      )}
    </div>
  );
}



