import { useCallback, useEffect, useRef, useState } from "react";
import { Save, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import {
  SYSTEM_SETTINGS_MODAL_POLL_MS,
  POS_SYSTEM_SETTINGS_CHANGED_EVENT,
} from "@/lib/optionButtonLayout";

type SubTab = "general" | "prices" | "ticket";

const TICKET_PRINT_MODES = [
  "Production ticket",
  "label-small",
  "label-large",
  "label-Production ticket + Small label",
  "Production ticket + Large label",
] as const;

const BARCODE_TYPES = ["Code39", "Code93", "Code128", "Interleaved2of5"] as const;

/** Radix Select forbids `SelectItem value=""`; use sentinel for “no price group” and map to `""` for the API. */
const PRICE_GROUP_SELECT_SENTINEL = "__pg_none__";
function priceGroupFieldToSelectValue(v: string): string {
  return v === "" ? PRICE_GROUP_SELECT_SENTINEL : v;
}
function selectValueToPriceGroupField(v: string): string {
  return v === PRICE_GROUP_SELECT_SENTINEL ? "" : v;
}

function bool(v: unknown, fallback: boolean): boolean {
  return v != null ? !!v : fallback;
}

function str(v: unknown, fallback = ""): string {
  return v != null && v !== undefined ? String(v) : fallback;
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function SystemSettings() {
  const { t } = useLanguage();
  const [sub, setSub] = useState<SubTab>("general");
  const [serverSystem, setServerSystem] = useState<Record<string, unknown>>({});
  const [bootLoaded, setBootLoaded] = useState(false);
  const [savingSection, setSavingSection] = useState(false);
  const [priceGroups, setPriceGroups] = useState<Array<{ id: string; name: string }>>([]);
  const formDirtyRef = useRef(false);
  const lastSigRef = useRef<string | null>(null);

  const fetchFull = useCallback(async () => {
    try {
      const data = await apiRequest<{ value: Record<string, unknown> }>("/api/settings/system-settings");
      const v = (data?.value && typeof data.value === "object" ? data.value : {}) as Record<string, unknown>;
      const sig = JSON.stringify(v);
      if (sig === lastSigRef.current) return;
      if (formDirtyRef.current) return;
      lastSigRef.current = sig;
      setServerSystem(v);
    } catch {
      toast({ variant: "destructive", description: t("failedLoadSystemSettings") });
    } finally {
      setBootLoaded(true);
    }
  }, [t]);

  const patchSystem = useCallback((patch: Record<string, unknown>) => {
    formDirtyRef.current = true;
    setServerSystem((prev) => ({ ...prev, ...patch }));
  }, []);

  const saveSection = useCallback(
    async (patch: Record<string, unknown>) => {
      setSavingSection(true);
      try {
        const prev = await apiRequest<{ value: Record<string, unknown> }>("/api/settings/system-settings");
        const base = (prev.value && typeof prev.value === "object" ? prev.value : {}) as Record<string, unknown>;
        const merged = { ...base, ...patch };
        await apiRequest("/api/settings/system-settings", {
          method: "PUT",
          body: JSON.stringify({ value: merged }),
        });
        formDirtyRef.current = false;
        lastSigRef.current = JSON.stringify(merged);
        setServerSystem(merged);
        toast({ title: t("save"), description: t("systemSettings") });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(POS_SYSTEM_SETTINGS_CHANGED_EVENT));
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

  useEffect(() => {
    void fetchFull();
  }, [fetchFull]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void fetchFull();
    }, SYSTEM_SETTINGS_MODAL_POLL_MS);
    const onPush = () => {
      void fetchFull();
    };
    window.addEventListener(POS_SYSTEM_SETTINGS_CHANGED_EVENT, onPush);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(POS_SYSTEM_SETTINGS_CHANGED_EVENT, onPush);
    };
  }, [fetchFull]);

  useEffect(() => {
    if (sub !== "prices") return;
    void (async () => {
      try {
        const rows = await apiRequest<Array<{ id: string; name?: string }>>("/api/price-groups");
        setPriceGroups(Array.isArray(rows) ? rows.map((r) => ({ id: String(r.id), name: String(r.name || r.id) })) : []);
      } catch {
        setPriceGroups([]);
      }
    })();
  }, [sub]);

  const buildPayloadFromState = useCallback(() => ({ ...serverSystem }), [serverSystem]);

  const tabs: { id: SubTab; label: string }[] = [
    { id: "general", label: t("ssGeneral") },
    { id: "prices", label: t("ssPrices") },
    { id: "ticket", label: t("ssTicket") },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-around items-center border-b border-border pb-3">
        {tabs.map((tab) => {
          const isActive = tab.id === sub;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSub(tab.id)}
              className={`text-sm transition-colors ${
                isActive ? "text-primary font-medium" : "text-foreground hover:text-primary"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {!bootLoaded ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
          {t("loadingEllipsis")}
        </div>
      ) : (
        <>
          {sub === "general" && (
            <GeneralPanel s={serverSystem} patch={patchSystem} onSave={() => saveSection(buildPayloadFromState())} saving={savingSection} />
          )}
          {sub === "prices" && (
            <PricesPanel s={serverSystem} patch={patchSystem} priceGroups={priceGroups} onSave={() => saveSection(buildPayloadFromState())} saving={savingSection} />
          )}
          {sub === "ticket" && (
            <TicketPanel s={serverSystem} patch={patchSystem} onSave={() => saveSection(buildPayloadFromState())} saving={savingSection} />
          )}
        </>
      )}
    </div>
  );
}

function DeviceSectionSave({ onSave, saving }: { onSave: () => void | Promise<void>; saving: boolean }) {
  const { t } = useLanguage();
  return (
    <div className="flex justify-center pt-8">
      <Button
        type="button"
        variant="ghost"
        disabled={saving}
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
  s,
  patch,
  onSave,
  saving,
}: {
  s: Record<string, unknown>;
  patch: (p: Record<string, unknown>) => void;
  onSave: () => void | Promise<void>;
  saving: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1">
        <div>
          <Row label={t("useStockManagement")}><Checkbox checked={bool(s.useStockManagement, true)} onCheckedChange={(v) => patch({ useStockManagement: !!v })} /></Row>
          <Row label={t("usePriceGroups")}><Checkbox checked={bool(s.usePriceGroups, true)} onCheckedChange={(v) => patch({ usePriceGroups: !!v })} /></Row>
          <Row label={t("loginWithoutCode")}><Checkbox checked={bool(s.loginWithoutCode, true)} onCheckedChange={(v) => patch({ loginWithoutCode: !!v })} /></Row>
          <Row label={t("categoriesPerRegister")}><Checkbox checked={bool(s.categorieenPerKassa, true)} onCheckedChange={(v) => patch({ categorieenPerKassa: !!v })} /></Row>
          <Row label={t("qrOrdersAutoAccept")}><Checkbox checked={bool(s.autoAcceptQROrders, false)} onCheckedChange={(v) => patch({ autoAcceptQROrders: !!v })} /></Row>
          <Row label={t("qrOrdersAutoSettle")}><Checkbox checked={bool(s.qrOrdersAutomatischAfrekenen, false)} onCheckedChange={(v) => patch({ qrOrdersAutomatischAfrekenen: !!v })} /></Row>
          <Row label={t("onlyQrToKitchenScreen")}><Checkbox checked={bool(s.enkelQROrdersKeukenscherm, false)} onCheckedChange={(v) => patch({ enkelQROrdersKeukenscherm: !!v })} /></Row>
          <Row label={t("aspect169")} sub={t("windows")}><Checkbox checked={bool(s.aspect169Windows, false)} onCheckedChange={(v) => patch({ aspect169Windows: !!v })} /></Row>
          <Row label={t("vatOfDiversProduct")}>
            <Select value={str(s.vatRateVariousProducts, "12")} onValueChange={(v) => patch({ vatRateVariousProducts: v })}>
              <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["0", "6", "9", "12", "21"].map((v) => (
                  <SelectItem key={v} value={v}>{v}%</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
        </div>
        <div>
          <Row label={t("productsManualSort")}><Checkbox checked={bool(s.arrangeProductsManually, true)} onCheckedChange={(v) => patch({ arrangeProductsManually: !!v })} /></Row>
          <Row label={t("oneWaitOrderPerCustomer")}><Checkbox checked={bool(s.oneWachtorderPerKlant, false)} onCheckedChange={(v) => patch({ oneWachtorderPerKlant: !!v })} /></Row>
          <Row label={t("cashButtonVisibleMultipleMethods")}><Checkbox checked={bool(s.cashButtonVisibleMultiplePayment, true)} onCheckedChange={(v) => patch({ cashButtonVisibleMultiplePayment: !!v })} /></Row>
          <Row label={t("usePlaceSettings")}><Checkbox checked={bool(s.usePlaceSettings, false)} onCheckedChange={(v) => patch({ usePlaceSettings: !!v })} /></Row>
          <Row label={t("autoLoadCredit")}><Checkbox checked={bool(s.tegoedAutomatischInladen, true)} onCheckedChange={(v) => patch({ tegoedAutomatischInladen: !!v })} /></Row>
          <Row label={t("useLatestPrice")}><Checkbox checked={bool(s.nieuwstePrijsGebruiken, true)} onCheckedChange={(v) => patch({ nieuwstePrijsGebruiken: !!v })} /></Row>
          <Row label={t("emptiesReturn")}>
            <Select value={str(s.leeggoedTerugname, "by-customers-name")} onValueChange={(v) => patch({ leeggoedTerugname: v })}>
              <SelectTrigger className="w-52 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="by-customers-name">{t("onCustomerName")}</SelectItem>
                <SelectItem value="other">{t("emptiesReturnOther")}</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label={t("printQrCustomerData")}><Checkbox checked={bool(s.klantgegevensQRAfdrukken, false)} onCheckedChange={(v) => patch({ klantgegevensQRAfdrukken: !!v })} /></Row>
          <Row label={t("limitOneUserPerTable")}><Checkbox checked={bool(s.limitOneUserPerTable, false)} onCheckedChange={(v) => patch({ limitOneUserPerTable: !!v })} /></Row>
        </div>
      </div>
      <DeviceSectionSave onSave={onSave} saving={saving} />
    </div>
  );
}

function PricesPanel({
  s,
  patch,
  priceGroups,
  onSave,
  saving,
}: {
  s: Record<string, unknown>;
  patch: (p: Record<string, unknown>) => void;
  priceGroups: Array<{ id: string; name: string }>;
  onSave: () => void | Promise<void>;
  saving: boolean;
}) {
  const { t } = useLanguage();
  const groups = priceGroups.filter(
    (g) => String(g.id ?? "").trim() !== "" && String(g.id) !== PRICE_GROUP_SELECT_SENTINEL,
  );
  const pgOpts = [{ id: PRICE_GROUP_SELECT_SENTINEL, name: t("disabled") }, ...groups];
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="text-center font-medium mb-4">{t("defaultPriceGroup")}:</div>
          <div className="space-y-2">
            <Row label={t("chosenCustomerPickup")}>
              <Select
                value={priceGroupFieldToSelectValue(str(s.priceTakeAway))}
                onValueChange={(v) => patch({ priceTakeAway: selectValueToPriceGroupField(v) })}
              >
                <SelectTrigger className="w-52 h-8"><SelectValue placeholder=" " /></SelectTrigger>
                <SelectContent>
                  {pgOpts.map((g) => (
                    <SelectItem key={`pickup-${g.id}`} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <Row label={t("chosenCustomerDelivery")}>
              <Select
                value={priceGroupFieldToSelectValue(str(s.priceDelivery))}
                onValueChange={(v) => patch({ priceDelivery: selectValueToPriceGroupField(v) })}
              >
                <SelectTrigger className="w-52 h-8"><SelectValue placeholder=" " /></SelectTrigger>
                <SelectContent>
                  {pgOpts.map((g) => (
                    <SelectItem key={`d-${g.id}`} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <Row label={t("counterSale")}>
              <Select
                value={priceGroupFieldToSelectValue(str(s.priceCounterSale))}
                onValueChange={(v) => patch({ priceCounterSale: selectValueToPriceGroupField(v) })}
              >
                <SelectTrigger className="w-52 h-8"><SelectValue placeholder=" " /></SelectTrigger>
                <SelectContent>
                  {pgOpts.map((g) => (
                    <SelectItem key={`c-${g.id}`} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <Row label={t("priceTableSale")}>
              <Select
                value={priceGroupFieldToSelectValue(str(s.priceTableSale))}
                onValueChange={(v) => patch({ priceTableSale: selectValueToPriceGroupField(v) })}
              >
                <SelectTrigger className="w-52 h-8"><SelectValue placeholder=" " /></SelectTrigger>
                <SelectContent>
                  {pgOpts.map((g) => (
                    <SelectItem key={`t-${g.id}`} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
          </div>
        </Card>

        <Card className="p-6">
          <div className="text-center font-medium mb-4">{t("customerLoyaltyCard")}:</div>
          <div className="space-y-2">
            <Row label={t("pointsPerEuro")}>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => patch({ savingsPointsPerEuro: num(s.savingsPointsPerEuro, 0) + 1 })}><ArrowUp className="h-3 w-3" /></Button>
              <Input className="w-14 h-8 text-center" value={num(s.savingsPointsPerEuro, 0)} onChange={(e) => patch({ savingsPointsPerEuro: Number(e.target.value) || 0 })} />
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => patch({ savingsPointsPerEuro: Math.max(0, num(s.savingsPointsPerEuro, 0) - 1) })}><ArrowDown className="h-3 w-3" /></Button>
            </Row>
            <Row label={t("pointsPerDiscount")}>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => patch({ savingsPointsPerDiscount: num(s.savingsPointsPerDiscount, 0) + 1 })}><ArrowUp className="h-3 w-3" /></Button>
              <Input className="w-14 h-8 text-center" value={num(s.savingsPointsPerDiscount, 0)} onChange={(e) => patch({ savingsPointsPerDiscount: Number(e.target.value) || 0 })} />
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => patch({ savingsPointsPerDiscount: Math.max(0, num(s.savingsPointsPerDiscount, 0) - 1) })}><ArrowDown className="h-3 w-3" /></Button>
            </Row>
            <Row label={t("discountLabel")}>
              <Select value={str(s.savingsDiscount, "") || "disabled"} onValueChange={(v) => patch({ savingsDiscount: v === "disabled" ? "" : v })}>
                <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="disabled">{t("disabled")}</SelectItem>
                  <SelectItem value="percentage">{t("percentage")}</SelectItem>
                  <SelectItem value="amount">{t("amount")}</SelectItem>
                </SelectContent>
              </Select>
            </Row>
          </div>
        </Card>
      </div>
      <DeviceSectionSave onSave={onSave} saving={saving} />
    </div>
  );
}

function TicketPanel({
  s,
  patch,
  onSave,
  saving,
}: {
  s: Record<string, unknown>;
  patch: (p: Record<string, unknown>) => void;
  onSave: () => void | Promise<void>;
  saving: boolean;
}) {
  const { t } = useLanguage();
  const voucherVal = str(s.ticketVoucherValidity, "3");
  const printMode = str(s.ticketScheduledPrintMode, "label-large");
  const customerSort = str(s.ticketScheduledCustomerSort, "as-registered");
  const barcode = str(s.barcodeType, "Code39");
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1">
        <div>
          <Row label={t("askVatTicketPrinter")}><Checkbox checked={bool(s.usePlaceSettings, false)} onCheckedChange={(v) => patch({ usePlaceSettings: !!v })} /></Row>
          <Row label={t("ticketProductionPrinterCascade")}><Checkbox checked={bool(s.tegoedAutomatischInladen, true)} onCheckedChange={(v) => patch({ tegoedAutomatischInladen: !!v })} /></Row>
          <Row label={t("ticketDisplaySubproductsWithoutPrice")}><Checkbox checked={bool(s.nieuwstePrijsGebruiken, true)} onCheckedChange={(v) => patch({ nieuwstePrijsGebruiken: !!v })} /></Row>
          <Row label={t("printPricePerKilo")}><Checkbox checked={bool(s.nieuwstePrijsGebruiken, true)} onCheckedChange={(v) => patch({ nieuwstePrijsGebruiken: !!v })} /></Row>
          <Row label={t("printUnitPrice")}><Checkbox checked={bool(s.klantgegevensQRAfdrukken, false)} onCheckedChange={(v) => patch({ klantgegevensQRAfdrukken: !!v })} /></Row>
          <Row label={t("barcodeTypeGenerated")}>
            <Select value={barcode} onValueChange={(v) => patch({ barcodeType: v })}>
              <SelectTrigger className="w-52 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BARCODE_TYPES.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
        </div>
        <div>
          <Row label={t("voucherValidity")}>
            <Select value={voucherVal} onValueChange={(v) => patch({ ticketVoucherValidity: v })}>
              <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{t("voucherMonth1")}</SelectItem>
                <SelectItem value="3">{t("months3")}</SelectItem>
                <SelectItem value="6">{t("months6")}</SelectItem>
                <SelectItem value="12">{t("year1")}</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label={t("plannedOrdersPrintMode")}>
            <Select value={printMode} onValueChange={(v) => patch({ ticketScheduledPrintMode: v })}>
              <SelectTrigger className="w-[min(100%,280px)] h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TICKET_PRINT_MODES.map((m) => (
                  <SelectItem key={m} value={m} className="whitespace-normal">{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label={t("plannedOrdersCustomerSort")}>
            <Select value={customerSort} onValueChange={(v) => patch({ ticketScheduledCustomerSort: v })}>
              <SelectTrigger className="w-52 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="as-registered">{t("asEntered")}</SelectItem>
                <SelectItem value="Alphabetical first name">{t("alphabeticalFirstName")}</SelectItem>
                <SelectItem value="Alphabetical last name">{t("alphabeticalLastName")}</SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </div>
      </div>
      <DeviceSectionSave onSave={onSave} saving={saving} />
    </div>
  );
}
