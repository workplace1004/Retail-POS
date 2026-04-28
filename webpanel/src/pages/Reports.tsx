import { Fragment, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
import { format, parseISO, startOfDay } from "date-fns";
import {
  Cloud,
  CalendarIcon,
  Printer,
  FileText,
  Search,
  SlidersHorizontal,
  Save,
  BarChart3,
  Upload,
  Ticket,
  CalendarDays,
  TrendingUp,
  PackageOpen,
  Boxes,
  Clock,
  Truck,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { TabsBar } from "@/components/TabsBar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, type CalendarProps } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/api";
import { getRealtimeSocket } from "@/lib/realtime";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  SUPPLIER_REPORT_PRINT_AREA_ID,
  buildSupplierReportPdfFileName,
  downloadSupplierReportPdf,
} from "@/lib/supplierReportPdf";
import {
  STOCK_REPORT_PRINT_AREA_ID,
  buildStockReportPdfFileName,
  downloadStockReportPdf,
} from "@/lib/stockReportPdf";
import {
  TICKETS_REPORT_PRINT_AREA_ID,
  buildTicketsReportPdfFileName,
  downloadTicketsReportPdf,
} from "@/lib/ticketsReportPdf";
import {
  PERIODIC_REPORT_PRINT_AREA_ID,
  buildPeriodicReportPdfFileName,
  downloadPeriodicReportPdf,
} from "@/lib/periodicReportPdf";
import { BEST_REPORT_PRINT_AREA_ID, buildBestReportPdfFileName, downloadBestReportPdf } from "@/lib/bestReportPdf";
import {
  TIME_CLOCK_REPORT_PRINT_AREA_ID,
  buildTimeClockReportPdfFileName,
  downloadTimeClockReportPdf,
} from "@/lib/timeClockReportPdf";
import {
  EMPTIES_REPORT_PRINT_AREA_ID,
  buildEmptiesReportPdfFileName,
  downloadEmptiesReportPdf,
} from "@/lib/emptiesReportPdf";
import { Z_REPORT_PRINT_AREA_ID, buildZReportPdfFileName, downloadZReportPdf } from "@/lib/zReportPdf";

const PERIODIC_REPORT_PRINT_BODY_CLASS = "print-periodic-report-only";
const BEST_REPORT_PRINT_BODY_CLASS = "print-best-report-only";

const PERIODIC_SECTION_KEYS = [
  "categoryTotals",
  "productTotals",
  "vatTotals",
  "payments",
  "hourTotals",
  "hourTotalsPerUser",
] as const;
type PeriodicSectionKey = (typeof PERIODIC_SECTION_KEYS)[number];
type PeriodicSide = "L" | "R" | "off";
const PERIODIC_LAYOUT_STORAGE_KEY = "webpanel.periodicReport.sectionLayout";

function defaultPeriodicLayout(): Record<PeriodicSectionKey, PeriodicSide> {
  return {
    categoryTotals: "L",
    productTotals: "L",
    vatTotals: "L",
    payments: "R",
    hourTotals: "R",
    hourTotalsPerUser: "L",
  };
}

function parseStoredPeriodicLayout(raw: string | null): Record<PeriodicSectionKey, PeriodicSide> | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const base = defaultPeriodicLayout();
    for (const k of PERIODIC_SECTION_KEYS) {
      const v = o[k];
      if (v === "L" || v === "R" || v === "off") base[k] = v;
    }
    return base;
  } catch {
    return null;
  }
}

function periodicReportHourLabel(h: number) {
  const n = Math.min(24, Math.max(0, Math.round(Number(h) || 0)));
  return `${String(n).padStart(2, "0")}:00`;
}

function PeriodicReportSectionBlock({
  sectionKey,
  sections,
  title,
  t,
  formatReportMoney,
}: {
  sectionKey: PeriodicSectionKey;
  sections: Record<string, unknown>;
  title: string;
  t: (key: string) => string;
  formatReportMoney: (n: number) => string;
}) {
  const wrap = (inner: ReactNode) => (
    <div className="rounded-md border border-border bg-card p-3 text-sm shadow-sm print:border-neutral-300 print:bg-white print:shadow-none">
      <div className="mb-2 pb-1.5 text-center text-sm font-semibold text-foreground">
        {title}
      </div>
      {inner}
    </div>
  );

  if (sectionKey === "categoryTotals") {
    const block = sections.categoryTotals as
      | {
        rows?: {
          label: string;
          orderCount?: number;
          lineCount?: number;
          qty?: number;
          amount: number;
          isSubproducts?: boolean;
        }[];
        total?: number;
        totalOrderCount?: number;
        totalLineCount?: number;
        totalQty?: number;
      }
      | undefined;
    const rows = Array.isArray(block?.rows) ? block.rows : [];
    const total = Number(block?.total) || 0;
    /** Distinct orders that touched this category (legacy: lineCount / qty). */
    const categoryCounterForRow = (r: { orderCount?: number; lineCount?: number; qty?: number }) =>
      typeof r.orderCount === "number"
        ? r.orderCount
        : typeof r.lineCount === "number"
          ? r.lineCount
          : typeof r.qty === "number"
            ? r.qty
            : undefined;
    const totalOrdersFromServer = block?.totalOrderCount ?? block?.totalLineCount ?? block?.totalQty;
    const totalOrderCount =
      typeof totalOrdersFromServer === "number"
        ? totalOrdersFromServer
        : rows.reduce((s, r) => s + (categoryCounterForRow(r) ?? 0), 0);
    return wrap(
      <div className="space-y-1">
        {rows.length === 0 ? (
          <p className="text-muted-foreground">—</p>
        ) : (
          rows.map((r) => {
            const n = categoryCounterForRow(r);
            return (
              <div key={r.isSubproducts ? "__periodicSubproducts" : r.label} className="flex justify-between gap-2 tabular-nums">
                <span className="break-words text-left">
                  {typeof n === "number" ? `${n} ` : ""}
                  {r.label}
                </span>
                <span>{formatReportMoney(r.amount)}</span>
              </div>
            );
          })
        )}
        <div className="mt-2 flex justify-between pt-1.5 font-medium">
          <span>
            {rows.length > 0 ? `${totalOrderCount} ` : ""}
          </span>
          <span className="tabular-nums">{t("total")} &nbsp;&nbsp; : &nbsp;&nbsp;{formatReportMoney(total)}</span>
        </div>
      </div>,
    );
  }

  if (sectionKey === "productTotals") {
    const block = sections.productTotals as
      | { rows?: { label: string; qty: number; amount: number }[]; total?: number }
      | undefined;
    const rows = Array.isArray(block?.rows) ? block.rows : [];
    const total = Number(block?.total) || 0;
    const totalQtySum = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
    return wrap(
      <div className="space-y-1">
        {rows.length === 0 ? (
          <p className="text-muted-foreground">—</p>
        ) : (
          rows.map((r) => (
            <div key={r.label} className="flex justify-between gap-2 tabular-nums">
              <span className="break-words text-left">
                {Number(r.qty) || 0} {r.label}
              </span>
              <span className="whitespace-nowrap">{formatReportMoney(r.amount)}</span>
            </div>
          ))
        )}
        <div className="mt-2 flex justify-between pt-1.5 font-medium">
          <span>
            {rows.length > 0 ? `${totalQtySum} ` : ""}
          </span>
          <span className="tabular-nums">{t("total")} &nbsp;&nbsp; : &nbsp;&nbsp;{formatReportMoney(total)}</span>
        </div>
      </div>,
    );
  }

  if (sectionKey === "vatTotals") {
    const block = sections.vatTotals as
      | {
        rows?: { rateLabel: string; mvhNs: number; mvhNr: number; vat: number; gross: number; net: number }[];
        sums?: { mvhNs: number; mvhNr: number; vat: number; gross: number; net: number };
      }
      | undefined;
    const rows = Array.isArray(block?.rows) ? block.rows : [];
    const sums = block?.sums;
    const vatHdr2 = (top: string, bottom: string) => (
      <span className="flex min-h-[2.75rem] flex-col items-end justify-end gap-0 text-right">
        <span className="text-xs font-medium leading-tight text-muted-foreground">{top}</span>
        <span className="max-w-[9rem] text-[0.65rem] font-normal leading-tight text-muted-foreground">{bottom}</span>
      </span>
    );
    return wrap(
      <div className="space-y-1">
        {rows.length === 0 ? (
          <p className="text-muted-foreground">—</p>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-x-2 gap-y-1">
              <span className="flex min-h-[2.75rem] items-end pb-0.5 text-left text-xs font-medium leading-tight text-muted-foreground">
                {t("periodicVatHdrPurchaseVat")}
              </span>
              {vatHdr2(t("periodicVatHdrInclShort"), "")}
              {vatHdr2(t("periodicVatHdrExclShort"), "")}
              {vatHdr2(t("periodicVatHdrAmountShort"), "")}
            </div>
            {rows.map((r) => (
              <div key={r.rateLabel} className="grid grid-cols-4 gap-x-2 gap-y-1 tabular-nums text-sm text-foreground">
                <span className="min-w-0 font-medium">{r.rateLabel}</span>
                <span className="whitespace-nowrap text-right">{formatReportMoney(r.gross)}</span>
                <span className="whitespace-nowrap text-right">{formatReportMoney(r.net)}</span>
                <span className="whitespace-nowrap text-right">{formatReportMoney(r.vat)}</span>
              </div>
            ))}
            {sums ? (
              <div className="grid grid-cols-4 gap-x-2 gap-y-1 pt-1.5 font-medium tabular-nums">
                <span className="min-w-0 text-left">{t("total")}</span>
                <span className="whitespace-nowrap text-right">{formatReportMoney(sums.gross)}</span>
                <span className="whitespace-nowrap text-right">{formatReportMoney(sums.net)}</span>
                <span className="whitespace-nowrap text-right">{formatReportMoney(sums.vat)}</span>
              </div>
            ) : null}
          </>
        )}
      </div>,
    );
  }

  if (sectionKey === "payments") {
    const block = sections.payments as
      | {
        rows?: { label: string; orderCount?: number; amount: number }[];
        total?: number;
        totalOrderCount?: number;
      }
      | undefined;
    const rows = Array.isArray(block?.rows) ? block.rows : [];
    const total = Number(block?.total) || 0;
    return wrap(
      <div className="space-y-1">
        {rows.length === 0 ? (
          <p className="text-muted-foreground">—</p>
        ) : (
          rows.map((r) => (
            <div key={r.label} className="flex justify-between gap-2 tabular-nums">
              <span className="break-words text-left">{r.label}</span>
              <span className="whitespace-nowrap">{formatReportMoney(r.amount)}</span>
            </div>
          ))
        )}
        <div className="mt-2 flex justify-between pt-1.5 font-medium">
          <span>{t("total")}</span>
          <span className="tabular-nums">{formatReportMoney(total)}</span>
        </div>
      </div>,
    );
  }

  if (sectionKey === "hourTotals") {
    const block = sections.hourTotals as { rows?: { hour: number; tickets: number; amount: number }[] } | undefined;
    const rows = Array.isArray(block?.rows) ? block.rows : [];
    const totalTickets = rows.reduce((s, r) => s + (Number(r.tickets) || 0), 0);
    const totalAmount = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    return wrap(
      <div className="space-y-1">
        {rows.length === 0 ? (
          <p className="text-muted-foreground">—</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground tabular-nums">
              <span className="min-w-0 text-left">{t("periodicHourCol")}</span>
              <span className="text-center">{t("periodicTicketsCol")}</span>
              <span className="text-right">{t("amount")}</span>
            </div>
            {rows.map((r) => (
              <div key={r.hour} className="grid grid-cols-3 gap-2 tabular-nums text-foreground">
                <span className="min-w-0 text-left">{periodicReportHourLabel(r.hour)}</span>
                <span className="text-center">{Number(r.tickets) || 0}</span>
                <span className="whitespace-nowrap text-right">{formatReportMoney(r.amount)}</span>
              </div>
            ))}
            <div className="grid grid-cols-3 gap-2 pt-1.5 font-medium tabular-nums">
              <span className="min-w-0 text-left">{t("total")}</span>
              <span className="text-center">{totalTickets}</span>
              <span className="whitespace-nowrap text-right">{formatReportMoney(totalAmount)}</span>
            </div>
          </>
        )}
      </div>,
    );
  }

  if (sectionKey === "hourTotalsPerUser") {
    const block = sections.hourTotalsPerUser as
      | { users?: { userName: string; rows: { hour: number; tickets: number; amount: number }[] }[] }
      | undefined;
    const users = Array.isArray(block?.users) ? block.users : [];
    return wrap(
      <div className="space-y-4">
        {users.length === 0 ? (
          <p className="text-muted-foreground">—</p>
        ) : (
          users.map((u) => {
            const rowList = Array.isArray(u.rows) ? u.rows : [];
            const totalTickets = rowList.reduce((s, r) => s + (Number(r.tickets) || 0), 0);
            const totalAmount = rowList.reduce((s, r) => s + (Number(r.amount) || 0), 0);
            return (
              <div key={u.userName}>
                <div className="mb-1 font-medium text-foreground">{u.userName}</div>
                <div className="space-y-1">
                  {rowList.length === 0 ? (
                    <p className="text-muted-foreground text-sm">—</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground tabular-nums">
                        <span className="min-w-0 text-left">{t("periodicHourCol")}</span>
                        <span className="text-center">{t("periodicTicketsCol")}</span>
                        <span className="text-right">{t("amount")}</span>
                      </div>
                      {rowList.map((r) => (
                        <div
                          key={`${u.userName}-${r.hour}`}
                          className="grid grid-cols-3 gap-2 tabular-nums text-foreground"
                        >
                          <span className="min-w-0 text-left">{periodicReportHourLabel(r.hour)}</span>
                          <span className="text-center">{Number(r.tickets) || 0}</span>
                          <span className="whitespace-nowrap text-right">{formatReportMoney(r.amount)}</span>
                        </div>
                      ))}
                      <div className="grid grid-cols-3 gap-2 pt-1.5 font-medium tabular-nums">
                        <span className="min-w-0 text-left">{t("total")}</span>
                        <span className="text-center">{totalTickets}</span>
                        <span className="whitespace-nowrap text-right">{formatReportMoney(totalAmount)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>,
    );
  }

  return null;
}

type ReportPosUser = { id: string; name: string };
type ReportPosRegister = { id: string; name: string };
type ReportSupplier = { id: string; name: string };

type TicketReportRow = {
  id: string;
  rowNumber: number;
  event: string;
  registerName: string;
  settledAt: string;
  amount: number;
  payment: string;
  userName: string;
  customerName: string;
};

type StockReportRow = {
  productId: string;
  qty: number;
  qtyLabel: string;
  productName: string;
  categoryName: string;
  salePrice: number;
  purchasePrice: number;
  totalSale: number;
  totalPurchase: number;
  margin: number;
};

type TimeClockReportRow = {
  id: string;
  userId: string;
  userName: string;
  startAt: string | null;
  endAt: string | null;
  hours: number;
};
type ZPreviewPayload = {
  lines?: string[];
  periodStart?: string;
  periodEnd?: string;
  nextZNumber?: number;
  orderCount?: number;
};
type ZHistoryRow = {
  id: string;
  zNumber: number;
  periodStart: string;
  periodEnd: string;
  registerName?: string | null;
  closedByName?: string | null;
  createdAt?: string;
  grossTotal?: number | null;
};

type EmptiesTotals = { out: number; in: number; diff: number };
type EmptiesRow = { label: string; out: number; in: number; diff: number };

type BestSellersMode = "best25" | "worst25" | "p80" | "cust10";
type BestSellersDisplay = "text" | "pie" | "bar";
type ReportSectionVisibilityKey = "categoryTotals" | "productTotals" | "hourTotals" | "hourTotalsPerUser";
type BestSellersEntity = "products" | "customers";
type BestSellersRow = {
  label: string;
  qty: number;
  amount: number;
  category?: string;
};

const DatePickerField = ({
  value,
  onChange,
  disabled,
}: {
  value: Date;
  onChange: (d: Date) => void;
  disabled?: CalendarProps["disabled"];
}) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        className={cn("flex-1 justify-start text-left font-normal h-9", !value && "text-muted-foreground")}
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {value ? format(value, "dd-MM-yyyy") : <span>Pick a date</span>}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar
        mode="single"
        selected={value}
        onSelect={(d) => d && onChange(d)}
        initialFocus
        disabled={disabled}
        className={cn("p-3 pointer-events-auto")}
      />
    </PopoverContent>
  </Popover>
);

function reportHourLabel(h: string) {
  const n = Number(h);
  if (Number.isFinite(n) && n >= 0 && n <= 24) return `${String(n).padStart(2, "0")}:00`;
  return `${h}:00`;
}

function formatTimeClockDuration(totalSeconds: number) {
  const sec = Math.max(0, Math.round(Number(totalSeconds) || 0));
  if (sec < 60) return `${sec}s`;
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  if (hours > 0) return seconds > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${hours}h ${minutes}m`;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

function isZPreviewCenteredTitle(line: string) {
  const s = String(line || "").trim();
  if (!s || s.startsWith("-")) return false;
  if (/^Z\s+(FINANCIEEL|FINANCIAL)\b/i.test(s)) return true;
  return [
    "CATEGORIE TOTALEN",
    "CATEGORY TOTALS",
    "PRODUCT TOTALEN",
    "PRODUCT TOTALS",
    "BTW PER TARIEF",
    "VAT PER RATE",
    "BETALINGEN",
    "PAYMENTS",
    "TAKE-OUT",
    "TICKET SOORTEN",
    "TICKET TYPES",
    "UUR TOTALEN",
    "HOUR TOTALS PER USER",
    "HOUR TOTALS",
    "UUR TOTALEN PER GEBRUIKER",
  ].includes(s.toUpperCase());
}

function isZPreviewHeaderLine(line: string) {
  const s = String(line || "").trim();
  if (!s) return false;
  if (/^pospoint demo$/i.test(s)) return true;
  if (/^BE[0-9]+$/i.test(s)) return true;
  if (/^pospoint$/i.test(s)) return true;
  return false;
}

function formatZReportLineForDisplay(line: string, isSaved: boolean) {
  const raw = String(line ?? "");
  // Keep date+time visible and normalized like the classic report header.
  if (/\b(Date|Datum)\s*:/.test(raw) && /\b(Time|Tijd)\s*:/.test(raw)) {
    const m = raw.match(
      /^\s*(?:Date|Datum)\s*:\s*(\d{2}-\d{2}-\d{4})\s+(?:Time|Tijd)\s*:\s*(\d{2}:\d{2}:\d{2})\s*$/i,
    );
    if (m) {
      const timeLabel = /Tijd/i.test(raw) ? "Tijd" : "Time";
      return `Date : ${m[1]}            ${timeLabel}: ${m[2]}`;
    }
  }
  return raw;
}

const SUPPLIER_REPORT_PRINT_BODY_CLASS = "print-supplier-report-only";
const STOCK_REPORT_PRINT_BODY_CLASS = "print-stock-report-only";
const TICKETS_REPORT_PRINT_BODY_CLASS = "print-tickets-report-only";
const TIME_CLOCK_REPORT_PRINT_BODY_CLASS = "print-time-clock-report-only";
const EMPTIES_REPORT_PRINT_BODY_CLASS = "print-empties-report-only";
const Z_REPORT_PRINT_BODY_CLASS = "print-z-report-only";

/** Print only the report sheet (see `#supplier-report-print-area` + `index.css` @media print). */
function printSupplierReportMain() {
  document.body.classList.add(SUPPLIER_REPORT_PRINT_BODY_CLASS);
  let finished = false;
  const removeClass = () => {
    if (finished) return;
    finished = true;
    document.body.classList.remove(SUPPLIER_REPORT_PRINT_BODY_CLASS);
    window.removeEventListener("afterprint", removeClass);
  };
  window.addEventListener("afterprint", removeClass);
  window.setTimeout(removeClass, 2000);
  window.print();
}

/** Print only `#stock-report-print-area` (see `index.css` @media print). */
function printStockReportMain() {
  document.body.classList.add(STOCK_REPORT_PRINT_BODY_CLASS);
  let finished = false;
  const removeClass = () => {
    if (finished) return;
    finished = true;
    document.body.classList.remove(STOCK_REPORT_PRINT_BODY_CLASS);
    window.removeEventListener("afterprint", removeClass);
  };
  window.addEventListener("afterprint", removeClass);
  window.setTimeout(removeClass, 2000);
  window.print();
}

/** Print only `#tickets-report-print-area` (see `index.css` @media print). */
function printTicketsReportMain() {
  document.body.classList.add(TICKETS_REPORT_PRINT_BODY_CLASS);
  let finished = false;
  const removeClass = () => {
    if (finished) return;
    finished = true;
    document.body.classList.remove(TICKETS_REPORT_PRINT_BODY_CLASS);
    window.removeEventListener("afterprint", removeClass);
  };
  window.addEventListener("afterprint", removeClass);
  window.setTimeout(removeClass, 2000);
  window.print();
}

function printPeriodicReportMain() {
  document.body.classList.add(PERIODIC_REPORT_PRINT_BODY_CLASS);
  let finished = false;
  const removeClass = () => {
    if (finished) return;
    finished = true;
    document.body.classList.remove(PERIODIC_REPORT_PRINT_BODY_CLASS);
    window.removeEventListener("afterprint", removeClass);
  };
  window.addEventListener("afterprint", removeClass);
  window.setTimeout(removeClass, 2000);
  window.print();
}

function printBestReportMain() {
  document.body.classList.add(BEST_REPORT_PRINT_BODY_CLASS);
  let finished = false;
  const removeClass = () => {
    if (finished) return;
    finished = true;
    document.body.classList.remove(BEST_REPORT_PRINT_BODY_CLASS);
    window.removeEventListener("afterprint", removeClass);
  };
  window.addEventListener("afterprint", removeClass);
  window.setTimeout(removeClass, 2000);
  window.print();
}

function printTimeClockReportMain() {
  document.body.classList.add(TIME_CLOCK_REPORT_PRINT_BODY_CLASS);
  let finished = false;
  const removeClass = () => {
    if (finished) return;
    finished = true;
    document.body.classList.remove(TIME_CLOCK_REPORT_PRINT_BODY_CLASS);
    window.removeEventListener("afterprint", removeClass);
  };
  window.addEventListener("afterprint", removeClass);
  window.setTimeout(removeClass, 2000);
  window.print();
}

function printEmptiesReportMain() {
  document.body.classList.add(EMPTIES_REPORT_PRINT_BODY_CLASS);
  let finished = false;
  const removeClass = () => {
    if (finished) return;
    finished = true;
    document.body.classList.remove(EMPTIES_REPORT_PRINT_BODY_CLASS);
    window.removeEventListener("afterprint", removeClass);
  };
  window.addEventListener("afterprint", removeClass);
  window.setTimeout(removeClass, 2000);
  window.print();
}

function printZReportMain() {
  document.body.classList.add(Z_REPORT_PRINT_BODY_CLASS);
  let finished = false;
  const removeClass = () => {
    if (finished) return;
    finished = true;
    document.body.classList.remove(Z_REPORT_PRINT_BODY_CLASS);
    window.removeEventListener("afterprint", removeClass);
  };
  window.addEventListener("afterprint", removeClass);
  window.setTimeout(removeClass, 2000);
  window.print();
}

const Reports = () => {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("tickets");
  const [fromDate, setFromDate] = useState<Date>(new Date());
  const [toDate, setToDate] = useState<Date>(new Date());
  /** Shared report range: To cannot be before From; From cannot be after To (calendars + auto-clamp). */
  const reportRangeFromCalendarDisabled = useMemo(() => ({ after: startOfDay(toDate) }), [toDate]);
  const reportRangeToCalendarDisabled = useMemo(() => ({ before: startOfDay(fromDate) }), [fromDate]);
  useEffect(() => {
    if (startOfDay(fromDate) > startOfDay(toDate)) {
      setToDate(fromDate);
    }
  }, [fromDate, toDate]);
  const [ticketsOpen, setTicketsOpen] = useState(false);
  const closeTicketsModal = useCallback(() => setTicketsOpen(false), []);
  const ticketsDialogOverlayProps = useMemo(() => ({ onPointerDown: closeTicketsModal }), [closeTicketsModal]);
  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketFromHour, setTicketFromHour] = useState("0");
  const [ticketToHour, setTicketToHour] = useState("24");
  const [ticketRows, setTicketRows] = useState<TicketReportRow[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsReportOpenedAt, setTicketsReportOpenedAt] = useState<Date | null>(null);
  const [ticketsPdfWorking, setTicketsPdfWorking] = useState(false);
  const ticketsPdfLockRef = useRef(false);
  const [expandedTicketOrderIds, setExpandedTicketOrderIds] = useState<string[]>([]);
  const [ticketOrderById, setTicketOrderById] = useState<
    Record<
      string,
      {
        id: string;
        total: number;
        items: Array<{
          id: string;
          quantity: number;
          price: number;
          product: { name?: string | null } | null;
        }>;
      }
    >
  >({});
  const [ticketExpandLoadingIds, setTicketExpandLoadingIds] = useState<string[]>([]);
  const [ticketExpandErrors, setTicketExpandErrors] = useState<Record<string, string>>({});
  const [zSubTab, setZSubTab] = useState<"history" | "create">("history");
  const [zCreateUntilMode, setZCreateUntilMode] = useState<"current" | "manual">("current");
  const [zCreateManualHour, setZCreateManualHour] = useState("0");
  const [zCreateManualDate, setZCreateManualDate] = useState<Date>(new Date());
  const [zPreviewOpen, setZPreviewOpen] = useState(false);
  const [zPreviewLoading, setZPreviewLoading] = useState(false);
  const [zPreviewPayload, setZPreviewPayload] = useState<ZPreviewPayload | null>(null);
  const [zReportSaving, setZReportSaving] = useState(false);
  const [zReportSaved, setZReportSaved] = useState(false);
  const [zPdfWorking, setZPdfWorking] = useState(false);
  const zPdfLockRef = useRef(false);
  const [zHistoryRows, setZHistoryRows] = useState<ZHistoryRow[]>([]);
  const [zHistoryReportId, setZHistoryReportId] = useState("");
  const [zHistoryMonth, setZHistoryMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [zHistoryYear, setZHistoryYear] = useState(String(new Date().getFullYear()));
  const [zHistoryLoading, setZHistoryLoading] = useState(false);
  const [reportSectionVisibility, setReportSectionVisibility] = useState<Record<ReportSectionVisibilityKey, boolean>>({
    categoryTotals: false,
    productTotals: false,
    hourTotals: false,
    hourTotalsPerUser: false,
  });
  const [dailyAutoCreateEnabled, setDailyAutoCreateEnabled] = useState(false);
  const [dailyAutoCreateHour, setDailyAutoCreateHour] = useState("00");
  const [dailyAutoCreateEmail, setDailyAutoCreateEmail] = useState("");
  const [reportSettingsSaving, setReportSettingsSaving] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportType, setExportType] = useState("orders");
  const [exportFrom, setExportFrom] = useState<Date>(new Date());
  const [exportTo, setExportTo] = useState<Date>(new Date());
  const [reportUsers, setReportUsers] = useState<ReportPosUser[]>([]);
  const [reportUserFilter, setReportUserFilter] = useState("all");
  const [reportRegisters, setReportRegisters] = useState<ReportPosRegister[]>([]);
  const [reportRegisterFilter, setReportRegisterFilter] = useState("all");
  const [clockFromHour, setClockFromHour] = useState("0");
  const [clockToHour, setClockToHour] = useState("24");
  const [emptiesReportType, setEmptiesReportType] = useState<"pieces" | "liters" | "kg" | "meters">("pieces");
  const [emptiesReportOpen, setEmptiesReportOpen] = useState(false);
  const [emptiesReportOpenedAt, setEmptiesReportOpenedAt] = useState<Date | null>(null);
  const [emptiesReportLoading, setEmptiesReportLoading] = useState(false);
  const [emptiesPdfWorking, setEmptiesPdfWorking] = useState(false);
  const emptiesPdfLockRef = useRef(false);
  const [emptiesCategoryTotals, setEmptiesCategoryTotals] = useState<EmptiesTotals>({ out: 0, in: 0, diff: 0 });
  const [emptiesProductTotals, setEmptiesProductTotals] = useState<EmptiesTotals>({ out: 0, in: 0, diff: 0 });
  const [emptiesTransactionTotals, setEmptiesTransactionTotals] = useState<EmptiesTotals>({ out: 0, in: 0, diff: 0 });
  const [emptiesCategoryRows, setEmptiesCategoryRows] = useState<EmptiesRow[]>([]);
  const [emptiesProductRows, setEmptiesProductRows] = useState<EmptiesRow[]>([]);
  const [emptiesTransactionRows, setEmptiesTransactionRows] = useState<EmptiesRow[]>([]);
  const [timeClockReportOpen, setTimeClockReportOpen] = useState(false);
  const [timeClockReportOpenedAt, setTimeClockReportOpenedAt] = useState<Date | null>(null);
  const [timeClockReportLoading, setTimeClockReportLoading] = useState(false);
  const [timeClockReportRows, setTimeClockReportRows] = useState<TimeClockReportRow[]>([]);
  const [timeClockPdfWorking, setTimeClockPdfWorking] = useState(false);
  const timeClockPdfLockRef = useRef(false);
  const [periodicFromHour, setPeriodicFromHour] = useState("0");
  const [periodicToHour, setPeriodicToHour] = useState("24");
  const [periodicLayout, setPeriodicLayout] = useState<Record<PeriodicSectionKey, PeriodicSide>>(() => {
    try {
      return parseStoredPeriodicLayout(localStorage.getItem(PERIODIC_LAYOUT_STORAGE_KEY)) ?? defaultPeriodicLayout();
    } catch {
      return defaultPeriodicLayout();
    }
  });
  const [periodicReportOpen, setPeriodicReportOpen] = useState(false);
  const [periodicReportLoading, setPeriodicReportLoading] = useState(false);
  const [periodicReportOpenedAt, setPeriodicReportOpenedAt] = useState<Date | null>(null);
  const [periodicReportPayload, setPeriodicReportPayload] = useState<{
    sections: Record<string, unknown>;
    labels?: { eatInTakeOutTitle?: string; ns?: string; nr?: string; total?: string };
    periodStart: string;
    periodEndExclusive: string;
  } | null>(null);
  const [periodicPdfWorking, setPeriodicPdfWorking] = useState(false);
  const periodicPdfLockRef = useRef(false);
  const closePeriodicModal = useCallback(() => setPeriodicReportOpen(false), []);
  const periodicDialogOverlayProps = useMemo(() => ({ onPointerDown: closePeriodicModal }), [closePeriodicModal]);
  const [bestFromHour, setBestFromHour] = useState("0");
  const [bestToHour, setBestToHour] = useState("24");
  const [bestMode, setBestMode] = useState<BestSellersMode>("best25");
  const [bestDisplay, setBestDisplay] = useState<BestSellersDisplay>("text");
  const [bestReportOpen, setBestReportOpen] = useState(false);
  const [bestReportLoading, setBestReportLoading] = useState(false);
  const [bestReportOpenedAt, setBestReportOpenedAt] = useState<Date | null>(null);
  const [bestReportPayload, setBestReportPayload] = useState<{
    mode: BestSellersMode;
    entity: BestSellersEntity;
    rows: BestSellersRow[];
    categoryRows: Array<{ label: string; qty: number; amount: number }>;
    totals: { amount: number; qty: number };
    periodStart: string;
    periodEndExclusive: string;
  } | null>(null);
  const [bestPdfWorking, setBestPdfWorking] = useState(false);
  const bestPdfLockRef = useRef(false);
  const [reportSuppliers, setReportSuppliers] = useState<ReportSupplier[]>([]);
  const [reportSupplierFilter, setReportSupplierFilter] = useState("");
  const [supplierFromHour, setSupplierFromHour] = useState("0");
  const [supplierToHour, setSupplierToHour] = useState("24");
  const [supplierReportOpen, setSupplierReportOpen] = useState(false);
  const [supplierReportOpenedAt, setSupplierReportOpenedAt] = useState<Date | null>(null);
  const [supplierReportLoading, setSupplierReportLoading] = useState(false);
  const [supplierReportPayload, setSupplierReportPayload] = useState<{
    categoryRows: Array<{ label: string; qty: number; qtyLabel?: string; amount: number }>;
    rows: Array<{ label: string; qty: number; qtyLabel?: string; amount: number }>;
    totals: { amount: number; qty: number };
    periodStart: string;
    periodEndExclusive: string;
  } | null>(null);
  const [supplierPdfWorking, setSupplierPdfWorking] = useState(false);
  const supplierPdfLockRef = useRef(false);

  const [stockSortBy, setStockSortBy] = useState("product");
  const [stockDisplay, setStockDisplay] = useState("all");
  const [stockVat, setStockVat] = useState("incl");
  const [stockReportOpen, setStockReportOpen] = useState(false);
  const [stockReportOpenedAt, setStockReportOpenedAt] = useState<Date | null>(null);
  const [stockReportLoading, setStockReportLoading] = useState(false);
  const [stockReportRows, setStockReportRows] = useState<StockReportRow[]>([]);
  const [stockReportTotals, setStockReportTotals] = useState<{ openSale: number; openPurchase: number }>({
    openSale: 0,
    openPurchase: 0,
  });
  const [stockPdfWorking, setStockPdfWorking] = useState(false);
  const stockPdfLockRef = useRef(false);

  const loadReportUsers = useCallback(async () => {
    try {
      const rows = await apiRequest<Array<{ id: string; name: string; label?: string }>>("/api/webpanel/pos-users");
      setReportUsers(
        (Array.isArray(rows) ? rows : []).map((r) => ({
          id: r.id,
          name: (r.name || r.label || r.id).trim() || r.id,
        })),
      );
    } catch (e) {
      setReportUsers([]);
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Failed to load users.",
      });
    }
  }, []);

  const loadReportSuppliers = useCallback(async () => {
    try {
      const rows = await apiRequest<Array<{ id: string; companyName?: string }>>("/api/suppliers");
      setReportSuppliers(
        (Array.isArray(rows) ? rows : []).map((r) => ({
          id: r.id,
          name: (r.companyName || r.id).trim() || r.id,
        })),
      );
    } catch (e) {
      setReportSuppliers([]);
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Failed to load suppliers.",
      });
    }
  }, []);

  const loadReportRegisters = useCallback(async () => {
    try {
      const rows = await apiRequest<Array<{ id: string; name?: string }>>("/api/webpanel/pos-registers");
      setReportRegisters(
        (Array.isArray(rows) ? rows : []).map((r) => ({
          id: r.id,
          name: (r.name || r.id).trim() || r.id,
        })),
      );
    } catch (e) {
      setReportRegisters([]);
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Failed to load registers.",
      });
    }
  }, []);

  const loadReportSettings = useCallback(async () => {
    try {
      const data = await apiRequest<{
        value?: {
          sectionVisibility?: Partial<Record<ReportSectionVisibilityKey, unknown>>;
          dailyAutoCreateEnabled?: unknown;
          autoCreateHour?: unknown;
          sendEmailTo?: unknown;
        };
      }>("/api/settings/reports");
      const value = data?.value && typeof data.value === "object" ? data.value : {};
      const sectionVisibility =
        value.sectionVisibility && typeof value.sectionVisibility === "object" ? value.sectionVisibility : {};
      const parsedHourNum = Number.parseInt(String(value.autoCreateHour ?? "00"), 10);
      const safeHour = Number.isFinite(parsedHourNum) ? Math.max(0, Math.min(parsedHourNum, 23)) : 0;
      setReportSectionVisibility({
        categoryTotals: sectionVisibility.categoryTotals === true,
        productTotals: sectionVisibility.productTotals === true,
        hourTotals: sectionVisibility.hourTotals === true,
        hourTotalsPerUser: sectionVisibility.hourTotalsPerUser === true,
      });
      setDailyAutoCreateEnabled(value.dailyAutoCreateEnabled === true);
      setDailyAutoCreateHour(String(safeHour).padStart(2, "0"));
      setDailyAutoCreateEmail(String(value.sendEmailTo ?? ""));
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Failed to load report settings.",
      });
    }
  }, []);

  const saveReportSettings = useCallback(async () => {
    setReportSettingsSaving(true);
    try {
      const payload = {
        sectionVisibility: reportSectionVisibility,
        dailyAutoCreateEnabled,
        autoCreateHour: dailyAutoCreateHour,
        sendEmailTo: dailyAutoCreateEmail.trim(),
      };
      const data = await apiRequest<{
        value?: {
          sectionVisibility?: Partial<Record<ReportSectionVisibilityKey, unknown>>;
          dailyAutoCreateEnabled?: unknown;
          autoCreateHour?: unknown;
          sendEmailTo?: unknown;
        };
      }>("/api/settings/reports", {
        method: "PUT",
        body: JSON.stringify({ value: payload }),
      });
      const value = data?.value && typeof data.value === "object" ? data.value : payload;
      const sectionVisibility =
        value.sectionVisibility && typeof value.sectionVisibility === "object" ? value.sectionVisibility : {};
      const parsedHourNum = Number.parseInt(String(value.autoCreateHour ?? "00"), 10);
      const safeHour = Number.isFinite(parsedHourNum) ? Math.max(0, Math.min(parsedHourNum, 23)) : 0;
      setReportSectionVisibility({
        categoryTotals: sectionVisibility.categoryTotals === true,
        productTotals: sectionVisibility.productTotals === true,
        hourTotals: sectionVisibility.hourTotals === true,
        hourTotalsPerUser: sectionVisibility.hourTotalsPerUser === true,
      });
      setDailyAutoCreateEnabled(value.dailyAutoCreateEnabled === true);
      setDailyAutoCreateHour(String(safeHour).padStart(2, "0"));
      setDailyAutoCreateEmail(String(value.sendEmailTo ?? ""));
      toast({ description: t("save") });
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Failed to save report settings.",
      });
    } finally {
      setReportSettingsSaving(false);
    }
  }, [dailyAutoCreateEmail, dailyAutoCreateEnabled, dailyAutoCreateHour, reportSectionVisibility, t]);

  const loadZHistoryRows = useCallback(async (preferLatest = false) => {
    setZHistoryLoading(true);
    try {
      const rows = await apiRequest<ZHistoryRow[]>("/api/reports/financial/z/history?limit=200");
      const list = Array.isArray(rows) ? rows : [];
      setZHistoryRows(list);
      if (preferLatest) {
        setZHistoryReportId(list[0]?.id || "");
      } else {
        setZHistoryReportId((prev) => (prev && list.some((r) => r.id === prev) ? prev : list[0]?.id || ""));
      }
    } catch (e) {
      setZHistoryRows([]);
      setZHistoryReportId("");
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Failed to load Z report history.",
      });
    } finally {
      setZHistoryLoading(false);
    }
  }, []);

  const openSelectedZHistoryReport = useCallback(async () => {
    if (!zHistoryReportId) return;
    try {
      const data = await apiRequest<{ lines?: string[]; periodStart?: string; periodEnd?: string; zNumber?: number }>(
        `/api/reports/financial/z/${encodeURIComponent(zHistoryReportId)}/receipt`,
      );
      setZPreviewPayload({
        lines: Array.isArray(data?.lines) ? data.lines : [],
        periodStart: String(data?.periodStart ?? ""),
        periodEnd: String(data?.periodEnd ?? ""),
        nextZNumber: Number(data?.zNumber) || undefined,
        orderCount: 0,
      });
      setZReportSaved(true);
      setZPreviewOpen(true);
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Failed to load Z report.",
      });
    }
  }, [zHistoryReportId]);

  useEffect(() => {
    void loadReportUsers();
    void loadReportSuppliers();
    void loadReportRegisters();
    void loadReportSettings();
  }, [loadReportUsers, loadReportSuppliers, loadReportRegisters, loadReportSettings]);

  useEffect(() => {
    if (zSubTab !== "create") return;
    if (reportRegisterFilter !== "all") return;
    if (!reportRegisters.length) return;
    setReportRegisterFilter(reportRegisters[0]?.id || "all");
  }, [zSubTab, reportRegisterFilter, reportRegisters]);

  const userSelectContent = useMemo(
    () => (
      <>
        <SelectItem value="all">{t("allUsers")}</SelectItem>
        {reportUsers.map((u) => (
          <SelectItem key={u.id} value={u.id}>
            {u.name}
          </SelectItem>
        ))}
      </>
    ),
    [t, reportUsers],
  );

  const registerSelectContent = useMemo(
    () => (
      <>
        <SelectItem value="all">{t("allRegisters")}</SelectItem>
        {reportRegisters.map((r) => (
          <SelectItem key={r.id} value={r.id}>
            {r.name}
          </SelectItem>
        ))}
      </>
    ),
    [t, reportRegisters],
  );
  const registerSelectContentNoAll = useMemo(
    () => (
      <>
        {reportRegisters.map((r) => (
          <SelectItem key={r.id} value={r.id}>
            {r.name}
          </SelectItem>
        ))}
      </>
    ),
    [reportRegisters],
  );
  const zHistoryFilteredRows = useMemo(
    () =>
      zHistoryRows.filter((r) => {
        const d = new Date(r.periodEnd || r.createdAt || "");
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const y = String(d.getFullYear());
        if (!(m === zHistoryMonth && y === zHistoryYear)) return false;
        if (reportRegisterFilter === "all") return true;
        const selectedRegisterName =
          reportRegisters.find((x) => x.id === reportRegisterFilter)?.name?.trim().toLowerCase() || reportRegisterFilter.trim().toLowerCase();
        const rowRegisterName = String(r.registerName || "").trim().toLowerCase();
        // Match by exact register name when available; also allow id fallback.
        if (rowRegisterName) return rowRegisterName === selectedRegisterName || rowRegisterName === reportRegisterFilter.trim().toLowerCase();
        return false;
      }),
    [zHistoryRows, zHistoryMonth, zHistoryYear, reportRegisterFilter, reportRegisters],
  );
  const formatZHistoryOptionLabel = useCallback(
    (r: ZHistoryRow) => {
      const d = new Date(r.periodEnd || r.createdAt || "");
      const time = Number.isNaN(d.getTime()) ? "--:--:--" : format(d, "HH:mm:ss");
      const date = Number.isNaN(d.getTime()) ? "--/--/----" : format(d, "dd-MM-yyyy");
      const register = String(r.registerName || "").trim() || t("allRegisters");
      return `#${r.zNumber}  ${time}  ${date}  ${register}`;
    },
    [t],
  );

  const ticketReportUserLabel = useMemo(
    () =>
      reportUserFilter === "all"
        ? t("allUsers")
        : reportUsers.find((u) => u.id === reportUserFilter)?.name ?? "—",
    [reportUserFilter, reportUsers, t],
  );
  const timeClockUserLabel = useMemo(
    () => (reportUserFilter === "all" ? t("reportTotalsAllUsers") : `${t("user")}: ${ticketReportUserLabel}`),
    [reportUserFilter, t, ticketReportUserLabel],
  );
  const timeClockRowsForDisplay = useMemo(
    () =>
      timeClockReportRows.map((r) => ({
        id: r.id,
        userId: r.userId,
        name: r.userName,
        start: r.startAt ? parseISO(r.startAt) : null,
        stop: r.endAt ? parseISO(r.endAt) : null,
        durationSeconds:
          r.startAt && r.endAt
            ? Math.max(0, Math.round((Date.parse(r.endAt) - Date.parse(r.startAt)) / 1000))
            : Math.max(0, Math.round((Number(r.hours) || 0) * 3600)),
      })),
    [timeClockReportRows],
  );
  const timeClockGroupedRows = useMemo(() => {
    const grouped = new Map<
      string,
      {
        userId: string;
        name: string;
        entries: Array<{
          id: string;
          start: Date | null;
          stop: Date | null;
          durationSeconds: number;
        }>;
        totalSeconds: number;
      }
    >();
    for (const row of timeClockRowsForDisplay) {
      const key = row.userId || row.name;
      const existing = grouped.get(key);
      if (existing) {
        existing.entries.push({
          id: row.id,
          start: row.start,
          stop: row.stop,
          durationSeconds: row.durationSeconds,
        });
        existing.totalSeconds += row.durationSeconds;
      } else {
        grouped.set(key, {
          userId: row.userId,
          name: row.name,
          entries: [
            {
              id: row.id,
              start: row.start,
              stop: row.stop,
              durationSeconds: row.durationSeconds,
            },
          ],
          totalSeconds: row.durationSeconds,
        });
      }
    }
    return Array.from(grouped.values());
  }, [timeClockRowsForDisplay]);

  const ticketReportRegisterLabel = useMemo(
    () =>
      reportRegisterFilter === "all"
        ? t("allRegisters")
        : reportRegisters.find((r) => r.id === reportRegisterFilter)?.name ?? "—",
    [reportRegisterFilter, reportRegisters, t],
  );

  const supplierSelectContent = useMemo(
    () =>
      reportSuppliers.map((s) => (
        <SelectItem key={s.id} value={s.id}>
          {s.name}
        </SelectItem>
      )),
    [reportSuppliers],
  );

  const selectedSupplierName = useMemo(
    () => reportSuppliers.find((s) => s.id === reportSupplierFilter)?.name ?? "—",
    [reportSuppliers, reportSupplierFilter],
  );

  const downloadSupplierPdf = useCallback(async () => {
    if (supplierPdfLockRef.current) return;
    supplierPdfLockRef.current = true;
    setSupplierPdfWorking(true);
    try {
      const slug =
        selectedSupplierName === "—"
          ? "supplier-report"
          : selectedSupplierName.replace(/[^\w\s-]+/gu, "").trim().replace(/\s+/g, "-").slice(0, 48);
      const base = buildSupplierReportPdfFileName([slug || "supplier-report", format(new Date(), "yyyy-MM-dd-HHmm")]);
      await downloadSupplierReportPdf(base);
      toast({ description: t("reportPdfDownloaded") });
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : t("reportPdfFailed"),
      });
    } finally {
      supplierPdfLockRef.current = false;
      setSupplierPdfWorking(false);
    }
  }, [selectedSupplierName, t]);

  const formatReportMoney = useCallback(
    (n: number) =>
      new Intl.NumberFormat(lang === "nl" ? "nl-BE" : "en-GB", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n),
    [lang],
  );

  /** Periodic report modal: same decimals as money fields, no € symbol (classic Z-report style). */
  const formatPeriodicReportMoney = useCallback(
    (n: number) =>
      new Intl.NumberFormat(lang === "nl" ? "nl-BE" : "en-GB", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n),
    [lang],
  );

  /** Unit line prices in expanded ticket rows (plain decimals, like legacy kassarapport). */
  const formatTicketLineUnitPrice = useCallback(
    (n: number) =>
      new Intl.NumberFormat(lang === "nl" ? "nl-BE" : "en-GB", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n),
    [lang],
  );

  const ticketHourToTime = useCallback((h: string) => {
    const n = Math.min(24, Math.max(0, parseInt(h, 10)));
    if (Number.isNaN(n)) return "00:00";
    return `${String(n).padStart(2, "0")}:00`;
  }, []);

  const ticketTimePattern = useMemo(
    () => (lang === "nl" ? "dd-MM-yyyy HH:mm" : "dd/MM/yyyy HH:mm"),
    [lang],
  );

  const formatTicketRowTime = useCallback(
    (iso: string) => {
      try {
        return format(parseISO(iso), ticketTimePattern);
      } catch {
        return "—";
      }
    },
    [ticketTimePattern],
  );

  const displayedTickets = useMemo(() => {
    const q = ticketSearch.trim().toLowerCase();
    if (!q) return ticketRows;
    return ticketRows.filter((row) => {
      const timeStr = formatTicketRowTime(row.settledAt).toLowerCase();
      const hay = [
        String(row.rowNumber),
        row.event,
        row.registerName,
        timeStr,
        formatTicketLineUnitPrice(row.amount).toLowerCase(),
        String(row.amount),
        row.payment,
        row.userName,
        row.customerName,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [ticketRows, ticketSearch, formatTicketRowTime, formatTicketLineUnitPrice]);

  const displayedTicketsTotal = useMemo(
    () => Math.round(displayedTickets.reduce((s, r) => s + r.amount, 0) * 100) / 100,
    [displayedTickets],
  );

  const allDisplayedTicketsExpanded = useMemo(
    () =>
      displayedTickets.length > 0 &&
      displayedTickets.every((r) => expandedTicketOrderIds.includes(r.id)),
    [displayedTickets, expandedTicketOrderIds],
  );

  const openTicketsReport = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const qs = new URLSearchParams({
        startDate: format(fromDate, "dd-MM-yyyy"),
        startTime: ticketHourToTime(ticketFromHour),
        endDate: format(toDate, "dd-MM-yyyy"),
        endTime: ticketHourToTime(ticketToHour),
        userId: reportUserFilter,
        registerId: reportRegisterFilter,
      });
      const data = await apiRequest<{ tickets: TicketReportRow[]; totalAmount: number; count: number }>(
        `/api/webpanel/reports/tickets?${qs.toString()}`,
      );
      const list = Array.isArray(data?.tickets) ? data.tickets : [];
      setTicketRows(list);
      setTicketSearch("");
      setExpandedTicketOrderIds([]);
      setTicketOrderById({});
      setTicketExpandErrors({});
      setTicketExpandLoadingIds([]);
      setTicketsReportOpenedAt(new Date());
      setTicketsOpen(true);
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Failed to load tickets.",
      });
    } finally {
      setTicketsLoading(false);
    }
  }, [fromDate, toDate, ticketFromHour, ticketToHour, ticketHourToTime, reportUserFilter, reportRegisterFilter]);

  const openPeriodicReport = useCallback(async () => {
    setPeriodicReportLoading(true);
    try {
      const qs = new URLSearchParams({
        startDate: format(fromDate, "dd-MM-yyyy"),
        startTime: ticketHourToTime(periodicFromHour),
        endDate: format(toDate, "dd-MM-yyyy"),
        endTime: ticketHourToTime(periodicToHour),
        userId: reportUserFilter,
        registerId: reportRegisterFilter,
        lang: lang === "nl" ? "nl" : "en",
      });
      const data = await apiRequest<{
        sections?: Record<string, unknown>;
        labels?: { eatInTakeOutTitle?: string; ns?: string; nr?: string; total?: string };
        periodStart?: string;
        periodEndExclusive?: string;
      }>(`/api/webpanel/reports/periodic?${qs.toString()}`);
      const sections = data?.sections && typeof data.sections === "object" ? data.sections : {};
      setPeriodicReportPayload({
        sections,
        labels: data?.labels,
        periodStart: String(data?.periodStart ?? ""),
        periodEndExclusive: String(data?.periodEndExclusive ?? ""),
      });
      setPeriodicReportOpenedAt(new Date());
      setPeriodicReportOpen(true);
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : t("periodicReportLoadFailed"),
      });
    } finally {
      setPeriodicReportLoading(false);
    }
  }, [
    fromDate,
    toDate,
    periodicFromHour,
    periodicToHour,
    ticketHourToTime,
    reportUserFilter,
    reportRegisterFilter,
    lang,
    t,
  ]);

  const openBestSellersReport = useCallback(async () => {
    setBestReportLoading(true);
    try {
      const qs = new URLSearchParams({
        startDate: format(fromDate, "dd-MM-yyyy"),
        startTime: ticketHourToTime(bestFromHour),
        endDate: format(toDate, "dd-MM-yyyy"),
        endTime: ticketHourToTime(bestToHour),
        mode: bestMode,
      });
      const data = await apiRequest<{
        mode?: BestSellersMode;
        entity?: BestSellersEntity;
        rows?: BestSellersRow[];
        categoryRows?: Array<{ label: string; qty: number; amount: number }>;
        totals?: { amount?: number; qty?: number };
        periodStart?: string;
        periodEndExclusive?: string;
      }>(`/api/webpanel/reports/best-sellers?${qs.toString()}`);
      setBestReportPayload({
        mode: data?.mode ?? bestMode,
        entity: data?.entity ?? (bestMode === "cust10" ? "customers" : "products"),
        rows: Array.isArray(data?.rows) ? data.rows : [],
        categoryRows: Array.isArray(data?.categoryRows) ? data.categoryRows : [],
        totals: {
          amount: Math.round((Number(data?.totals?.amount) || 0) * 100) / 100,
          qty: Math.round(Number(data?.totals?.qty) || 0),
        },
        periodStart: String(data?.periodStart ?? ""),
        periodEndExclusive: String(data?.periodEndExclusive ?? ""),
      });
      setBestReportOpenedAt(new Date());
      setBestReportOpen(true);
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Failed to load best sellers report.",
      });
    } finally {
      setBestReportLoading(false);
    }
  }, [fromDate, toDate, bestFromHour, bestToHour, bestMode, ticketHourToTime]);

  const openSupplierReport = useCallback(async () => {
    if (!reportSupplierFilter) return;
    setSupplierReportLoading(true);
    try {
      const qs = new URLSearchParams({
        supplierId: reportSupplierFilter,
        startDate: format(fromDate, "dd-MM-yyyy"),
        startTime: ticketHourToTime(supplierFromHour),
        endDate: format(toDate, "dd-MM-yyyy"),
        endTime: ticketHourToTime(supplierToHour),
      });
      const data = await apiRequest<{
        categoryRows?: Array<{ label?: string; qty?: number; qtyLabel?: string; amount?: number }>;
        rows?: Array<{ label?: string; qty?: number; qtyLabel?: string; amount?: number }>;
        totals?: { amount?: number; qty?: number };
        periodStart?: string;
        periodEndExclusive?: string;
      }>(`/api/webpanel/reports/supplier?${qs.toString()}`);

      const categoryRows = (Array.isArray(data?.categoryRows) ? data.categoryRows : []).map((r) => ({
        label: String(r?.label || "—"),
        qty: Number(r?.qty) || 0,
        qtyLabel: String(r?.qtyLabel || "").trim() || undefined,
        amount: Math.round((Number(r?.amount) || 0) * 100) / 100,
      }));
      const rows = (Array.isArray(data?.rows) ? data.rows : []).map((r) => ({
        label: String(r?.label || "—"),
        qty: Number(r?.qty) || 0,
        qtyLabel: String(r?.qtyLabel || "").trim() || undefined,
        amount: Math.round((Number(r?.amount) || 0) * 100) / 100,
      }));

      setSupplierReportPayload({
        categoryRows,
        rows,
        totals: {
          qty: Number(data?.totals?.qty) || 0,
          amount: Math.round((Number(data?.totals?.amount) || 0) * 100) / 100,
        },
        periodStart: String(data?.periodStart ?? ""),
        periodEndExclusive: String(data?.periodEndExclusive ?? ""),
      });
      setSupplierReportOpenedAt(new Date());
      setSupplierReportOpen(true);
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Failed to load supplier report.",
      });
    } finally {
      setSupplierReportLoading(false);
    }
  }, [reportSupplierFilter, fromDate, toDate, supplierFromHour, supplierToHour, ticketHourToTime]);

  const openTimeClockReport = useCallback(async () => {
    setTimeClockReportLoading(true);
    try {
      const qs = new URLSearchParams({
        startDate: format(fromDate, "dd-MM-yyyy"),
        startTime: ticketHourToTime(clockFromHour),
        endDate: format(toDate, "dd-MM-yyyy"),
        endTime: ticketHourToTime(clockToHour),
        userId: reportUserFilter,
      });
      const data = await apiRequest<{ rows?: TimeClockReportRow[] }>(`/api/webpanel/reports/time-clock?${qs.toString()}`);
      setTimeClockReportRows(Array.isArray(data?.rows) ? data.rows : []);
      setTimeClockReportOpenedAt(new Date());
      setTimeClockReportOpen(true);
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Failed to load time clock report.",
      });
    } finally {
      setTimeClockReportLoading(false);
    }
  }, [fromDate, toDate, clockFromHour, clockToHour, reportUserFilter, ticketHourToTime]);

  const openEmptiesReport = useCallback(async () => {
    setEmptiesReportLoading(true);
    try {
      const qs = new URLSearchParams({
        startDate: format(fromDate, "dd-MM-yyyy"),
        startTime: ticketHourToTime(clockFromHour),
        endDate: format(toDate, "dd-MM-yyyy"),
        endTime: ticketHourToTime(clockToHour),
        mode: emptiesReportType,
      });
      const data = await apiRequest<{
        categories?: { totals?: Partial<EmptiesTotals>; rows?: EmptiesRow[] };
        products?: { totals?: Partial<EmptiesTotals>; rows?: EmptiesRow[] };
        transactions?: { totals?: Partial<EmptiesTotals>; rows?: EmptiesRow[] };
      }>(`/api/webpanel/reports/empties?${qs.toString()}`);
      const toTotals = (v?: Partial<EmptiesTotals>): EmptiesTotals => ({
        out: Math.round((Number(v?.out) || 0) * 100) / 100,
        in: Math.round((Number(v?.in) || 0) * 100) / 100,
        diff: Math.round((Number(v?.diff) || 0) * 100) / 100,
      });
      setEmptiesCategoryTotals(toTotals(data?.categories?.totals));
      setEmptiesProductTotals(toTotals(data?.products?.totals));
      setEmptiesTransactionTotals(toTotals(data?.transactions?.totals));
      setEmptiesCategoryRows(Array.isArray(data?.categories?.rows) ? data.categories.rows : []);
      setEmptiesProductRows(Array.isArray(data?.products?.rows) ? data.products.rows : []);
      setEmptiesTransactionRows(Array.isArray(data?.transactions?.rows) ? data.transactions.rows : []);
      setEmptiesReportOpenedAt(new Date());
      setEmptiesReportOpen(true);
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Failed to load empties report.",
      });
    } finally {
      setEmptiesReportLoading(false);
    }
  }, [fromDate, toDate, clockFromHour, clockToHour, emptiesReportType, ticketHourToTime]);

  const openZPreviewReport = useCallback(async () => {
    if (!reportRegisterFilter || reportRegisterFilter === "all") {
      toast({ variant: "destructive", description: "Please select a register first." });
      return;
    }
    setZPreviewLoading(true);
    try {
      const data = await apiRequest<ZPreviewPayload>("/api/webpanel/reports/z-preview", {
        method: "POST",
        body: JSON.stringify({
          registerId: reportRegisterFilter,
          createUntilMode: zCreateUntilMode,
          manualDate: format(zCreateManualDate, "dd-MM-yyyy"),
          manualHour: zCreateManualHour,
          sectionVisibility: reportSectionVisibility,
          lang: lang === "nl" ? "nl" : "en",
          userName: user?.name || user?.email || "",
          storeName: "Retail POS",
        }),
      });
      setZPreviewPayload({
        lines: Array.isArray(data?.lines) ? data.lines : [],
        periodStart: String(data?.periodStart ?? ""),
        periodEnd: String(data?.periodEnd ?? ""),
        nextZNumber: Number(data?.nextZNumber) || undefined,
        orderCount: Number(data?.orderCount) || 0,
      });
      setZReportSaved(false);
      setZPreviewOpen(true);
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Failed to load Z preview.",
      });
    } finally {
      setZPreviewLoading(false);
    }
  }, [
    reportRegisterFilter,
    zCreateUntilMode,
    zCreateManualDate,
    zCreateManualHour,
    reportSectionVisibility,
    lang,
    t,
    user?.name,
    user?.email,
  ]);

  const saveZReport = useCallback(async () => {
    if (zReportSaving || zReportSaved) return;
    setZReportSaving(true);
    try {
      const data = await apiRequest<{ ok?: boolean; zNumber?: number }>(
        "/api/webpanel/reports/z-save",
        {
          method: "POST",
          body: JSON.stringify({
            closedByName: user?.name || user?.email || "",
            closedByUserId: user?.id ? String(user.id) : null,
            periodStart: zPreviewPayload?.periodStart || null,
            periodEnd: zPreviewPayload?.periodEnd || null,
            lines: Array.isArray(zPreviewPayload?.lines) ? zPreviewPayload.lines : [],
            registerId: reportRegisterFilter || null,
            registerName: reportRegisters.find((r) => r.id === reportRegisterFilter)?.name || null,
          }),
        },
      );
      setZPreviewPayload((prev) => ({
        ...(prev || {}),
        nextZNumber: Number(data?.zNumber) || prev?.nextZNumber,
      }));
      setZReportSaved(true);
      toast({ description: lang === "nl" ? "Z rapport opgeslagen." : "Z report saved." });
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : lang === "nl" ? "Opslaan mislukt." : "Save failed.",
      });
    } finally {
      setZReportSaving(false);
    }
  }, [zReportSaving, zReportSaved, lang, user?.name, user?.email, user?.id, zPreviewPayload?.periodStart, zPreviewPayload?.periodEnd, zPreviewPayload?.lines, reportRegisterFilter, reportRegisters]);

  const printSavedZReport = useCallback(() => {
    if (!Array.isArray(zPreviewPayload?.lines) || zPreviewPayload.lines.length === 0) return;
    printZReportMain();
  }, [zPreviewPayload?.lines]);

  const downloadSavedZPdf = useCallback(async () => {
    if (zPdfLockRef.current) return;
    if (!Array.isArray(zPreviewPayload?.lines) || zPreviewPayload.lines.length === 0) return;
    zPdfLockRef.current = true;
    setZPdfWorking(true);
    try {
      const base = buildZReportPdfFileName(["z-report", format(new Date(), "yyyy-MM-dd-HHmm")]);
      (window as unknown as { __zReportPdfLines?: string[] }).__zReportPdfLines = [...zPreviewPayload.lines];
      await downloadZReportPdf(base);
      toast({ description: t("reportPdfDownloaded") });
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : t("reportPdfFailed"),
      });
    } finally {
      delete (window as unknown as { __zReportPdfLines?: string[] }).__zReportPdfLines;
      zPdfLockRef.current = false;
      setZPdfWorking(false);
    }
  }, [zPreviewPayload?.lines, t]);

  const downloadEmptiesPdf = useCallback(async () => {
    if (emptiesPdfLockRef.current) return;
    emptiesPdfLockRef.current = true;
    setEmptiesPdfWorking(true);
    try {
      const base = buildEmptiesReportPdfFileName(["empties-report", format(new Date(), "yyyy-MM-dd-HHmm")]);
      await downloadEmptiesReportPdf(base);
      toast({ description: t("reportPdfDownloaded") });
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : t("reportPdfFailed"),
      });
    } finally {
      emptiesPdfLockRef.current = false;
      setEmptiesPdfWorking(false);
    }
  }, [t]);

  const downloadTimeClockPdf = useCallback(async () => {
    if (timeClockPdfLockRef.current) return;
    timeClockPdfLockRef.current = true;
    setTimeClockPdfWorking(true);
    try {
      const base = buildTimeClockReportPdfFileName(["time-clock-report", format(new Date(), "yyyy-MM-dd-HHmm")]);
      await downloadTimeClockReportPdf(base);
      toast({ description: t("reportPdfDownloaded") });
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : t("reportPdfFailed"),
      });
    } finally {
      timeClockPdfLockRef.current = false;
      setTimeClockPdfWorking(false);
    }
  }, [t]);

  const bestReportPeriodLine = useMemo(() => {
    if (!bestReportPayload?.periodStart) return "";
    try {
      const a = parseISO(bestReportPayload.periodStart);
      const b = parseISO(bestReportPayload.periodEndExclusive);
      return `${format(a, "HH:mm")} ${format(a, "dd-MM-yyyy")} ${t("reportPeriodThrough")} ${format(b, "HH:mm")} ${format(b, "dd-MM-yyyy")}`;
    } catch {
      return "";
    }
  }, [bestReportPayload, t]);

  const bestModeLabel = useCallback(
    (m: BestSellersMode) => {
      if (m === "worst25") return t("worst25");
      if (m === "p80") return t("products80");
      if (m === "cust10") return t("top10Customers");
      return t("best25");
    },
    [t],
  );

  const bestReportTypeLabel = useMemo(
    () => bestModeLabel(bestReportPayload?.mode ?? bestMode),
    [bestMode, bestReportPayload, bestModeLabel],
  );

  const bestReportPieBarData = useMemo(() => {
    const rows = Array.isArray(bestReportPayload?.rows) ? bestReportPayload.rows : [];
    const useAmount = bestReportPayload?.entity === "customers";
    return rows.map((r) => ({
      name: r.label,
      value: useAmount ? Math.max(0, Number(r.amount) || 0) : Math.max(0, Number(r.qty) || 0),
      amount: Number(r.amount) || 0,
      qty: Number(r.qty) || 0,
    }));
  }, [bestReportPayload]);

  /** Left / right section keys in stable order (no row pairing — avoids tall empty gaps when one card is much taller). */
  const periodicLayoutColumns = useMemo(() => {
    const left = PERIODIC_SECTION_KEYS.filter((k) => periodicLayout[k] === "L");
    const right = PERIODIC_SECTION_KEYS.filter((k) => periodicLayout[k] === "R");
    return { left, right };
  }, [periodicLayout]);

  const periodicReportPeriodLine = useMemo(() => {
    if (!periodicReportPayload?.periodStart) return "";
    try {
      const a = parseISO(periodicReportPayload.periodStart);
      const b = parseISO(periodicReportPayload.periodEndExclusive);
      return `${format(a, "HH:mm")} ${format(a, "dd-MM-yyyy")} ${t("reportPeriodThrough")} ${format(b, "HH:mm")} ${format(b, "dd-MM-yyyy")}`;
    } catch {
      return "";
    }
  }, [periodicReportPayload, t]);

  const ticketHourSelectItems = useMemo(
    () =>
      Array.from({ length: 25 }, (_, i) => (
        <SelectItem key={i} value={String(i)}>
          {String(i).padStart(2, "0")}:00
        </SelectItem>
      )),
    [],
  );

  const stockListSubtitleKey = useMemo(() => {
    if (stockDisplay === "active") return "stockReportListActive" as const;
    if (stockDisplay === "screen") return "stockReportListScreen" as const;
    if (stockDisplay === "supplier") return "stockReportListSupplier" as const;
    return "stockReportListAll" as const;
  }, [stockDisplay]);

  const openStockReport = useCallback(async () => {
    setStockReportLoading(true);
    try {
      const qs = new URLSearchParams({ sort: stockSortBy, display: stockDisplay, vat: stockVat });
      const data = await apiRequest<{ rows: StockReportRow[]; totals: { openSale: number; openPurchase: number } }>(
        `/api/webpanel/reports/stock?${qs.toString()}`,
      );
      setStockReportRows(Array.isArray(data?.rows) ? data.rows : []);
      setStockReportTotals(
        data?.totals && typeof data.totals === "object"
          ? { openSale: Number(data.totals.openSale) || 0, openPurchase: Number(data.totals.openPurchase) || 0 }
          : { openSale: 0, openPurchase: 0 },
      );
      setStockReportOpenedAt(new Date());
      setStockReportOpen(true);
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : t("stockReportLoadFailed"),
      });
    } finally {
      setStockReportLoading(false);
    }
  }, [stockSortBy, stockDisplay, stockVat, t]);

  const downloadStockPdf = useCallback(async () => {
    if (stockPdfLockRef.current) return;
    stockPdfLockRef.current = true;
    setStockPdfWorking(true);
    try {
      const base = buildStockReportPdfFileName(["stock-report", format(new Date(), "yyyy-MM-dd-HHmm")]);
      await downloadStockReportPdf(base);
      toast({ description: t("reportPdfDownloaded") });
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : t("reportPdfFailed"),
      });
    } finally {
      stockPdfLockRef.current = false;
      setStockPdfWorking(false);
    }
  }, [t]);

  const downloadTicketsPdf = useCallback(async () => {
    if (ticketsPdfLockRef.current) return;
    ticketsPdfLockRef.current = true;
    setTicketsPdfWorking(true);
    try {
      const base = buildTicketsReportPdfFileName(["tickets-report", format(new Date(), "yyyy-MM-dd-HHmm")]);
      await downloadTicketsReportPdf(base);
      toast({ description: t("reportPdfDownloaded") });
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : t("reportPdfFailed"),
      });
    } finally {
      ticketsPdfLockRef.current = false;
      setTicketsPdfWorking(false);
    }
  }, [t]);

  const downloadPeriodicPdf = useCallback(async () => {
    if (periodicPdfLockRef.current) return;
    periodicPdfLockRef.current = true;
    setPeriodicPdfWorking(true);
    try {
      const base = buildPeriodicReportPdfFileName(["periodic-report", format(new Date(), "yyyy-MM-dd-HHmm")]);
      await downloadPeriodicReportPdf(base);
      toast({ description: t("reportPdfDownloaded") });
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : t("reportPdfFailed"),
      });
    } finally {
      periodicPdfLockRef.current = false;
      setPeriodicPdfWorking(false);
    }
  }, [t]);

  const downloadBestPdf = useCallback(async () => {
    if (bestPdfLockRef.current) return;
    bestPdfLockRef.current = true;
    setBestPdfWorking(true);
    try {
      const base = buildBestReportPdfFileName(["best-sellers-report", format(new Date(), "yyyy-MM-dd-HHmm")]);
      await downloadBestReportPdf(base);
      toast({ description: t("reportPdfDownloaded") });
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : t("reportPdfFailed"),
      });
    } finally {
      bestPdfLockRef.current = false;
      setBestPdfWorking(false);
    }
  }, [t]);

  const ticketOrderByIdRef = useRef(ticketOrderById);
  ticketOrderByIdRef.current = ticketOrderById;

  const expandedTicketIdsKey = useMemo(
    () => [...expandedTicketOrderIds].sort().join("|"),
    [expandedTicketOrderIds],
  );

  useEffect(() => {
    if (expandedTicketOrderIds.length === 0) return;
    const toFetch = expandedTicketOrderIds.filter((id) => !ticketOrderByIdRef.current[id]);
    if (toFetch.length === 0) return;
    let cancelled = false;
    setTicketExpandLoadingIds((prev) => {
      const s = new Set(prev);
      for (const id of toFetch) s.add(id);
      return [...s];
    });
    setTicketExpandErrors((prev) => {
      const next = { ...prev };
      for (const id of toFetch) delete next[id];
      return next;
    });
    void Promise.all(
      toFetch.map(async (id) => {
        try {
          const data = await apiRequest<{
            id?: string;
            total?: unknown;
            items?: Array<{
              id: string;
              quantity?: unknown;
              price?: unknown;
              product?: { name?: string | null } | null;
            }>;
          }>(`/api/orders/${id}`);
          if (cancelled) return;
          const items = (Array.isArray(data.items) ? data.items : []).map((it) => ({
            id: it.id,
            quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
            price: Math.round(Number(it.price) * 100) / 100 || 0,
            product: it.product ?? null,
          }));
          setTicketOrderById((prev) => ({
            ...prev,
            [id]: {
              id: String(data.id ?? id),
              total: Math.round(Number(data.total) * 100) / 100 || 0,
              items,
            },
          }));
          setTicketExpandErrors((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        } catch (e) {
          if (!cancelled) {
            const msg = e instanceof Error ? e.message : String(e);
            setTicketExpandErrors((prev) => ({ ...prev, [id]: msg }));
          }
        } finally {
          if (!cancelled) {
            setTicketExpandLoadingIds((prev) => prev.filter((x) => x !== id));
          }
        }
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [expandedTicketIdsKey]);

  useEffect(() => {
    setReportSupplierFilter((prev) => {
      if (reportSuppliers.length === 0) return "";
      if (prev && reportSuppliers.some((s) => s.id === prev)) return prev;
      return reportSuppliers[0].id;
    });
  }, [reportSuppliers]);

  useEffect(() => {
    const handler = () => setExportOpen(true);
    window.addEventListener("reports:open-export", handler);
    return () => window.removeEventListener("reports:open-export", handler);
  }, []);

  useEffect(() => {
    if (!supplierReportOpen) {
      document.body.classList.remove(SUPPLIER_REPORT_PRINT_BODY_CLASS);
    }
  }, [supplierReportOpen]);

  useEffect(() => {
    if (!stockReportOpen) {
      document.body.classList.remove(STOCK_REPORT_PRINT_BODY_CLASS);
    }
  }, [stockReportOpen]);

  useEffect(() => {
    if (!ticketsOpen) {
      document.body.classList.remove(TICKETS_REPORT_PRINT_BODY_CLASS);
      setExpandedTicketOrderIds([]);
      setTicketExpandErrors({});
      setTicketExpandLoadingIds([]);
    }
  }, [ticketsOpen]);

  useEffect(() => {
    if (!periodicReportOpen) {
      document.body.classList.remove(PERIODIC_REPORT_PRINT_BODY_CLASS);
    }
  }, [periodicReportOpen]);

  useEffect(() => {
    if (!bestReportOpen) {
      document.body.classList.remove(BEST_REPORT_PRINT_BODY_CLASS);
    }
  }, [bestReportOpen]);
  useEffect(() => {
    if (!timeClockReportOpen) {
      document.body.classList.remove(TIME_CLOCK_REPORT_PRINT_BODY_CLASS);
    }
  }, [timeClockReportOpen]);
  useEffect(() => {
    if (!emptiesReportOpen) {
      document.body.classList.remove(EMPTIES_REPORT_PRINT_BODY_CLASS);
    }
  }, [emptiesReportOpen]);
  useEffect(() => {
    if (!zPreviewOpen) {
      document.body.classList.remove(Z_REPORT_PRINT_BODY_CLASS);
    }
  }, [zPreviewOpen]);
  useEffect(() => {
    if (tab !== "z" || zSubTab !== "history") return;
    void loadZHistoryRows();
  }, [tab, zSubTab, loadZHistoryRows]);

  useEffect(() => {
    const socket = getRealtimeSocket();
    const handleZReportsChanged = () => {
      if (tab !== "z") return;
      void loadZHistoryRows(true);
    };
    socket.on("z-reports:changed", handleZReportsChanged);
    return () => {
      socket.off("z-reports:changed", handleZReportsChanged);
    };
  }, [tab, loadZHistoryRows]);
  useEffect(() => {
    if (!zHistoryFilteredRows.length) {
      setZHistoryReportId("");
      return;
    }
    setZHistoryReportId((prev) => (prev && zHistoryFilteredRows.some((r) => r.id === prev) ? prev : zHistoryFilteredRows[0].id));
  }, [zHistoryFilteredRows]);

  const tabs = [
    { id: "tickets", label: t("tickets"), icon: <Ticket className="h-4 w-4" /> },
    { id: "periodic", label: t("periodic"), icon: <CalendarDays className="h-4 w-4" /> },
    { id: "best", label: t("bestSellers"), icon: <TrendingUp className="h-4 w-4" /> },
    { id: "z", label: t("zReports"), icon: <FileText className="h-4 w-4" /> },
    { id: "empties", label: t("empties"), icon: <PackageOpen className="h-4 w-4" /> },
    { id: "stock", label: t("stock"), icon: <Boxes className="h-4 w-4" /> },
    { id: "clock", label: t("timeClock"), icon: <Clock className="h-4 w-4" /> },
    { id: "suppliers", label: t("suppliers"), icon: <Truck className="h-4 w-4" /> },
  ];
  const exportTypeOptions = [
    { value: "orders", label: t("orders") },
    { value: "orders-with-product-detail", label: t("ordersWithProductDetail") },
    { value: "product-totals", label: t("productTotals") },
    { value: "product-margins", label: t("productMargins") },
    { value: "z-reports", label: t("zReports") },
    { value: "products-revenue-per-day", label: t("productsRevenuePerDay") },
    { value: "products-count-per-day", label: t("productsCountPerDay") },
    { value: "stock", label: t("stock") },
    { value: "invoices", label: t("invoices") },
    { value: "credit-notes", label: t("creditNotes") },
    { value: "vouchers", label: t("vouchers") },
    { value: "stored-value-topup-cards", label: t("storedValueTopupCards") },
  ];
  const bestChartColors = [
    "#1f334d",
    "#243d5d",
    "#2f4b70",
    "#375887",
    "#40639a",
    "#4c73af",
    "#5882c4",
    "#6691d7",
    "#77a1ea",
    "#86b0fb",
  ];

  return (
    <AppLayout>
      <div className="flex items-center justify-center mb-2 gap-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExportOpen(false)}
          className={`gap-1.5 border hover:border-primary ${!exportOpen ? "text-primary border-primary" : "text-foreground hover:text-primary"}`}
        >
          <BarChart3 className="h-4 w-4" />
          {t("reports")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExportOpen(true)}
          className={`gap-1.5 border hover:border-primary ${exportOpen ? "text-primary border-primary" : "text-foreground hover:text-primary"}`}
        >
          <Upload className="h-4 w-4" />
          {t("export")}
        </Button>
      </div>
      {!exportOpen && <TabsBar tabs={tabs} active={tab} onChange={setTab} />}

      {exportOpen && (
        <div className="flex justify-center">
          <Card className="w-full max-w-2xl p-6 shadow-card">
            <div className="space-y-4">
              <div className="grid grid-cols-[100px_1fr] items-center gap-3">
                <Label className="text-sm">{t("type")} :</Label>
                <Select value={exportType} onValueChange={setExportType}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {exportTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-[100px_1fr] items-center gap-3">
                <Label className="text-sm">{t("period")} :</Label>
                <div className="flex items-center gap-2">
                  <DatePickerField value={exportFrom} onChange={setExportFrom} />
                  <span className="text-xs text-muted-foreground">{t("until")}</span>
                  <DatePickerField value={exportTo} onChange={setExportTo} />
                </div>
              </div>
              <div className="grid grid-cols-[100px_1fr] items-center gap-3">
                <Label className="text-sm">{t("user")} :</Label>
                <Select value={reportUserFilter} onValueChange={setReportUserFilter}>
                  <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>{userSelectContent}</SelectContent>
                </Select>
              </div>
              <div className="flex justify-center pt-2">
                <Button variant="ghost" className="gap-2 text-foreground border hover:border-primary hover:text-primary">
                  <Cloud className="h-4 w-4" /> {t("exportAction")}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {!exportOpen && tab === "tickets" && (
        <div className="flex justify-center">
          <Card className="w-full max-w-3xl p-6 shadow-card">
            <div className="space-y-5">
              <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                <Label className="text-sm font-medium text-foreground">{t("period")}</Label>
                <div className="flex items-center gap-2">
                  <Select value={ticketFromHour} onValueChange={setTicketFromHour}>
                    <SelectTrigger className="w-23">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>{ticketHourSelectItems}</SelectContent>
                  </Select>
                  <DatePickerField value={fromDate} onChange={setFromDate} disabled={reportRangeFromCalendarDisabled} />
                  <span className="text-xs text-muted-foreground">{t("until")}</span>
                  <Select value={ticketToHour} onValueChange={setTicketToHour}>
                    <SelectTrigger className="w-23">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>{ticketHourSelectItems}</SelectContent>
                  </Select>
                  <DatePickerField value={toDate} onChange={setToDate} disabled={reportRangeToCalendarDisabled} />
                </div>
              </div>

              <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                <Label className="text-sm font-medium">{t("user")}</Label>
                <Select value={reportUserFilter} onValueChange={setReportUserFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>{userSelectContent}</SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                <Label className="text-sm font-medium">{t("register")}</Label>
                <Select value={reportRegisterFilter} onValueChange={setReportRegisterFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>{registerSelectContent}</SelectContent>
                </Select>
              </div>

              <div className="pt-3 flex justify-center">
                <Button
                  type="button"
                  disabled={ticketsLoading}
                  onClick={() => void openTicketsReport()}
                  className="gap-2 bg-gradient-primary text-primary-foreground hover:opacity-90 px-6"
                >
                  {ticketsLoading ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  ) : (
                    <Cloud className="h-4 w-4 shrink-0" />
                  )}
                  {t("showTickets")}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {!exportOpen && tab === "periodic" && (
        <div className="flex justify-center">
          <Card className="w-full max-w-3xl p-6 pt-14 shadow-card relative">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-3 top-3 h-8 w-8 text-primary hover:text-primary"
                  aria-label={t("reportSettings")}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[420px] p-5">
                <div className="space-y-3">
                  <div className="grid grid-cols-[1fr_28px_28px_28px] items-center gap-3 text-sm font-medium text-muted-foreground">
                    <span />
                    <span className="text-center">{t("onLabel")}</span>
                    <span className="text-center">{t("onReport")}</span>
                    <span className="text-center">{t("offLabel")}</span>
                  </div>
                  {PERIODIC_SECTION_KEYS.map((rowKey) => (
                    <RadioGroup
                      key={rowKey}
                      value={periodicLayout[rowKey]}
                      onValueChange={(v) => {
                        if (v === "L" || v === "R" || v === "off") {
                          setPeriodicLayout((prev) => ({ ...prev, [rowKey]: v }));
                        }
                      }}
                      className="grid grid-cols-[1fr_28px_28px_28px] items-center gap-3"
                    >
                      <Label className="text-sm text-foreground">{t(rowKey as never)} :</Label>
                      <div className="flex justify-center">
                        <RadioGroupItem value="L" />
                      </div>
                      <div className="flex justify-center">
                        <RadioGroupItem value="R" />
                      </div>
                      <div className="flex justify-center">
                        <RadioGroupItem value="off" />
                      </div>
                    </RadioGroup>
                  ))}
                  <div className="pt-2 flex justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        try {
                          localStorage.setItem(PERIODIC_LAYOUT_STORAGE_KEY, JSON.stringify(periodicLayout));
                          toast({ description: t("periodicLayoutSaved") });
                        } catch {
                          toast({ variant: "destructive", description: t("periodicLayoutSaveFailed") });
                        }
                      }}
                    >
                      <Save className="h-4 w-4" /> {t("save")}
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <div className="space-y-5">
              <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                <Label className="text-sm font-medium text-foreground">{t("period")}</Label>
                <div className="flex items-center gap-2">
                  <Select value={periodicFromHour} onValueChange={setPeriodicFromHour}>
                    <SelectTrigger className="w-23">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>{ticketHourSelectItems}</SelectContent>
                  </Select>
                  <DatePickerField value={fromDate} onChange={setFromDate} disabled={reportRangeFromCalendarDisabled} />
                  <span className="text-xs text-muted-foreground">{t("until")}</span>
                  <Select value={periodicToHour} onValueChange={setPeriodicToHour}>
                    <SelectTrigger className="w-23">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>{ticketHourSelectItems}</SelectContent>
                  </Select>
                  <DatePickerField value={toDate} onChange={setToDate} disabled={reportRangeToCalendarDisabled} />
                </div>
              </div>

              <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                <Label className="text-sm font-medium">{t("user")}</Label>
                <Select value={reportUserFilter} onValueChange={setReportUserFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>{userSelectContent}</SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                <Label className="text-sm font-medium">{t("register")}</Label>
                <Select value={reportRegisterFilter} onValueChange={setReportRegisterFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>{registerSelectContent}</SelectContent>
                </Select>
              </div>

              <div className="pt-3 flex justify-center">
                <Button
                  type="button"
                  disabled={periodicReportLoading}
                  onClick={() => void openPeriodicReport()}
                  className="gap-2 bg-gradient-primary text-primary-foreground hover:opacity-90 px-6"
                >
                  {periodicReportLoading ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  ) : (
                    <Cloud className="h-4 w-4 shrink-0" />
                  )}
                  {t("showReport")}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {!exportOpen && tab === "best" && (
        <div className="flex justify-center">
          <Card className="w-full max-w-3xl p-6 shadow-card">
            <div className="space-y-5">
              <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                <Label className="text-sm font-medium text-foreground">{t("period")}</Label>
                <div className="flex items-center gap-2">
                  <Select value={bestFromHour} onValueChange={setBestFromHour}>
                    <SelectTrigger className="w-23"><SelectValue /></SelectTrigger>
                    <SelectContent>{Array.from({ length: 25 }).map((_, i) => <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</SelectItem>)}</SelectContent>
                  </Select>
                  <DatePickerField value={fromDate} onChange={setFromDate} disabled={reportRangeFromCalendarDisabled} />
                  <span className="text-xs text-muted-foreground">{t("until")}</span>
                  <Select value={bestToHour} onValueChange={setBestToHour}>
                    <SelectTrigger className="w-23"><SelectValue /></SelectTrigger>
                    <SelectContent>{Array.from({ length: 25 }).map((_, i) => <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</SelectItem>)}</SelectContent>
                  </Select>
                  <DatePickerField value={toDate} onChange={setToDate} disabled={reportRangeToCalendarDisabled} />
                </div>
              </div>

              <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                <Label className="text-sm font-medium">{t("type")}</Label>
                <Select value={bestMode} onValueChange={(v) => setBestMode(v as BestSellersMode)}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="best25">{t("best25")}</SelectItem>
                    <SelectItem value="worst25">{t("worst25")}</SelectItem>
                    <SelectItem value="p80">{t("products80")}</SelectItem>
                    <SelectItem value="cust10">{t("top10Customers")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                <Label className="text-sm font-medium">{t("display")}</Label>
                <Select value={bestDisplay} onValueChange={(v) => setBestDisplay(v as BestSellersDisplay)}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">{t("text")}</SelectItem>
                    <SelectItem value="pie">{t("pieChart")}</SelectItem>
                    <SelectItem value="bar">{t("barChart")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-3 flex justify-center">
                <Button
                  type="button"
                  disabled={bestReportLoading}
                  onClick={() => void openBestSellersReport()}
                  className="gap-2 bg-gradient-primary text-primary-foreground hover:opacity-90 px-6"
                >
                  {bestReportLoading ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  ) : (
                    <Cloud className="h-4 w-4 shrink-0" />
                  )}{" "}
                  {t("showReport")}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {!exportOpen && tab === "z" && (
        <div className="flex justify-center">
          <Card className="w-full max-w-2xl p-6 shadow-card relative">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-3 top-3 h-8 w-8 text-primary hover:text-primary"
                  aria-label={t("reportSettings")}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[420px] p-5">
                <div className="space-y-3">
                  {(["categoryTotals", "productTotals", "hourTotals", "hourTotalsPerUser"] as const).map((rowKey) => (
                    <div key={rowKey} className="flex items-center justify-between">
                      <Label className="text-sm text-foreground">{t(rowKey)} :</Label>
                      <Checkbox
                        checked={reportSectionVisibility[rowKey]}
                        onCheckedChange={(checked) =>
                          setReportSectionVisibility((prev) => ({ ...prev, [rowKey]: checked === true }))
                        }
                      />
                    </div>
                  ))}
                  <div className="pt-2 border-t border-border" />
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-foreground">{t("dailyAutoCreate")} :</Label>
                    <Checkbox
                      checked={dailyAutoCreateEnabled}
                      onCheckedChange={(checked) => setDailyAutoCreateEnabled(checked === true)}
                    />
                  </div>
                  {dailyAutoCreateEnabled && (
                    <div className="space-y-2 rounded-sm border border-border p-2">
                      <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                        <Label className="text-sm text-foreground">{t("autoCreateHour")} :</Label>
                        <Select value={dailyAutoCreateHour} onValueChange={setDailyAutoCreateHour}>
                          <SelectTrigger className="h-8 w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }).map((_, i) => {
                              const hour = String(i).padStart(2, "0");
                              return (
                                <SelectItem key={hour} value={hour}>
                                  {hour}:00
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                        <Label className="whitespace-nowrap text-sm text-foreground">{t("sendEmailTo")} :</Label>
                        <Input
                          type="email"
                          value={dailyAutoCreateEmail}
                          onChange={(e) => setDailyAutoCreateEmail(e.target.value)}
                          className="h-8 w-64"
                          placeholder="name@example.com"
                        />
                      </div>
                    </div>
                  )}
                  <div className="pt-2 flex justify-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2"
                      disabled={reportSettingsSaving}
                      onClick={() => void saveReportSettings()}
                    >
                      {reportSettingsSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}{" "}
                      {t("save")}
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <div className="flex items-center justify-center gap-10 border-b border-border pb-3 mb-5">
              <button
                onClick={() => setZSubTab("history")}
                className={cn(
                  "text-sm font-medium transition-colors",
                  zSubTab === "history" ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t("history")}
              </button>
              <button
                onClick={() => setZSubTab("create")}
                className={cn(
                  "text-sm font-medium transition-colors",
                  zSubTab === "create" ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t("createZ")}
              </button>
            </div>

            {zSubTab === "history" ? (
              <div className="space-y-5">
                <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                  <Label className="text-sm font-medium">{t("register")}</Label>
                  <Select value={reportRegisterFilter} onValueChange={setReportRegisterFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>{registerSelectContent}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                  <Label className="text-sm font-medium">{t("period")}</Label>
                  <div className="flex items-center gap-2">
                    <Select value={zHistoryMonth} onValueChange={setZHistoryMonth}>
                      <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }).map((_, i) => {
                          const v = String(i + 1).padStart(2, "0");
                          return <SelectItem key={v} value={v}>{v}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                    <Select value={zHistoryYear} onValueChange={setZHistoryYear}>
                      <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 6 }).map((_, i) => {
                          const y = String(new Date().getFullYear() - i);
                          return <SelectItem key={y} value={y}>{y}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                  <Label className="text-sm font-medium">{t("report")}</Label>
                  <Select value={zHistoryReportId} onValueChange={setZHistoryReportId}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {zHistoryFilteredRows.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {formatZHistoryOptionLabel(r)}
                          </SelectItem>
                        ))}
                      {zHistoryFilteredRows.length === 0 ? <SelectItem value="__none" disabled>--</SelectItem> : null}
                    </SelectContent>
                  </Select>
                </div>
                <div className="pt-3 flex justify-center">
                  <Button
                    type="button"
                    disabled={zHistoryLoading || !zHistoryReportId}
                    onClick={() => void openSelectedZHistoryReport()}
                    className="gap-2 bg-gradient-primary text-primary-foreground hover:opacity-90 px-6"
                  >
                    <Cloud className="h-4 w-4" /> {t("showReport")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                  <Label className="text-sm font-medium">{t("register")}</Label>
                  <Select value={reportRegisterFilter} onValueChange={setReportRegisterFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>{registerSelectContentNoAll}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                  <Label className="text-sm font-medium">{t("createUntil")} :</Label>
                  <Select value={zCreateUntilMode} onValueChange={(v) => setZCreateUntilMode(v as "current" | "manual")}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">{t("currentTime")}</SelectItem>
                      <SelectItem value="manual">{t("manualTime")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {zCreateUntilMode === "manual" && (
                  <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                    <div />
                    <div className="flex items-center gap-2">
                      <Select value={zCreateManualHour} onValueChange={setZCreateManualHour}>
                        <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 25 }).map((_, i) => (
                            <SelectItem key={`z-create-hour-${i}`} value={String(i)}>
                              {String(i).padStart(2, "0")}:00
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <DatePickerField value={zCreateManualDate} onChange={setZCreateManualDate} />
                    </div>
                  </div>
                )}
                <div className="pt-3 flex justify-center">
                  <Button
                    type="button"
                    disabled={zPreviewLoading}
                    onClick={() => void openZPreviewReport()}
                    className="gap-2 bg-gradient-primary text-primary-foreground hover:opacity-90 px-6"
                  >
                    {zPreviewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}{" "}
                    {t("createPreview")}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {!exportOpen && tab === "empties" && (
        <div className="flex justify-center">
          <Card className="w-full max-w-3xl p-6 shadow-card">
            <div className="space-y-5">
              <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                <Label className="text-sm font-medium text-foreground">{t("period")}</Label>
                <div className="flex items-center gap-2">
                  <Select value={clockFromHour} onValueChange={setClockFromHour}>
                    <SelectTrigger className="w-23"><SelectValue /></SelectTrigger>
                    <SelectContent>{Array.from({ length: 25 }).map((_, i) => <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</SelectItem>)}</SelectContent>
                  </Select>
                  <DatePickerField value={fromDate} onChange={setFromDate} disabled={reportRangeFromCalendarDisabled} />
                  <span className="text-xs text-muted-foreground">{t("until")}</span>
                  <Select value={clockToHour} onValueChange={setClockToHour}>
                    <SelectTrigger className="w-23"><SelectValue /></SelectTrigger>
                    <SelectContent>{Array.from({ length: 25 }).map((_, i) => <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</SelectItem>)}</SelectContent>
                  </Select>
                  <DatePickerField value={toDate} onChange={setToDate} disabled={reportRangeToCalendarDisabled} />
                </div>
              </div>

              <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                <Label className="text-sm font-medium">{t("report")}</Label>
                <Select value={emptiesReportType} onValueChange={(v) => setEmptiesReportType(v as "pieces" | "liters" | "kg" | "meters")}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pieces">{t("piecesQty")}</SelectItem>
                    <SelectItem value="liters">{t("litersQty")}</SelectItem>
                    <SelectItem value="kg">{t("kgQty")}</SelectItem>
                    <SelectItem value="meters">{t("metersQty")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-3 flex justify-center">
                <Button
                  type="button"
                  className="gap-2 bg-gradient-primary text-primary-foreground hover:opacity-90 px-6"
                  disabled={emptiesReportLoading}
                  onClick={() => void openEmptiesReport()}
                >
                  {emptiesReportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}{" "}
                  {t("showReport")}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Dialog open={zPreviewOpen} onOpenChange={setZPreviewOpen}>
        <DialogContent
          data-z-print-content
          className={cn(
            "w-[96vw] max-w-3xl gap-0 overflow-hidden border-border bg-muted p-0 text-foreground shadow-2xl sm:rounded-lg",
            "[&>button]:text-muted-foreground [&>button]:hover:bg-accent [&>button]:hover:text-foreground",
            "[&>button]:top-[9px]",
          )}
        >
          <DialogTitle className="sr-only">{t("zReports")}</DialogTitle>
          <div className="relative flex h-[56px] items-center justify-center border-b border-border bg-card px-4">
            <div className="flex items-center gap-2 text-foreground">
              <div className="absolute flex left-0 pl-10 gap-2">
                {!zReportSaved ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void saveZReport()}
                    disabled={zReportSaving}
                    className="h-8 gap-2"
                  >
                    {zReportSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {lang === "nl" ? "Opslaan" : "Save"}
                  </Button>
                ) : (
                  <>
                    <button
                      type="button"
                      title={t("print")}
                      className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => printSavedZReport()}
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title={t("reportPdfAction")}
                      disabled={zPdfWorking}
                      className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                      onClick={() => void downloadSavedZPdf()}
                    >
                      {zPdfWorking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileText className="h-4 w-4" />}
                    </button>
                  </>
                )}
              </div>
              <span className="text-3xl">{lang === "nl" ? "Z rapport" : "Z report"}</span>
            </div>
          </div>
          <div data-z-print-scroll className="max-h-[80vh] overflow-y-auto bg-muted/70 p-4 sm:p-5 print:bg-white print:p-0">
            <div id={Z_REPORT_PRINT_AREA_ID} className="mx-auto w-fit min-w-[460px] border border-neutral-400 bg-white px-6 py-5 text-[#111]">
                <div className="mx-auto w-fit font-mono text-[15px] leading-[1.35]">
                  {(zPreviewPayload?.lines || []).map((line, idx) => {
                    const displayLine = formatZReportLineForDisplay(line, zReportSaved);
                    const centeredTitle = isZPreviewCenteredTitle(displayLine);
                    const centeredHeader = isZPreviewHeaderLine(displayLine);
                    return (
                      <div
                        key={`z-preview-line-${idx}`}
                        className={cn(
                          "whitespace-pre",
                          centeredTitle || centeredHeader ? "text-center" : "",
                          centeredTitle || centeredHeader ? "font-bold" : "",
                        )}
                      >
                        {centeredTitle ? displayLine.trim() : displayLine}
                      </div>
                    );
                  })}
                </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={emptiesReportOpen} onOpenChange={setEmptiesReportOpen}>
        <DialogContent
          data-empties-print-content
          className={cn(
            "flex h-full max-h-[90vh] min-h-[90vh] w-[96vw] max-w-5xl flex-col gap-0 overflow-hidden border-border bg-muted p-0 text-foreground shadow-2xl sm:rounded-lg",
            "[&>button]:text-muted-foreground [&>button]:hover:bg-accent [&>button]:hover:text-foreground",
            "[&>button]:top-[9px]",
          )}
        >
          <DialogTitle className="sr-only">{t("empties")}</DialogTitle>
          <div className="flex h-[50px] min-h-[50px] max-h-[50px] shrink-0 items-center justify-center gap-10 border-b border-border bg-card">
            <button
              type="button"
              title={t("print")}
              className="flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => printEmptiesReportMain()}
            >
              <Printer className="h-5 w-5" />
            </button>
            <button
              type="button"
              title={t("reportPdfAction")}
              disabled={emptiesPdfWorking}
              className="flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              onClick={() => void downloadEmptiesPdf()}
            >
              {emptiesPdfWorking ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <FileText className="h-5 w-5" />}
            </button>
          </div>
          <div data-empties-print-scroll className="h-full overflow-y-auto bg-muted/60 p-4 sm:p-5 print:bg-white print:p-0">
            <div id={EMPTIES_REPORT_PRINT_AREA_ID} className="mx-auto min-h-full max-w-4xl bg-card px-8 pb-10 pt-8 text-foreground sm:px-10">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-2xl font-bold leading-tight text-foreground">{t("reportDefaultBusinessName")}</p>
                  <p className="mt-2 text-lg text-muted-foreground">Leeggoed rapport</p>
                  <p className="mt-1 text-base font-medium text-foreground">
                    {emptiesReportType === "liters"
                      ? "LITERS"
                      : emptiesReportType === "kg"
                        ? t("kgQty")
                        : emptiesReportType === "meters"
                          ? t("metersQty")
                          : t("piecesQty")}
                  </p>
                </div>
                <div className="space-y-1 text-right text-sm text-muted-foreground">
                  <p>
                    {reportHourLabel(clockFromHour)} {format(fromDate, "dd-MM-yyyy")} {t("reportPeriodThrough")}{" "}
                    {reportHourLabel(clockToHour)} {format(toDate, "dd-MM-yyyy")}
                  </p>
                  <p>{t("reportPrintedOn")} {emptiesReportOpenedAt ? format(emptiesReportOpenedAt, "HH:mm dd-MM-yyyy") : "—"}</p>
                  <p>{t("reportBy")} {user?.email ?? "—"}</p>
                </div>
              </div>

              <div className="mt-7 space-y-4">
                {[
                  { key: "categories", label: lang === "nl" ? "Categorieën" : "Categories", totals: emptiesCategoryTotals, rows: emptiesCategoryRows },
                  { key: "products", label: lang === "nl" ? "Producten" : "Products", totals: emptiesProductTotals, rows: emptiesProductRows },
                  { key: "transactions", label: lang === "nl" ? "Transacties" : "Transactions", totals: emptiesTransactionTotals, rows: emptiesTransactionRows },
                ].map((section) => (
                  <div key={section.key} className="p-3">
                    <p className="mb-3 text-center text-lg text-foreground">{section.label}</p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { key: "out", label: lang === "nl" ? "Uit" : "Out" },
                        { key: "in", label: lang === "nl" ? "In" : "In" },
                        { key: "diff", label: lang === "nl" ? "Verschil" : "Difference" },
                      ].map((col) => {
                        const totals = section.totals;
                        const val = totals[col.key as keyof EmptiesTotals];
                        const rowsToShow = section.rows.slice(0, 8);
                        return (
                          <div key={`${section.key}-${col.key}`} className="rounded border border-border px-4 py-3">
                            <p className="text-center text-foreground">{col.label}</p>
                            <div className="mt-3 space-y-1 text-sm leading-6 text-foreground">
                              {rowsToShow.length > 0 ? (
                                rowsToShow.map((r) => {
                                  const rowVal = Number(r[col.key as keyof EmptiesTotals]) || 0;
                                  return (
                                    <div key={`${section.key}-${col.key}-${r.label}`} className="flex min-h-[20px] items-center justify-between gap-2">
                                      <span className="truncate">{r.label}</span>
                                      <span className="tabular-nums">{formatPeriodicReportMoney(rowVal)}</span>
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="text-muted-foreground">—</div>
                              )}
                            </div>
                            <p className="mt-3 text-right text-sm text-foreground">
                              {emptiesReportType === "liters"
                                ? `Totaal Liter : ${formatPeriodicReportMoney(val)}`
                                : emptiesReportType === "kg"
                                  ? `${t("kgQty")} : ${formatPeriodicReportMoney(val)}`
                                  : emptiesReportType === "meters"
                                    ? `${t("metersQty")} : ${formatPeriodicReportMoney(val)}`
                                    : `${t("piecesQty")} : ${formatPeriodicReportMoney(val)}`}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {!exportOpen && tab === "stock" && (
        <div className="flex justify-center">
          <Card className="w-full max-w-xl justify-center flex p-6 shadow-card">
            <div className="space-y-5">
              <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                <Label className="text-sm font-medium">{t("sortBy")}</Label>
                <Select value={stockSortBy} onValueChange={setStockSortBy}>
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">{t("sortByProduct")}</SelectItem>
                    <SelectItem value="category">{t("sortByCategory")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                <Label className="text-sm font-medium">{t("display")}</Label>
                <Select value={stockDisplay} onValueChange={setStockDisplay}>
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allProducts")}</SelectItem>
                    <SelectItem value="active">{t("activeOnly")}</SelectItem>
                    <SelectItem value="screen">{t("inUseOnScreen")}</SelectItem>
                    <SelectItem value="supplier">{t("supplierLabel")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                <Label className="text-sm font-medium">{t("vat")}</Label>
                <Select value={stockVat} onValueChange={setStockVat}>
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="incl">{t("includingVat")}</SelectItem>
                    <SelectItem value="excl">{t("excludingVat")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-3 flex justify-center">
                <Button
                  type="button"
                  className="gap-2 bg-gradient-primary text-primary-foreground hover:opacity-90 px-6"
                  disabled={stockReportLoading}
                  onClick={() => void openStockReport()}
                >
                  {stockReportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}{" "}
                  {t("showReport")}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {!exportOpen && tab === "clock" && (
        <div className="flex justify-center">
          <Card className="w-full max-w-3xl p-6 shadow-card">
            <div className="space-y-5">
              <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                <Label className="text-sm font-medium text-foreground">{t("period")}</Label>
                <div className="flex items-center gap-2">
                  <Select value={clockFromHour} onValueChange={setClockFromHour}>
                    <SelectTrigger className="w-23"><SelectValue /></SelectTrigger>
                    <SelectContent>{Array.from({ length: 25 }).map((_, i) => <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</SelectItem>)}</SelectContent>
                  </Select>
                  <DatePickerField value={fromDate} onChange={setFromDate} disabled={reportRangeFromCalendarDisabled} />
                  <span className="text-xs text-muted-foreground">{t("until")}</span>
                  <Select value={clockToHour} onValueChange={setClockToHour}>
                    <SelectTrigger className="w-23"><SelectValue /></SelectTrigger>
                    <SelectContent>{Array.from({ length: 25 }).map((_, i) => <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</SelectItem>)}</SelectContent>
                  </Select>
                  <DatePickerField value={toDate} onChange={setToDate} disabled={reportRangeToCalendarDisabled} />
                </div>
              </div>

              <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                <Label className="text-sm font-medium">{t("user")}</Label>
                <Select value={reportUserFilter} onValueChange={setReportUserFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>{userSelectContent}</SelectContent>
                </Select>
              </div>

              <div className="pt-3 flex justify-center">
                <Button
                  type="button"
                  className="gap-2 bg-gradient-primary text-primary-foreground hover:opacity-90 px-6"
                  disabled={timeClockReportLoading}
                  onClick={() => void openTimeClockReport()}
                >
                  {timeClockReportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}{" "}
                  {t("showReport")}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Dialog open={timeClockReportOpen} onOpenChange={setTimeClockReportOpen}>
        <DialogContent
          data-time-clock-print-content
          className={cn(
            "flex h-full max-h-[90vh] min-h-[90vh] w-[96vw] max-w-5xl flex-col gap-0 overflow-hidden border-border bg-muted p-0 text-foreground shadow-2xl sm:rounded-lg",
            "[&>button]:text-muted-foreground [&>button]:hover:bg-accent [&>button]:hover:text-foreground",
            "[&>button]:top-[9px]",
          )}
        >
          <DialogTitle className="sr-only">{t("timeClock")}</DialogTitle>
          <div className="flex h-[50px] min-h-[50px] max-h-[50px] shrink-0 items-center justify-center gap-10 border-b border-border bg-card">
            <button
              type="button"
              title={t("print")}
              className="flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => printTimeClockReportMain()}
            >
              <Printer className="h-5 w-5" />
            </button>
            <button
              type="button"
              title={t("reportPdfAction")}
              disabled={timeClockPdfWorking}
              className="flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              onClick={() => void downloadTimeClockPdf()}
            >
              {timeClockPdfWorking ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <FileText className="h-5 w-5" />}
            </button>
          </div>
          <div data-time-clock-print-scroll className="h-full overflow-y-auto bg-muted/60 p-4 sm:p-5 print:bg-white print:p-0">
            <div
              id={TIME_CLOCK_REPORT_PRINT_AREA_ID}
              className="mx-auto max-w-4xl rounded-lg border border-border bg-background p-5 text-foreground shadow-sm print:max-w-none print:border-0 print:shadow-none"
            >
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-2xl font-bold leading-tight tracking-tight">{t("reportDefaultBusinessName")}</p>
                  <p className="mt-2 text-lg text-muted-foreground">{t("timeClock")}</p>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground sm:text-right">
                  <p>
                    {reportHourLabel(clockFromHour)} {format(fromDate, "dd-MM-yyyy")} {t("reportPeriodThrough")}{" "}
                    {reportHourLabel(clockToHour)} {format(toDate, "dd-MM-yyyy")}
                  </p>
                  <p>
                    {t("reportPrintedOn")} {timeClockReportOpenedAt ? format(timeClockReportOpenedAt, "HH:mm dd-MM-yyyy") : "—"}
                  </p>
                  <p>{t("reportBy")} {user?.email ?? "—"}</p>
                  <p>{timeClockUserLabel}</p>
                  <p>{t("reportTotalsAllRegisters")}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-md border border-border bg-card">
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("name")}</TableHead>
                      <TableHead>{lang === "nl" ? "Start" : "Start"}</TableHead>
                      <TableHead>{lang === "nl" ? "Stop" : "Stop"}</TableHead>
                      <TableHead className="text-right">{lang === "nl" ? "Uren" : "Hours"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timeClockGroupedRows.length ? (
                      timeClockGroupedRows.map((group, groupIdx) => (
                        <Fragment key={`time-clock-group-${group.userId || group.name}`}>
                          {group.entries.map((entry, idx) => (
                            <TableRow
                              key={`time-clock-entry-${entry.id}`}
                              className={groupIdx > 0 && idx === 0 ? "border-t-2 border-border" : undefined}
                            >
                              <TableCell className="font-medium">{idx === 0 ? group.name : ""}</TableCell>
                              <TableCell>{entry.start ? format(entry.start, "HH:mm:ss dd-MM-yyyy") : "—"}</TableCell>
                              <TableCell>{entry.stop ? format(entry.stop, "HH:mm:ss dd-MM-yyyy") : "—"}</TableCell>
                              <TableCell className="text-right tabular-nums">{formatTimeClockDuration(entry.durationSeconds)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell className="font-semibold">{t("total")} :</TableCell>
                            <TableCell />
                            <TableCell />
                            <TableCell className="text-right font-semibold tabular-nums">
                              {formatTimeClockDuration(group.totalSeconds)}
                            </TableCell>
                          </TableRow>
                        </Fragment>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-muted-foreground">
                          —
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {!exportOpen && tab === "suppliers" && (
        <div className="flex justify-center">
          <Card className="w-full max-w-3xl p-6 shadow-card">
            <div className="space-y-5">
              <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                <Label className="text-sm font-medium text-foreground">{t("period")}</Label>
                <div className="flex items-center gap-2">
                  <Select value={supplierFromHour} onValueChange={setSupplierFromHour}>
                    <SelectTrigger className="w-23"><SelectValue /></SelectTrigger>
                    <SelectContent>{Array.from({ length: 25 }).map((_, i) => <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</SelectItem>)}</SelectContent>
                  </Select>
                  <DatePickerField value={fromDate} onChange={setFromDate} disabled={reportRangeFromCalendarDisabled} />
                  <span className="text-xs text-muted-foreground">{t("until")}</span>
                  <Select value={supplierToHour} onValueChange={setSupplierToHour}>
                    <SelectTrigger className="w-23"><SelectValue /></SelectTrigger>
                    <SelectContent>{Array.from({ length: 25 }).map((_, i) => <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</SelectItem>)}</SelectContent>
                  </Select>
                  <DatePickerField value={toDate} onChange={setToDate} disabled={reportRangeToCalendarDisabled} />
                </div>
              </div>

              <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                <Label className="text-sm font-medium">{t("supplierLabel")}</Label>
                {reportSuppliers.length === 0 ? (
                  <div className="flex h-9 w-56 items-center rounded-md border border-input bg-muted/30 px-3 text-sm text-muted-foreground">
                    —
                  </div>
                ) : (
                  <Select value={reportSupplierFilter} onValueChange={setReportSupplierFilter}>
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>{supplierSelectContent}</SelectContent>
                  </Select>
                )}
              </div>

              <div className="pt-3 flex justify-center">
                <Button
                  type="button"
                  className="gap-2 bg-gradient-primary text-primary-foreground hover:opacity-90 px-6"
                  disabled={reportSuppliers.length === 0 || !reportSupplierFilter || supplierReportLoading}
                  onClick={() => void openSupplierReport()}
                >
                  {supplierReportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}{" "}
                  {t("showReport")}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Dialog open={supplierReportOpen} onOpenChange={setSupplierReportOpen}>
        <DialogContent
          data-supplier-print-content
          className={cn(
            "flex h-full max-h-[90vh] min-h-[90vh] w-[95vw] max-w-4xl flex-col gap-0 overflow-hidden border-border bg-muted p-0 text-foreground shadow-2xl sm:rounded-lg",
            "[&>button]:text-muted-foreground [&>button]:hover:bg-accent [&>button]:hover:text-foreground",
            "[&>button]:top-[9px]",
          )}
        >
          <DialogTitle className="sr-only">{t("supplierReportTitle")}</DialogTitle>
          <div className="flex h-[50px] min-h-[50px] max-h-[50px] shrink-0 items-center justify-center gap-10 border-b border-border bg-card">
            <button
              type="button"
              title={t("print")}
              className="flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => printSupplierReportMain()}
            >
              <Printer className="h-5 w-5" />
            </button>
            <button
              type="button"
              title={t("reportPdfAction")}
              disabled={supplierPdfWorking}
              className="flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              onClick={() => void downloadSupplierPdf()}
            >
              {supplierPdfWorking ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <FileText className="h-5 w-5" />
              )}
            </button>
          </div>

          <div
            data-supplier-print-scroll
            className="h-full overflow-y-auto bg-muted/60 p-4 sm:p-5 print:bg-white print:p-0"
          >
            <div
              id={SUPPLIER_REPORT_PRINT_AREA_ID}
              className="min-h-full bg-card px-8 pb-10 pt-8 text-foreground sm:px-10"
            >
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                <div>
                  <p className="text-2xl font-bold leading-tight text-foreground">{t("reportDefaultBusinessName")}</p>
                  <p className="mt-2 text-lg text-muted-foreground">{t("supplierReportTitle")}</p>
                  <p className="mt-3 break-words text-base font-semibold leading-snug text-foreground">
                    {selectedSupplierName}
                  </p>
                </div>
                <div className="space-y-2 text-right text-sm text-muted-foreground">
                  <p>
                    {reportHourLabel(supplierFromHour)} {format(fromDate, "dd-MM-yyyy")}{" "}
                    {t("reportPeriodThrough")} {reportHourLabel(supplierToHour)} {format(toDate, "dd-MM-yyyy")}
                  </p>
                  <p>
                    {t("reportPrintedOn")}{" "}
                    {supplierReportOpenedAt ? format(supplierReportOpenedAt, "HH:mm dd-MM-yyyy") : "—"}
                  </p>
                  <p>
                    {t("reportBy")} {user?.email ?? "—"}
                  </p>
                </div>
              </div>

              <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="supplier-report-stat-box flex flex-col rounded-md border border-border bg-background dark:bg-muted/40">
                  <p className="pt-4 text-center text-sm font-medium text-foreground">{t("categoryTotals")}</p>
                  <div className="space-y-1 px-4 pb-1 pt-2 text-sm">
                    {supplierReportPayload?.categoryRows?.length ? (
                      supplierReportPayload.categoryRows.map((r) => (
                        <div key={`supplier-cat-${r.label}`} className="flex justify-between gap-2 tabular-nums">
                          <span className="break-words text-left">
                            <span className="inline-block min-w-[100px]">{r.qtyLabel ?? r.qty}</span>
                            <span>{r.label}</span>
                          </span>
                          <span>{formatPeriodicReportMoney(r.amount)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">—</p>
                    )}
                  </div>
                  <p className="pb-4 pr-4 text-right text-sm text-foreground">
                    {t("total")} :{" "}
                    <span className="text-muted-foreground">{formatPeriodicReportMoney(supplierReportPayload?.totals?.amount ?? 0)}</span>
                  </p>
                </div>
                <div className="supplier-report-stat-box flex flex-col rounded-md border border-border bg-background dark:bg-muted/40">
                  <p className="pt-4 text-center text-sm font-medium text-foreground">{t("productTotals")}</p>
                  <div className="space-y-1 px-4 pb-1 pt-2 text-sm">
                    {supplierReportPayload?.rows?.length ? (
                      supplierReportPayload.rows.map((r) => (
                        <div key={`supplier-product-${r.label}`} className="flex justify-between gap-2 tabular-nums">
                          <span className="break-words text-left">
                            <span className="inline-block min-w-[100px]">{r.qtyLabel ?? r.qty}</span>
                            <span>{r.label}</span>
                          </span>
                          <span>{formatPeriodicReportMoney(r.amount)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">—</p>
                    )}
                  </div>
                  <p className="pb-4 pr-4 text-right text-sm text-foreground">
                    {t("total")} :{" "}
                    <span className="text-muted-foreground">{formatPeriodicReportMoney(supplierReportPayload?.totals?.amount ?? 0)}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={stockReportOpen} onOpenChange={setStockReportOpen}>
        <DialogContent
          data-stock-print-content
          className={cn(
            "flex h-full max-h-[90vh] min-h-[90vh] w-[96vw] max-w-6xl flex-col gap-0 overflow-hidden border-border bg-muted p-0 text-foreground shadow-2xl sm:rounded-lg",
            "[&>button]:text-muted-foreground [&>button]:hover:bg-accent [&>button]:hover:text-foreground",
            "[&>button]:top-[9px]",
          )}
        >
          <DialogTitle className="sr-only">{t("stockReportTitle")}</DialogTitle>
          <div className="flex h-[50px] min-h-[50px] max-h-[50px] shrink-0 items-center justify-center gap-10 border-b border-border bg-card">
            <button
              type="button"
              title={t("print")}
              className="flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => printStockReportMain()}
            >
              <Printer className="h-5 w-5" />
            </button>
            <button
              type="button"
              title={t("reportPdfAction")}
              disabled={stockPdfWorking}
              className="flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              onClick={() => void downloadStockPdf()}
            >
              {stockPdfWorking ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <FileText className="h-5 w-5" />}
            </button>
          </div>

          <div
            data-stock-print-scroll
            className="h-full overflow-y-auto bg-muted/60 p-4 sm:p-5 print:bg-white print:p-0"
          >
            <div
              id={STOCK_REPORT_PRINT_AREA_ID}
              className="mx-auto max-w-5xl bg-card px-4 pb-10 pt-6 text-foreground shadow-sm sm:px-4 sm:pt-8 print:shadow-none"
            >
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between print:flex-row print:items-start print:justify-between">
                <div className="min-w-0">
                  <p className="text-2xl font-bold leading-tight text-foreground">{t("reportDefaultBusinessName")}</p>
                  <p className="mt-2 text-lg text-muted-foreground">{t("stockReportTitle")}</p>
                  <p className="mt-1 text-base font-semibold text-foreground">
                    {stockVat === "incl" ? t("includingVat") : t("excludingVat")}
                  </p>
                </div>
                <div className="shrink-0 space-y-1.5 text-right text-sm text-muted-foreground lg:max-w-[340px] print:max-w-[340px]">
                  <p>
                    {t("reportPrintedOn")}{" "}
                    {stockReportOpenedAt ? format(stockReportOpenedAt, "HH:mm dd-MM-yyyy") : "—"}
                  </p>
                  <p>
                    {t("reportBy")} {user?.email ?? "—"}
                  </p>
                  <p className="font-medium text-foreground">{t(stockListSubtitleKey)}</p>
                  <p>
                    {t("reportTotalOpenPurchase")} : {formatReportMoney(stockReportTotals.openPurchase)}
                  </p>
                  <p>
                    {t("reportTotalOpenSale")} : {formatReportMoney(stockReportTotals.openSale)}
                  </p>
                </div>
              </div>

              <div className="mt-8 overflow-x-auto rounded-md border border-border bg-background">
                <Table className="min-w-[920px] text-sm">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[100px] whitespace-nowrap">{t("stockColQty")}</TableHead>
                      <TableHead className="min-w-[120px] print:min-w-[96px]">{t("stockColProduct")}</TableHead>
                      <TableHead className="min-w-[90px] print:min-w-[72px]">{t("stockColCategory")}</TableHead>
                      <TableHead className="text-right tabular-nums whitespace-nowrap">{t("stockColSalePrice")}</TableHead>
                      <TableHead className="text-right tabular-nums whitespace-nowrap">{t("stockColPurchasePrice")}</TableHead>
                      <TableHead className="text-right tabular-nums whitespace-nowrap">{t("stockColTotalSale")}</TableHead>
                      <TableHead className="text-right tabular-nums whitespace-nowrap">{t("stockColTotalPurchase")}</TableHead>
                      <TableHead className="text-right tabular-nums whitespace-nowrap">{t("stockColMargin")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockReportRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                          —
                        </TableCell>
                      </TableRow>
                    ) : (
                      stockReportRows.map((row) => (
                        <TableRow key={row.productId}>
                          <TableCell className="whitespace-nowrap font-medium">{row.qtyLabel}</TableCell>
                          <TableCell className="max-w-[160px] break-words print:max-w-[120px]">{row.productName}</TableCell>
                          <TableCell className="max-w-[100px] break-words text-muted-foreground print:max-w-[76px]">{row.categoryName || "—"}</TableCell>
                          <TableCell className="text-right tabular-nums whitespace-nowrap">
                            {formatReportMoney(row.salePrice)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums whitespace-nowrap">
                            {formatReportMoney(row.purchasePrice)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums whitespace-nowrap">
                            {formatReportMoney(row.totalSale)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums whitespace-nowrap">
                            {formatReportMoney(row.totalPurchase)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums whitespace-nowrap">
                            {formatReportMoney(row.margin)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog modal={false} open={ticketsOpen} onOpenChange={setTicketsOpen}>
        <DialogContent
          data-ticket-print-content
          overlayProps={ticketsDialogOverlayProps}
          className={cn(
            "flex h-[90vh] max-h-[90vh] w-[95vw] max-w-6xl flex-col gap-0 overflow-hidden p-0",
            "[&>button]:text-muted-foreground [&>button]:hover:bg-accent [&>button]:hover:text-foreground",
            "[&>button]:top-[9px]",
          )}
        >
          <DialogTitle className="sr-only">{t("tickets")}</DialogTitle>
          <div className="flex h-[50px] min-h-[50px] max-h-[50px] shrink-0 items-center justify-around gap-4 border-b border-border bg-card px-4 sm:px-10">
            <div className="flex items-center gap-10">
              <button
                type="button"
                title={t("print")}
                className="flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => printTicketsReportMain()}
              >
                <Printer className="h-5 w-5" />
              </button>
              <button
                type="button"
                title={t("reportPdfAction")}
                disabled={ticketsPdfWorking}
                className="flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                onClick={() => void downloadTicketsPdf()}
              >
                {ticketsPdfWorking ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <FileText className="h-5 w-5" />}
              </button>
            </div>
            <div className="flex items-center gap-8 text-sm">
              <span className="font-medium text-foreground">
                {t("total")} :{" "}
                <span className="text-muted-foreground tabular-nums">{formatReportMoney(displayedTicketsTotal)}</span>
              </span>
              <span className="font-medium text-foreground">
                {t("numTickets")} :{" "}
                <span className="text-muted-foreground tabular-nums">{displayedTickets.length}</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  placeholder={t("search") + "..."}
                  className="h-9 w-44 pl-8 sm:w-56"
                />
              </div>
            </div>
          </div>

          <div
            data-ticket-print-scroll
            className="min-h-0 flex-1 overflow-y-auto bg-muted/60 p-4 sm:p-5 print:bg-white print:p-0"
          >
            <div
              id={TICKETS_REPORT_PRINT_AREA_ID}
            >
              <div className="overflow-x-auto rounded-md print:border-0 print:bg-white">
                <Table className="min-w-[720px] text-sm">
                  <TableHeader
                    className="sticky top-0 z-10 print:static print:bg-white print:text-black"
                    data-ticket-print-skip
                  >
                    <TableRow>
                      <TableHead>{t("number")}</TableHead>
                      <TableHead>{t("event")}</TableHead>
                      <TableHead>{t("kassaNr")}</TableHead>
                      <TableHead>{t("time")}</TableHead>
                      <TableHead className="text-right">{t("amount")}</TableHead>
                      <TableHead>{t("payment")}</TableHead>
                      <TableHead>{t("user")}</TableHead>
                      <TableHead>{t("customer")}</TableHead>
                      <TableHead className="w-10 min-w-10 px-1 text-center print:w-12">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mx-auto h-8 w-8 text-muted-foreground opacity-90 hover:text-foreground"
                          data-ticket-print-skip
                          title={allDisplayedTicketsExpanded ? t("collapseAll") : t("expandAll")}
                          aria-expanded={allDisplayedTicketsExpanded}
                          disabled={displayedTickets.length === 0}
                          onClick={() => {
                            setTicketExpandErrors({});
                            if (allDisplayedTicketsExpanded) {
                              setExpandedTicketOrderIds([]);
                            } else {
                              setExpandedTicketOrderIds(displayedTickets.map((r) => r.id));
                            }
                          }}
                        >
                          {allDisplayedTicketsExpanded ? (
                            <ChevronUp className="h-4 w-4" aria-hidden />
                          ) : (
                            <ChevronDown className="h-4 w-4" aria-hidden />
                          )}
                          <span className="sr-only">
                            {allDisplayedTicketsExpanded ? t("collapseAll") : t("expandAll")}
                          </span>
                        </Button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="[&>tr:last-child[data-ticket-print-divider]]:!border-b [&>tr:last-child[data-ticket-print-divider]]:!border-border">
                    {displayedTickets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                          —
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayedTickets.map((row) => {
                        const isExpanded = expandedTicketOrderIds.includes(row.id);
                        const orderPayload = ticketOrderById[row.id];
                        const loadingLines = isExpanded && ticketExpandLoadingIds.includes(row.id);
                        const rowExpandError = ticketExpandErrors[row.id];
                        return (
                          <Fragment key={row.id}>
                            <TableRow
                              className={cn(isExpanded && "border-b-0")}
                              data-ticket-print-divider={isExpanded ? undefined : ""}
                            >
                              <TableCell className="tabular-nums">{row.rowNumber}</TableCell>
                              <TableCell>{row.event}</TableCell>
                              <TableCell>{row.registerName}</TableCell>
                              <TableCell className="whitespace-nowrap">{formatTicketRowTime(row.settledAt)}</TableCell>
                              <TableCell className="whitespace-nowrap tabular-nums text-right">
                                {formatTicketLineUnitPrice(row.amount)}
                              </TableCell>
                              <TableCell className="max-w-[140px] break-words">{row.payment}</TableCell>
                              <TableCell>{row.userName}</TableCell>
                              <TableCell className="max-w-[160px] break-words">{row.customerName}</TableCell>
                              <TableCell className="w-10 min-w-10 p-0 text-right print:px-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                                  data-ticket-print-skip
                                  title={t("details")}
                                  aria-expanded={isExpanded}
                                  onClick={() => {
                                    setExpandedTicketOrderIds((prev) =>
                                      prev.includes(row.id) ? prev.filter((x) => x !== row.id) : [...prev, row.id],
                                    );
                                  }}
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4" aria-hidden />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" aria-hidden />
                                  )}
                                  <span className="sr-only">{t("details")}</span>
                                </Button>
                              </TableCell>
                            </TableRow>
                            {isExpanded && loadingLines ? (
                              <TableRow className="hover:bg-transparent border-b border-border" data-ticket-print-divider="">
                                <TableCell
                                  colSpan={9}
                                  className="bg-muted/50 px-3 py-3 text-sm dark:bg-muted/30"
                                >
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                                    <span>{t("loadingEllipsis")}</span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : null}
                            {isExpanded && !loadingLines && rowExpandError ? (
                              <TableRow className="hover:bg-transparent border-b border-border" data-ticket-print-divider="">
                                <TableCell
                                  colSpan={9}
                                  className="bg-muted/50 px-3 py-3 text-sm dark:bg-muted/30"
                                >
                                  <p className="text-destructive">{rowExpandError}</p>
                                </TableCell>
                              </TableRow>
                            ) : null}
                            {isExpanded && !loadingLines && !rowExpandError && orderPayload && orderPayload.items.length > 0
                              ? orderPayload.items.map((item, idx) => {
                                const name = (item.product?.name || "").trim() || "—";
                                const isLastLine = idx === orderPayload.items.length - 1;
                                return (
                                  <TableRow
                                    key={`${row.id}-${item.id}`}
                                    className={cn(
                                      "hover:bg-transparent border-b-0",
                                      isLastLine && "border-b border-border",
                                    )}
                                    data-ticket-print-divider={isLastLine ? "" : undefined}
                                  >
                                    <TableCell colSpan={4} className="py-1.5 pl-10 text-sm align-top text-foreground">
                                      <span className="tabular-nums text-muted-foreground">{item.quantity}</span>
                                      <span className="text-muted-foreground"> x </span>
                                      <span>{name}</span>
                                    </TableCell>
                                    <TableCell className="py-1.5 text-sm align-top tabular-nums text-right text-foreground whitespace-nowrap">
                                      {formatTicketLineUnitPrice(item.price)}
                                    </TableCell>
                                    <TableCell colSpan={4} className="py-1.5 align-top" />
                                  </TableRow>
                                );
                              })
                              : null}
                            {isExpanded && !loadingLines && !rowExpandError && orderPayload && orderPayload.items.length === 0 ? (
                              <TableRow className="hover:bg-transparent border-b border-border" data-ticket-print-divider="">
                                <TableCell
                                  colSpan={9}
                                  className="bg-muted/50 px-3 py-3 text-sm text-muted-foreground dark:bg-muted/30"
                                >
                                  —
                                </TableCell>
                              </TableRow>
                            ) : null}
                          </Fragment>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog modal={false} open={bestReportOpen} onOpenChange={setBestReportOpen}>
        <DialogContent
          data-best-print-content
          className={cn(
            "flex h-[90vh] max-h-[90vh] w-[95vw] max-w-5xl flex-col gap-0 overflow-hidden p-0",
            "[&>button]:text-muted-foreground [&>button]:hover:bg-accent [&>button]:hover:text-foreground",
            "[&>button]:top-[9px]",
          )}
        >
          <DialogTitle className="sr-only">{t("bestSellers")}</DialogTitle>
          <div className="flex h-[50px] min-h-[50px] max-h-[50px] shrink-0 items-center justify-center gap-10 border-b border-border bg-card px-4" data-best-print-skip>
            <button
              type="button"
              title={t("print")}
              className="flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => printBestReportMain()}
            >
              <Printer className="h-5 w-5" />
            </button>
            <button
              type="button"
              title={t("reportPdfAction")}
              disabled={bestPdfWorking}
              className="flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              onClick={() => void downloadBestPdf()}
            >
              {bestPdfWorking ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <FileText className="h-5 w-5" />}
            </button>
          </div>

          <div
            data-best-print-scroll
            className="min-h-0 flex-1 overflow-y-auto bg-muted/60 p-4 sm:p-6 print:bg-white print:p-0"
          >
            <div
              id={BEST_REPORT_PRINT_AREA_ID}
              className="mx-auto max-w-4xl rounded-lg border border-border bg-background p-5 text-foreground shadow-sm print:max-w-none print:border-0 print:shadow-none"
            >
              {bestReportPayload ? (
                <>
                  <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
                    <div className="min-w-0 shrink-0">
                      <div className="text-2xl font-bold leading-tight tracking-tight print:text-[18pt]">{t("reportDefaultBusinessName")}</div>
                      <div className="mt-1 text-base font-semibold text-foreground sm:text-lg print:text-[12pt]">{t("bestSellers")}</div>
                      <div className="mt-2 text-xl font-semibold text-foreground">{bestReportTypeLabel}</div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1 text-sm sm:text-right print:text-[9pt]">
                      {bestReportPeriodLine ? <div className="tabular-nums text-muted-foreground">{bestReportPeriodLine}</div> : null}
                      {bestReportOpenedAt ? (
                        <div>
                          {t("reportPrintedOn")}{" "}
                          <span className="tabular-nums text-muted-foreground">
                            {format(
                              bestReportOpenedAt,
                              lang === "nl" ? "HH:mm dd-MM-yyyy" : "HH:mm dd/MM/yyyy",
                            )}
                          </span>
                        </div>
                      ) : null}
                      <div>
                        {t("reportBy")} <span className="text-muted-foreground">{user?.email ?? "—"}</span>
                      </div>
                    </div>
                  </div>

                  {bestDisplay === "text" ? (
                    bestReportPayload.entity === "products" ? (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 print:grid-cols-2 print:items-start">
                        <div className="rounded-md border border-border bg-card p-3 text-sm shadow-sm print:mb-4 print:break-inside-avoid print:border-neutral-300 print:bg-white print:shadow-none">
                          <div className="mb-2 pb-1.5 text-center text-sm font-semibold text-foreground">{t("categoryTotals")}</div>
                          <div className="space-y-1">
                            {bestReportPayload.categoryRows.length === 0 ? (
                              <p className="text-muted-foreground">—</p>
                            ) : (
                              bestReportPayload.categoryRows.map((r) => (
                                <div key={r.label} className="flex justify-between gap-2 tabular-nums">
                                  <span className="break-words text-left">
                                    <span className="inline-block min-w-[50px]">{r.qty}</span>
                                    <span>{r.label}</span>
                                  </span>
                                  <span>{formatPeriodicReportMoney(r.amount)}</span>
                                </div>
                              ))
                            )}
                            <div className="mt-2 flex justify-between pt-1.5 font-medium">
                              <span>{bestReportPayload.totals.qty}</span>
                              <span className="tabular-nums">{t("total")} &nbsp;:&nbsp; {formatPeriodicReportMoney(bestReportPayload.totals.amount)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-md border border-border bg-card p-3 text-sm shadow-sm print:break-inside-auto print:border-neutral-300 print:bg-white print:shadow-none">
                          <div className="mb-2 pb-1.5 text-center text-sm font-semibold text-foreground">{t("productTotals")}</div>
                          <div className="space-y-1">
                            {bestReportPayload.rows.length === 0 ? (
                              <p className="text-muted-foreground">—</p>
                            ) : (
                              bestReportPayload.rows.map((r) => (
                                <div key={`${r.label}-${r.category ?? ""}`} className="flex justify-between gap-2 tabular-nums">
                                  <span className="break-words text-left">
                                    <span className="inline-block min-w-[50px]">{r.qty}</span>
                                    <span>{r.label}</span>
                                  </span>
                                  <span>{formatPeriodicReportMoney(r.amount)}</span>
                                </div>
                              ))
                            )}
                            <div className="mt-2 flex justify-between pt-1.5 font-medium">
                              <span>{bestReportPayload.totals.qty}</span>
                              <span className="tabular-nums">{t("total")} &nbsp;:&nbsp; {formatPeriodicReportMoney(bestReportPayload.totals.amount)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-md border border-border bg-card p-3 text-sm shadow-sm print:border-neutral-300 print:bg-white print:shadow-none">
                        <div className="mb-2 pb-1.5 text-center text-sm font-semibold text-foreground">{bestReportTypeLabel}</div>
                        <div className="space-y-1">
                          {bestReportPayload.rows.length === 0 ? (
                            <p className="text-muted-foreground">—</p>
                          ) : (
                            bestReportPayload.rows.map((r) => (
                              <div key={r.label} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 tabular-nums">
                                <span className="break-words">{r.label}</span>
                                <span>{r.qty}</span>
                                <span>{formatPeriodicReportMoney(r.amount)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )
                  ) : bestReportPieBarData.length === 0 ? (
                    <div className="rounded-md border border-border bg-card p-8 text-center text-muted-foreground">—</div>
                  ) : bestDisplay === "pie" ? (
                    <div className="rounded-md border border-border bg-card p-4 shadow-sm print:border-neutral-300 print:bg-white print:shadow-none">
                      <div className="h-[500px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={bestReportPieBarData}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={120}
                              outerRadius={200}
                              paddingAngle={1}
                              label={({ percent }) => `${((percent ?? 0) * 100).toFixed(1)}%`}
                            >
                              {bestReportPieBarData.map((_, i) => (
                                <Cell key={`best-pie-${i}`} fill={bestChartColors[i % bestChartColors.length]} />
                              ))}
                            </Pie>
                            <RechartsTooltip
                              formatter={(v: number, _name, payload: { payload?: { amount?: number; qty?: number } }) => {
                                const p = payload?.payload;
                                const metric = bestReportPayload.entity === "customers" ? formatPeriodicReportMoney(Number(v) || 0) : String(Math.round(Number(v) || 0));
                                return [`${metric} (${formatPeriodicReportMoney(Number(p?.amount) || 0)})`, t("total")];
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-3 text-sm">
                        {bestReportPieBarData.map((row, i) => (
                          <div key={`best-pie-legend-${row.name}-${i}`} className="inline-flex items-center gap-2">
                            <span
                              className="h-2.5 w-10 shrink-0 rounded-sm"
                              style={{ backgroundColor: bestChartColors[i % bestChartColors.length] }}
                            />
                            <span className="text-foreground">{row.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-md border border-border bg-card p-4 shadow-sm print:border-neutral-300 print:bg-white print:shadow-none">
                      <div className="h-[500px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={bestReportPieBarData} margin={{ top: 12, right: 12, left: 0, bottom: 16 }}>
                            <XAxis dataKey="name" hide />
                            <YAxis />
                            <RechartsTooltip
                              formatter={(v: number, _name, payload: { payload?: { amount?: number; qty?: number } }) => {
                                const p = payload?.payload;
                                const metric = bestReportPayload.entity === "customers" ? formatPeriodicReportMoney(Number(v) || 0) : String(Math.round(Number(v) || 0));
                                return [`${metric} (${formatPeriodicReportMoney(Number(p?.amount) || 0)})`, t("total")];
                              }}
                            />
                            <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                              {bestReportPieBarData.map((_, i) => (
                                <Cell key={`best-bar-${i}`} fill={bestChartColors[i % bestChartColors.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-3 text-sm">
                        {bestReportPieBarData.map((row, i) => (
                          <div key={`best-bar-legend-${row.name}-${i}`} className="inline-flex items-center gap-2">
                            <span
                              className="h-2.5 w-10 shrink-0 rounded-sm"
                              style={{ backgroundColor: bestChartColors[i % bestChartColors.length] }}
                            />
                            <span className="text-foreground">{row.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="py-12 text-center text-muted-foreground">—</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog modal={false} open={periodicReportOpen} onOpenChange={setPeriodicReportOpen}>
        <DialogContent
          data-periodic-print-content
          overlayProps={periodicDialogOverlayProps}
          className={cn(
            "flex h-[90vh] max-h-[90vh] w-[95vw] max-w-5xl flex-col gap-0 overflow-hidden p-0",
            "[&>button]:text-muted-foreground [&>button]:hover:bg-accent [&>button]:hover:text-foreground",
            "[&>button]:top-[9px]",
          )}
        >
          <DialogTitle className="sr-only">{t("periodic")}</DialogTitle>
          <div
            className="flex h-[50px] min-h-[50px] max-h-[50px] shrink-0 items-center justify-center gap-10 border-b border-border bg-card px-4"
            data-periodic-print-skip
          >
            <button
              type="button"
              title={t("print")}
              className="flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => printPeriodicReportMain()}
            >
              <Printer className="h-5 w-5" />
            </button>
            <button
              type="button"
              title={t("reportPdfAction")}
              disabled={periodicPdfWorking}
              className="flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              onClick={() => void downloadPeriodicPdf()}
            >
              {periodicPdfWorking ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <FileText className="h-5 w-5" />
              )}
            </button>
          </div>

          <div
            data-periodic-print-scroll
            className="min-h-0 flex-1 overflow-y-auto bg-muted/60 p-4 sm:p-6 print:bg-white print:p-0"
          >
            <div id={PERIODIC_REPORT_PRINT_AREA_ID} className="mx-auto max-w-4xl rounded-lg border border-border bg-background p-5 text-foreground shadow-sm print:max-w-none print:border-0 print:shadow-none">
              {periodicReportPayload ? (
                <>
                  <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
                    <div className="min-w-0 shrink-0">
                      <div className="text-2xl font-bold leading-tight tracking-tight print:text-[18pt]">
                        {t("reportDefaultBusinessName")}
                      </div>
                      <div className="mt-1 text-base font-semibold text-foreground sm:text-lg print:text-[12pt]">
                        {t("periodicReportDocTitle")}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1 text-sm sm:text-right print:text-[9pt]">
                      {periodicReportPeriodLine ? (
                        <div className="tabular-nums text-muted-foreground">{periodicReportPeriodLine}</div>
                      ) : null}
                      {periodicReportOpenedAt ? (
                        <div>
                          {t("reportPrintedOn")}{" "}
                          <span className="tabular-nums text-muted-foreground">
                            {format(
                              periodicReportOpenedAt,
                              lang === "nl" ? "HH:mm dd-MM-yyyy" : "HH:mm dd/MM/yyyy",
                            )}
                          </span>
                        </div>
                      ) : null}
                      <div>
                        {t("reportBy")}{" "}
                        <span className="text-muted-foreground">{user?.email ?? "—"}</span>
                      </div>
                      {reportUserFilter === "all" ? (
                        <div className="text-muted-foreground">{t("reportTotalsAllUsers")}</div>
                      ) : (
                        <div className="text-muted-foreground">
                          {t("user")}: {ticketReportUserLabel}
                        </div>
                      )}
                      {reportRegisterFilter === "all" ? (
                        <div className="text-muted-foreground">{t("reportTotalsAllRegisters")}</div>
                      ) : (
                        <div className="text-muted-foreground">
                          {t("register")}: {ticketReportRegisterLabel}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 print:grid-cols-2 md:items-start">
                    <div className="flex min-w-0 flex-col gap-4">
                      {periodicLayoutColumns.left.map((key) => (
                        <PeriodicReportSectionBlock
                          key={key}
                          sectionKey={key}
                          sections={periodicReportPayload.sections}
                          title={t(key as never)}
                          t={t}
                          formatReportMoney={formatPeriodicReportMoney}
                        />
                      ))}
                    </div>
                    <div className="flex min-w-0 flex-col gap-4">
                      {periodicLayoutColumns.right.map((key) => (
                        <PeriodicReportSectionBlock
                          key={key}
                          sectionKey={key}
                          sections={periodicReportPayload.sections}
                          title={t(key as never)}
                          t={t}
                          formatReportMoney={formatPeriodicReportMoney}
                        />
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <p className="py-12 text-center text-muted-foreground">—</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
};

export default Reports;
