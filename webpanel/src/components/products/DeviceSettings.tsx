import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Save, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import type { TranslationKey } from "@/lib/translations";
import {
  DEVICE_SETTINGS_MODAL_POLL_MS,
  buildAutoArrangedOptionButtonLayout,
  DEFAULT_OPTION_BUTTON_LAYOUT,
  DEFAULT_POS_REGISTER_NAME,
  normalizeOptionButtonSlots,
  OPTION_BUTTON_ITEMS,
  OPTION_BUTTON_ITEM_BY_ID,
  OPTION_BUTTON_LOCKED_ID,
  OPTION_BUTTON_SLOT_COUNT,
  OPTION_LAYOUT_POLL_MS,
  pickOptionButtonLayoutFromDeviceSettings,
  POS_DEVICE_SETTINGS_CHANGED_EVENT,
} from "@/lib/optionButtonLayout";
import {
  generalFromServer,
  generalToServerPatch,
  ordersWaitFromServer,
  ordersWaitToServerPatch,
  plannedFromServer,
  plannedToServerPatch,
  printerFromServer,
  printerToServerPatch,
} from "@/lib/deviceSettingsMap";
import {
  buildDefaultFunctionButtonsLayout,
  FUNCTION_BUTTON_ITEMS,
  FUNCTION_BUTTON_ITEM_BY_ID,
  FUNCTION_BUTTON_SLOT_COUNT,
  normalizeFunctionButtonsLayout,
} from "@/lib/functionButtonLayout";

type SubTab = "general" | "printer" | "categoryView" | "ordersWait" | "plannedOrders" | "optionKeys" | "functionKeys";

type WebpanelPosRegisterRow = { id: string; name: string; ipAddress: string };

const OPTION_BUTTON_LABEL_KEY: Record<string, TranslationKey> = {
  "extra-bc-bedrag": "optBtnExtraBcBedrag",
  "bc-refund": "optBtnBcRefund",
  "stock-retour": "optBtnStockRetour",
  "product-labels": "optBtnProductLabels",
  "ticket-afdrukken": "optBtnTicketAfdrukken",
  tegoed: "optBtnTegoed",
  "tickets-optellen": "optBtnTicketsOptellen",
  "product-info": "optBtnProductInfo",
  "personeel-ticket": "optBtnPersoneelTicket",
  "productie-bericht": "optBtnProductieBericht",
  "prijs-groep": "optBtnPrijsGroep",
  discount: "optBtnDiscount",
  kadobon: "optBtnKadobon",
  various: "optBtnVarious",
  plu: "optBtnPlu",
  "product-zoeken": "optBtnProductZoeken",
  lade: "optBtnLade",
  klanten: "optBtnKlanten",
  historiek: "optBtnHistoriek",
  subtotaal: "optBtnSubtotaal",
  terugname: "optBtnTerugname",
  meer: "optBtnMeer",
  "eat-in-take-out": "optBtnEatInTakeOut",
  "externe-apps": "optBtnExterneApps",
  "voor-verpakken": "optBtnVoorVerpakken",
  "leeggoed-terugnemen": "optBtnLeeggoedTerugnemen",
  "webshop-tijdsloten": "optBtnWebshopTijdsloten",
};

const FUNCTION_BUTTON_LABEL_KEY: Record<string, TranslationKey> = {
  weborders: "fnBtnWeborders",
  "in-wacht": "fnBtnInWacht",
  "geplande-orders": "fnBtnGeplandeOrders",
  reservaties: "fnBtnReservaties",
  verkopers: "fnBtnVerkopers",
};

function optionButtonLabel(id: string, t: (k: TranslationKey) => string): string {
  const key = OPTION_BUTTON_LABEL_KEY[id];
  return key ? t(key) : OPTION_BUTTON_ITEM_BY_ID[id]?.fallbackLabel ?? id;
}

function functionButtonLabel(id: string, t: (k: TranslationKey) => string): string {
  const key = FUNCTION_BUTTON_LABEL_KEY[id];
  return key ? t(key) : FUNCTION_BUTTON_ITEM_BY_ID[id]?.fallbackLabel ?? id;
}

function registerDisplayLabel(registerId: string, t: (k: TranslationKey) => string, rows: WebpanelPosRegisterRow[]): string {
  const row = rows.find((r) => r.id === registerId);
  if (row) {
    const label = String(row.name || "").trim() || String(row.ipAddress || "").trim();
    return label || row.id;
  }
  if (registerId === DEFAULT_POS_REGISTER_NAME) return t("deviceRegisterDisplay1");
  return registerId;
}

export function DeviceSettings() {
  const { t } = useLanguage();
  const [register, setRegister] = useState<string>("");
  const [posRegisters, setPosRegisters] = useState<WebpanelPosRegisterRow[]>([]);
  const [posRegistersLoading, setPosRegistersLoading] = useState(true);
  const [sub, setSub] = useState<SubTab>("general");
  const [serverDevice, setServerDevice] = useState<Record<string, unknown>>({});
  const [bootLoaded, setBootLoaded] = useState(false);
  const [savingSection, setSavingSection] = useState(false);
  const [printers, setPrinters] = useState<Array<{ id: string; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const deviceFormDirtyRef = useRef(false);
  const lastServerSigRef = useRef<string | null>(null);

  const fetchFull = useCallback(async () => {
    try {
      const data = await apiRequest<{ value: Record<string, unknown> }>("/api/settings/device-settings");
      const v = (data?.value && typeof data.value === "object" ? data.value : {}) as Record<string, unknown>;
      const sig = JSON.stringify(v);
      if (sig === lastServerSigRef.current) return;
      if (deviceFormDirtyRef.current) return;
      lastServerSigRef.current = sig;
      setServerDevice(v);
    } catch {
      toast({ variant: "destructive", description: t("failedLoadDeviceSettings") });
    } finally {
      setBootLoaded(true);
    }
  }, [t]);

  const patchDevice = useCallback((patch: Record<string, unknown>) => {
    deviceFormDirtyRef.current = true;
    setServerDevice((prev) => ({ ...prev, ...patch }));
  }, []);

  const saveSection = useCallback(
    async (patch: Record<string, unknown>) => {
      setSavingSection(true);
      try {
        const prev = await apiRequest<{ value: Record<string, unknown> }>("/api/settings/device-settings");
        const base = (prev.value && typeof prev.value === "object" ? prev.value : {}) as Record<string, unknown>;
        const merged = { ...base, ...patch };
        await apiRequest("/api/settings/device-settings", {
          method: "PUT",
          body: JSON.stringify({ value: merged }),
        });
        deviceFormDirtyRef.current = false;
        lastServerSigRef.current = JSON.stringify(merged);
        setServerDevice(merged);
        toast({ title: t("save"), description: t("deviceSettings") });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(POS_DEVICE_SETTINGS_CHANGED_EVENT));
        }
      } catch (e) {
        toast({
          variant: "destructive",
          description: e instanceof Error ? e.message : t("saveFailedGeneric"),
        });
      } finally {
        setSavingSection(false);
      }
    },
    [t],
  );

  const bumpAfterOptionSave = useCallback(() => {
    deviceFormDirtyRef.current = false;
    lastServerSigRef.current = null;
    void fetchFull();
  }, [fetchFull]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setPosRegistersLoading(true);
      try {
        const list = await apiRequest<WebpanelPosRegisterRow[]>("/api/webpanel/pos-registers");
        const rows = !cancelled && Array.isArray(list) ? list : [];
        if (cancelled) return;
        setPosRegisters(rows);
        setRegister((cur) => (cur && rows.some((r) => r.id === cur) ? cur : rows[0]?.id ?? ""));
      } catch {
        if (!cancelled) {
          setPosRegisters([]);
          setRegister("");
        }
      } finally {
        if (!cancelled) setPosRegistersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const resolvedRegister = useMemo(() => {
    if (!posRegisters.length) return "";
    if (register && posRegisters.some((r) => r.id === register)) return register;
    return posRegisters[0]!.id;
  }, [register, posRegisters]);

  useEffect(() => {
    void fetchFull();
  }, [fetchFull, resolvedRegister]);

  useEffect(() => {
    const onVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") void fetchFull();
    };
    void fetchFull();
    const id = window.setInterval(() => {
      void fetchFull();
    }, DEVICE_SETTINGS_MODAL_POLL_MS);
    const onPush = () => {
      void fetchFull();
    };
    window.addEventListener(POS_DEVICE_SETTINGS_CHANGED_EVENT, onPush);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }
    return () => {
      window.clearInterval(id);
      window.removeEventListener(POS_DEVICE_SETTINGS_CHANGED_EVENT, onPush);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, [fetchFull]);

  useEffect(() => {
    void (async () => {
      try {
        const list = await apiRequest<Array<{ id: string; name?: string }>>("/api/printers");
        setPrinters(Array.isArray(list) ? list.map((p) => ({ id: String(p.id), name: String(p.name || p.id) })) : []);
      } catch {
        setPrinters([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (sub !== "categoryView") return;
    setCategoriesLoading(true);
    void (async () => {
      try {
        const rows = await apiRequest<Array<{ id: string; name?: string }>>("/api/categories");
        setCategories(Array.isArray(rows) ? rows.map((c) => ({ id: String(c.id), name: String(c.name || c.id) })) : []);
      } catch {
        setCategories([]);
      } finally {
        setCategoriesLoading(false);
      }
    })();
  }, [sub]);

  const tabs: { id: SubTab; label: string }[] = [
    { id: "general", label: t("dsGeneral") },
    { id: "printer", label: t("dsPrinter") },
    { id: "categoryView", label: t("dsCategoryView") },
    { id: "ordersWait", label: t("dsOrdersWait") },
    { id: "plannedOrders", label: t("dsPlannedOrders") },
    { id: "optionKeys", label: t("dsOptionKeys") },
    { id: "functionKeys", label: t("dsFunctionKeys") },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-6 border-b border-border pb-3">
        <Select
          value={resolvedRegister || "__none__"}
          onValueChange={(v) => setRegister(v === "__none__" ? "" : v)}
          disabled={posRegistersLoading || posRegisters.length === 0}
        >
          <SelectTrigger className="min-w-[200px] max-w-xs w-auto">
            <SelectValue placeholder={posRegistersLoading ? t("loadingEllipsis") : t("deviceSettingsNoRegisters")} />
          </SelectTrigger>
          <SelectContent>
            {posRegisters.length === 0 ? (
              <SelectItem value="__none__" disabled>
                {t("deviceSettingsNoRegisters")}
              </SelectItem>
            ) : (
              posRegisters.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {registerDisplayLabel(r.id, t, posRegisters)}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        {tabs.map((tab) => {
          const isActive = tab.id === sub;
          return (
            <button
              key={tab.id}
              onClick={() => setSub(tab.id)}
              className={`text-sm transition-colors text-center max-w-[110px] leading-tight ${
                isActive ? "text-primary font-medium" : "text-foreground hover:text-primary"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {!bootLoaded && sub !== "optionKeys" && sub !== "functionKeys" ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
          {t("loadingEllipsis")}
        </div>
      ) : (
        <>
          {sub === "general" && (
            <GeneralPanel serverDevice={serverDevice} patchDevice={patchDevice} onSave={() => saveSection(generalToServerPatch(generalFromServer(serverDevice)))} saving={savingSection} />
          )}
          {sub === "printer" && (
            <PrinterPanel serverDevice={serverDevice} patchDevice={patchDevice} onSave={() => saveSection(printerToServerPatch(printerFromServer(serverDevice)))} saving={savingSection} printers={printers} />
          )}
          {sub === "categoryView" && (
            <CategoryViewPanel
              categories={categories}
              categoriesLoading={categoriesLoading}
              serverDevice={serverDevice}
              patchDevice={patchDevice}
              onSave={() =>
                saveSection({
                  categoryDisplayIds: Array.isArray(serverDevice.categoryDisplayIds)
                    ? (serverDevice.categoryDisplayIds as unknown[]).map(String)
                    : [],
                })
              }
              saving={savingSection}
            />
          )}
          {sub === "ordersWait" && (
            <OrdersWaitPanel serverDevice={serverDevice} patchDevice={patchDevice} onSave={() => saveSection(ordersWaitToServerPatch(ordersWaitFromServer(serverDevice)))} saving={savingSection} />
          )}
          {sub === "plannedOrders" && (
            <PlannedOrdersPanel serverDevice={serverDevice} patchDevice={patchDevice} onSave={() => saveSection(plannedToServerPatch(plannedFromServer(serverDevice)))} saving={savingSection} printers={printers} />
          )}
          {sub === "optionKeys" && resolvedRegister ? (
            <OptionKeysPanel register={resolvedRegister} posRegisters={posRegisters} onDeviceSettingsWritten={bumpAfterOptionSave} />
          ) : null}
          {sub === "functionKeys" && <FunctionKeysPanel />}
        </>
      )}
    </div>
  );
}

function DeviceSectionSave({ onSave, saving, disabled }: { onSave: () => void | Promise<void>; saving: boolean; disabled?: boolean }) {
  const { t } = useLanguage();
  return (
    <div className="flex justify-center pt-8">
      <Button
        type="button"
        variant="ghost"
        disabled={disabled || saving}
        onClick={() => void onSave()}
        className="gap-2 bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-sm"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {t("save")}
      </Button>
    </div>
  );
}

function Row({ label, children, sub }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-4 py-2">
      <div className="text-sm">
        <div>{label}:</div>
        {sub && <div className="text-xs text-muted-foreground">({sub})</div>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function GeneralPanel({
  serverDevice,
  patchDevice,
  onSave,
  saving,
}: {
  serverDevice: Record<string, unknown>;
  patchDevice: (patch: Record<string, unknown>) => void;
  onSave: () => void | Promise<void>;
  saving: boolean;
}) {
  const { t } = useLanguage();
  const g = generalFromServer(serverDevice);
  const [askMode, setAskMode] = useState("--");
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1">
        <div>
          <Row label={t("useSubproducts")}>
            <Checkbox checked={g.subproducts} onCheckedChange={(v) => patchDevice({ useSubproducts: !!v })} />
          </Row>
          <Row label={t("autoLogoutAfterTransaction")}>
            <Checkbox checked={g.autoLogout} onCheckedChange={(v) => patchDevice({ autoLogoutAfterTransaction: !!v })} />
          </Row>
          <Row label={t("cashButtonOffInPaymentPopup")}>
            <Checkbox checked={g.cashOff} onCheckedChange={(v) => patchDevice({ disableCashButtonInPayment: !!v })} />
          </Row>
          <Row label={t("openPriceWithoutPopup")}>
            <Checkbox checked={g.openPrice} onCheckedChange={(v) => patchDevice({ openPriceWithoutPopup: !!v })} />
          </Row>
        </div>
        <div>
          <Row label={t("drawerOpenAfterOrder")}>
            <Checkbox checked={g.drawerOpen} onCheckedChange={(v) => patchDevice({ openCashDrawerAfterOrder: !!v })} />
          </Row>
          <Row label={t("timeoutLogout")}>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => patchDevice({ timeoutLogout: g.timeout + 1 })}><ArrowUp className="h-3 w-3" /></Button>
            <Input
              className="w-14 h-8 text-center"
              value={g.timeout}
              onChange={(e) => patchDevice({ timeoutLogout: Number(e.target.value) || 0 })}
            />
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => patchDevice({ timeoutLogout: Math.max(0, g.timeout - 1) })}><ArrowDown className="h-3 w-3" /></Button>
          </Row>
          <Row label={t("fixedEdge")} sub={t("windows")}>
            <Checkbox checked={g.fixedEdge} onCheckedChange={(v) => patchDevice({ fixedBorder: !!v })} />
          </Row>
          <Row label={t("alwaysOnTop")} sub={t("windows")}>
            <Checkbox checked={g.alwaysTop} onCheckedChange={(v) => patchDevice({ alwaysOnTop: !!v })} />
          </Row>
          <Row label={t("askInvoiceOrTicket")}>
            <Checkbox checked={g.askInvoice} onCheckedChange={(v) => patchDevice({ askInvoiceOrTicket: !!v })} />
            <Select value={askMode} onValueChange={setAskMode}>
              <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="--">--</SelectItem>
                <SelectItem value="invoice">{t("invoice")}</SelectItem>
                <SelectItem value="ticket">{t("ticket")}</SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </div>
      </div>
      <DeviceSectionSave onSave={onSave} saving={saving} />
    </div>
  );
}

function PrinterPanel({
  serverDevice,
  patchDevice,
  onSave,
  saving,
  printers,
}: {
  serverDevice: Record<string, unknown>;
  patchDevice: (patch: Record<string, unknown>) => void;
  onSave: () => void | Promise<void>;
  saving: boolean;
  printers: Array<{ id: string; name: string }>;
}) {
  const { t } = useLanguage();
  const p = printerFromServer(serverDevice);
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1">
        <div>
          <Row label={t("groupProductsOnTicket")}><Checkbox checked={p.group} onCheckedChange={(v) => patchDevice({ printerGroupingProducts: !!v })} /></Row>
          <Row label={t("showErrorScreenOnPrinterError")}><Checkbox checked={p.errorScreen} onCheckedChange={(v) => patchDevice({ printerShowErrorScreen: !!v })} /></Row>
          <Row label={t("printProductionOnVatTicket")}><Checkbox checked={p.vatTicket} onCheckedChange={(v) => patchDevice({ printerProductionMessageOnVat: !!v })} /></Row>
          <Row label={t("defaultTicketPrintMode")}>
            <Select value={p.defaultMode} onValueChange={(v) => patchDevice({ printerStandardMode: v === "off" ? "disable" : "enable" })}>
              <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="on">{t("on")}</SelectItem>
                <SelectItem value="off">{t("off")}</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label={t("qrOrderPrinter")}>
            <Select value={p.qrPrinter} onValueChange={(v) => patchDevice({ printerQROrderPrinter: v === "disabled" ? "" : v })}>
              <SelectTrigger className="w-48 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="disabled">{t("disabled")}</SelectItem>
                {printers.map((pr) => (
                  <SelectItem key={pr.id} value={pr.id}>{pr.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
        </div>
        <div>
          <Row label={t("printZeroEuroTickets")}><Checkbox checked={p.zeroTicket} onCheckedChange={(v) => patchDevice({ printerPrintZeroTickets: !!v })} /></Row>
          <Row label={t("printVoucherAtMinAmount")}><Checkbox checked={p.voucherMin} onCheckedChange={(v) => patchDevice({ printerGiftVoucherAtMin: !!v })} /></Row>
        </div>
      </div>
      <DeviceSectionSave onSave={onSave} saving={saving} />
    </div>
  );
}

function CategoryViewPanel({
  categories,
  categoriesLoading,
  serverDevice,
  patchDevice,
  onSave,
  saving,
}: {
  categories: Array<{ id: string; name: string }>;
  categoriesLoading: boolean;
  serverDevice: Record<string, unknown>;
  patchDevice: (patch: Record<string, unknown>) => void;
  onSave: () => void | Promise<void>;
  saving: boolean;
}) {
  const { t } = useLanguage();
  const raw = serverDevice.categoryDisplayIds;
  const selected = Array.isArray(raw) ? raw.map(String) : [];
  const toggle = (catId: string) => {
    const allIds = categories.map((c) => String(c.id));
    if (selected.length === 0) {
      patchDevice({ categoryDisplayIds: allIds.filter((id) => id !== catId) });
      return;
    }
    if (selected.includes(catId)) {
      patchDevice({ categoryDisplayIds: selected.filter((id) => id !== catId) });
    } else {
      patchDevice({ categoryDisplayIds: [...selected, catId] });
    }
  };
  return (
    <div>
      {categoriesLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("loadingEllipsis")}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
          {categories.map((cat) => {
            const isChecked = selected.length === 0 || selected.includes(cat.id);
            return (
              <label key={cat.id} className="flex items-center gap-3 text-sm cursor-pointer">
                <Checkbox checked={isChecked} onCheckedChange={() => toggle(cat.id)} />
                <span className="truncate">{cat.name}</span>
              </label>
            );
          })}
        </div>
      )}
      <DeviceSectionSave onSave={onSave} saving={saving} disabled={categoriesLoading} />
    </div>
  );
}

function OrdersWaitPanel({
  serverDevice,
  patchDevice,
  onSave,
  saving,
}: {
  serverDevice: Record<string, unknown>;
  patchDevice: (patch: Record<string, unknown>) => void;
  onSave: () => void | Promise<void>;
  saving: boolean;
}) {
  const { t } = useLanguage();
  const o = ordersWaitFromServer(serverDevice);
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1">
        <div>
          <Row label={t("confirmWaitOrders")}><Checkbox checked={o.confirm} onCheckedChange={(v) => patchDevice({ ordersConfirmOnHold: !!v })} /></Row>
          <Row label={t("printBarcodeAfterOrder")}><Checkbox checked={o.barcode} onCheckedChange={(v) => patchDevice({ ordersPrintBarcodeAfterCreate: !!v })} /></Row>
        </div>
        <div>
          <Row label={t("waitOrdersCustomerChangeable")}><Checkbox checked={o.customerChange} onCheckedChange={(v) => patchDevice({ ordersCustomerCanBeModified: !!v })} /></Row>
          <Row label={t("bookTableToWaitOrder")}><Checkbox checked={o.tableBook} onCheckedChange={(v) => patchDevice({ ordersBookTableToWaiting: !!v })} /></Row>
          <Row label={t("waitOrdersFastCustomerName")}><Checkbox checked={o.fastName} onCheckedChange={(v) => patchDevice({ ordersFastCustomerName: !!v })} /></Row>
        </div>
      </div>
      <DeviceSectionSave onSave={onSave} saving={saving} />
    </div>
  );
}

function PlannedOrdersPanel({
  serverDevice,
  patchDevice,
  onSave,
  saving,
  printers,
}: {
  serverDevice: Record<string, unknown>;
  patchDevice: (patch: Record<string, unknown>) => void;
  onSave: () => void | Promise<void>;
  saving: boolean;
  printers: Array<{ id: string; name: string }>;
}) {
  const { t } = useLanguage();
  const s = plannedFromServer(serverDevice);
  const loadDays = [0, 1, 2, 3, 4, 5, 6, 7, 14, 21, 30, 31] as const;
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1">
        <div>
          <Row label={t("plannedOrdersPrinter")}>
            <Select value={s.printer} onValueChange={(v) => patchDevice({ scheduledPrinter: v === "disabled" ? "" : v })}>
              <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="disabled">{t("disabled")}</SelectItem>
                {printers.map((pr) => (
                  <SelectItem key={pr.id} value={pr.id}>{pr.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label={t("plannedOrdersTicketFlow")}>
            <Select value={s.flow} onValueChange={(v) => patchDevice({ scheduledProductionFlow: v })}>
              <SelectTrigger className="w-52 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled-orders-print">{t("plannedOrdersTicketFlow")}</SelectItem>
                <SelectItem value="default">{t("standard")}</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label={t("plannedOrdersLoad")}>
            <Select value={s.load} onValueChange={(v) => patchDevice({ scheduledLoading: v })}>
              <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {loadDays.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d} {d === 1 ? t("dayAgo") : t("daysAgo")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label={t("plannedOrderMode")}>
            <Select value={s.mode} onValueChange={(v) => patchDevice({ scheduledMode: v === "list" ? "list" : "labels" })}>
              <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="labels">{t("plannedOrderModeLabels")}</SelectItem>
                <SelectItem value="list">{t("list")}</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label={t("plannedOrderInvoiceLayout")}>
            <Select value={s.layout} onValueChange={(v) => patchDevice({ scheduledInvoiceLayout: v === "compact" ? "compact" : "standard" })}>
              <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">{t("standard")}</SelectItem>
                <SelectItem value="compact">{t("invoiceLayoutCompact")}</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label={t("plannedOrderSettleAt")}>
            <Select value={s.settle} onValueChange={(v) => patchDevice({ scheduledCheckoutAt: v === "order-date" ? "order-date" : "delivery-note" })}>
              <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="delivery-note">{t("deliveryNote")}</SelectItem>
                <SelectItem value="order-date">{t("scheduledCheckoutOrderDate")}</SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </div>
        <div>
          <Row label={t("printBarcodeLabel")}><Checkbox checked={s.barcode} onCheckedChange={(v) => patchDevice({ scheduledPrintBarcodeLabel: !!v })} /></Row>
          <Row label={t("addDeliveryNoteToRevenue")}><Checkbox checked={s.deliveryNote} onCheckedChange={(v) => patchDevice({ scheduledDeliveryNoteToTurnover: !!v })} /></Row>
          <Row label={t("printProductionOnNewPlanning")}><Checkbox checked={s.newPrint} onCheckedChange={(v) => patchDevice({ scheduledPrintProductionReceipt: !!v })} /></Row>
          <Row label={t("printProductionForCustomerOnNewPlanning")}><Checkbox checked={s.newPrintCustomer} onCheckedChange={(v) => patchDevice({ scheduledPrintCustomerProductionReceipt: !!v })} /></Row>
          <Row label={t("autoPrintWebOrderProduction")}><Checkbox checked={s.autoPrint} onCheckedChange={(v) => patchDevice({ scheduledWebOrderAutoPrint: !!v })} /></Row>
        </div>
      </div>
      <DeviceSectionSave onSave={onSave} saving={saving} />
    </div>
  );
}

function canPlaceIdOnSlot(prev: string[], slotIndex: number, itemId: string): boolean {
  if (slotIndex === OPTION_BUTTON_SLOT_COUNT - 1 && itemId !== OPTION_BUTTON_LOCKED_ID) return false;
  const cur = prev[slotIndex] || "";
  if (cur === OPTION_BUTTON_LOCKED_ID && itemId !== OPTION_BUTTON_LOCKED_ID) return false;
  return true;
}

function OptionKeysPanel({
  register,
  posRegisters,
  onDeviceSettingsWritten,
}: {
  register: string;
  posRegisters: WebpanelPosRegisterRow[];
  onDeviceSettingsWritten?: () => void;
}) {
  const { t } = useLanguage();
  const [grid, setGrid] = useState<string[]>(() => [...DEFAULT_OPTION_BUTTON_LAYOUT]);
  /** First selected grid index (occupied or empty), for swap / move / “slot then pool”. */
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  /** Selected pool item when choosing pool-first, then a grid cell. */
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  /** True while the user has local edits not yet saved — polling must not overwrite the grid. */
  const layoutDirtyRef = useRef(false);
  /** Last normalized layout applied from the server (signature avoids pointless re-renders). */
  const lastServerLayoutSigRef = useRef<string | null>(null);

  const markLayoutDirty = () => {
    layoutDirtyRef.current = true;
  };

  const load = useCallback(async () => {
    setLoading(true);
    layoutDirtyRef.current = false;
    try {
      const data = await apiRequest<{ value: Record<string, unknown> }>("/api/settings/device-settings");
      const raw = pickOptionButtonLayoutFromDeviceSettings(data?.value ?? {}, register) ?? data?.value?.optionButtonLayout;
      const norm = normalizeOptionButtonSlots(raw);
      lastServerLayoutSigRef.current = JSON.stringify(norm);
      setGrid(norm);
    } catch {
      toast({ variant: "destructive", description: t("failedLoadDeviceSettings") });
      const norm = normalizeOptionButtonSlots(null);
      lastServerLayoutSigRef.current = JSON.stringify(norm);
      setGrid(norm);
    } finally {
      setLoading(false);
    }
  }, [register, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading) return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const data = await apiRequest<{ value: Record<string, unknown> }>("/api/settings/device-settings");
        if (cancelled) return;
        const raw = pickOptionButtonLayoutFromDeviceSettings(data?.value ?? {}, register) ?? data?.value?.optionButtonLayout;
        const next = normalizeOptionButtonSlots(raw);
        const sig = JSON.stringify(next);
        if (sig === lastServerLayoutSigRef.current) return;
        if (layoutDirtyRef.current) return;
        lastServerLayoutSigRef.current = sig;
        setGrid(next);
        setSelectedSlot(null);
        setSelectedPoolId(null);
      } catch {
        /* silent */
      }
    };
    void poll();
    const id = window.setInterval(poll, OPTION_LAYOUT_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [register, loading]);

  const assignedIds = useMemo(() => new Set(grid.filter(Boolean)), [grid]);
  const poolItems = useMemo(
    () => OPTION_BUTTON_ITEMS.filter((item) => !assignedIds.has(item.id)),
    [assignedIds],
  );

  const placePoolIdAtSlot = (itemId: string, slotIndex: number) => {
    markLayoutDirty();
    setGrid((prev) => {
      if (!canPlaceIdOnSlot(prev, slotIndex, itemId)) return prev;
      const next = [...prev];
      const dup = next.findIndex((x, j) => x === itemId && j !== slotIndex);
      if (dup >= 0) next[dup] = "";
      next[slotIndex] = itemId;
      return normalizeOptionButtonSlots(next);
    });
    setSelectedPoolId(null);
    setSelectedSlot(null);
  };

  const onPoolItemClick = (itemId: string) => {
    if (selectedSlot !== null) {
      placePoolIdAtSlot(itemId, selectedSlot);
      return;
    }
    setSelectedPoolId((p) => (p === itemId ? null : itemId));
  };

  const onGridSlotClick = (idx: number) => {
    if (selectedPoolId) {
      placePoolIdAtSlot(selectedPoolId, idx);
      return;
    }

    if (selectedSlot === null) {
      setSelectedSlot(idx);
      return;
    }
    if (selectedSlot === idx) {
      setSelectedSlot(null);
      return;
    }

    const j = selectedSlot;
    const a = grid[j] || "";
    const b = grid[idx] || "";
    if (!a && !b) {
      setSelectedSlot(idx);
      return;
    }

    markLayoutDirty();
    setGrid((prev) => {
      const pa = prev[j] || "";
      const pb = prev[idx] || "";
      if (pa && pb) {
        if (!canPlaceIdOnSlot(prev, j, pb) || !canPlaceIdOnSlot(prev, idx, pa)) return prev;
        const next = [...prev];
        next[j] = pb;
        next[idx] = pa;
        return normalizeOptionButtonSlots(next);
      }
      if (pa && !pb) {
        if (!canPlaceIdOnSlot(prev, idx, pa)) return prev;
        const next = [...prev];
        next[j] = "";
        next[idx] = pa;
        return normalizeOptionButtonSlots(next);
      }
      if (!pa && pb) {
        if (!canPlaceIdOnSlot(prev, j, pb)) return prev;
        const next = [...prev];
        next[j] = pb;
        next[idx] = "";
        return normalizeOptionButtonSlots(next);
      }
      return prev;
    });
    setSelectedSlot(null);
  };

  const removeFromSelected = () => {
    if (selectedSlot === null) return;
    markLayoutDirty();
    setGrid((prev) => {
      if (prev[selectedSlot] === OPTION_BUTTON_LOCKED_ID) return prev;
      const next = [...prev];
      next[selectedSlot] = "";
      return normalizeOptionButtonSlots(next);
    });
    setSelectedSlot(null);
    setSelectedPoolId(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      const data = await apiRequest<{ value: Record<string, unknown> }>("/api/settings/device-settings");
      const prev = (data?.value && typeof data.value === "object" ? data.value : {}) as Record<string, unknown>;
      const normalized = normalizeOptionButtonSlots(grid);
      const prevBy = prev.optionButtonLayoutByRegister;
      const prevReg =
        prevBy && typeof prevBy === "object" && !Array.isArray(prevBy) ? (prevBy as Record<string, unknown>) : {};
      const next: Record<string, unknown> = { ...prev };
      next.optionButtonLayoutByRegister = { ...prevReg, [register]: normalized };
      const firstId = posRegisters[0]?.id;
      if (register === DEFAULT_POS_REGISTER_NAME || (firstId && register === firstId)) {
        next.optionButtonLayout = normalized;
      }
      await apiRequest("/api/settings/device-settings", {
        method: "PUT",
        body: JSON.stringify({ value: next }),
      });
      lastServerLayoutSigRef.current = JSON.stringify(normalized);
      layoutDirtyRef.current = false;
      onDeviceSettingsWritten?.();
      toast({ title: t("save"), description: registerDisplayLabel(register, t, posRegisters) });
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : t("saveFailedGeneric"),
      });
    } finally {
      setSaving(false);
    }
  };

  const registerLabel = registerDisplayLabel(register, t, posRegisters);
  const pollSec = String(OPTION_LAYOUT_POLL_MS / 1000);
  const helpA = t("optionKeysHelpA")
    .replace("{{register}}", registerLabel)
    .replace("{{sectionTitle}}", t("dsOptionKeys"));
  const helpB = t("optionKeysHelpB").replace("{{seconds}}", pollSec);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {helpA} {helpB}
      </p>
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("loadingEllipsis")}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          <div>
            <div className="grid grid-cols-7 gap-2 max-w-2xl">
              {grid.map((cell, i) => {
                const label = cell ? optionButtonLabel(cell, t) : "";
                return (
                  <button
                    key={i}
                    type="button"
                    title={cell || undefined}
                    onClick={() => onGridSlotClick(i)}
                    className={`aspect-square border rounded-md text-[10px] leading-tight px-0.5 flex items-center justify-center text-center transition-colors ${
                      selectedSlot === i ? "border-primary border-2 bg-primary/5" : "border-border hover:border-primary/50"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="text-center mt-6 flex flex-wrap justify-center gap-4">
              <Button variant="ghost" className="text-muted-foreground" onClick={removeFromSelected} disabled={selectedSlot === null}>
                {t("removeFromPlaceLabel")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  markLayoutDirty();
                  setGrid(buildAutoArrangedOptionButtonLayout());
                  setSelectedSlot(null);
                  setSelectedPoolId(null);
                }}
              >
                {t("autoArrange")}
              </Button>
            </div>
          </div>
          <div className="border border-border rounded-md min-h-[300px] p-2 flex flex-col gap-2">
            <div className="text-xs font-medium text-muted-foreground px-1">{t("keySidebarUnassigned")}</div>
            <div className="flex-1 overflow-y-auto space-y-1 pr-1 max-h-[420px]">
              {poolItems.length === 0 ? (
                <p className="text-xs text-muted-foreground px-1">{t("keySidebarAllPlaced")}</p>
              ) : (
                poolItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onPoolItemClick(item.id)}
                    className={`w-full text-left text-xs rounded border px-2 py-1.5 hover:bg-muted/60 ${
                      selectedPoolId === item.id ? "border-primary border-2 bg-primary/5" : "border-border"
                    }`}
                  >
                    {optionButtonLabel(item.id, t)}
                  </button>
                ))
              )}
            </div>
            <div className="flex justify-around gap-2 pt-2 border-t border-border opacity-40 pointer-events-none">
              <Button variant="ghost" size="icon" type="button" disabled>
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" type="button" disabled>
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className="flex justify-center pt-4">
        <Button
          type="button"
          disabled={saving || loading}
          onClick={() => void save()}
          className="gap-2 bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-sm"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("save")}
        </Button>
      </div>
    </div>
  );
}

function FunctionKeysPanel() {
  const { t } = useLanguage();
  const [slots, setSlots] = useState<string[]>(() => normalizeFunctionButtonsLayout([]));
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const layoutDirtyRef = useRef(false);
  const lastServerSigRef = useRef<string | null>(null);

  const markLayoutDirty = () => {
    layoutDirtyRef.current = true;
  };

  const load = useCallback(async () => {
    setLoading(true);
    layoutDirtyRef.current = false;
    try {
      const data = await apiRequest<{ value: unknown }>("/api/settings/function-buttons-layout");
      const norm = normalizeFunctionButtonsLayout(data?.value);
      lastServerSigRef.current = JSON.stringify(norm);
      setSlots(norm);
    } catch {
      toast({ variant: "destructive", description: t("failedLoadFunctionButtonsLayout") });
      const norm = normalizeFunctionButtonsLayout([]);
      lastServerSigRef.current = JSON.stringify(norm);
      setSlots(norm);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading) return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const data = await apiRequest<{ value: unknown }>("/api/settings/function-buttons-layout");
        if (cancelled) return;
        const next = normalizeFunctionButtonsLayout(data?.value);
        const sig = JSON.stringify(next);
        if (sig === lastServerSigRef.current) return;
        if (layoutDirtyRef.current) return;
        lastServerSigRef.current = sig;
        setSlots(next);
        setSelectedSlot(null);
        setSelectedPoolId(null);
      } catch {
        /* silent */
      }
    };
    void poll();
    const id = window.setInterval(poll, OPTION_LAYOUT_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [loading]);

  const assignedIds = useMemo(() => new Set(slots.filter(Boolean)), [slots]);
  const poolItems = useMemo(
    () => FUNCTION_BUTTON_ITEMS.filter((item) => !assignedIds.has(item.id)),
    [assignedIds],
  );

  const placePoolIdAtSlot = (itemId: string, slotIndex: number) => {
    markLayoutDirty();
    setSlots((prev) => {
      const next = [...prev];
      const dup = next.findIndex((x, j) => x === itemId && j !== slotIndex);
      if (dup >= 0) next[dup] = "";
      next[slotIndex] = itemId;
      return normalizeFunctionButtonsLayout(next);
    });
    setSelectedPoolId(null);
    setSelectedSlot(null);
  };

  const onPoolItemClick = (itemId: string) => {
    if (selectedSlot !== null) {
      placePoolIdAtSlot(itemId, selectedSlot);
      return;
    }
    setSelectedPoolId((p) => (p === itemId ? null : itemId));
  };

  const onGridSlotClick = (idx: number) => {
    if (selectedPoolId) {
      placePoolIdAtSlot(selectedPoolId, idx);
      return;
    }
    if (selectedSlot === null) {
      setSelectedSlot(idx);
      return;
    }
    if (selectedSlot === idx) {
      setSelectedSlot(null);
      return;
    }
    const j = selectedSlot;
    const a = slots[j] || "";
    const b = slots[idx] || "";
    if (!a && !b) {
      setSelectedSlot(idx);
      return;
    }
    markLayoutDirty();
    setSlots((prev) => {
      const pa = prev[j] || "";
      const pb = prev[idx] || "";
      if (pa && pb) {
        const next = [...prev];
        next[j] = pb;
        next[idx] = pa;
        return normalizeFunctionButtonsLayout(next);
      }
      if (pa && !pb) {
        const next = [...prev];
        next[j] = "";
        next[idx] = pa;
        return normalizeFunctionButtonsLayout(next);
      }
      if (!pa && pb) {
        const next = [...prev];
        next[j] = pb;
        next[idx] = "";
        return normalizeFunctionButtonsLayout(next);
      }
      return prev;
    });
    setSelectedSlot(null);
  };

  const removeFromSelected = () => {
    if (selectedSlot === null) return;
    markLayoutDirty();
    setSlots((prev) => {
      const next = [...prev];
      if (!next[selectedSlot]) return prev;
      next[selectedSlot] = "";
      return normalizeFunctionButtonsLayout(next);
    });
    setSelectedSlot(null);
    setSelectedPoolId(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      const normalized = normalizeFunctionButtonsLayout(slots);
      const data = await apiRequest<{ value: unknown }>("/api/settings/function-buttons-layout", {
        method: "PUT",
        body: JSON.stringify({ value: normalized }),
      });
      const norm = normalizeFunctionButtonsLayout(data?.value ?? normalized);
      lastServerSigRef.current = JSON.stringify(norm);
      layoutDirtyRef.current = false;
      setSlots(norm);
      toast({ title: t("save"), description: t("dsFunctionKeys") });
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : t("saveFailedGeneric"),
      });
    } finally {
      setSaving(false);
    }
  };

  const pollSec = String(OPTION_LAYOUT_POLL_MS / 1000);
  const fnHelpA = t("functionKeysHelpA").replace("{{sectionTitle}}", t("dsFunctionKeys"));
  const fnHelpB = t("functionKeysHelpB").replace("{{seconds}}", pollSec);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {fnHelpA} {fnHelpB}
      </p>
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("loadingEllipsis")}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          <div>
            <div className="grid grid-cols-4 gap-2 max-w-xl">
              {slots.map((cell, i) => {
                const label = cell ? functionButtonLabel(cell, t) : "";
                return (
                  <button
                    key={i}
                    type="button"
                    title={cell || undefined}
                    onClick={() => onGridSlotClick(i)}
                    className={`min-h-[52px] border rounded-md text-xs px-1 flex items-center justify-center text-center transition-colors ${
                      selectedSlot === i ? "border-primary border-2 bg-primary/5" : "border-border hover:border-primary/50"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="text-center mt-6 flex flex-wrap justify-center gap-4">
              <Button variant="ghost" className="text-muted-foreground" onClick={removeFromSelected} disabled={selectedSlot === null}>
                {t("removeFromPlaceLabel")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  markLayoutDirty();
                  setSlots(buildDefaultFunctionButtonsLayout());
                  setSelectedSlot(null);
                  setSelectedPoolId(null);
                }}
              >
                {t("autoArrange")}
              </Button>
            </div>
          </div>
          <div className="border border-border rounded-md min-h-[220px] p-2 flex flex-col gap-2">
            <div className="text-xs font-medium text-muted-foreground px-1">{t("keySidebarUnassigned")}</div>
            <div className="flex-1 overflow-y-auto space-y-1 pr-1 max-h-[320px]">
              {poolItems.length === 0 ? (
                <p className="text-xs text-muted-foreground px-1">{t("keySidebarAllPlaced")}</p>
              ) : (
                poolItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onPoolItemClick(item.id)}
                    className={`w-full text-left text-xs rounded border px-2 py-1.5 hover:bg-muted/60 ${
                      selectedPoolId === item.id ? "border-primary border-2 bg-primary/5" : "border-border"
                    }`}
                  >
                    {functionButtonLabel(item.id, t)}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      <div className="flex justify-center pt-4">
        <Button
          type="button"
          disabled={saving || loading}
          onClick={() => void save()}
          className="gap-2 bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-sm"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("save")}
        </Button>
      </div>
    </div>
  );
}
