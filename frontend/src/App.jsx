import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import { useLanguage } from './contexts/LanguageContext';
import { Header } from './components/Header';
import { LeftSidebar } from './components/LeftSidebar';
import { ProductArea } from './components/ProductArea';
import { OrderPanel } from './components/OrderPanel';
import { Footer } from './components/Footer';
import { CustomersView } from './components/CustomersView';
import { WebordersModal } from './components/WebordersModal';
import { InPlanningModal } from './components/InPlanningModal';
import { InWaitingModal } from './components/InWaitingModal';
import { HistoryModal } from './components/HistoryModal';
import { LoginScreen } from './components/LoginScreen';
import { DeviceRegisterModal } from './components/DeviceRegisterModal';
import { ControlView } from './components/ControlView';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { ScaleWeightModal } from './components/ScaleWeightModal';
import { LoadingSpinner } from './components/LoadingSpinner';
import { LicenseActivationScreen } from './components/LicenseActivationScreen';
import { usePos } from './hooks/usePos';
import { POS_API_PREFIX as API, POS_SOCKET_ORIGIN } from './lib/apiOrigin.js';
import { isLicenseEnforcementEnabled, runStartupLicenseCheck } from './lib/posWebLicense.js';
import { OPTION_LAYOUT_POLL_MS, POS_DEVICE_SETTINGS_CHANGED_EVENT } from './lib/optionButtonLayout.ts';
import { setPosTerminalToken, posTerminalAuthHeaders } from './lib/posTerminalSession.js';
import { buildCustomerDisplayTicketPayload } from './lib/customerDisplayTicketPayload.js';
import {
  useCustomerDisplayOrderPublisher,
  useCustomerDisplayWindowLifecycle,
  useExtendPriceDisplayEnabled,
} from './hooks/useCustomerDisplayOrderSync.js';

const USER_STORAGE_KEY = 'pos-user';
const VIEW_STORAGE_KEY = 'pos-view';
const VALID_VIEWS = ['pos', 'control'];
const CONTROL_ACCESS_PIN = '1258';

function normalizeAppView(v) {
  if (v == null || v === '') return 'pos';
  if (v === 'kiosk') return 'pos';
  return VALID_VIEWS.includes(v) ? v : 'pos';
}

function loadInitialView() {
  try {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('view');
    if (v) return normalizeAppView(v);
  } catch {
    /* ignore */
  }
  try {
    const v = localStorage.getItem(VIEW_STORAGE_KEY);
    return normalizeAppView(v);
  } catch {
    return 'pos';
  }
}

function loadStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u && u.id && (u.label ?? u.name) ? u : null;
  } catch {
    return null;
  }
}

const socket = io(POS_SOCKET_ORIGIN, { path: '/socket.io' });

export default function App() {
  const { t } = useLanguage();
  const [licenseUi, setLicenseUi] = useState(() => (isLicenseEnforcementEnabled() ? 'checking' : 'ready'));
  const [licenseBlockReason, setLicenseBlockReason] = useState(null);
  const [user, setUser] = useState(loadStoredUser);
  const [view, setView] = useState(loadInitialView);
  const [isPosBootstrapReady, setIsPosBootstrapReady] = useState(false);
  const posSessionBootstrappedRef = useRef(false);
  const [deviceCheck, setDeviceCheck] = useState('pending');
  const [deviceCheckInfo, setDeviceCheckInfo] = useState(null);

  const fetchPosDeviceGate = useCallback(async () => {
    setDeviceCheck('pending');
    try {
      const res = await fetch(`${API}/pos-registers/current-device`, {
        headers: { ...posTerminalAuthHeaders() },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeviceCheckInfo({
          clientIp: typeof data.clientIp === 'string' ? data.clientIp : '',
          registersConfigured: Number(data.registersConfigured) || 0,
          verifyFailed: true,
        });
        setDeviceCheck('blocked');
        return;
      }
      setDeviceCheckInfo(data);
      if (data.deviceAllowed === true) {
        setDeviceCheck('ok');
      } else {
        setDeviceCheck('blocked');
      }
    } catch {
      setDeviceCheckInfo({ clientIp: '', registersConfigured: 0, verifyFailed: true, networkError: true });
      setDeviceCheck('blocked');
    }
  }, [API]);

  useEffect(() => {
    if (user) return;
    void fetchPosDeviceGate();
  }, [user, fetchPosDeviceGate]);

  // Ensure register metadata is available in logged-in views (e.g. Control footer).
  useEffect(() => {
    if (!user) return;
    if (deviceCheckInfo?.register?.id || deviceCheckInfo?.register?.name) return;
    void fetchPosDeviceGate();
  }, [user, deviceCheckInfo?.register?.id, deviceCheckInfo?.register?.name, fetchPosDeviceGate]);

  const setViewAndPersist = useCallback((nextView) => {
    setView(nextView);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, nextView);
    } catch { }
  }, []);

  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [ordersModalTab, setOrdersModalTab] = useState('new');
  const [showInPlanningModal, setShowInPlanningModal] = useState(false);
  const [showInWaitingModal, setShowInWaitingModal] = useState(false);
  const [focusedOrderId, setFocusedOrderId] = useState(null);
  const [focusedOrderInitialItemCount, setFocusedOrderInitialItemCount] = useState(0);
  const [showCustomersModal, setShowCustomersModal] = useState(false);
  const [showSubtotalView, setShowSubtotalView] = useState(false);
  const [subtotalBreaks, setSubtotalBreaks] = useState([]); // after each click: item count at which we inserted a subtotal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);
  const [showControlPinModal, setShowControlPinModal] = useState(false);
  const [controlPinInput, setControlPinInput] = useState('');
  const [controlPinError, setControlPinError] = useState('');
  const [quantityInput, setQuantityInput] = useState('');
  const scaleWeightResolveRef = useRef(null);
  const [scaleWeightProduct, setScaleWeightProduct] = useState(null);
  const [showInWaitingButton, setShowInWaitingButton] = useState(false);
  const [turnOnStockWarningEnabled, setTurnOnStockWarningEnabled] = useState(true);
  const [lowStockWarning, setLowStockWarning] = useState(null);
  const [stockZeroErrorOpen, setStockZeroErrorOpen] = useState(false);
  const [lowStockPrintBusy, setLowStockPrintBusy] = useState(false);
  const [lowStockPrintSuccessOpen, setLowStockPrintSuccessOpen] = useState(false);
  const [lowStockPrintFailToast, setLowStockPrintFailToast] = useState('');
  const UA_TIMEZONE = 'Europe/Kyiv';
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('en-GB', { timeZone: UA_TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false }));
  const {
    categories,
    products,
    selectedCategoryId,
    setSelectedCategoryId,
    currentOrder,
    orders,
    webordersCount,
    weborders,
    inPlanningCount,
    inWaitingCount,
    fetchInWaitingCount,
    fetchWeborders,
    addItemToOrder,
    removeOrderItem,
    updateOrderItemQuantity,
    setOrderStatus,
    setOrderCustomer,
    createOrder,
    markOrderPrinted,
    removeOrder,
    removeAllOrders,
    fetchCategories,
    fetchProducts,
    refetchCategoriesProducts,
    loadPosFullCatalog,
    fetchOrders,
    fetchWebordersCount,
    fetchInPlanningCount,
    historyOrders,
    fetchOrderHistory,
    fetchSubproductsForProduct,
    savedPositioningLayoutByCategory,
    fetchSavedPositioningLayout,
    savedPositioningColorByCategory,
    fetchSavedPositioningColors,
    savedFunctionButtonsLayout,
    fetchSavedFunctionButtonsLayout,
    appendSubproductNoteToItem,
    findProductByBarcode
  } = usePos(API, socket, focusedOrderId);

  const extendPriceDisplay = useExtendPriceDisplayEnabled();
  const customerDisplayTicketPayload = useMemo(
    () => buildCustomerDisplayTicketPayload(currentOrder),
    [currentOrder]
  );
  useCustomerDisplayOrderPublisher({
    enabled: Boolean(user) && extendPriceDisplay,
    payload: customerDisplayTicketPayload,
  });
  useCustomerDisplayWindowLifecycle({
    userPresent: Boolean(user),
    extendEnabled: extendPriceDisplay,
  });

  const handleMenuCatalogRefresh = useCallback(
    (categoryIds) => {
      if (Array.isArray(categoryIds) && categoryIds.length > 0) {
        void refetchCategoriesProducts(categoryIds);
      } else {
        void refetchCategoriesProducts();
      }
    },
    [refetchCategoriesProducts],
  );

  const inPlanningCountDisplay = (orders || []).filter((o) => o?.status === 'in_planning').length;
  const inWaitingCountDisplay = (orders || []).filter((o) => o?.status === 'in_waiting').length;

  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString('en-GB', { timeZone: UA_TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false })), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!lowStockPrintFailToast) return undefined;
    const id = window.setTimeout(() => setLowStockPrintFailToast(''), 3500);
    return () => window.clearTimeout(id);
  }, [lowStockPrintFailToast]);

  useEffect(() => {
    if (!isLicenseEnforcementEnabled()) return;
    let cancelled = false;
    (async () => {
      const r = await runStartupLicenseCheck();
      if (cancelled) return;
      if (r.ok || r.skipped) setLicenseUi('ready');
      else {
        setLicenseBlockReason(r.errorKey || 'license.err.generic');
        setLicenseUi('blocked');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user?.id || user.role != null) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/users/${user.id}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled || data?.role == null) return;
        setUser((prev) => {
          if (!prev || prev.id !== user.id) return prev;
          const next = { ...prev, role: data.role };
          try {
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(next));
          } catch { }
          return next;
        });
      } catch { }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role]);

  const refreshDeviceSettings = useCallback(() => {
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem('pos_device_settings');
      const saved = raw ? JSON.parse(raw) : {};
      const allFour =
        !!saved.ordersConfirmOnHold &&
        !!saved.ordersCustomerCanBeModified &&
        !!saved.ordersBookTableToWaiting &&
        !!saved.ordersFastCustomerName;
      setShowInWaitingButton(!!allFour);
      if (saved && typeof saved === 'object' && saved.turnOnStockWarning != null) {
        setTurnOnStockWarningEnabled(!!saved.turnOnStockWarning);
      } else {
        setTurnOnStockWarningEnabled(true);
      }
    } catch {
      setShowInWaitingButton(false);
      setTurnOnStockWarningEnabled(true);
    }
  }, []);

  useEffect(() => {
    refreshDeviceSettings();
    (async () => {
      try {
        const res = await fetch(`${API}/settings/device-settings`);
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          const saved = data?.value;
          if (saved && typeof saved === 'object' && Object.keys(saved).length > 0) {
            if (typeof localStorage !== 'undefined') localStorage.setItem('pos_device_settings', JSON.stringify(saved));
            refreshDeviceSettings();
          }
        }
      } catch (_) { }
    })();
  }, [refreshDeviceSettings]);

  /** Webpanel edits device settings — refresh in-waiting shortcut bar and cached settings. */
  useEffect(() => {
    const sync = async () => {
      try {
        const res = await fetch(`${API}/settings/device-settings`);
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        const saved = data?.value;
        if (saved && typeof saved === 'object') {
          if (typeof localStorage !== 'undefined') localStorage.setItem('pos_device_settings', JSON.stringify(saved));
          refreshDeviceSettings();
        }
      } catch (_) { /* ignore */ }
    };
    const onPush = () => {
      void sync();
    };
    window.addEventListener(POS_DEVICE_SETTINGS_CHANGED_EVENT, onPush);
    const id = window.setInterval(() => {
      void sync();
    }, OPTION_LAYOUT_POLL_MS);
    return () => {
      window.removeEventListener(POS_DEVICE_SETTINGS_CHANGED_EVENT, onPush);
      window.clearInterval(id);
    };
  }, [refreshDeviceSettings]);

  const runPosBootstrap = useCallback(async () => {
    await Promise.all([
      fetchOrders(),
      fetchWebordersCount(),
      fetchInPlanningCount(),
      fetchInWaitingCount(),
      fetchSavedPositioningLayout(),
      fetchSavedPositioningColors(),
      fetchSavedFunctionButtonsLayout(),
      loadPosFullCatalog()
    ]);
  }, [
    fetchOrders,
    fetchWebordersCount,
    fetchInPlanningCount,
    fetchInWaitingCount,
    fetchSavedPositioningLayout,
    fetchSavedPositioningColors,
    fetchSavedFunctionButtonsLayout,
    loadPosFullCatalog
  ]);

  useEffect(() => {
    if (!user) {
      posSessionBootstrappedRef.current = false;
      setIsPosBootstrapReady(false);
      return;
    }
    if (view !== 'pos') {
      setIsPosBootstrapReady(true);
      return;
    }
    if (posSessionBootstrappedRef.current) {
      setIsPosBootstrapReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsPosBootstrapReady(false);
      try {
        await runPosBootstrap();
      } finally {
        if (!cancelled) {
          posSessionBootstrappedRef.current = true;
          setIsPosBootstrapReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, view, runPosBootstrap]);

  useEffect(() => {
    if (selectedCategoryId) fetchProducts(selectedCategoryId);
  }, [selectedCategoryId, fetchProducts]);

  useEffect(() => {
    if (view === 'pos') {
      fetchSavedPositioningLayout();
      fetchSavedPositioningColors();
      fetchSavedFunctionButtonsLayout();
      refreshDeviceSettings();
    }
  }, [view, fetchSavedPositioningLayout, fetchSavedPositioningColors, fetchSavedFunctionButtonsLayout, refreshDeviceSettings]);

  const prevViewRef = useRef(view);
  useEffect(() => {
    if (prevViewRef.current === 'control' && view === 'pos') {
      fetchCategories();
      if (selectedCategoryId) fetchProducts(selectedCategoryId, { force: true });
    }
    prevViewRef.current = view;
  }, [view, fetchCategories, fetchProducts, selectedCategoryId]);

  useEffect(() => {
    setSubtotalBreaks([]);
  }, [currentOrder?.id]);

  const itemCount = currentOrder?.items?.length ?? 0;
  const lastBreak = subtotalBreaks[subtotalBreaks.length - 1] ?? 0;
  const hasNewItemsSinceLastSubtotal = itemCount > lastBreak;
  const subtotalButtonDisabled = itemCount === 0 || !hasNewItemsSinceLastSubtotal;

  const handleSubtotalClick = () => {
    if (subtotalButtonDisabled) return;
    const n = currentOrder?.items?.length ?? 0;
    setSubtotalBreaks((prev) => [...prev, n]);
    setShowSubtotalView(true);
  };

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser);
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get('view');
      if (fromUrl != null && fromUrl !== '') {
        setViewAndPersist(normalizeAppView(fromUrl));
      } else {
        const stored = localStorage.getItem(VIEW_STORAGE_KEY);
        setViewAndPersist(normalizeAppView(stored));
      }
    } catch {
      setViewAndPersist('pos');
    }
    try {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(loggedInUser));
    } catch { }
  };

  const requestApplicationExit = useCallback(() => {
    try {
      if (typeof window !== 'undefined' && window.posElectronApp?.quit) {
        window.posElectronApp.quit();
        return;
      }
    } catch {
      /* ignore */
    }
    try {
      window.close();
    } catch {
      /* ignore */
    }
  }, []);

  const handleLogout = () => {
    setUser(null);
    posSessionBootstrappedRef.current = false;
    setIsPosBootstrapReady(false);
    setDeviceCheck('ok');
    try {
      localStorage.removeItem(USER_STORAGE_KEY);
    } catch { }
  };

  const handleControlClick = useCallback(() => {
    setControlPinInput('');
    setControlPinError('');
    setShowControlPinModal(true);
  }, []);

  const handleControlPinSubmit = useCallback(
    (e) => {
      e?.preventDefault?.();
      const entered = String(controlPinInput || '').trim();
      if (entered === CONTROL_ACCESS_PIN) {
        setShowControlPinModal(false);
        setControlPinInput('');
        setControlPinError('');
        setViewAndPersist('control');
        return;
      }
      setControlPinError(t('loginWrongPin'));
    },
    [controlPinInput, setViewAndPersist, t]
  );

  const appendControlPinDigit = useCallback((digit) => {
    setControlPinInput((prev) => `${String(prev || '')}${String(digit || '')}`.replace(/\D/g, '').slice(0, 8));
    setControlPinError('');
  }, []);

  const backspaceControlPin = useCallback(() => {
    setControlPinInput((prev) => String(prev || '').slice(0, -1));
    setControlPinError('');
  }, []);

  const handleAddProductWithSelectedTable = useCallback(
    async (product) => {
      const toNumberOrNull = (value) => {
        const raw = String(value ?? '').trim();
        if (!raw) return null;
        const match = raw.match(/-?\d+(?:[.,]\d+)?/);
        if (!match) return null;
        const parsed = Number(match[0].replace(',', '.'));
        return Number.isFinite(parsed) ? parsed : null;
      };
      const shouldWarnLowStock = (candidate) => {
        if (!turnOnStockWarningEnabled) return false;
        const stockNotificationEnabled =
          candidate?.stockNotification !== false &&
          String(candidate?.stockNotification ?? '').toLowerCase() !== 'false';
        const threshold = toNumberOrNull(candidate?.notificationSoldOutPieces);
        const stock = toNumberOrNull(candidate?.stock);
        if (!stockNotificationEnabled || threshold == null || stock == null) return false;
        return stock <= threshold;
      };

      let resolvedProduct = product;
      if (product?.id) {
        try {
          const res = await fetch(`${API}/products/${encodeURIComponent(String(product.id))}`, {
            headers: { ...posTerminalAuthHeaders() },
            cache: 'no-store',
          });
          if (res.ok) {
            const fresh = await res.json().catch(() => null);
            if (fresh && typeof fresh === 'object') {
              resolvedProduct = { ...product, ...fresh };
            }
          }
        } catch {
          // Keep the local product fallback when refresh fails.
        }
      }

      const resolvedStock = toNumberOrNull(resolvedProduct?.stock);
      const qty = Math.max(1, parseInt(quantityInput, 10) || 1);
      const alreadyOrderedQty = Array.isArray(currentOrder?.items)
        ? currentOrder.items.reduce((sum, item) => {
            const sameProduct = String(item?.productId ?? '') === String(resolvedProduct?.id ?? '');
            if (!sameProduct) return sum;
            return sum + Math.max(0, Number(item?.quantity) || 0);
          }, 0)
        : 0;
      const availableStock = resolvedStock != null ? (resolvedStock - alreadyOrderedQty) : null;

      if (availableStock != null && availableStock <= 0) {
        setStockZeroErrorOpen(true);
        return false;
      }
      if (availableStock != null && qty > availableStock) {
        setStockZeroErrorOpen(true);
        return false;
      }

      if (shouldWarnLowStock(resolvedProduct)) {
        const threshold = toNumberOrNull(resolvedProduct?.notificationSoldOutPieces);
        const stock = toNumberOrNull(resolvedProduct?.stock);
        setLowStockWarning({
          id: String(resolvedProduct?.id ?? ''),
          number: Number(resolvedProduct?.number) || 0,
          name: String(resolvedProduct?.name ?? ''),
          stock: stock ?? 0,
          threshold: threshold ?? 0,
        });
        setLowStockPrintFailToast('');
      }

      setQuantityInput('');

      if (resolvedProduct?.weegschaal) {
        const result = await new Promise((resolve) => {
          scaleWeightResolveRef.current = resolve;
          setScaleWeightProduct(resolvedProduct);
        });
        if (!result) return false;
        return await addItemToOrder(resolvedProduct, 1, {
          linePrice: result.linePrice,
          lineNotes: result.notes
        });
      }

      return addItemToOrder(resolvedProduct, qty);
    },
    [addItemToOrder, quantityInput, turnOnStockWarningEnabled, currentOrder]
  );

  const barcodeScanPaused =
    showOrdersModal ||
    showInPlanningModal ||
    showInWaitingModal ||
    showHistoryModal ||
    showCustomersModal ||
    showControlPinModal ||
    showLogoutConfirmModal ||
    scaleWeightProduct != null;

  const handleApplyScannedBarcode = useCallback(
    async (barcode) => {
      const product = findProductByBarcode(barcode);
      if (!product) return;
      await handleAddProductWithSelectedTable(product);
    },
    [findProductByBarcode, handleAddProductWithSelectedTable]
  );

  if (licenseUi === 'checking') {
    return (
      <div className="flex h-full min-h-[100dvh] w-full items-center justify-center bg-pos-bg">
        <LoadingSpinner label={t('license.checking')} />
      </div>
    );
  }

  if (licenseUi === 'blocked') {
    return (
      <LicenseActivationScreen
        time={time}
        variant="pos"
        initialErrorKey={licenseBlockReason}
        onLicensed={() => setLicenseUi('ready')}
      />
    );
  }

  if (!user) {
    if (deviceCheck === 'pending') {
      return (
        <div className="flex h-full min-h-[100dvh] w-full items-center justify-center bg-pos-bg">
          <LoadingSpinner label={t('checkingDevice')} />
        </div>
      );
    }
    if (deviceCheck === 'blocked') {
      return (
        <DeviceRegisterModal
          apiPrefix={API}
          verifyFailed={Boolean(deviceCheckInfo?.verifyFailed)}
          onLogin={async (token) => {
            setPosTerminalToken(token);
            await fetchPosDeviceGate();
          }}
        />
      );
    }
    return (
      <LoginScreen
        time={time}
        onLogin={handleLogin}
        onExitApplication={requestApplicationExit}
      />
    );
  }

  if (view === 'control') {
    return (
      <ControlView
        currentUser={user}
        realtimeSocket={socket}
        currentRegisterId={String(deviceCheckInfo?.register?.id || '').trim()}
        currentRegisterName={String(deviceCheckInfo?.register?.name || deviceCheckInfo?.register?.id || '').trim()}
        onLogout={handleLogout}
        onBack={() => setViewAndPersist('pos')}
        onFunctionButtonsSaved={fetchSavedFunctionButtonsLayout}
        onMenuCatalogRefresh={handleMenuCatalogRefresh}
      />
    );
  }

  if (!isPosBootstrapReady) {
    return (
      <div className="flex h-full min-h-[100dvh] w-full items-center justify-center bg-pos-bg">
        <LoadingSpinner label={t('loadingPos')} />
      </div>
    );
  }

  return (
    <div className="flex h-full bg-pos-bg text-pos-text">
      <LeftSidebar
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={setSelectedCategoryId}
        currentUser={user}
        onControlClick={handleControlClick}
        onLogout={() => setShowLogoutConfirmModal(true)}
        time={time}
      />
      <div className="flex flex-col flex-1 min-h-0 w-2/4">
        <Header
          webordersCount={webordersCount}
          inPlanningCount={inPlanningCountDisplay}
          inWaitingCount={inWaitingCountDisplay}
          functionButtonSlots={savedFunctionButtonsLayout}
          onOpenWeborders={() => {
            setOrdersModalTab('new');
            setShowOrdersModal(true);
            fetchOrders();
            fetchOrderHistory();
          }}
          onOpenInPlanning={() => {
            setShowInPlanningModal(true);
            fetchOrders();
          }}
          onOpenInWaiting={() => {
            setShowInWaitingModal(true);
            fetchOrders();
          }}
        />
        <ProductArea
          products={products}
          selectedCategoryId={selectedCategoryId}
          categories={categories}
          onSelectCategory={setSelectedCategoryId}
          onAddProduct={handleAddProductWithSelectedTable}
          fetchSubproductsForProduct={fetchSubproductsForProduct}
          positioningLayoutByCategory={savedPositioningLayoutByCategory}
          positioningColorByCategory={savedPositioningColorByCategory}
          appendSubproductNoteToItem={appendSubproductNoteToItem}
        />
        <Footer
          currentUser={user}
          customersActive={showCustomersModal}
          onCustomersClick={() => setShowCustomersModal(true)}
          showSubtotalView={showSubtotalView}
          subtotalButtonDisabled={subtotalButtonDisabled}
          onSubtotalClick={handleSubtotalClick}
          onHistoryClick={() => setShowHistoryModal(true)}
          onLogout={handleLogout}
        />
      </div>
      <OrderPanel
        order={currentOrder}
        orders={orders}
        focusedOrderId={focusedOrderId}
        focusedOrderInitialItemCount={focusedOrderInitialItemCount}
        onRemoveItem={removeOrderItem}
        onUpdateItemQuantity={updateOrderItemQuantity}
        onStatusChange={setOrderStatus}
        onAfterPaidCheckout={async () => {
          setFocusedOrderId(null);
          setFocusedOrderInitialItemCount(0);
        }}
        onRemoveAllOrders={async () => {
          await removeAllOrders();
          setFocusedOrderId(null);
          setFocusedOrderInitialItemCount(0);
        }}
        showInPlanningButton={Array.isArray(savedFunctionButtonsLayout) && savedFunctionButtonsLayout.includes('geplande-orders')}
        onSaveInWaitingAndReset={async () => {
          setFocusedOrderId(null);
          setFocusedOrderInitialItemCount(0);
          await createOrder(null);
          fetchOrders();
        }}
        showSubtotalView={showSubtotalView}
        subtotalBreaks={subtotalBreaks}
        onPaymentCompleted={() => {
          fetchOrderHistory();
        }}
        currentUser={user}
        currentTime={time}
        quantityInput={quantityInput}
        setQuantityInput={setQuantityInput}
        showInWaitingButton={
          showInWaitingButton &&
          Array.isArray(savedFunctionButtonsLayout) &&
          savedFunctionButtonsLayout.includes('in-wacht')
        }
        onOpenInPlanning={() => {
          setShowInPlanningModal(true);
          fetchOrders();
        }}
        onOpenInWaiting={() => {
          setShowInWaitingModal(true);
          fetchOrders();
        }}
        barcodeScanPaused={barcodeScanPaused}
        onApplyScannedBarcode={handleApplyScannedBarcode}
      />
      <WebordersModal
        open={showOrdersModal}
        onClose={() => setShowOrdersModal(false)}
        weborders={(orders || []).filter((o) => o.status === 'in_planning')}
        inPlanningOrders={historyOrders || []}
        initialTab={ordersModalTab}
        onConfirm={() => {
          fetchOrders();
          fetchOrderHistory();
          fetchWebordersCount();
          fetchInPlanningCount();
        }}
        onCancelOrder={removeOrder}
      />
      {lowStockWarning ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="w-[min(90vw,460px)] rounded-xl border border-red-500/60 bg-red-50 p-5 text-red-950 shadow-2xl dark:bg-red-950/30 dark:text-red-100">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-red-700 dark:text-red-300">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3L22 20H2L12 3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M12 9V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="17" r="1.2" fill="currentColor" />
              </svg>
              <span>{t('warning', 'Warning')}</span>
            </h3>
            <p className="mt-3 text-sm text-red-800 dark:text-red-200">
              {`${lowStockWarning.name} is out of stock.`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={lowStockPrintBusy}
                className="rounded-lg border border-red-600 bg-white px-4 py-2 text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-transparent dark:text-red-200 dark:hover:bg-red-900/40"
                onClick={async () => {
                  if (!lowStockWarning || lowStockPrintBusy) return;
                  setLowStockPrintBusy(true);
                  setLowStockPrintFailToast('');
                  try {
                    const lines = [
                      '*** LOW STOCK WARNING ***',
                      `Product: ${lowStockWarning.name}`,
                      lowStockWarning.number > 0 ? `PLU: ${lowStockWarning.number}` : '',
                      lowStockWarning.id ? `Id: ${lowStockWarning.id}` : '',
                      `Stock: ${lowStockWarning.stock}`,
                      `Notification level: ${lowStockWarning.threshold}`,
                      '',
                    ].filter(Boolean);
                    const res = await fetch(`${API}/printers/text-report`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', ...posTerminalAuthHeaders() },
                      body: JSON.stringify({ lines }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok || data?.success !== true || data?.data?.printed !== true) {
                      throw new Error(data?.error || t('control.reports.printFailed', 'Could not print on the main printer.'));
                    }
                    setLowStockWarning(null);
                    setLowStockPrintSuccessOpen(true);
                  } catch (error) {
                    setLowStockPrintFailToast(error?.message || t('control.reports.printFailed', 'Could not print on the main printer.'));
                  } finally {
                    setLowStockPrintBusy(false);
                  }
                }}
              >
                {lowStockPrintBusy ? t('printerModal.testing', 'Printing...') : t('print', 'Print')}
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 active:bg-red-700"
                onClick={() => {
                  if (lowStockPrintBusy) return;
                  setLowStockWarning(null);
                  setLowStockPrintFailToast('');
                }}
              >
                {t('ok', 'OK')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {stockZeroErrorOpen ? (
        <div className="fixed inset-0 z-[111] flex items-center justify-center bg-black/50">
          <div className="w-[min(90vw,420px)] rounded-xl border border-red-500/60 bg-red-50 p-5 text-red-950 shadow-2xl dark:bg-red-950/30 dark:text-red-100">
            <h3 className="text-lg font-semibold text-red-700 dark:text-red-300">{t('warning', 'Warning')}</h3>
            <p className="mt-3 text-sm text-red-800 dark:text-red-200">Stock is 0</p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 active:bg-red-700"
                onClick={() => setStockZeroErrorOpen(false)}
              >
                {t('ok', 'OK')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {lowStockPrintSuccessOpen ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50">
          <div className="w-[min(90vw,420px)] rounded-xl border border-green-500/50 bg-green-50 p-5 text-green-950 shadow-2xl dark:bg-green-950/30 dark:text-green-100">
            <h3 className="text-lg font-semibold text-green-700 dark:text-green-300">{t('print', 'Print')} {t('success', 'Success')}</h3>
            <p className="mt-2 text-sm text-green-800 dark:text-green-200">
              {t('printerModal.testSuccess', 'Test print succeeded.')}
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 active:bg-green-700"
                onClick={() => setLowStockPrintSuccessOpen(false)}
              >
                {t('ok', 'OK')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {lowStockPrintFailToast ? (
        <div className="fixed right-4 top-4 z-[120]">
          <div className="max-w-[420px] rounded-lg border border-red-500/60 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-xl dark:bg-red-950/40 dark:text-red-200">
            {lowStockPrintFailToast}
          </div>
        </div>
      ) : null}
      <InPlanningModal
        open={showInPlanningModal}
        onClose={() => setShowInPlanningModal(false)}
        orders={orders || []}
        onDeleteOrder={async (orderId) => {
          await removeOrder(orderId);
          fetchInPlanningCount();
        }}
        onLoadOrder={(orderId) => {
          const ord = (orders || []).find((o) => o.id === orderId);
          setFocusedOrderId(orderId);
          setFocusedOrderInitialItemCount(ord?.items?.length ?? 0);
          setShowInPlanningModal(false);
        }}
        onFetchOrders={fetchOrders}
        onMarkOrderPrinted={async (orderId) => {
          await markOrderPrinted(orderId);
          fetchOrders();
        }}
      />
      <InWaitingModal
        open={showInWaitingModal}
        onClose={() => setShowInWaitingModal(false)}
        orders={orders || []}
        currentUser={user}
        onViewOrder={(orderId) => {
          const viewedOrder = (orders || []).find((o) => o.id === orderId);
          setFocusedOrderId(orderId);
          let savedCount = viewedOrder?.items?.length ?? 0;
          try {
            if (viewedOrder?.itemBatchBoundariesJson) {
              const b = JSON.parse(viewedOrder.itemBatchBoundariesJson);
              if (Array.isArray(b) && b.length > 0) savedCount = b[b.length - 1];
            }
          } catch { /* ignore */ }
          setFocusedOrderInitialItemCount(savedCount);
          setShowInWaitingModal(false);
          // Don't change status to open - order stays in_waiting, remains in In waiting list
        }}
        onPrintOrder={async (orderId) => {
          await markOrderPrinted(orderId);
          fetchOrders();
        }}
        onDeleteOrder={async (orderId) => {
          await removeOrder(orderId);
          fetchOrders();
          fetchInPlanningCount();
          fetchInWaitingCount();
        }}
      />
      <HistoryModal
        open={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        historyOrders={historyOrders || []}
        onFetchHistory={fetchOrderHistory}
      />
      {showCustomersModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="h-[96vh] w-[96vw] rounded-xl overflow-hidden border border-pos-border shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <CustomersView
              orderCustomer={currentOrder?.customer ?? null}
              onBack={() => setShowCustomersModal(false)}
              onSelectCustomer={async (customer) => {
                if (!customer?.id) return;
                await setOrderCustomer(customer.id);
                setShowCustomersModal(false);
              }}
              onNoCustomer={async () => {
                await setOrderCustomer(null);
                setShowCustomersModal(false);
              }}
            />
          </div>
        </div>
      )}
      {showControlPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          {controlPinError ? (
            <div className="absolute top-5 right-5 flex items-center gap-2 rounded-xl border border-red-400/70 bg-red-950/95 px-4 py-3 text-sm font-semibold text-red-100 shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-sm">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500/25 text-red-200">!</span>
              <span>{controlPinError}</span>
            </div>
          ) : null}
          <form
            className="w-full max-w-sm rounded-xl border border-pos-border bg-pos-bg p-4 shadow-2xl"
            onSubmit={handleControlPinSubmit}
          >
            <div className="text-xl font-semibold text-pos-text mb-2">{t('control')}</div>
            <div className="text-pos-muted mb-3">Enter PIN to open Control</div>
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={controlPinInput}
              onChange={(e) => {
                setControlPinInput(e.target.value.replace(/\D/g, '').slice(0, 8));
                if (controlPinError) setControlPinError('');
              }}
              className="w-full rounded-lg border border-pos-border bg-pos-panel px-3 py-2 text-lg text-pos-text text-center outline-none focus:border-green-500"
              placeholder="PIN"
            />
            <div className="mt-3 grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button
                  key={`pin-key-${d}`}
                  type="button"
                  className="rounded-lg border border-pos-border bg-pos-panel px-3 py-2 text-xl font-semibold text-pos-text active:bg-green-500"
                  onClick={() => appendControlPinDigit(d)}
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                className="rounded-lg border border-pos-border bg-pos-panel px-3 py-2 text-sm font-semibold text-pos-text active:bg-green-500"
                onClick={() => {
                  setControlPinInput('');
                  setControlPinError('');
                }}
              >
                Clear
              </button>
              <button
                type="button"
                className="rounded-lg border border-pos-border bg-pos-panel px-3 py-2 text-xl font-semibold text-pos-text active:bg-green-500"
                onClick={() => appendControlPinDigit('0')}
              >
                0
              </button>
              <button
                type="button"
                className="rounded-lg border border-pos-border bg-pos-panel px-3 py-2 text-sm font-semibold text-pos-text active:bg-green-500"
                onClick={backspaceControlPin}
              >
                Del
              </button>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-pos-border bg-pos-panel px-3 py-2 text-pos-text active:bg-green-500"
                onClick={() => {
                  setShowControlPinModal(false);
                  setControlPinInput('');
                  setControlPinError('');
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 rounded-lg border border-green-500 bg-green-600 px-3 py-2 text-white active:bg-green-500"
              >
                OK
              </button>
            </div>
          </form>
        </div>
      )}
      <DeleteConfirmModal
        open={showLogoutConfirmModal}
        onClose={() => setShowLogoutConfirmModal(false)}
        onConfirm={() => {
          setShowLogoutConfirmModal(false);
          handleLogout();
        }}
        message={t('logoutConfirm')}
      />
      <ScaleWeightModal
        open={scaleWeightProduct != null}
        product={scaleWeightProduct}
        onCancel={() => {
          const r = scaleWeightResolveRef.current;
          scaleWeightResolveRef.current = null;
          r?.(null);
          setScaleWeightProduct(null);
        }}
        onConfirm={({ weightGrams, linePrice }) => {
          const r = scaleWeightResolveRef.current;
          scaleWeightResolveRef.current = null;
          r?.({ linePrice, notes: `${weightGrams}g` });
          setScaleWeightProduct(null);
        }}
        labels={{
          cancel: t('scaleWeight.cancel', 'Cancel'),
          confirm: t('scaleWeight.confirm', 'Confirm'),
          weightHint: t('scaleWeight.weight', 'Weight'),
          totalHint: t('scaleWeight.total', 'Total'),
          gramsLabel: t('scaleWeight.grams', 'Grams'),
          gramsPlaceholder: t('scaleWeight.gramsPlaceholder', 'Weight in grams'),
          pollHint: t('scaleWeight.pollHint', 'Scale read unavailable — check scale connection/configuration.'),
          confirmHint: t(
            'scaleWeight.confirmHint',
            'Place product on scale, wait for weight, then tap Confirm.'
          )
        }}
      />
    </div>
  );
}
