import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlarmClock, Cloud, Loader2, Printer, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/api";
import type { TranslationKey } from "@/lib/translations";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const hours = Array.from({ length: 25 }, (_, i) => String(i).padStart(2, "0"));
const minutes = ["00", "15", "30", "45"];

const STORE_DISPLAY_NAME = "Retail POS Webpanel";
const REPORT_USER_LABEL = "info@pospoint.be";

function csvField(val: unknown): string {
  const s = val == null ? "" : String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

type InfoPerOrderLine = {
  id?: string;
  quantity: number;
  name: string;
  notes?: string | null;
};

type InfoPerOrderRow = {
  id: string;
  createdAt: string;
  updatedAt: string;
  total: number;
  kioskServiceType: string | null;
  source: string;
  items: InfoPerOrderLine[];
};

type InfoPerOrderResponse = {
  orders: InfoPerOrderRow[];
  periodStart: string;
  periodEndExclusive: string;
};

type Production2SubRow = {
  name: string;
  quantity: number;
  firstOrderAt?: string | null;
  lastOrderAt?: string | null;
};
type Production2ProductRow = {
  id: string;
  name: string;
  sortOrder: number;
  quantity: number;
  firstOrderAt?: string | null;
  lastOrderAt?: string | null;
  subproducts: Production2SubRow[];
};
type Production2CategoryRow = {
  id: string;
  name: string;
  sortOrder: number;
  products: Production2ProductRow[];
};

type Production2Response = {
  categories: Production2CategoryRow[];
  periodStart: string;
  periodEndExclusive: string;
};

function formatMoney(amount: number, lang: "nl" | "en") {
  return new Intl.NumberFormat(lang === "nl" ? "nl-BE" : "en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function orderServiceLabelKey(order: InfoPerOrderRow): TranslationKey {
  if (order.kioskServiceType === "takeaway") return "productionTakeaway";
  if (order.kioskServiceType === "dine_in") return "productionDineIn";
  if (order.source === "weborder") return "productionWeborder";
  return "productionCounter";
}

function shortOrderRef(id: string) {
  const compact = id.replace(/-/g, "");
  return compact.slice(-6).toUpperCase();
}

/** Stable 5-digit display number for Production 1 cards (matches receipt-style order numbers). */
function production1OrderNumber(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(31, h) + id.charCodeAt(i);
  }
  return String(10000 + (Math.abs(h) % 90000));
}

/** Subproduct names from line notes (same token rules as POS). */
function subproductNamesFromNotes(rawNotes: string | null | undefined): string[] {
  const tokens = String(rawNotes || "")
    .split(/[;,]/)
    .map((n) => n.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const token of tokens) {
    const rawName = String(token).split("::")[0];
    const name = String(rawName || "").trim();
    if (name) out.push(name);
  }
  return out;
}

type Production2PrintOrder = "qty-desc" | "alpha";

function orderTimeMs(iso?: string | null) {
  if (!iso) return 0;
  const n = new Date(iso).getTime();
  return Number.isFinite(n) ? n : 0;
}

/** Quantity large → small, then earliest sale in period (order time), then name. Only inside each card. */
function cmpQtyDescThenOrderTimeName(
  a: { quantity: number; firstOrderAt?: string | null; name: string },
  b: { quantity: number; firstOrderAt?: string | null; name: string },
  collator: Intl.Collator,
) {
  const q = b.quantity - a.quantity;
  if (q !== 0) return q;
  const ta = orderTimeMs(a.firstOrderAt);
  const tb = orderTimeMs(b.firstOrderAt);
  if (ta !== tb) return ta - tb;
  return collator.compare(a.name, b.name);
}

/** Print order applies only inside each category card (products + subproducts), never reorders cards. */
function sortProduction2Categories(
  data: Production2Response | undefined,
  order: Production2PrintOrder,
): Production2CategoryRow[] {
  if (!data?.categories?.length) return [];
  const collator = new Intl.Collator(undefined, { sensitivity: "base" });

  return data.categories.map((c) => {
    const products = c.products.map((p) => ({
      ...p,
      subproducts: [...p.subproducts],
    }));

    if (order === "alpha") {
      return {
        ...c,
        products: [...products]
          .sort((a, b) => collator.compare(a.name, b.name))
          .map((p) => ({
            ...p,
            subproducts: [...p.subproducts].sort((a, b) => collator.compare(a.name, b.name)),
          })),
      };
    }

    return {
      ...c,
      products: [...products]
        .sort((a, b) => cmpQtyDescThenOrderTimeName(a, b, collator))
        .map((p) => ({
          ...p,
          subproducts: [...p.subproducts].sort((a, b) =>
            cmpQtyDescThenOrderTimeName(a, b, collator),
          ),
        })),
    };
  });
}

/** Local calendar “today” for default period (avoids hardcoded demo dates). */
function localToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

const Production = () => {
  const { t, lang } = useLanguage();
  const [startH, setStartH] = useState("00");
  const [startM, setStartM] = useState("00");
  const [endH, setEndH] = useState("24");
  const [endM, setEndM] = useState("00");
  const [startDate, setStartDate] = useState<Date | undefined>(() => localToday());
  const [endDate, setEndDate] = useState<Date | undefined>(() => localToday());
  const [reportKind, setReportKind] = useState("info");
  const [prod2PrintOrder, setProd2PrintOrder] = useState<Production2PrintOrder>("qty-desc");
  const [printedAt, setPrintedAt] = useState(() => new Date());
  const [excelExporting, setExcelExporting] = useState(false);

  const startStr = startDate ? format(startDate, "dd-MM-yyyy") : "";
  const endStr = endDate ? format(endDate, "dd-MM-yyyy") : "";
  const startTimeStr = `${startH}:${startM}`;
  const endTimeStr = `${endH}:${endM}`;

  const queryParams = useMemo(() => {
    if (!startDate || !endDate) return null;
    const qs = new URLSearchParams({
      startDate: format(startDate, "dd-MM-yyyy"),
      startTime: startTimeStr,
      endDate: format(endDate, "dd-MM-yyyy"),
      endTime: endTimeStr,
    });
    return qs.toString();
  }, [startDate, endDate, startTimeStr, endTimeStr]);

  const ordersPeriodQuery = useQuery({
    queryKey: ["production-orders-period", queryParams ?? ""],
    queryFn: () => {
      if (!queryParams) throw new Error("missing period");
      return apiRequest<InfoPerOrderResponse>(`/api/reports/production/info-per-order?${queryParams}`);
    },
    enabled: (reportKind === "info" || reportKind === "prod1") && queryParams != null,
  });

  const prod2Query = useQuery({
    queryKey: ["production-2-by-category", queryParams ?? ""],
    queryFn: () => {
      if (!queryParams) throw new Error("missing period");
      return apiRequest<Production2Response>(`/api/reports/production/production-2?${queryParams}`);
    },
    enabled: reportKind === "prod2" && queryParams != null,
  });

  useEffect(() => {
    if ((reportKind === "info" || reportKind === "prod1") && ordersPeriodQuery.data) setPrintedAt(new Date());
    if (reportKind === "prod2" && prod2Query.data) setPrintedAt(new Date());
  }, [reportKind, ordersPeriodQuery.data, prod2Query.data]);

  const handlePrint = () => {
    setPrintedAt(new Date());
    window.print();
  };

  const handleExcelExport = async () => {
    if (!queryParams || !startDate || !endDate) {
      toast({ variant: "destructive", description: t("productionExcelExportFailed") });
      return;
    }
    setExcelExporting(true);
    try {
      const data = await apiRequest<InfoPerOrderResponse>(
        `/api/reports/production/info-per-order?${queryParams}`,
      );
      const header = ["order_id", "created_at", "paid_at", "source", "kiosk_service_type", "total", "lines"].map(csvField).join(",");
      const body = data.orders.map((o) => {
        const lines = o.items
          .map((it) => {
            const main = `${it.quantity}x ${it.name || ""}`;
            const subs = subproductNamesFromNotes(it.notes).map((s) => `${it.quantity}x ${s}`).join("; ");
            return subs ? `${main}; ${subs}` : main;
          })
          .join(" | ");
        return [
          csvField(o.id),
          csvField(o.createdAt),
          csvField(o.updatedAt),
          csvField(o.source),
          csvField(o.kioskServiceType ?? ""),
          csvField(o.total),
          csvField(lines),
        ].join(",");
      });
      const csv = `\ufeff${[header, ...body].join("\r\n")}`;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `production-export-${format(startDate, "yyyy-MM-dd")}_${format(endDate, "yyyy-MM-dd")}.csv`;
      a.rel = "noopener";
      a.click();
      URL.revokeObjectURL(url);
      toast({ description: t("productionExcelExported") });
    } catch {
      toast({ variant: "destructive", description: t("productionExcelExportFailed") });
    } finally {
      setExcelExporting(false);
    }
  };

  const reloadSupported = reportKind === "info" || reportKind === "prod1" || reportKind === "prod2";
  const reloadLoading =
    reportKind === "info" || reportKind === "prod1"
      ? ordersPeriodQuery.isLoading || ordersPeriodQuery.isFetching
      : reportKind === "prod2"
        ? prod2Query.isLoading || prod2Query.isFetching
        : false;

  const handleReload = () => {
    if (reportKind === "info" || reportKind === "prod1") void ordersPeriodQuery.refetch();
    else if (reportKind === "prod2") void prod2Query.refetch();
  };

  const periodLine = `${startH}:${startM} ${startStr} ${t("until")} ${endH}:${endM} ${endStr}`;
  const printedLine = `${t("printedOn")} : ${format(printedAt, "HH:mm dd-MM-yyyy")}`;
  const byLine = `${t("by")} : ${REPORT_USER_LABEL}`;

  const reportSubtitle =
    reportKind === "info"
      ? t("infoPerOrder")
      : reportKind === "prod1"
        ? t("production1")
        : reportKind === "prod2"
          ? t("production2")
          : "";

  const prod2SortedCategories = useMemo(
    () => sortProduction2Categories(prod2Query.data, prod2PrintOrder),
    [prod2Query.data, prod2PrintOrder],
  );

  return (
    <AppLayout>
      <div className="print:hidden">
        <PageHeader title={t("production")} icon={<AlarmClock className="h-5 w-5" />} />
      </div>

      <div className="max-w-6xl mx-auto">
        <div className="print:hidden space-y-3 mb-4">
          <div className="grid grid-cols-[140px_1fr] items-center gap-3">
            <Label className="text-sm font-medium text-right">{t("period")} :</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={startH} onValueChange={setStartH}>
                <SelectTrigger className="h-8 w-[72px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {hours.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={startM} onValueChange={setStartM}>
                <SelectTrigger className="h-8 w-[72px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {minutes.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-8 w-[140px] justify-start font-mono text-sm">
                    {startStr}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <span className="text-sm text-muted-foreground">{t("until")}</span>
              <Select value={endH} onValueChange={setEndH}>
                <SelectTrigger className="h-8 w-[72px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {hours.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={endM} onValueChange={setEndM}>
                <SelectTrigger className="h-8 w-[72px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {minutes.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-8 w-[140px] justify-start font-mono text-sm">
                    {endStr}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-[140px_1fr] items-center gap-3">
            <Label className="text-sm font-medium text-right">{t("reportType")} :</Label>
            <Select value={reportKind} onValueChange={setReportKind}>
              <SelectTrigger className="h-8 w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">{t("infoPerOrder")}</SelectItem>
                <SelectItem value="prod1">{t("production1")}</SelectItem>
                <SelectItem value="prod2">{t("production2")}</SelectItem>
                <SelectItem value="excel">{t("excelExport")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {reportKind === "prod2" && (
            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
              <Label className="text-sm font-medium text-right">{t("printOrder")} :</Label>
              <Select
                value={prod2PrintOrder}
                onValueChange={(v) => setProd2PrintOrder(v as Production2PrintOrder)}
              >
                <SelectTrigger className="h-8 w-full max-w-[280px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="qty-desc">{t("printOrderQtyDesc")}</SelectItem>
                  <SelectItem value="alpha">{t("printOrderAlpha")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {reportKind !== "excel" && (
            <div className="flex justify-center items-center gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 border-border text-foreground"
                onClick={handlePrint}
              >
                <Printer className="h-4 w-4" />
                {t("print")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 border-border text-foreground"
                disabled={!reloadSupported || queryParams == null || reloadLoading}
                onClick={handleReload}
              >
                <RefreshCw
                  className={cn(
                    "h-4 w-4",
                    ((reportKind === "info" || reportKind === "prod1") && ordersPeriodQuery.isFetching) ||
                      (reportKind === "prod2" && prod2Query.isFetching)
                      ? "animate-spin"
                      : "",
                  )}
                />
                {t("reload")}
              </Button>
            </div>
          )}

          {reportKind === "excel" && (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={queryParams == null || excelExporting}
                className="gap-2 text-foreground border border-border hover:bg-accent/50 hover:border-primary/50"
                onClick={() => void handleExcelExport()}
              >
                {excelExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Cloud className="h-4 w-4" />
                )}
                {t("exportAction")}
              </Button>
            </div>
          )}
        </div>

        {reportKind !== "excel" && (
        <Card
          className={cn(
            "p-6 md:p-8 shadow-card min-h-[320px] text-foreground",
            "print:shadow-none print:border-0 print:bg-white print:rounded-none",
            "print:!text-black print:[&_*]:!text-black print:[&_*]:![color:#000]",
          )}
        >
          {(reportKind === "info" || reportKind === "prod1" || reportKind === "prod2") && (
            <>
              <div className="flex w-full justify-between mb-6 min-h-[4.5rem]">
                <div className="text-center px-4 md:px-32">
                  <h2 className="text-xl font-bold text-foreground">{STORE_DISPLAY_NAME}</h2>
                  <p className="text-sm font-semibold text-foreground mt-1">{reportSubtitle}</p>
                </div>
                <div className="text-sm text-foreground text-right space-y-0.5 shrink-0">
                  <div>{periodLine}</div>
                  <div>{printedLine}</div>
                  <div>{byLine}</div>
                </div>
              </div>

              {reportKind === "info" && (
                <>
                  {ordersPeriodQuery.isLoading && (
                    <p className="text-sm text-muted-foreground text-center py-12">{t("loadingEllipsis")}</p>
                  )}
                  {ordersPeriodQuery.isError && (
                    <p className="text-sm text-destructive text-center py-12">{t("productionReportError")}</p>
                  )}
                  {!ordersPeriodQuery.isLoading &&
                    !ordersPeriodQuery.isError &&
                    ordersPeriodQuery.data &&
                    ordersPeriodQuery.data.orders.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-12">{t("productionNoPaidOrders")}</p>
                    )}
                  {!ordersPeriodQuery.isLoading &&
                    !ordersPeriodQuery.isError &&
                    ordersPeriodQuery.data &&
                    ordersPeriodQuery.data.orders.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch print:grid-cols-3 print:gap-3">
                      {ordersPeriodQuery.data.orders.map((order) => (
                        <div
                          key={order.id}
                          className="flex h-full min-h-0 flex-col border border-border rounded-md bg-background p-3 text-sm text-foreground"
                        >
                          <div className="shrink-0 border-b border-border/60 pb-2 mb-2 flex justify-between items-start gap-2">
                            <div>
                              <div className="font-medium">{t(orderServiceLabelKey(order))}</div>
                              <div className="text-muted-foreground tabular-nums">
                                {format(new Date(order.createdAt), "HH:mm dd-MM-yyyy")}
                              </div>
                            </div>
                            <div className="font-medium whitespace-nowrap shrink-0">
                              {t("productionOrderWord")} {shortOrderRef(order.id)}
                            </div>
                          </div>
                          <ul className="min-h-0 flex-1 list-none space-y-1 pl-0">
                            {order.items.flatMap((line, idx) => {
                              const subs = subproductNamesFromNotes(line.notes);
                              return [
                                <li key={`${order.id}-${line.id ?? idx}-p`}>
                                  {line.quantity}x {line.name || "—"}
                                </li>,
                                ...subs.map((subName, si) => (
                                  <li
                                    key={`${order.id}-${line.id ?? idx}-s-${si}`}
                                    className="pl-3 text-muted-foreground"
                                  >
                                    {line.quantity}x {subName}
                                  </li>
                                )),
                              ];
                            })}
                          </ul>
                          <div className="mt-auto shrink-0 border-t border-border/60 pt-2 font-medium">
                            {t("total")} : {formatMoney(order.total, lang)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {reportKind === "prod1" && (
                <>
                  {ordersPeriodQuery.isLoading && (
                    <p className="text-sm text-muted-foreground text-center py-12">{t("loadingEllipsis")}</p>
                  )}
                  {ordersPeriodQuery.isError && (
                    <p className="text-sm text-destructive text-center py-12">{t("productionReportError")}</p>
                  )}
                  {!ordersPeriodQuery.isLoading &&
                    !ordersPeriodQuery.isError &&
                    ordersPeriodQuery.data &&
                    ordersPeriodQuery.data.orders.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-12">{t("productionNoPaidOrders")}</p>
                    )}
                  {!ordersPeriodQuery.isLoading &&
                    !ordersPeriodQuery.isError &&
                    ordersPeriodQuery.data &&
                    ordersPeriodQuery.data.orders.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch print:grid-cols-3 print:gap-3">
                        {ordersPeriodQuery.data.orders.map((order) => (
                          <div
                            key={order.id}
                            className="rounded-md border border-border bg-background p-3 text-base font-normal text-foreground shadow-none print:border-black print:text-black"
                          >
                            <div className="font-normal leading-snug">
                              {t("productionOrderWord")} {production1OrderNumber(order.id)}
                            </div>
                            <ul className="mt-2 space-y-1 pl-4 leading-snug">
                              {order.items.flatMap((line, idx) => {
                                const subs = subproductNamesFromNotes(line.notes);
                                const rows = [
                                  <li key={`${order.id}-${idx}-p`} className="pl-0">
                                    {line.quantity}x {line.name || "—"}
                                  </li>,
                                  ...subs.map((subName, si) => (
                                    <li key={`${order.id}-${idx}-s-${si}`} className="pl-4">
                                      {line.quantity}x {subName}
                                    </li>
                                  )),
                                ];
                                return rows;
                              })}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                </>
              )}

              {reportKind === "prod2" && (
                <>
                  {prod2Query.isLoading && (
                    <p className="text-sm text-muted-foreground text-center py-12">{t("loadingEllipsis")}</p>
                  )}
                  {prod2Query.isError && (
                    <p className="text-sm text-destructive text-center py-12">{t("productionReportError")}</p>
                  )}
                  {!prod2Query.isLoading &&
                    !prod2Query.isError &&
                    prod2Query.data &&
                    prod2Query.data.categories.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-12">{t("productionNoPaidOrders")}</p>
                    )}
                  {!prod2Query.isLoading &&
                    !prod2Query.isError &&
                    prod2Query.data &&
                    prod2SortedCategories.length > 0 && (
                      <div className="text-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-3 print:gap-3 text-foreground">
                        {prod2SortedCategories.map((cat) => (
                          <section key={cat.id} className="border border-border/70 p-4 rounded-md">
                            <h3 className="text-xl font-bold text-foreground tracking-tight">
                              {/* <span className="text-muted-foreground font-semibold mr-2">{t("categories")}:</span> */}
                              {cat.name}
                            </h3>
                            <ul className="mt-1 space-y-1 pl-1">
                              {cat.products.map((prod) => (
                                <li key={prod.id} className="p-1">
                                  <div className="font-semibold text-foreground">
                                    {/* <span className="text-muted-foreground font-medium mr-2">{t("product")}:</span> */}
                                    {prod.quantity}x {prod.name}
                                  </div>
                                  {prod.subproducts.length > 0 && (
                                    <div className="mt-2 pl-2 border-l-2 border-primary/40">
                                      {/* <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                                        {t("subproducts")}
                                      </div> */}
                                      <ul className="space-y-1">
                                        {prod.subproducts.map((sub) => (
                                          <li key={sub.name} className="text-muted-foreground pl-1">
                                            {sub.quantity}x {sub.name}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </section>
                        ))}
                      </div>
                    )}
                </>
              )}
            </>
          )}

        </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default Production;
