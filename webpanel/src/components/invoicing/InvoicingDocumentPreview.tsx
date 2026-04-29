import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Printer, Download, FileText, Bell, Coins, X } from "lucide-react";
import type { TranslationKey } from "@/lib/translations";
import { apiRequest } from "@/lib/api";

export type SavedInvoicingDocumentDTO = {
  id: string;
  displayNumber: number;
  kind: string;
  layout: string;
  docLang: string;
  paymentTerm: string;
  paymentMethod: string;
  documentDate: string;
  alreadyPaid: number;
  notes: string;
  attachmentPos: string;
  attachmentText: string;
  customerId: string | null;
  customer: Record<string, unknown> | null;
  items: Array<{
    qty: number;
    description: string;
    totalIncl: number;
    perPieceIncl: number;
    perPieceExcl: number;
    discount: number;
    vat: number;
  }>;
  subtotalExcl: number;
  vatTotal: number;
  totalIncl: number;
  dueAmount: number;
};

export type InvoicingPreviewLayout = {
  companyInfoLines: string[];
  footerText: string;
  logoDataUrl: string;
};

type Props = {
  document: SavedInvoicingDocumentDTO;
  layout: InvoicingPreviewLayout | null;
  docKindLabel: string;
  t: (key: TranslationKey) => string;
  onClose: () => void;
  onToolbarStub: () => void;
};

function emailFromCustomerSnapshot(customer: Record<string, unknown> | null): string {
  const raw = customer ? String(customer.email ?? "").trim() : "";
  return raw.includes("@") ? raw : "";
}

function isDisplayableLogoUrl(raw: string | undefined | null): raw is string {
  const s = String(raw ?? "").trim();
  if (!s) return false;
  return s.startsWith("data:image/") || s.startsWith("http://") || s.startsWith("https://");
}

function CustomerUnderInvoice({ customer }: { customer: Record<string, unknown> | null }) {
  if (!customer) {
    return <div className="text-xs text-neutral-500">—</div>;
  }
  const lines = [
    String(customer.name ?? "").trim(),
    customer.subName != null ? String(customer.subName).trim() : "",
    String(customer.street ?? "").trim(),
    String(customer.postalCity ?? "").trim(),
    String(customer.country ?? "").trim(),
    String(customer.vatNumber ?? "").trim(),
  ].filter((x) => x.length > 0 && x !== "-");
  if (lines.length === 0) {
    return <div className="text-xs text-neutral-500">—</div>;
  }
  return (
    <div className="mt-2 space-y-0.5 text-xs leading-snug text-neutral-900">
      {lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
}

function vatRowsFromItems(
  items: SavedInvoicingDocumentDTO["items"],
): { rate: number; amount: number; base: number }[] {
  const map = new Map<number, { vat: number; base: number }>();
  for (const it of items) {
    const lineIncl = Number(it.totalIncl) || 0;
    const lineExcl = (Number(it.perPieceExcl) || 0) * (Number(it.qty) || 0);
    const vatAmt = Math.round((lineIncl - lineExcl) * 100) / 100;
    const rate = Number(it.vat) || 0;
    const cur = map.get(rate) ?? { vat: 0, base: 0 };
    cur.vat += vatAmt;
    cur.base += lineExcl;
    map.set(rate, cur);
  }
  return [...map.entries()]
    .map(([rate, v]) => ({ rate, amount: Math.round(v.vat * 100) / 100, base: Math.round(v.base * 100) / 100 }))
    .sort((a, b) => a.rate - b.rate);
}

export function InvoicingDocumentPreview({ document, layout, docKindLabel, t, onClose, onToolbarStub }: Props) {
  const snapshotEmail = emailFromCustomerSnapshot(document.customer);

  /** Snapshot email, or fetched from `/api/customers/:id` when snapshot omits email (older saves). */
  const [resolvedMail, setResolvedMail] = useState<string | null>(() => {
    if (snapshotEmail) return snapshotEmail;
    return document.customerId?.trim() ? null : "";
  });

  useEffect(() => {
    if (snapshotEmail) {
      setResolvedMail(snapshotEmail);
      return;
    }
    const cid = document.customerId?.trim();
    if (!cid) {
      setResolvedMail("");
      return;
    }
    setResolvedMail(null);
    let cancelled = false;
    void (async () => {
      try {
        const row = await apiRequest<Record<string, unknown>>(`/api/customers/${encodeURIComponent(cid)}`);
        if (cancelled) return;
        const e = String(row?.email ?? "").trim();
        setResolvedMail(e.includes("@") ? e : "");
      } catch {
        if (!cancelled) setResolvedMail("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [document.customerId, snapshotEmail]);

  const docDate = (() => {
    try {
      return format(parseISO(document.documentDate), "dd-MM-yyyy");
    } catch {
      return document.documentDate;
    }
  })();

  const customerNr = document.customerId ? String(document.customerId).slice(0, 8) : "—";
  const mailTo =
    resolvedMail === null
      ? t("invoicingPreviewMailLoading")
      : resolvedMail || t("invoicingPreviewNoCustomerEmail");

  /** All non-empty company lines from document layout settings (shown under logo, in order). */
  const companyLines = (layout?.companyInfoLines ?? [])
    .map((l) => String(l ?? "").trim())
    .filter((l) => l.length > 0);
  const logoRaw = layout?.logoDataUrl?.trim() ?? "";
  const logoUrl = isDisplayableLogoUrl(logoRaw) ? logoRaw : null;
  const footerText = (layout?.footerText ?? "").trim();

  const vatRows = vatRowsFromItems(document.items);

  return (
    <div className="flex flex-col bg-background text-foreground max-h-[90vh]">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 bg-muted/30">
        <div className="flex flex-1 items-center justify-center gap-2 sm:gap-3">
          <button type="button" className="h-10 w-10 inline-flex items-center justify-center rounded-md hover:bg-muted" aria-label="Print" onClick={onToolbarStub}>
            <Printer className="h-5 w-5" />
          </button>
          <button type="button" className="h-10 w-10 inline-flex items-center justify-center rounded-md hover:bg-muted" aria-label="Download" onClick={onToolbarStub}>
            <Download className="h-5 w-5" />
          </button>
          <button type="button" className="h-10 w-10 inline-flex items-center justify-center rounded-md hover:bg-muted" aria-label="PDF" onClick={onToolbarStub}>
            <FileText className="h-5 w-5" />
          </button>
          <button type="button" className="h-10 w-10 inline-flex items-center justify-center rounded-md hover:bg-muted" aria-label="Notify" onClick={onToolbarStub}>
            <Bell className="h-5 w-5" />
          </button>
          <button type="button" className="h-10 w-10 inline-flex items-center justify-center rounded-md hover:bg-muted" aria-label="Payments" onClick={onToolbarStub}>
            <Coins className="h-5 w-5" />
          </button>
        </div>
        <button type="button" className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-md hover:bg-muted" aria-label={t("invoicingPreviewClose")} onClick={onClose}>
          <X className="h-7 w-7" />
        </button>
      </div>
      <p className="text-center text-sm text-muted-foreground py-2 border-b border-border">
        {t("invoicingPreviewMailPrefix")}
        {mailTo}
      </p>

      <div className="overflow-y-auto flex-1 p-4 sm:p-6">
        <div className="mx-auto max-w-[720px] bg-white text-black shadow-sm border border-neutral-200 rounded-sm p-6 sm:p-8 min-h-[480px]">
          <div className="flex flex-wrap justify-between gap-8 border-b border-neutral-200 pb-4 mb-4 items-start">
            {/* Sender: logo + company info (document layout settings) */}
            <div className="flex flex-col gap-2 max-w-[min(100%,320px)]">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt=""
                  className="h-20 w-auto max-w-[220px] object-contain object-left border border-neutral-200 bg-white p-1"
                />
              ) : (
                <div className="h-20 w-28 bg-neutral-900 flex items-center justify-center shrink-0 rounded-sm">
                  <span className="text-[10px] text-white text-center px-1">logo</span>
                </div>
              )}
              <div className="text-xs leading-snug space-y-0.5 text-neutral-900">
                {companyLines.length > 0 ? (
                  companyLines.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))
                ) : (
                  <div className="text-neutral-500">—</div>
                )}
              </div>
            </div>
            {/* Document title + bill-to client */}
            <div className="text-right text-sm flex-1 min-w-[200px]">
              <div className="text-lg font-semibold leading-tight">
                {docKindLabel} {document.displayNumber}
              </div>
              <CustomerUnderInvoice customer={document.customer} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs sm:text-sm mb-6">
            <div>
              <span className="text-neutral-600">{t("invoicingPreviewDate")}: </span>
              <span className="font-medium">{docDate}</span>
            </div>
            <div>
              <span className="text-neutral-600">{t("invoicingPreviewExpiration")}: </span>
              <span className="font-medium">{docDate}</span>
            </div>
            <div>
              <span className="text-neutral-600">{t("invoicingPreviewCustomerNr")}: </span>
              <span className="font-medium">{customerNr}</span>
            </div>
          </div>

          <table className="w-full text-xs sm:text-sm border border-neutral-300 border-collapse mb-6">
            <thead>
              <tr className="bg-neutral-100">
                <th className="border border-neutral-300 p-2 text-left font-medium">{t("invoicingPreviewAmount")}</th>
                <th className="border border-neutral-300 p-2 text-left font-medium">{t("invoicingPreviewDescription")}</th>
                <th className="border border-neutral-300 p-2 text-right font-medium">{t("invoicingPreviewPriceIncl")}</th>
                <th className="border border-neutral-300 p-2 text-right font-medium">{t("invoicingPreviewPriceExcl")}</th>
              </tr>
            </thead>
            <tbody>
              {document.items.map((it, idx) => (
                <tr key={idx}>
                  <td className="border border-neutral-300 p-2 align-top">{it.qty}</td>
                  <td className="border border-neutral-300 p-2 align-top">{it.description}</td>
                  <td className="border border-neutral-300 p-2 text-right font-mono align-top">{it.perPieceIncl.toFixed(2)}</td>
                  <td className="border border-neutral-300 p-2 text-right font-mono align-top">{it.perPieceExcl.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-full max-w-[280px] text-sm space-y-1 border border-neutral-200 rounded p-3">
              <div className="flex justify-between gap-4">
                <span>{t("invoicingPreviewSubtotal")}</span>
                <span className="font-mono">{document.subtotalExcl.toFixed(2)}</span>
              </div>
              {vatRows.map((row) => (
                <div key={row.rate} className="flex justify-between gap-4">
                  <span>
                    {t("btwShort")} {row.rate} %
                  </span>
                  <span className="font-mono">{row.amount.toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between gap-4 font-semibold border-t border-neutral-200 pt-1 mt-1">
                <span>{t("totalEuro")}</span>
                <span className="font-mono">{document.totalIncl.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>{t("alreadyPaid")}</span>
                <span className="font-mono">{document.alreadyPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-4 text-xs pt-1">
                <span>
                  {t("invoicingPreviewPayable")} {docDate}
                </span>
                <span className="font-mono font-medium">{document.dueAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {footerText && <p className="text-xs text-neutral-600 mt-6">{footerText}</p>}
          <p className="text-xs text-neutral-600 mt-4">{t("invoicingPreviewTerms")}</p>
        </div>
      </div>
    </div>
  );
}
