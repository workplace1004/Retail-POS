import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Save, Calendar as CalendarIcon, User, PlusCircle, Download,
  RotateCcw, FileDown, BookOpen, Plus, ArrowDown, ArrowUp, Pencil, Trash2, ArrowLeftRight,
  Bold, Italic, Underline, Strikethrough, Subscript, Superscript,
  Type, Highlighter, Smile, Brush, Wand2, Pilcrow, AlignLeft, ListOrdered,
  List, Indent, Outdent, Quote, Minus, Link as LinkIcon, Image as ImageIcon,
  Video, FileText, Table as TableIcon, Undo2, Redo2, Eraser, MousePointer, Code2, X, Loader2, AlertTriangle,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/api";
import { getCountryName, getSortedCountryCodes } from "@/lib/countries";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { toast } from "@/hooks/use-toast";
import { ExistingCustomersDialog, type ExistingCustomer } from "./ExistingCustomersDialog";
import { AdvanceLoadDialog } from "./AdvanceLoadDialog";
import {
  InvoicingDocumentPreview,
  type InvoicingPreviewLayout,
  type SavedInvoicingDocumentDTO,
} from "./InvoicingDocumentPreview";
import { buildInvoicingPreviewPdfBase64, downloadInvoicingPreviewPdf } from "@/lib/invoicingPreviewPdf";
import type { TranslationKey } from "@/lib/translations";

interface NewDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, loads this saved invoicing document for edit (list → pencil). */
  documentIdToEdit?: string | null;
}

interface LineItem {
  id: number;
  qty: number;
  description: string;
  totalIncl: number;
  perPieceIncl: number;
  perPieceExcl: number;
  discount: number;
  vat: number;
  isVatTicketHeader?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface CustomerOrderTicket {
  id: string;
  displayNumber: number;
  createdAt: string;
  customerName: string;
  totalIncl: number;
  paymentLabel: string;
  items: Array<{
    id: string;
    qty: number;
    description: string;
    perPieceIncl: number;
    perPieceExcl: number;
    totalIncl: number;
    vat: number;
  }>;
}

function getVatTicketKey(ticket: CustomerOrderTicket): string {
  const numberNumeric = Number(ticket.displayNumber);
  if (Number.isFinite(numberNumeric) && numberNumeric > 0) {
    return `number:${numberNumeric}`;
  }
  const id = String(ticket.id || "").trim();
  if (id) return `id:${id}`;
  const createdAt = String(ticket.createdAt || "").trim();
  const total = Number(ticket.totalIncl || 0).toFixed(2);
  return `fallback:${createdAt}|${total}`;
}

function getStableTicketLineBaseId(ticket: CustomerOrderTicket): number {
  const key = getVatTicketKey(ticket);
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) + 1;
}

function invoicingDocKindLabel(kind: string, t: (k: TranslationKey) => string) {
  const map: Record<string, TranslationKey> = {
    invoice: "docKindInvoice",
    "invoice-tickets": "docKindInvoiceFromTickets",
    quotation: "docKindQuotation",
    credit: "docKindCreditNote",
    delivery: "docKindDeliveryNote",
  };
  return t(map[kind] ?? "docKindInvoice");
}

type CatalogProduct = {
  id: string;
  name: string;
  number: number;
  price: number;
  stock: string | number | null;
  stockNotification?: boolean | string | null;
  notificationSoldOutPieces?: string | number | null;
  vatTakeOut?: string | null;
};

type CustomerFormState = {
  companyName: string;
  name: string;
  firstName: string;
  attention: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  vatNumber: string;
  phone: string;
  email: string;
  paymentTerm: string;
  deliveryCompany: string;
  deliveryStreet: string;
  deliveryPostal: string;
  deliveryCity: string;
  deliveryCountry: string;
  notes: string;
  creditTag: string;
  discount: string;
  priceGroup: string;
  email2: string;
  email3: string;
};

function emptyCustomerForm(): CustomerFormState {
  return {
    companyName: "",
    name: "",
    firstName: "",
    attention: "",
    street: "",
    postalCode: "",
    city: "",
    country: "BE",
    vatNumber: "",
    phone: "",
    email: "",
    paymentTerm: "0",
    deliveryCompany: "",
    deliveryStreet: "",
    deliveryPostal: "",
    deliveryCity: "",
    deliveryCountry: "BE",
    notes: "",
    creditTag: "",
    discount: "",
    priceGroup: "off",
    email2: "",
    email3: "",
  };
}

function toNullableTrim(s: string): string | null {
  const x = s.trim();
  return x === "" ? null : x;
}

function layoutSelectLabel(name: string, t: (k: TranslationKey) => string) {
  return name.trim().toLowerCase() === "standard" ? t("docLayoutStandard") : name;
}

function pickLayoutValueForList(current: string, names: string[]): string {
  if (names.includes(current)) return current;
  const caseInsensitive = names.find((n) => n.toLowerCase() === current.toLowerCase());
  if (caseInsensitive) return caseInsensitive;
  const standard = names.find((n) => n.trim().toLowerCase() === "standard");
  if (standard) return standard;
  return names[0] ?? "standard";
}

function documentLineItemsToLocal(doc: SavedInvoicingDocumentDTO): LineItem[] {
  let nid = 1;
  return (Array.isArray(doc.items) ? doc.items : []).map((it) => ({
    // Saved "all-detail" VAT ticket header rows are persisted as zero-value lines.
    // Re-mark them on load so edit mode renders/behaves correctly.
    isVatTicketHeader: (() => {
      const description = String(it.description ?? "").toLowerCase();
      const looksLikeVatTicketHeader = description.includes("vat ticket") || description.includes("btw ticket");
      const isZeroRow =
        (Number(it.totalIncl) || 0) === 0
        && (Number(it.perPieceIncl) || 0) === 0
        && (Number(it.perPieceExcl) || 0) === 0;
      return looksLikeVatTicketHeader && isZeroRow;
    })(),
    id: nid++,
    qty: Number(it.qty) || 0,
    description: String(it.description ?? ""),
    totalIncl: Number(it.totalIncl) || 0,
    perPieceIncl: Number(it.perPieceIncl) || 0,
    perPieceExcl: Number(it.perPieceExcl) || 0,
    discount: Number(it.discount) || 0,
    vat: Number(it.vat) || 0,
  }));
}

function restoreVatTicketsFromSavedItems(items: LineItem[]): CustomerOrderTicket[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  const hasHeaders = items.some((it) => it.isVatTicketHeader);
  if (!hasHeaders) return [];

  const tickets: CustomerOrderTicket[] = [];
  let active: CustomerOrderTicket | null = null;
  let lineCounter = 1;

  for (const it of items) {
    if (it.isVatTicketHeader) {
      if (active) tickets.push(active);
      const headerText = String(it.description ?? "").trim();
      const numberMatch = headerText.match(/(?:vat|btw)\s*ticket\s*(\d+)/i);
      const dateTimeMatch = headerText.match(/(\d{2}):(\d{2})\s+(\d{2})-(\d{2})-(\d{4})/);
      const isoCreatedAt = dateTimeMatch
        ? `${dateTimeMatch[5]}-${dateTimeMatch[4]}-${dateTimeMatch[3]}T${dateTimeMatch[1]}:${dateTimeMatch[2]}:00`
        : new Date().toISOString();

      active = {
        id: `saved-vat-ticket-${tickets.length + 1}`,
        displayNumber: numberMatch ? Number(numberMatch[1]) || tickets.length + 1 : tickets.length + 1,
        createdAt: isoCreatedAt,
        customerName: "",
        totalIncl: 0,
        paymentLabel: "",
        items: [],
      };
      continue;
    }

    if (!active) continue;
    const detail = {
      id: `saved-vat-line-${lineCounter}`,
      qty: Number(it.qty) || 0,
      description: String(it.description ?? ""),
      perPieceIncl: Number(it.perPieceIncl) || 0,
      perPieceExcl: Number(it.perPieceExcl) || 0,
      totalIncl: Number(it.totalIncl) || 0,
      vat: Number(it.vat) || 0,
    };
    lineCounter += 1;
    active.items.push(detail);
    active.totalIncl = Math.round((active.totalIncl + detail.totalIncl) * 100) / 100;
  }

  if (active) tickets.push(active);
  return tickets.filter((tk) => tk.items.length > 0);
}

function isVatTicketLineDescription(value: string): boolean {
  return /(?:vat|btw)\s*ticket/i.test(String(value ?? "").trim());
}

function renumberLineItems(items: LineItem[]): LineItem[] {
  return items.map((it, idx) => ({ ...it, id: idx + 1 }));
}

function derivePerVatRowsFromSavedTicketSource(sourceItems: LineItem[]): LineItem[] {
  if (!Array.isArray(sourceItems) || sourceItems.length === 0) return [];
  const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

  const groups: Array<{ header: LineItem; details: LineItem[] }> = [];
  let active: { header: LineItem; details: LineItem[] } | null = null;

  for (const row of sourceItems) {
    if (isVatTicketLineDescription(row.description)) {
      if (active) groups.push(active);
      active = { header: row, details: [] };
      continue;
    }
    if (active) active.details.push(row);
  }
  if (active) groups.push(active);
  if (groups.length === 0) return renumberLineItems(sourceItems);

  const collapsed = groups.map(({ header, details }, idx) => {
    if (details.length === 0) {
      return {
        ...header,
        id: idx + 1,
        qty: 1,
        discount: 0,
        isVatTicketHeader: false,
      };
    }
    const totalIncl = round2(details.reduce((sum, it) => sum + (Number(it.totalIncl) || 0), 0));
    const totalExcl = round2(details.reduce((sum, it) => {
      const qty = Math.max(1, Number(it.qty) || 1);
      const perExcl = Number(it.perPieceExcl) || 0;
      return sum + (perExcl * qty);
    }, 0));
    const vat = totalExcl > 0 ? round2(((totalIncl / totalExcl) - 1) * 100) : 0;
    return {
      ...header,
      id: idx + 1,
      qty: 1,
      totalIncl,
      perPieceIncl: totalIncl,
      perPieceExcl: totalExcl,
      discount: 0,
      vat,
      isVatTicketHeader: false,
    };
  });

  return collapsed;
}

function customerSnapshotFromDocument(doc: SavedInvoicingDocumentDTO): ExistingCustomer | null {
  const raw = doc.customer;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const c = raw as Record<string, unknown>;
  const id = doc.customerId?.trim();
  const name = String(c.name ?? "").trim() || "-";
  const subName = c.subName != null ? String(c.subName).trim() : "";
  const street = String(c.street ?? "").trim() || "-";
  const postalCity = String(c.postalCity ?? "").trim() || "-";
  const country = c.country != null ? String(c.country).trim() : "";
  const vatNumber = String(c.vatNumber ?? "").trim() || "-";
  const email = c.email != null ? String(c.email).trim() : "";
  return {
    id: id || undefined,
    name,
    subName: subName || undefined,
    street,
    postalCity,
    country: country || undefined,
    vatNumber,
    email: email || undefined,
  };
}

function buildCustomerPayload(form: CustomerFormState): Record<string, string | null> {
  const nameResolved =
    form.name.trim()
    || form.companyName.trim()
    || [form.firstName.trim(), form.attention.trim()].filter(Boolean).join(" ").trim();
  const pg = form.priceGroup.trim();
  return {
    companyName: toNullableTrim(form.companyName),
    firstName: toNullableTrim(form.firstName),
    lastName: toNullableTrim(form.attention),
    name: nameResolved,
    street: toNullableTrim(form.street),
    postalCode: toNullableTrim(form.postalCode),
    city: toNullableTrim(form.city),
    country: (() => {
      const c = (form.country || "BE").trim().toUpperCase();
      return c.length >= 2 ? c.slice(0, 2) : "BE";
    })(),
    phone: toNullableTrim(form.phone),
    email: toNullableTrim(form.email),
    discount: toNullableTrim(form.discount),
    priceGroup: pg === "" || pg === "off" ? null : pg,
    vatNumber: toNullableTrim(form.vatNumber),
    creditTag: toNullableTrim(form.creditTag),
  };
}

export function NewDocumentDialog({ open, onOpenChange, documentIdToEdit = null }: NewDocumentDialogProps) {
  const { t, lang } = useLanguage();
  const editingSavedDocument = useMemo(() => Boolean(documentIdToEdit?.trim()), [documentIdToEdit]);
  const sortedCountryCodes = useMemo(() => getSortedCountryCodes(lang), [lang]);

  const [tab, setTab] = useState<"format" | "attachment">("format");
  const [date, setDate] = useState<Date>(new Date());
  const [kind, setKind] = useState("invoice");
  const [layout, setLayout] = useState("standard");
  const [layoutOptions, setLayoutOptions] = useState<string[]>(["standard"]);
  const [docLang, setDocLang] = useState("nl");
  const [payTerm, setPayTerm] = useState("immediately");
  const [payMethod, setPayMethod] = useState("transfer");
  const [alreadyPaid, setAlreadyPaid] = useState("");
  const [notes, setNotes] = useState("");

  // line entry
  const [qty, setQty] = useState<string>("1");
  const [desc, setDesc] = useState("");
  const [qtyError, setQtyError] = useState(false);
  const [descError, setDescError] = useState(false);
  const [totalIncl, setTotalIncl] = useState("");
  const [perIncl, setPerIncl] = useState("");
  const [perExcl, setPerExcl] = useState("");
  const [discount, setDiscount] = useState("");
  const [vat, setVat] = useState("21");
  const [lastEditedPriceField, setLastEditedPriceField] = useState<"totalIncl" | "perIncl" | "perExcl">("perExcl");
  const [lastEditedRawValue, setLastEditedRawValue] = useState("");
  const [savingItem, setSavingItem] = useState(false);
  const [saveItemError, setSaveItemError] = useState("");
  const [loadItemsError, setLoadItemsError] = useState("");
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingQty, setEditingQty] = useState("");
  const [editingDesc, setEditingDesc] = useState("");
  const [editingTotalIncl, setEditingTotalIncl] = useState("");
  const [editingPerIncl, setEditingPerIncl] = useState("");
  const [editingPerExcl, setEditingPerExcl] = useState("");
  const [editingDiscount, setEditingDiscount] = useState("");
  const [editingVat, setEditingVat] = useState("21");
  const [editingLastEditedPriceField, setEditingLastEditedPriceField] = useState<"totalIncl" | "perIncl" | "perExcl">("perExcl");
  const [editingLastEditedRawValue, setEditingLastEditedRawValue] = useState("");
  const [editingIsNewItem, setEditingIsNewItem] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [resetListConfirmOpen, setResetListConfirmOpen] = useState(false);
  const [items, setItems] = useState<LineItem[]>([]);
  const [documentPhase, setDocumentPhase] = useState<"form" | "preview">("form");
  const [savedDocument, setSavedDocument] = useState<SavedInvoicingDocumentDTO | null>(null);
  const [previewLayout, setPreviewLayout] = useState<InvoicingPreviewLayout | null>(null);
  const [savingDocument, setSavingDocument] = useState(false);
  const [sendInvoiceLoading, setSendInvoiceLoading] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentReceivedStr, setPaymentReceivedStr] = useState("0.00");
  const [paymentSaving, setPaymentSaving] = useState(false);

  // attachment editor
  const [attachmentPos, setAttachmentPos] = useState("above");
  const [attachmentText, setAttachmentText] = useState("");

  // customer
  const [customersOpen, setCustomersOpen] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newCustomerTab, setNewCustomerTab] = useState<"general" | "advanced">("general");
  const [newCustomerSaving, setNewCustomerSaving] = useState(false);
  const [newCustomerError, setNewCustomerError] = useState("");
  const [customerForm, setCustomerForm] = useState<CustomerFormState>(() => emptyCustomerForm());
  const [selectedCustomer, setSelectedCustomer] = useState<ExistingCustomer | null>(null);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [editCustomerOpen, setEditCustomerOpen] = useState(false);
  const [editCustomerTab, setEditCustomerTab] = useState<"general" | "advanced">("general");
  const [editCustomerSaving, setEditCustomerSaving] = useState(false);
  const [editCustomerError, setEditCustomerError] = useState("");
  const [editCustomerForm, setEditCustomerForm] = useState<CustomerFormState>(() => emptyCustomerForm());
  const [productsOpen, setProductsOpen] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState("");
  const [productsSearch, setProductsSearch] = useState("");
  const [productsVatFilter, setProductsVatFilter] = useState("original");
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [lowStockWarning, setLowStockWarning] = useState<{ name: string; stock: number; threshold: number } | null>(null);
  const [vatTicketLoadMode, setVatTicketLoadMode] = useState<"per-vat" | "all-detail">("per-vat");
  const isInvoiceFromTickets = kind === "invoice-tickets";
  const [loadedVatTickets, setLoadedVatTickets] = useState<CustomerOrderTicket[]>([]);
  const [savedVatTicketSourceItems, setSavedVatTicketSourceItems] = useState<LineItem[] | null>(null);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [ticketDialogLoading, setTicketDialogLoading] = useState(false);
  const [ticketDialogError, setTicketDialogError] = useState("");
  const [ticketDialogQuery, setTicketDialogQuery] = useState("");
  const [customerTickets, setCustomerTickets] = useState<CustomerOrderTicket[]>([]);

  const totals = useMemo(() => {
    const totalInclSum = items.reduce((s, it) => s + it.totalIncl, 0);
    const totalExclSum = items.reduce((s, it) => s + it.perPieceExcl * it.qty, 0);
    const vatSum = totalInclSum - totalExclSum;
    const paid = parseFloat(alreadyPaid || "0") || 0;
    return {
      mvh: totalExclSum,
      vat: vatSum,
      total: totalInclSum,
      paid,
      due: totalInclSum - paid,
    };
  }, [items, alreadyPaid]);

  const handleMainDialogOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setDocumentPhase("form");
        setSavedDocument(null);
        setPreviewLayout(null);
      }
      onOpenChange(next);
    },
    [onOpenChange],
  );

  const parseVatRate = (value: string | null | undefined) => {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    const match = raw.match(/\d+(?:[.,]\d+)?/);
    if (!match) return null;
    const parsed = Number(match[0].replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  };

  const parseStockQty = (value: string | number | null | undefined) => {
    if (value == null || value === "") return 0;
    const parsed = Number(String(value).trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const bootstrap = async () => {
      setLoadItemsError("");
      setDocumentPhase("form");
      setSavedDocument(null);
      setPreviewLayout(null);

      let names: string[] = ["standard"];
      try {
        const lr = await apiRequest<{ value: string[] }>("/api/settings/invoicing-layouts");
        const raw = Array.isArray(lr?.value) ? lr.value : [];
        const parsed = raw.map((s) => String(s ?? "").trim()).filter(Boolean);
        names = parsed.length > 0 ? parsed : ["standard"];
      } catch {
        names = ["standard"];
      }
      if (cancelled) return;
      setLayoutOptions(names);

      const editId = documentIdToEdit?.trim() || "";
      if (editId) {
        try {
          const res = await apiRequest<{ document: SavedInvoicingDocumentDTO }>(
            `/api/webpanel/invoicing/documents/${encodeURIComponent(editId)}`
          );
          if (cancelled || !res?.document) return;
          const d = res.document;
          setTab("format");
          setKind(String(d.kind || "invoice"));
          setLayout(pickLayoutValueForList(String(d.layout || "standard"), names));
          setDocLang(String(d.docLang || "nl"));
          setPayTerm(String(d.paymentTerm || "immediately"));
          setPayMethod(String(d.paymentMethod || "transfer"));
          try {
            const dd = parseISO(d.documentDate);
            if (Number.isFinite(dd.getTime())) setDate(dd);
          } catch {
            /* ignore */
          }
          setAlreadyPaid((Number(d.alreadyPaid) || 0).toFixed(2));
          setNotes(String(d.notes ?? ""));
          setAttachmentPos(String(d.attachmentPos || "above"));
          setAttachmentText(String(d.attachmentText ?? ""));
          const localItems = documentLineItemsToLocal(d);
          setItems(localItems);
          if (String(d.kind || "").trim().toLowerCase() === "invoice-tickets") {
            const restoredTickets = restoreVatTicketsFromSavedItems(localItems);
            setLoadedVatTickets(restoredTickets);
            setSavedVatTicketSourceItems(localItems);
            setVatTicketLoadMode(localItems.some((it) => it.isVatTicketHeader) ? "all-detail" : "per-vat");
          } else {
            setVatTicketLoadMode("per-vat");
            setLoadedVatTickets([]);
            setSavedVatTicketSourceItems(null);
          }
          setSelectedCustomer(customerSnapshotFromDocument(d));
          setEditingItemId(null);
          setEditingIsNewItem(false);
        } catch {
          if (!cancelled) {
            setLoadItemsError(t("invoicingDocumentLoadFailed"));
            setItems([]);
            setLoadedVatTickets([]);
            setSavedVatTicketSourceItems(null);
            setSelectedCustomer(null);
          }
        }
      } else {
        setLayout((prev) => pickLayoutValueForList(prev, names));
        setVatTicketLoadMode("per-vat");
        setSavedVatTicketSourceItems(null);
        try {
          const response = await apiRequest<{ items: LineItem[] }>("/api/webpanel/invoicing/line-items");
          if (!cancelled) {
            setItems(Array.isArray(response?.items) ? response.items : []);
            setLoadedVatTickets([]);
            setSavedVatTicketSourceItems(null);
          }
        } catch {
          if (!cancelled) {
            setLoadItemsError(t("invoicingLineItemsLoadFailed"));
          }
        }
      }
    };
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [open, documentIdToEdit, t]);

  useEffect(() => {
    if (documentPhase !== "preview" || !savedDocument) return;
    let cancelled = false;
    const loadLayout = async () => {
      const requested = String(savedDocument.layout ?? "").trim();
      const match = layoutOptions.find((n) => n.trim().toLowerCase() === requested.toLowerCase());
      const layoutKey = (match || requested || "standard").trim() || "standard";
      try {
        const r = await apiRequest<{
          value?: { companyInfoLines?: string[]; footerText?: string; logoDataUrl?: string };
        }>(`/api/settings/invoicing-document-layout/${encodeURIComponent(layoutKey)}`);
        const val = r?.value;
        if (cancelled || !val) return;
        const lines = Array.isArray(val.companyInfoLines) ? val.companyInfoLines.map((x) => String(x ?? "")) : [];
        setPreviewLayout({
          companyInfoLines: Array.from({ length: 6 }).map((_, i) => lines[i] ?? ""),
          footerText: String(val.footerText ?? ""),
          logoDataUrl: String(val.logoDataUrl ?? ""),
        });
      } catch {
        if (!cancelled) setPreviewLayout(null);
      }
    };
    void loadLayout();
    return () => {
      cancelled = true;
    };
  }, [documentPhase, savedDocument, layoutOptions]);

  useEffect(() => {
    if (!productsOpen) return;
    let cancelled = false;
    const loadProducts = async () => {
      setProductsLoading(true);
      setProductsError("");
      try {
        const rows = await apiRequest<Array<Record<string, unknown>>>("/api/products/catalog");
        if (cancelled) return;
        const mapped = (Array.isArray(rows) ? rows : []).map((row) => ({
          id: String(row.id ?? ""),
          name: String(row.name ?? ""),
          number: Number(row.number) || 0,
          price: Number(row.price) || 0,
          stock: (row.stock as string | number | null | undefined) ?? null,
          stockNotification: (row.stockNotification as boolean | string | null | undefined) ?? null,
          notificationSoldOutPieces: (row.notificationSoldOutPieces as string | number | null | undefined) ?? null,
          vatTakeOut: row.vatTakeOut == null ? null : String(row.vatTakeOut),
        })).filter((p) => p.id && p.name);
        setProducts(mapped);
      } catch {
        if (!cancelled) {
          setProducts([]);
          setProductsError("Failed to load products.");
        }
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    };
    void loadProducts();
    return () => {
      cancelled = true;
    };
  }, [productsOpen]);

  useEffect(() => {
    if (kind === "invoice-tickets") return;
    setItems([]);
    setLoadedVatTickets([]);
    setSavedVatTicketSourceItems(null);
    setEditingItemId(null);
    setEditingIsNewItem(false);
    setSaveItemError("");
  }, [kind]);

  const visibleProducts = useMemo(() => {
    const q = productsSearch.trim().toLowerCase();
    return products.filter((p) => {
      const matchesSearch = !q
        || p.name.toLowerCase().includes(q)
        || String(p.number).includes(q);
      if (!matchesSearch) return false;
      if (productsVatFilter === "original") return true;
      const vatRate = parseVatRate(p.vatTakeOut);
      if (vatRate == null) return false;
      return Math.abs(vatRate - Number(productsVatFilter)) < 0.001;
    });
  }, [products, productsSearch, productsVatFilter]);

  const filteredCustomerTickets = useMemo(() => {
    const q = ticketDialogQuery.trim().toLowerCase();
    if (!q) return customerTickets;
    return customerTickets.filter((tk) =>
      [
        String(tk.displayNumber),
        format(parseISO(tk.createdAt), "dd-MM-yyyy HH:mm:ss"),
        tk.customerName,
        (Number(tk.totalIncl) || 0).toFixed(2),
        tk.paymentLabel,
      ].some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [customerTickets, ticketDialogQuery]);

  const loadedVatTicketIds = useMemo(
    () => new Set(loadedVatTickets.map((tk) => getVatTicketKey(tk))),
    [loadedVatTickets],
  );

  const selectableCustomerTickets = useMemo(
    () => filteredCustomerTickets.filter((tk) => !loadedVatTicketIds.has(getVatTicketKey(tk))),
    [filteredCustomerTickets, loadedVatTicketIds],
  );

  const toNumber = (value: string) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const parseMoneyInput = (value: string): number => {
    const normalized = String(value ?? "").trim().replace(",", ".");
    if (!normalized) return Number.NaN;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : Number.NaN;
  };

  const formatMoney = (value: number) => {
    const rounded = Math.round(value * 100) / 100;
    return Number.isFinite(rounded) ? `${rounded}` : "";
  };

  const recalculatePriceFields = (
    source: "totalIncl" | "perIncl" | "perExcl",
    sourceValue: string,
    overrides?: { qty?: string; vat?: string; discount?: string },
  ) => {
    const nextQty = toNumber(overrides?.qty ?? qty);
    const nextVat = toNumber(overrides?.vat ?? vat);
    const nextDiscount = Math.min(Math.max(toNumber(overrides?.discount ?? discount), 0), 100);

    const vatFactor = 1 + nextVat / 100;
    const discountFactor = 1 - nextDiscount / 100;
    const typedValue = toNumber(sourceValue);

    let computedPerExcl = 0;
    let computedPerIncl = 0;
    let computedTotalIncl = 0;

    if (source === "totalIncl") {
      if (nextQty > 0) {
        const perInclRaw = typedValue / nextQty;
        const perExclRaw = vatFactor > 0 ? perInclRaw / vatFactor : 0;
        computedPerExcl = perExclRaw * discountFactor;
        computedPerIncl = computedPerExcl * vatFactor;
        computedTotalIncl = computedPerIncl * nextQty;
      } else {
        computedTotalIncl = typedValue;
      }
    }

    if (source === "perIncl") {
      const perExclRaw = vatFactor > 0 ? typedValue / vatFactor : 0;
      computedPerExcl = perExclRaw * discountFactor;
      computedPerIncl = computedPerExcl * vatFactor;
      computedTotalIncl = computedPerIncl * nextQty;
    }

    if (source === "perExcl") {
      computedPerExcl = typedValue * discountFactor;
      computedPerIncl = computedPerExcl * vatFactor;
      computedTotalIncl = computedPerIncl * nextQty;
    }

    setPerExcl(formatMoney(computedPerExcl));
    setPerIncl(formatMoney(computedPerIncl));
    setTotalIncl(formatMoney(computedTotalIncl));
  };

  const handleTotalInclChange = (value: string) => {
    setLastEditedPriceField("totalIncl");
    setLastEditedRawValue(value);
    setDiscount("");
    recalculatePriceFields("totalIncl", value, { discount: "0" });
  };

  const handlePerInclChange = (value: string) => {
    setLastEditedPriceField("perIncl");
    setLastEditedRawValue(value);
    setDiscount("");
    recalculatePriceFields("perIncl", value, { discount: "0" });
  };

  const handlePerExclChange = (value: string) => {
    setLastEditedPriceField("perExcl");
    setLastEditedRawValue(value);
    setDiscount("");
    recalculatePriceFields("perExcl", value, { discount: "0" });
  };

  const handleQtyChange = (value: string) => {
    setQty(value);
    const nextQty = parseFloat(value) || 0;
    setQtyError(nextQty <= 0);
    const unitIncl = parseFloat(perIncl) || 0;
    recalculatePriceFields("perIncl", `${unitIncl}`, { qty: value });
  };

  const handleDiscountChange = (value: string) => {
    setDiscount(value);
    const sourceValue = lastEditedRawValue || (lastEditedPriceField === "totalIncl"
      ? totalIncl
      : lastEditedPriceField === "perIncl"
        ? perIncl
        : perExcl);
    recalculatePriceFields(lastEditedPriceField, sourceValue, { discount: value });
  };

  const handleVatChange = (value: string) => {
    setVat(value);
    const sourceValue = lastEditedRawValue || (lastEditedPriceField === "totalIncl"
      ? totalIncl
      : lastEditedPriceField === "perIncl"
        ? perIncl
        : perExcl);
    recalculatePriceFields(lastEditedPriceField, sourceValue, { vat: value });
  };

  const addItem = async () => {
    const q = parseFloat(qty) || 0;
    const hasValidQty = q > 0;
    const hasDescription = desc.trim().length > 0;

    setQtyError(!hasValidQty);
    setDescError(!hasDescription);
    if (!hasValidQty || !hasDescription) return;

    const ti = parseFloat(totalIncl) || 0;
    const pi = parseFloat(perIncl) || (q > 0 ? ti / q : 0);
    const pe = parseFloat(perExcl) || pi / (1 + parseFloat(vat) / 100);
    const newItem: LineItem = {
      id: Date.now(),
      qty: q,
      description: desc,
      totalIncl: ti || pi * q,
      perPieceIncl: pi,
      perPieceExcl: pe,
      discount: parseFloat(discount) || 0,
      vat: parseFloat(vat) || 0,
    };
    setSavingItem(true);
    setSaveItemError("");
    try {
      if (editingSavedDocument) {
        setItems((prev) => [...prev, newItem]);
      } else {
        const saved = await apiRequest<LineItem>("/api/webpanel/invoicing/line-items", {
          method: "POST",
          body: JSON.stringify(newItem),
        });
        setItems((prev) => [...prev, saved]);
      }
    } catch {
      setSaveItemError("Failed to save line item to database.");
      return;
    } finally {
      setSavingItem(false);
    }

    setQty("1");
    setDesc("");
    setQtyError(false);
    setDescError(false);
    setTotalIncl("");
    setPerIncl("");
    setPerExcl("");
    setDiscount("");
    setLastEditedRawValue("");
  };

  const moveItem = (id: number, dir: -1 | 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  const deleteItem = async (id: number) => {
    setSavingItem(true);
    setSaveItemError("");
    try {
      if (!editingSavedDocument) {
        await apiRequest<void>(`/api/webpanel/invoicing/line-items/${id}`, {
          method: "DELETE",
        });
      }
      setItems((prev) => prev.filter((i) => i.id !== id));
      if (editingItemId === id) setEditingItemId(null);
    } catch {
      setSaveItemError("Failed to delete line item.");
    } finally {
      setSavingItem(false);
      setDeleteTargetId(null);
    }
  };

  const resetList = async () => {
    setSavingItem(true);
    setSaveItemError("");
    try {
      if (!editingSavedDocument) {
        await apiRequest<void>("/api/webpanel/invoicing/line-items", {
          method: "DELETE",
        });
      }
      setItems([]);
      setLoadedVatTickets([]);
      setSavedVatTicketSourceItems(null);
      setEditingItemId(null);
    } catch {
      setSaveItemError("Failed to reset list.");
    } finally {
      setSavingItem(false);
    }
  };

  const startEditingItem = (item: LineItem, isNew = false) => {
    setEditingIsNewItem(isNew);
    setEditingItemId(item.id);
    setEditingQty(String(item.qty));
    setEditingDesc(item.description);
    setEditingTotalIncl(formatMoney(item.totalIncl));
    setEditingPerIncl(formatMoney(item.perPieceIncl));
    setEditingPerExcl(formatMoney(item.perPieceExcl));
    setEditingDiscount(formatMoney(item.discount));
    setEditingVat(String(item.vat));
    setEditingLastEditedPriceField("perExcl");
    setEditingLastEditedRawValue(formatMoney(item.perPieceExcl));
    setSaveItemError("");
  };

  const recalculateEditingPriceFields = (
    source: "totalIncl" | "perIncl" | "perExcl",
    sourceValue: string,
    overrides?: { qty?: string; vat?: string; discount?: string },
  ) => {
    const nextQty = toNumber(overrides?.qty ?? editingQty);
    const nextVat = toNumber(overrides?.vat ?? editingVat);
    const nextDiscount = Math.min(Math.max(toNumber(overrides?.discount ?? editingDiscount), 0), 100);
    const vatFactor = 1 + nextVat / 100;
    const discountFactor = 1 - nextDiscount / 100;
    const typedValue = toNumber(sourceValue);

    let computedPerExcl = 0;
    let computedPerIncl = 0;
    let computedTotalIncl = 0;

    if (source === "totalIncl") {
      if (nextQty > 0) {
        const perInclRaw = typedValue / nextQty;
        const perExclRaw = vatFactor > 0 ? perInclRaw / vatFactor : 0;
        computedPerExcl = perExclRaw * discountFactor;
        computedPerIncl = computedPerExcl * vatFactor;
        computedTotalIncl = computedPerIncl * nextQty;
      } else {
        computedTotalIncl = typedValue;
      }
    }

    if (source === "perIncl") {
      const perExclRaw = vatFactor > 0 ? typedValue / vatFactor : 0;
      computedPerExcl = perExclRaw * discountFactor;
      computedPerIncl = computedPerExcl * vatFactor;
      computedTotalIncl = computedPerIncl * nextQty;
    }

    if (source === "perExcl") {
      computedPerExcl = typedValue * discountFactor;
      computedPerIncl = computedPerExcl * vatFactor;
      computedTotalIncl = computedPerIncl * nextQty;
    }

    setEditingPerExcl(formatMoney(computedPerExcl));
    setEditingPerIncl(formatMoney(computedPerIncl));
    setEditingTotalIncl(formatMoney(computedTotalIncl));
  };

  const handleEditingTotalInclChange = (value: string) => {
    setEditingLastEditedPriceField("totalIncl");
    setEditingLastEditedRawValue(value);
    setEditingDiscount("");
    recalculateEditingPriceFields("totalIncl", value, { discount: "0" });
  };

  const handleEditingPerInclChange = (value: string) => {
    setEditingLastEditedPriceField("perIncl");
    setEditingLastEditedRawValue(value);
    setEditingDiscount("");
    recalculateEditingPriceFields("perIncl", value, { discount: "0" });
  };

  const handleEditingPerExclChange = (value: string) => {
    setEditingLastEditedPriceField("perExcl");
    setEditingLastEditedRawValue(value);
    setEditingDiscount("");
    recalculateEditingPriceFields("perExcl", value, { discount: "0" });
  };

  const handleEditingQtyChange = (value: string) => {
    setEditingQty(value);
    const unitIncl = toNumber(editingPerIncl);
    recalculateEditingPriceFields("perIncl", `${unitIncl}`, { qty: value });
  };

  const handleEditingDiscountChange = (value: string) => {
    setEditingDiscount(value);
    const sourceValue = editingLastEditedRawValue || (
      editingLastEditedPriceField === "totalIncl"
        ? editingTotalIncl
        : editingLastEditedPriceField === "perIncl"
          ? editingPerIncl
          : editingPerExcl
    );
    recalculateEditingPriceFields(editingLastEditedPriceField, sourceValue, { discount: value });
  };

  const handleEditingVatChange = (value: string) => {
    setEditingVat(value);
    const sourceValue = editingLastEditedRawValue || (
      editingLastEditedPriceField === "totalIncl"
        ? editingTotalIncl
        : editingLastEditedPriceField === "perIncl"
          ? editingPerIncl
          : editingPerExcl
    );
    recalculateEditingPriceFields(editingLastEditedPriceField, sourceValue, { vat: value });
  };

  const saveEditingItem = async () => {
    if (editingItemId == null) return;
    const q = parseFloat(editingQty) || 0;
    const description = editingDesc.trim();
    if (q <= 0 || !description) {
      setSaveItemError("Quantity and description are required.");
      return;
    }

    const payload: LineItem = {
      id: editingItemId,
      qty: q,
      description,
      totalIncl: parseFloat(editingTotalIncl) || 0,
      perPieceIncl: parseFloat(editingPerIncl) || 0,
      perPieceExcl: parseFloat(editingPerExcl) || 0,
      discount: parseFloat(editingDiscount) || 0,
      vat: parseFloat(editingVat) || 0,
    };

    setSavingItem(true);
    setSaveItemError("");
    try {
      if (editingSavedDocument) {
        const { id: _lid, createdAt: _c, updatedAt: _u, ...rest } = payload;
        setItems((prev) =>
          prev.map((it) => (it.id === editingItemId ? { ...it, ...rest, id: it.id } : it)),
        );
      } else if (editingIsNewItem) {
        const created = await apiRequest<LineItem>("/api/webpanel/invoicing/line-items", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setItems((prev) => prev.map((it) => (it.id === editingItemId ? created : it)));
      } else {
        const updated = await apiRequest<LineItem>(`/api/webpanel/invoicing/line-items/${editingItemId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setItems((prev) => prev.map((it) => (it.id === editingItemId ? updated : it)));
      }
      setEditingItemId(null);
      setEditingIsNewItem(false);
    } catch {
      setSaveItemError(editingIsNewItem ? "Failed to save line item." : "Failed to update line item.");
    } finally {
      setSavingItem(false);
    }
  };

  const handleSave = async () => {
    if (!selectedCustomer) {
      toast({
        variant: "destructive",
        description: t("selectCustomerRequired"),
      });
      return;
    }
    if (items.length === 0) {
      toast({
        variant: "destructive",
        description: t("invoicingDocumentNoLines"),
      });
      return;
    }
    const docDate = new Date(date);
    docDate.setHours(12, 0, 0, 0);
    const linePayload = items.map(({ id: _id, createdAt: _c, updatedAt: _u, ...rest }) => rest);
    const body = {
      kind,
      layout,
      docLang,
      paymentTerm: payTerm,
      paymentMethod: payMethod,
      documentDate: docDate.toISOString(),
      alreadyPaid: totals.paid,
      notes,
      attachmentPos,
      attachmentText,
      customerId: selectedCustomer.id?.trim() || null,
      customerJson: selectedCustomer,
      items: linePayload,
      subtotalExcl: totals.mvh,
      vatTotal: totals.vat,
      totalIncl: totals.total,
      dueAmount: totals.due,
    };
    const editId = documentIdToEdit?.trim();
    setSavingDocument(true);
    try {
      const res = await apiRequest<{ document: SavedInvoicingDocumentDTO }>(
        editId ? `/api/webpanel/invoicing/documents/${encodeURIComponent(editId)}` : "/api/webpanel/invoicing/documents",
        { method: editId ? "PATCH" : "POST", body: JSON.stringify(body) },
      );
      if (res?.document) {
        if (!editId) {
          // New-document flow uses temporary line-items storage; clear it after successful save.
          try {
            await apiRequest<void>("/api/webpanel/invoicing/line-items", { method: "DELETE" });
          } catch {
            // Keep save successful even if temp cleanup fails.
          }
          setItems([]);
          setLoadedVatTickets([]);
          setSavedVatTicketSourceItems(null);
          setEditingItemId(null);
          setEditingIsNewItem(false);
        }
        setSavedDocument(res.document);
        setDocumentPhase("preview");
        toast({ description: editId ? t("invoicingDocumentUpdated") : t("invoicingDocumentSaved") });
      }
    } catch {
      toast({
        variant: "destructive",
        description: t("invoicingDocumentSaveFailed"),
      });
    } finally {
      setSavingDocument(false);
    }
  };

  const handlePreviewPrint = useCallback(() => {
    const body = document.body;
    const className = "print-invoicing-preview-only";
    const cleanup = () => body.classList.remove(className);
    body.classList.add(className);
    const onAfterPrint = () => {
      cleanup();
      window.removeEventListener("afterprint", onAfterPrint);
    };
    window.addEventListener("afterprint", onAfterPrint);
    window.requestAnimationFrame(() => {
      window.print();
      window.setTimeout(() => {
        cleanup();
        window.removeEventListener("afterprint", onAfterPrint);
      }, 1000);
    });
  }, []);

  const handlePreviewDownloadPdf = useCallback(async () => {
    if (!savedDocument) return;
    try {
      await downloadInvoicingPreviewPdf(`invoice-${savedDocument.displayNumber || savedDocument.id}`);
      toast({ description: t("reportPdfDownloaded") });
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : t("reportPdfFailed"),
      });
    }
  }, [savedDocument, t]);

  const handlePreviewPayments = useCallback(() => {
    if (!savedDocument) return;
    const due = Math.max(0, Number(savedDocument.dueAmount) || 0);
    const total = Math.max(0, Number(savedDocument.totalIncl) || 0);
    const alreadyPaid = Math.max(0, Number(savedDocument.alreadyPaid) || 0);
    const remainingFromTotal = Math.max(0, total - alreadyPaid);
    const target =
      due > 0.0005
        ? due
        : remainingFromTotal > 0.0005
          ? remainingFromTotal
          : total;
    setPaymentReceivedStr(target.toFixed(2));
    setPaymentModalOpen(true);
  }, [savedDocument]);

  const handlePreviewSavePayment = useCallback(async () => {
    if (!savedDocument) return;
    const received = parseMoneyInput(paymentReceivedStr);
    if (Number.isNaN(received)) {
      toast({ variant: "destructive", description: t("invoicingPaymentInvalidAmount") });
      return;
    }
    const total = Math.max(0, Number(savedDocument.totalIncl) || 0);
    if (received > total + 0.0005) {
      toast({ variant: "destructive", description: t("invoicingPaymentExceedsTotal") });
      return;
    }
    setPaymentSaving(true);
    try {
      await apiRequest(`/api/webpanel/invoicing/documents/${encodeURIComponent(savedDocument.id)}/payment`, {
        method: "PATCH",
        body: JSON.stringify({ received }),
      });
      const refreshed = await apiRequest<{ document?: SavedInvoicingDocumentDTO }>(
        `/api/webpanel/invoicing/documents/${encodeURIComponent(savedDocument.id)}`
      );
      if (refreshed?.document) setSavedDocument(refreshed.document);
      toast({ description: t("invoicingPaymentSaved") });
      setPaymentModalOpen(false);
    } catch {
      toast({ variant: "destructive", description: t("invoicingPaymentSaveFailed") });
    } finally {
      setPaymentSaving(false);
    }
  }, [savedDocument, paymentReceivedStr, t]);

  const handlePreviewSend = useCallback(async () => {
    if (!savedDocument) return;
    setSendInvoiceLoading(true);
    try {
      const pdfBase64 = await buildInvoicingPreviewPdfBase64(1.1);
      const fileName = `invoice-${savedDocument.displayNumber || savedDocument.id}.pdf`;
      await apiRequest<{ ok?: boolean; to?: string; messageId?: string | null }>(
        `/api/webpanel/invoicing/documents/${encodeURIComponent(savedDocument.id)}/send`,
        {
          method: "POST",
          body: JSON.stringify({ pdfBase64, fileName }),
        },
      );
      toast({ description: "Invoice email sent." });
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Failed to send invoice email.",
      });
    } finally {
      setSendInvoiceLoading(false);
    }
  }, [savedDocument]);

  const resetNewCustomerForm = () => {
    setCustomerForm(emptyCustomerForm());
    setNewCustomerTab("general");
    setNewCustomerError("");
  };

  const handleCreateCustomer = async () => {
    const payload = buildCustomerPayload(customerForm);
    if (!String(payload.name || "").trim()) {
      setNewCustomerError("Name or company is required.");
      return;
    }
    setNewCustomerSaving(true);
    setNewCustomerError("");
    try {
      const created = await apiRequest<Record<string, unknown>>("/api/customers", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const street = String(created.street ?? "").trim();
      const postalCode = String(created.postalCode ?? "").trim();
      const city = String(created.city ?? "").trim();
      const company = String(created.companyName ?? "").trim();
      const customerName = String(created.name ?? "").trim();
      const displayName = company || customerName;
      const createdEmail = String(created.email ?? "").trim();
      setSelectedCustomer({
        id: String(created.id ?? "").trim() || undefined,
        name: displayName || "-",
        subName: displayName && customerName && displayName !== customerName ? customerName : undefined,
        street: street || "-",
        postalCity: [postalCode, city].filter(Boolean).join(" ").trim() || "-",
        country: String(created.country ?? "").trim() || undefined,
        vatNumber: String(created.vatNumber ?? "").trim() || "-",
        email: createdEmail || undefined,
      });
      setNewCustomerOpen(false);
      resetNewCustomerForm();
    } catch {
      setNewCustomerError("Failed to create customer.");
    } finally {
      setNewCustomerSaving(false);
    }
  };

  const applyProductToLine = (product: CatalogProduct) => {
    const stockNotificationEnabled = product.stockNotification !== false && String(product.stockNotification ?? "").toLowerCase() !== "false";
    const thresholdRaw = String(product.notificationSoldOutPieces ?? "").trim();
    const thresholdNum = Number(thresholdRaw.replace(",", "."));
    const threshold = Number.isFinite(thresholdNum) ? thresholdNum : null;
    const stock = parseStockQty(product.stock);
    if (stockNotificationEnabled && threshold != null && stock <= threshold) {
      setLowStockWarning({ name: product.name, stock, threshold });
    }
    const originalVat = parseVatRate(product.vatTakeOut);
    const nextVat = productsVatFilter === "original"
      ? (originalVat ?? 21)
      : (parseFloat(productsVatFilter) || 21);
    const price = Number(product.price) || 0;
    const tempId = Date.now();
    const vatFactor = 1 + nextVat / 100;
    const perExcl = vatFactor > 0 ? price / vatFactor : price;
    const draft: LineItem = {
      id: tempId,
      qty: 1,
      description: product.name,
      totalIncl: price,
      perPieceIncl: price,
      perPieceExcl: perExcl,
      discount: 0,
      vat: nextVat,
    };
    setItems((prev) => [...prev, draft]);
    startEditingItem(draft, true);
    setProductsOpen(false);
  };

  const openEditCustomerModal = useCallback(async () => {
    if (!selectedCustomer?.id) {
      toast({ variant: "destructive", description: t("selectCustomerRequired") });
      return;
    }
    try {
      const row = await apiRequest<Record<string, unknown>>(
        `/api/customers/${encodeURIComponent(String(selectedCustomer.id))}`,
      );
      const companyName = String(row.companyName ?? "").trim();
      const firstName = String(row.firstName ?? "").trim();
      const lastName = String(row.lastName ?? "").trim();
      const fallbackName = String(row.name ?? "").trim();
      setEditCustomerForm({
        companyName,
        name: fallbackName || companyName || [firstName, lastName].filter(Boolean).join(" ").trim(),
        firstName,
        attention: lastName,
        street: String(row.street ?? "").trim(),
        postalCode: String(row.postalCode ?? "").trim(),
        city: String(row.city ?? "").trim(),
        country: String(row.country ?? "BE").trim() || "BE",
        vatNumber: String(row.vatNumber ?? "").trim(),
        phone: String(row.phone ?? "").trim(),
        email: String(row.email ?? "").trim(),
        paymentTerm: "0",
        deliveryCompany: "",
        deliveryStreet: "",
        deliveryPostal: "",
        deliveryCity: "",
        deliveryCountry: String(row.country ?? "BE").trim() || "BE",
        notes: "",
        creditTag: String(row.creditTag ?? "").trim(),
        discount: String(row.discount ?? "").trim(),
        priceGroup: String(row.priceGroup ?? "").trim() || "off",
        email2: "",
        email3: "",
      });
      setEditCustomerTab("general");
      setEditCustomerError("");
      setEditCustomerOpen(true);
    } catch {
      setEditCustomerError(t("saveFailedGeneric"));
      toast({ variant: "destructive", description: t("saveFailedGeneric") });
    }
  }, [selectedCustomer, t]);

  const saveEditedCustomer = useCallback(async () => {
    const customerId = String(selectedCustomer?.id || "").trim();
    if (!customerId) return;
    const payload = buildCustomerPayload(editCustomerForm);
    if (!String(payload.name || "").trim()) {
      setEditCustomerError(t("saveFailedGeneric"));
      toast({ variant: "destructive", description: t("saveFailedGeneric") });
      return;
    }
    setEditCustomerSaving(true);
    setEditCustomerError("");
    try {
      const updated = await apiRequest<Record<string, unknown>>(
        `/api/customers/${encodeURIComponent(customerId)}`,
        { method: "PATCH", body: JSON.stringify(payload) },
      );
      const companyName = String(updated.companyName ?? "").trim();
      const firstName = String(updated.firstName ?? "").trim();
      const lastName = String(updated.lastName ?? "").trim();
      const customerName = String(updated.name ?? "").trim();
      const displayName = companyName || customerName || [firstName, lastName].filter(Boolean).join(" ").trim();
      const street = String(updated.street ?? "").trim() || "-";
      const postalCode = String(updated.postalCode ?? "").trim();
      const city = String(updated.city ?? "").trim();
      const vatNumber = String(updated.vatNumber ?? "").trim() || "-";
      const email = String(updated.email ?? "").trim();
      setSelectedCustomer({
        id: customerId,
        name: displayName || "-",
        subName: displayName && customerName && displayName !== customerName ? customerName : undefined,
        street,
        postalCity: [postalCode, city].filter(Boolean).join(" ").trim() || "-",
        country: String(updated.country ?? "").trim() || undefined,
        vatNumber,
        email: email || undefined,
      });
      setEditCustomerOpen(false);
      toast({ description: "Customer saved." });
    } catch {
      setEditCustomerError(t("saveFailedGeneric"));
      toast({ variant: "destructive", description: t("saveFailedGeneric") });
    } finally {
      setEditCustomerSaving(false);
    }
  }, [editCustomerForm, selectedCustomer?.id, t]);

  const openTicketDialog = useCallback(async () => {
    const customerId = String(selectedCustomer?.id || "").trim();
    if (!customerId) {
      toast({ variant: "destructive", description: t("selectCustomerRequired") });
      return;
    }
    setTicketDialogOpen(true);
    setTicketDialogLoading(true);
    setTicketDialogError("");
    setTicketDialogQuery("");
    try {
      const res = await apiRequest<{ tickets?: CustomerOrderTicket[] }>(
        `/api/webpanel/invoicing/customer-tickets?customerId=${encodeURIComponent(customerId)}`,
      );
      const rows = Array.isArray(res?.tickets) ? res.tickets : [];
      const seen = new Set<string>();
      const uniqueRows = rows.filter((row) => {
        const key = getVatTicketKey(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setCustomerTickets(uniqueRows);
    } catch {
      setCustomerTickets([]);
      setTicketDialogError(t("vatTicketLoadFailed"));
    } finally {
      setTicketDialogLoading(false);
    }
  }, [selectedCustomer?.id, t]);

  const buildItemsFromTicket = useCallback((ticket: CustomerOrderTicket, mode: "per-vat" | "all-detail"): LineItem[] => {
    const sourceItems = Array.isArray(ticket.items) ? ticket.items : [];
    const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
    const baseId = getStableTicketLineBaseId(ticket);
    const createdAtLabel = (() => {
      try {
        return format(parseISO(ticket.createdAt), "HH:mm dd-MM-yyyy");
      } catch {
        return format(new Date(), "HH:mm dd-MM-yyyy");
      }
    })();
    const paymentPrefix = t("vatTicketPaidPrefix");
    const headerDescription = `${t("vatTicketHeaderPrefix")} ${ticket.displayNumber} ${createdAtLabel}\n${paymentPrefix}: ${round2(ticket.totalIncl).toFixed(2)}`;

    let next: LineItem[];
    if (mode === "per-vat") {
      const totalIncl = round2(sourceItems.reduce((sum, it) => sum + (Number(it.totalIncl) || 0), 0));
      const totalExcl = round2(sourceItems.reduce((sum, it) => {
        const qty = Math.max(1, Number(it.qty) || 1);
        const perExcl = Number(it.perPieceExcl) || 0;
        return sum + (perExcl * qty);
      }, 0));
      const effectiveVat = totalExcl > 0
        ? round2(((totalIncl / totalExcl) - 1) * 100)
        : 0;
      next = [{
        id: baseId,
        qty: 1,
        description: headerDescription,
        totalIncl,
        perPieceIncl: totalIncl,
        perPieceExcl: totalExcl,
        discount: 0,
        vat: effectiveVat,
      }];
    } else {
      const headerRow = {
        id: baseId,
        qty: 1,
        description: headerDescription,
        totalIncl: 0,
        perPieceIncl: 0,
        perPieceExcl: 0,
        discount: 0,
        vat: 0,
        isVatTicketHeader: true,
      };
      const detailRows = sourceItems.map((it, idx) => ({
        id: baseId + idx + 1,
        qty: Math.max(1, Number(it.qty) || 1),
        description: String(it.description || ""),
        totalIncl: round2(Number(it.totalIncl) || 0),
        perPieceIncl: round2(Number(it.perPieceIncl) || 0),
        perPieceExcl: round2(Number(it.perPieceExcl) || 0),
        discount: 0,
        vat: round2(Number(it.vat) || 0),
      }));
      next = [headerRow, ...detailRows];
    }
    return next;
  }, [t]);

  const mergeLoadedTicketItems = useCallback((tickets: CustomerOrderTicket[], mode: "per-vat" | "all-detail") => {
    return tickets.flatMap((ticket) => buildItemsFromTicket(ticket, mode));
  }, [buildItemsFromTicket]);

  const dedupeVatTicketsById = useCallback((tickets: CustomerOrderTicket[]) => {
    const seen = new Set<string>();
    const unique: CustomerOrderTicket[] = [];
    for (const tk of tickets) {
      const key = getVatTicketKey(tk);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(tk);
    }
    return unique;
  }, []);

  const applyCustomerTicket = useCallback((ticket: CustomerOrderTicket) => {
    setLoadedVatTickets((prev) => {
      const ticketKey = getVatTicketKey(ticket);
      const alreadyLoaded = prev.some((tk) => getVatTicketKey(tk) === ticketKey);
      if (alreadyLoaded) {
        toast({ description: "This VAT ticket is already loaded." });
        return prev;
      }
      const nextTickets = dedupeVatTicketsById([...prev, ticket]);
      setTicketDialogOpen(false);
      setSaveItemError("");
      toast({ description: t("vatTicketLoadedSuccess") });
      return nextTickets;
    });
  }, [t, dedupeVatTicketsById]);

  useEffect(() => {
    if (!isInvoiceFromTickets || loadedVatTickets.length === 0) {
      if (isInvoiceFromTickets && !editingSavedDocument) setItems([]);
      return;
    }
    const uniqueTickets = dedupeVatTicketsById(loadedVatTickets);
    if (uniqueTickets.length !== loadedVatTickets.length) {
      setLoadedVatTickets(uniqueTickets);
      return;
    }
    setItems(mergeLoadedTicketItems(uniqueTickets, vatTicketLoadMode));
    setEditingItemId(null);
    setEditingIsNewItem(false);
  }, [isInvoiceFromTickets, loadedVatTickets, vatTicketLoadMode, mergeLoadedTicketItems, dedupeVatTicketsById, editingSavedDocument]);

  useEffect(() => {
    if (!editingSavedDocument || !isInvoiceFromTickets) return;
    if (loadedVatTickets.length > 0) return;
    if (!savedVatTicketSourceItems || savedVatTicketSourceItems.length === 0) return;

    const nextItems = vatTicketLoadMode === "per-vat"
      ? derivePerVatRowsFromSavedTicketSource(savedVatTicketSourceItems)
      : renumberLineItems(savedVatTicketSourceItems);

    setItems(nextItems);
    setEditingItemId(null);
    setEditingIsNewItem(false);
  }, [editingSavedDocument, isInvoiceFromTickets, loadedVatTickets.length, savedVatTicketSourceItems, vatTicketLoadMode]);

  // Tab nav
  const TopTabs = (
    <div className="flex items-center gap-1 text-sm font-medium">
      <button
        onClick={() => setTab("format")}
        className={cn(
          "px-1 transition-colors",
          tab === "format" ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {t("docFormatting")}
      </button>
      <span className="text-muted-foreground">/</span>
      <button
        onClick={() => setTab("attachment")}
        className={cn(
          "px-1 transition-colors",
          tab === "attachment" ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {t("docAttachment")}
      </button>
    </div>
  );

  // Rich-text toolbar buttons (purely presentational)
  const toolbarRows: { icon: typeof Bold; key: string }[][] = [
    [
      { icon: Bold, key: "b" }, { icon: Italic, key: "i" }, { icon: Underline, key: "u" },
      { icon: Strikethrough, key: "s" }, { icon: Subscript, key: "sub" }, { icon: Superscript, key: "sup" },
      { icon: Type, key: "font" }, { icon: Type, key: "size" }, { icon: Highlighter, key: "color" },
      { icon: Smile, key: "emoji" }, { icon: Brush, key: "brush" }, { icon: Wand2, key: "wand" },
      { icon: Pilcrow, key: "para" }, { icon: AlignLeft, key: "align" }, { icon: ListOrdered, key: "ol" },
    ],
    [
      { icon: List, key: "ul" }, { icon: Outdent, key: "outdent" }, { icon: Indent, key: "indent" },
      { icon: Quote, key: "quote" }, { icon: Minus, key: "hr" },
    ],
    [
      { icon: LinkIcon, key: "link" }, { icon: ImageIcon, key: "image" }, { icon: Video, key: "video" },
      { icon: FileText, key: "file" }, { icon: TableIcon, key: "table" },
      { icon: Undo2, key: "undo" }, { icon: Redo2, key: "redo" },
      { icon: Eraser, key: "clear" }, { icon: MousePointer, key: "cursor" }, { icon: Code2, key: "code" },
    ],
  ];

  return (
    <Dialog open={open} onOpenChange={handleMainDialogOpenChange}>
      <DialogContent
        className={cn(
          "p-0 overflow-hidden",
          documentPhase === "preview" ? "max-w-3xl [&>button:last-child]:hidden" : "max-w-6xl",
        )}
      >
        <DialogTitle className="sr-only">
          {documentPhase === "preview"
            ? t("invoicingPreviewSrTitle")
            : editingSavedDocument
              ? t("invoicingEditDocument")
              : t("newDocument")}
        </DialogTitle>
        {documentPhase === "preview" && savedDocument ? (
          <InvoicingDocumentPreview
            document={savedDocument}
            layout={previewLayout}
            t={t}
            onClose={() => handleMainDialogOpenChange(false)}
            onPrint={handlePreviewPrint}
            onDownloadPdf={() => void handlePreviewDownloadPdf()}
            onPayments={handlePreviewPayments}
            onSend={() => void handlePreviewSend()}
            sendLoading={sendInvoiceLoading}
          />
        ) : (
          <>
        <div className="bg-muted/40 border-b border-border px-6 pt-5 pb-4">
          {TopTabs}
        </div>

        <div className="px-6 pb-6 max-h-[87vh] min-h-[87vh] overflow-y-auto">
          {tab === "format" && (
            <div className="space-y-5">
              {/* Top section: form + customer card */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
                <div className="bg-muted/30 rounded-md p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                    {/* Left col */}
                    <div className="space-y-3">
                      <Row label={t("date")}>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="h-8 w-40 justify-start text-left font-normal">
                              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                              {format(date, "dd-MM-yyyy")}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
                          </PopoverContent>
                        </Popover>
                      </Row>
                      <Row label={t("docKind")}>
                        <Select value={kind} onValueChange={setKind}>
                          <SelectTrigger className="h-8 w-56"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="invoice">{t("docKindInvoice")}</SelectItem>
                            <SelectItem value="invoice-tickets">{t("docKindInvoiceFromTickets")}</SelectItem>
                            <SelectItem value="quotation">{t("docKindQuotation")}</SelectItem>
                            <SelectItem value="credit">{t("docKindCreditNote")}</SelectItem>
                            <SelectItem value="delivery">{t("docKindDeliveryNote")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </Row>
                      <Row label={t("docLayout")}>
                        <div className="flex gap-2">
                          <Select value={layout} onValueChange={setLayout}>
                            <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {layoutOptions.map((name) => (
                                <SelectItem key={name} value={name}>
                                  {layoutSelectLabel(name, t)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={docLang} onValueChange={setDocLang}>
                            <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="nl">nl</SelectItem>
                              <SelectItem value="en">en</SelectItem>
                              <SelectItem value="fr">fr</SelectItem>
                              <SelectItem value="de">de</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </Row>
                    </div>

                    {/* Right col */}
                    <div className="space-y-3">
                      <Row label={t("paymentTerm")}>
                        <Select value={payTerm} onValueChange={setPayTerm}>
                          <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="immediately">{t("payTermImmediately")}</SelectItem>
                            <SelectItem value="3">{t("days3")}</SelectItem>
                            <SelectItem value="7">{t("days7")}</SelectItem>
                            <SelectItem value="14">{t("days14")}</SelectItem>
                            <SelectItem value="21">{t("days21")}</SelectItem>
                            <SelectItem value="30">{t("days30")}</SelectItem>
                            <SelectItem value="60">{t("days60")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </Row>
                      <Row label={t("paymentMethod")}>
                        <Select value={payMethod} onValueChange={setPayMethod}>
                          <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="transfer">{t("payMethodTransfer")}</SelectItem>
                            <SelectItem value="cash">{t("payMethodCash")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </Row>
                      <Row label={t("alreadyPaid")}>
                        <div className="flex items-center gap-2">
                          <Input
                            value={alreadyPaid}
                            onChange={(e) => setAlreadyPaid(e.target.value)}
                            className="h-8 w-32"
                          />
                          <button
                            type="button"
                            onClick={() => setAlreadyPaid(totals.total.toFixed(2))}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="reset"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        </div>
                      </Row>
                    </div>
                  </div>

                  <div className="flex justify-center mt-4">
                    <Button
                      variant="ghost"
                      onClick={() => void handleSave()}
                      disabled={savingDocument}
                      className="gap-2 text-foreground hover:text-primary"
                    >
                      {savingDocument ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {t("save")}
                    </Button>
                  </div>
                </div>

                {/* Customer card */}
                <div className="bg-card border border-border rounded-md p-4 flex flex-col shadow-sm">
                  {selectedCustomer ? (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm leading-tight">
                          <div className="text-foreground">{selectedCustomer.name}</div>
                          {selectedCustomer.subName && (
                            <div className="text-foreground">{selectedCustomer.subName}</div>
                          )}
                          <div className="text-foreground">{selectedCustomer.street}</div>
                          <div className="text-foreground">{selectedCustomer.postalCity}</div>
                          {selectedCustomer.country && (
                            <div className="text-foreground">{selectedCustomer.country}</div>
                          )}
                          <div className="text-foreground">{selectedCustomer.vatNumber}</div>
                        </div>
                        <button
                          type="button"
                          onClick={openEditCustomerModal}
                          disabled={!selectedCustomer?.id}
                          className="text-muted-foreground hover:text-primary transition-colors"
                          aria-label="edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="border-t border-border mt-3 pt-3 flex items-center justify-between text-sm">
                        <button
                          onClick={() => setNewCustomerOpen(true)}
                          className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors"
                        >
                          <PlusCircle className="h-4 w-4" />
                          {t("newCustomer")}
                        </button>
                        <button
                          onClick={() => setCustomersOpen(true)}
                          className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors"
                        >
                          <ArrowLeftRight className="h-4 w-4" />
                          {t("otherCustomer")}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col justify-center gap-4 flex-1">
                      <button
                        onClick={() => setCustomersOpen(true)}
                        className="flex items-center gap-3 text-sm text-foreground hover:text-primary transition-colors"
                      >
                        <User className="h-5 w-5 text-muted-foreground" />
                        {t("chooseExistingCustomer")}
                      </button>
                      <button
                        onClick={() => setNewCustomerOpen(true)}
                        className="flex items-center gap-3 text-sm text-foreground hover:text-primary transition-colors"
                      >
                        <PlusCircle className="h-5 w-5 text-muted-foreground" />
                        {t("createNewCustomerBtn")}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Line entry */}
              <div className="bg-muted/30 rounded-md p-4">
                {isInvoiceFromTickets ? (
                  selectedCustomer ? (
                    <div className="flex items-center justify-center gap-4 py-2">
                      <Select value={vatTicketLoadMode} onValueChange={(v) => setVatTicketLoadMode(v as "per-vat" | "all-detail")}>
                        <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="per-vat">{t("vatTicketModePerVat")}</SelectItem>
                          <SelectItem value="all-detail">{t("vatTicketModeAllDetail")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 text-foreground hover:text-primary"
                        onClick={() => void openTicketDialog()}
                      >
                        <FileDown className="h-4 w-4" />
                        {t("vatTicketLoadCashTicket")}
                      </button>
                    </div>
                  ) : (
                    <div className="py-4 text-center text-sm text-foreground">
                      {t("vatTicketSelectCustomerHint")}
                    </div>
                  )
                ) : (
                  <>
                    <div className="grid grid-cols-[60px_160px_200px_100px_90px_90px_70px_90px_auto] gap-3 items-end text-xs text-muted-foreground">
                      <div>{t("quantity")}</div>
                      <div>{t("description")}</div>
                      <button
                        type="button"
                        onClick={() => setProductsOpen(true)}
                        className="inline-flex items-center gap-1.5 text-foreground/80 hover:text-primary justify-self-start"
                      >
                        <Download className="h-3.5 w-3.5" /> {t("insertProduct")}
                      </button>
                      <div className="text-center leading-tight">{t("totalInclVat")}</div>
                      <div className="text-center leading-tight">{t("perPieceIncl")}</div>
                      <div className="text-center leading-tight">{t("perPieceExcl")}</div>
                      <div>{t("discount")}</div>
                      <div>{t("vatRate")}</div>
                      <div />
                    </div>
                    <div className="grid grid-cols-[60px_160px_200px_100px_90px_90px_70px_90px_auto] gap-3 items-center mt-2">
                      <Input
                        value={qty}
                        onChange={(e) => handleQtyChange(e.target.value)}
                        className={cn("h-8 text-center", qtyError && "border-destructive bg-destructive/10")}
                      />
                      <Input
                        value={desc}
                        onChange={(e) => {
                          const value = e.target.value;
                          setDesc(value);
                          setDescError(value.trim().length === 0);
                        }}
                        className={cn("h-8", descError && "border-destructive bg-destructive/10")}
                      />
                      <div />
                      <Input value={totalIncl} onChange={(e) => handleTotalInclChange(e.target.value)} className="h-8 text-right" />
                      <Input value={perIncl} onChange={(e) => handlePerInclChange(e.target.value)} className="h-8 text-right" />
                      <Input value={perExcl} onChange={(e) => handlePerExclChange(e.target.value)} className="h-8 text-right" />
                      <div className="flex items-center gap-1">
                        <Input value={discount} onChange={(e) => handleDiscountChange(e.target.value)} className="h-8 text-right" />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                      <Select value={vat} onValueChange={handleVatChange}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0 %</SelectItem>
                          <SelectItem value="6">6 %</SelectItem>
                          <SelectItem value="12">12 %</SelectItem>
                          <SelectItem value="21">21 %</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={addItem}
                        disabled={savingItem}
                        className="gap-1.5 text-foreground hover:text-primary"
                      >
                        <Plus className="h-4 w-4" /> {t("add")}
                      </Button>
                    </div>
                    {saveItemError && (
                      <div className="mt-2 text-xs text-destructive">{saveItemError}</div>
                    )}
                  </>
                )}
              </div>

              {/* Items list */}
              <div className="border border-border rounded-md min-h-[260px] max-h-[260px] overflow-y-auto">
                {items.length === 0 ? (
                  <div className="h-[260px]" />
                ) : (
                  <div className="divide-y divide-border">
                    {items.map((it) => (
                      <div
                        key={it.id}
                        className={cn(
                          "grid gap-3 items-center px-3 py-2 text-sm",
                          isInvoiceFromTickets
                            ? "grid-cols-[60px_320px_30px_100px_90px_90px_70px_90px_auto]"
                            : "grid-cols-[60px_150px_200px_100px_90px_90px_70px_90px_auto]",
                        )}
                      >
                        {editingItemId === it.id ? (
                          <>
                            <Input value={editingQty} onChange={(e) => handleEditingQtyChange(e.target.value)} className="h-8 text-center" />
                            <Input value={editingDesc} onChange={(e) => setEditingDesc(e.target.value)} className="h-8" />
                            <div />
                            <Input value={editingTotalIncl} onChange={(e) => handleEditingTotalInclChange(e.target.value)} className="h-8 text-right" />
                            <Input value={editingPerIncl} onChange={(e) => handleEditingPerInclChange(e.target.value)} className="h-8 text-right" />
                            <Input value={editingPerExcl} onChange={(e) => handleEditingPerExclChange(e.target.value)} className="h-8 text-right" />
                            <div className="flex items-center gap-1">
                              <Input value={editingDiscount} onChange={(e) => handleEditingDiscountChange(e.target.value)} className="h-8 text-right" />
                              <span className="text-xs text-muted-foreground">%</span>
                            </div>
                            <Select value={editingVat} onValueChange={handleEditingVatChange}>
                              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0">0 %</SelectItem>
                                <SelectItem value="6">6 %</SelectItem>
                                <SelectItem value="12">12 %</SelectItem>
                                <SelectItem value="21">21 %</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="flex items-center justify-center text-muted-foreground">
                              <button
                                onClick={saveEditingItem}
                                className="hover:text-primary"
                                aria-label="save edit"
                                disabled={savingItem}
                              >
                                <Save className="h-4 w-4" />
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-center">{it.qty}</div>
                            <div className="whitespace-pre-line break-words">{it.description}</div>
                            <div />
                            <div className="text-right font-mono">{it.isVatTicketHeader ? "" : it.totalIncl.toFixed(2)}</div>
                            <div className="text-right font-mono">{it.isVatTicketHeader ? "" : it.perPieceIncl.toFixed(2)}</div>
                            <div className="text-right font-mono">{it.isVatTicketHeader ? "" : it.perPieceExcl.toFixed(2)}</div>
                            <div className="text-right">{it.isVatTicketHeader ? "" : `${it.discount.toFixed(2)} %`}</div>
                            <div className="text-right">{it.isVatTicketHeader ? "" : `${it.vat} %`}</div>
                            <div className="flex items-center gap-3 pl-5 text-muted-foreground">
                              <button
                                onClick={() => moveItem(it.id, 1)}
                                className={cn(
                                  "hover:text-foreground",
                                  isInvoiceFromTickets && "opacity-40 cursor-not-allowed hover:text-muted-foreground",
                                )}
                                aria-label="down"
                                disabled={isInvoiceFromTickets}
                              >
                                <ArrowDown className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => moveItem(it.id, -1)}
                                className={cn(
                                  "hover:text-foreground",
                                  isInvoiceFromTickets && "opacity-40 cursor-not-allowed hover:text-muted-foreground",
                                )}
                                aria-label="up"
                                disabled={isInvoiceFromTickets}
                              >
                                <ArrowUp className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => startEditingItem(it)}
                                className={cn(
                                  "hover:text-primary",
                                  isInvoiceFromTickets && "opacity-40 cursor-not-allowed hover:text-muted-foreground",
                                )}
                                aria-label="edit"
                                disabled={isInvoiceFromTickets}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setDeleteTargetId(it.id)}
                                className={cn(
                                  "hover:text-destructive",
                                  isInvoiceFromTickets && vatTicketLoadMode !== "per-vat" && !it.isVatTicketHeader && "opacity-40 cursor-not-allowed hover:text-muted-foreground",
                                )}
                                aria-label="delete"
                                disabled={isInvoiceFromTickets && vatTicketLoadMode !== "per-vat" && !it.isVatTicketHeader}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {loadItemsError && (
                <div className="text-xs text-destructive">{loadItemsError}</div>
              )}

              {/* Footer actions + totals */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-8 text-sm">
                    <button onClick={() => setResetListConfirmOpen(true)} className="inline-flex items-center gap-1.5 text-foreground hover:text-primary">
                      <RotateCcw className="h-4 w-4" /> {t("resetList")}
                    </button>
                    <button className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                      <FileDown className="h-4 w-4" /> {t("insertDocumentBtn")}
                    </button>
                    <button
                      onClick={() => setAdvanceOpen(true)}
                      disabled={isInvoiceFromTickets}
                      className={cn(
                        "inline-flex items-center gap-1.5",
                        isInvoiceFromTickets ? "text-muted-foreground/60 cursor-not-allowed" : "text-foreground hover:text-primary",
                      )}
                    >
                      <BookOpen className="h-4 w-4" /> {t("advanceLoad")}
                    </button>
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground">{t("notesLabel")} :</label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="mt-1 min-h-[90px] resize-none"
                    />
                  </div>
                </div>

                <div className="border border-border rounded-md divide-y divide-border text-sm self-end">
                  <TotalRow label={`${t("mvh")} :`} value={totals.mvh.toFixed(2)} />
                  <TotalRow label={`${t("btwShort")} ${items[0]?.vat ?? 21} %`} value={totals.vat.toFixed(2)} />
                  <TotalRow label={`${t("totalEuro")} :`} value={totals.total.toFixed(2)} />
                  <TotalRow label={`${t("alreadyPaid")} :`} value={totals.paid.toFixed(2)} />
                  <TotalRow label={`${t("payableBefore")} ${format(date, "dd-MM-yyyy")} :`} value={totals.due.toFixed(2)} />
                </div>
              </div>
            </div>
          )}

          {tab === "attachment" && (
            <div className="pt-4 space-y-4">
              <div className="flex items-center justify-center gap-12">
                <Button
                  variant="ghost"
                  onClick={() => void handleSave()}
                  disabled={savingDocument}
                  className="gap-2 text-foreground hover:text-primary"
                >
                  {savingDocument ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {t("save")}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setAttachmentText("")}
                  className="gap-2 text-foreground hover:text-primary"
                >
                  <RotateCcw className="h-4 w-4" /> {t("reset")}
                </Button>
                <Select value={attachmentPos} onValueChange={setAttachmentPos}>
                  <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="above">{t("aboveDocument")}</SelectItem>
                    <SelectItem value="below">{t("belowDocument")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border border-border rounded-md bg-muted/20">
                <div className="border-b border-border px-2 py-2 space-y-1">
                  {toolbarRows.map((row, ri) => (
                    <div key={ri} className="flex flex-wrap items-center gap-1">
                      {row.map(({ icon: Icon, key }) => (
                        <button
                          key={key}
                          type="button"
                          className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-muted text-foreground"
                        >
                          <Icon className="h-4 w-4" />
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
                <Textarea
                  value={attachmentText}
                  onChange={(e) => setAttachmentText(e.target.value)}
                  placeholder={t("typeSomething")}
                  className="min-h-[580px] max-h-[580px] border-0 rounded-none focus-visible:ring-0 resize-none bg-transparent"
                />
              </div>
            </div>
          )}
        </div>
          </>
        )}
      </DialogContent>
      <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden">
          <DialogTitle className="sr-only">{t("vatTicketLoadCashTicket")}</DialogTitle>
          <div className="px-5 py-3 border-b border-border">
            <Input
              value={ticketDialogQuery}
              onChange={(e) => setTicketDialogQuery(e.target.value)}
              placeholder={t("search")}
              className="h-9 max-w-sm"
            />
          </div>
          <div className="max-h-[70vh] min-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-[110px_190px_1fr_140px_140px] gap-4 px-5 py-2 text-sm font-medium border-b border-border bg-muted/30">
              <div>{t("number")}</div>
              <div>{t("date")}</div>
              <div>{t("name")}</div>
              <div className="text-right">{t("total")}</div>
              <div>{t("payment")}</div>
            </div>
            {ticketDialogLoading ? (
              <div className="flex justify-center py-12 text-muted-foreground">
                <Loader2 className="h-7 w-7 animate-spin opacity-60" />
              </div>
            ) : ticketDialogError ? (
              <div className="px-5 py-6 text-sm text-destructive">{ticketDialogError}</div>
            ) : selectableCustomerTickets.length === 0 ? (
              <div className="px-5 py-8 text-sm text-muted-foreground">{t("vatTicketNoOrdersFound")}</div>
            ) : (
              <div className="divide-y divide-border">
                {selectableCustomerTickets.map((tk) => (
                  <button
                    key={tk.id}
                    type="button"
                    className="w-full grid grid-cols-[110px_190px_1fr_140px_140px] gap-4 px-5 py-2 text-left text-sm hover:bg-muted/30 transition-colors"
                    onClick={() => applyCustomerTicket(tk)}
                  >
                    <div>{tk.displayNumber}</div>
                    <div>{format(parseISO(tk.createdAt), "dd-MM-yyyy HH:mm:ss")}</div>
                    <div className="truncate">{tk.customerName}</div>
                    <div className="text-right font-mono">{(Number(tk.totalIncl) || 0).toFixed(2)}</div>
                    <div>{tk.paymentLabel}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={editCustomerOpen} onOpenChange={setEditCustomerOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden [&>button:last-child]:hidden">
          <DialogTitle className="sr-only">{t("editCustomers")}</DialogTitle>
          <DialogDescription className="sr-only">{t("customerData")}</DialogDescription>
          <div className="flex items-center justify-center gap-16 border-b border-border px-6 pt-5 pb-3 relative">
            <button
              type="button"
              onClick={() => setEditCustomerTab("general")}
              className={cn(
                "text-sm font-medium pb-2 -mb-3 border-b-2 transition-colors",
                editCustomerTab === "general" ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
              )}
            >
              {t("general")}
            </button>
            <button
              type="button"
              onClick={() => setEditCustomerTab("advanced")}
              className={cn(
                "text-sm font-medium pb-2 -mb-3 border-b-2 transition-colors",
                editCustomerTab === "advanced" ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
              )}
            >
              {t("advanced")}
            </button>
            <button
              type="button"
              onClick={() => setEditCustomerOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto px-8 py-6">
            {editCustomerTab === "general" ? (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">{t("customerData")} :</h3>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("companyNameLabel")} :</Label>
                  <Input className="h-9" value={editCustomerForm.companyName} onChange={(e) => setEditCustomerForm((p) => ({ ...p, companyName: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("name")} :</Label>
                  <Input className="h-9" value={editCustomerForm.name} onChange={(e) => setEditCustomerForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("firstName")} :</Label>
                  <Input className="h-9" value={editCustomerForm.firstName} onChange={(e) => setEditCustomerForm((p) => ({ ...p, firstName: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("attentionOf")} :</Label>
                  <Input className="h-9" value={editCustomerForm.attention} onChange={(e) => setEditCustomerForm((p) => ({ ...p, attention: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("streetAndNr")} :</Label>
                  <Input className="h-9" value={editCustomerForm.street} onChange={(e) => setEditCustomerForm((p) => ({ ...p, street: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("postcode")} :</Label>
                  <Input className="h-9 w-32" value={editCustomerForm.postalCode} onChange={(e) => setEditCustomerForm((p) => ({ ...p, postalCode: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("cityLabel")} :</Label>
                  <Input className="h-9" value={editCustomerForm.city} onChange={(e) => setEditCustomerForm((p) => ({ ...p, city: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("country")} :</Label>
                  <Select value={editCustomerForm.country} onValueChange={(v) => setEditCustomerForm((p) => ({ ...p, country: v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {sortedCountryCodes.map((code) => (
                        <SelectItem key={code} value={code}>{getCountryName(code, lang)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("vatNumber")} :</Label>
                  <Input className="h-9" value={editCustomerForm.vatNumber} onChange={(e) => setEditCustomerForm((p) => ({ ...p, vatNumber: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("phone")} :</Label>
                  <Input className="h-9" value={editCustomerForm.phone} onChange={(e) => setEditCustomerForm((p) => ({ ...p, phone: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("email")} :</Label>
                  <Input className="h-9" value={editCustomerForm.email} onChange={(e) => setEditCustomerForm((p) => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("paymentTerm")} :</Label>
                  <Select value={editCustomerForm.paymentTerm} onValueChange={(v) => setEditCustomerForm((p) => ({ ...p, paymentTerm: v }))}>
                    <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">{t("immediate")}</SelectItem>
                      <SelectItem value="3">{t("days3")}</SelectItem>
                      <SelectItem value="7">{t("days7")}</SelectItem>
                      <SelectItem value="14">{t("days14")}</SelectItem>
                      <SelectItem value="21">{t("days21")}</SelectItem>
                      <SelectItem value="30">{t("days30")}</SelectItem>
                      <SelectItem value="60">{t("days60")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">{t("customerData")} :</h3>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("creditTag")} :</Label>
                  <Input className="h-9" value={editCustomerForm.creditTag} onChange={(e) => setEditCustomerForm((p) => ({ ...p, creditTag: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("discountLabel")} :</Label>
                  <Input className="h-9" value={editCustomerForm.discount} onChange={(e) => setEditCustomerForm((p) => ({ ...p, discount: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("priceGroupLabel")} :</Label>
                  <Input className="h-9" value={editCustomerForm.priceGroup === "off" ? "" : editCustomerForm.priceGroup} onChange={(e) => setEditCustomerForm((p) => ({ ...p, priceGroup: e.target.value || "off" }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-start gap-3">
                  <Label className="text-sm">{t("notes")} :</Label>
                  <Textarea className="min-h-[110px]" value={editCustomerForm.notes} onChange={(e) => setEditCustomerForm((p) => ({ ...p, notes: e.target.value }))} />
                </div>
              </div>
            )}
            {editCustomerError ? (
              <p className="text-sm text-destructive pt-4">{editCustomerError}</p>
            ) : null}
          </div>
          <div className="border-t border-border px-8 py-4 flex justify-center">
            <Button onClick={() => void saveEditedCustomer()} disabled={editCustomerSaving} className="min-w-[110px]">
              {editCustomerSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ExistingCustomersDialog
        open={customersOpen}
        onOpenChange={setCustomersOpen}
        onSelect={setSelectedCustomer}
      />
      <Dialog open={newCustomerOpen} onOpenChange={(nextOpen) => {
        setNewCustomerOpen(nextOpen);
        if (!nextOpen) resetNewCustomerForm();
      }}>
        <DialogContent className="max-w-xl p-0 overflow-hidden [&>button:last-child]:hidden">
          <DialogTitle className="sr-only">{t("createNewCustomerBtn")}</DialogTitle>
          <DialogDescription className="sr-only">{t("customerData")}</DialogDescription>
          <div className="flex items-center justify-center gap-16 border-b border-border px-6 pt-5 pb-3 relative">
            <button
              type="button"
              onClick={() => setNewCustomerTab("general")}
              className={cn(
                "text-sm font-medium pb-2 -mb-3 border-b-2 transition-colors",
                newCustomerTab === "general" ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
              )}
            >
              {t("general")}
            </button>
            <button
              type="button"
              onClick={() => setNewCustomerTab("advanced")}
              className={cn(
                "text-sm font-medium pb-2 -mb-3 border-b-2 transition-colors",
                newCustomerTab === "advanced" ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
              )}
            >
              {t("advanced")}
            </button>
            <button
              type="button"
              onClick={() => setNewCustomerOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto px-8 py-6">
            {newCustomerTab === "general" ? (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">{t("customerData")} :</h3>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("companyNameLabel")} :</Label>
                  <Input className="h-9" value={customerForm.companyName} onChange={(e) => setCustomerForm((p) => ({ ...p, companyName: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("name")} :</Label>
                  <Input className="h-9" value={customerForm.name} onChange={(e) => setCustomerForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("firstName")} :</Label>
                  <Input className="h-9" value={customerForm.firstName} onChange={(e) => setCustomerForm((p) => ({ ...p, firstName: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("attentionOf")} :</Label>
                  <Input className="h-9" value={customerForm.attention} onChange={(e) => setCustomerForm((p) => ({ ...p, attention: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("streetAndNr")} :</Label>
                  <Input className="h-9" value={customerForm.street} onChange={(e) => setCustomerForm((p) => ({ ...p, street: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("postcode")} :</Label>
                  <Input className="h-9 w-32" value={customerForm.postalCode} onChange={(e) => setCustomerForm((p) => ({ ...p, postalCode: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("cityLabel")} :</Label>
                  <Input className="h-9" value={customerForm.city} onChange={(e) => setCustomerForm((p) => ({ ...p, city: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("country")} :</Label>
                  <Select value={customerForm.country} onValueChange={(v) => setCustomerForm((p) => ({ ...p, country: v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {sortedCountryCodes.map((code) => (
                        <SelectItem key={code} value={code}>{getCountryName(code, lang)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("vatNumber")} :</Label>
                  <Input className="h-9" value={customerForm.vatNumber} onChange={(e) => setCustomerForm((p) => ({ ...p, vatNumber: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("phone")} :</Label>
                  <Input className="h-9" value={customerForm.phone} onChange={(e) => setCustomerForm((p) => ({ ...p, phone: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("email")} :</Label>
                  <Input className="h-9" value={customerForm.email} onChange={(e) => setCustomerForm((p) => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("paymentTerm")} :</Label>
                  <Select value={customerForm.paymentTerm} onValueChange={(v) => setCustomerForm((p) => ({ ...p, paymentTerm: v }))}>
                    <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">{t("immediate")}</SelectItem>
                      <SelectItem value="3">{t("days3")}</SelectItem>
                      <SelectItem value="7">{t("days7")}</SelectItem>
                      <SelectItem value="14">{t("days14")}</SelectItem>
                      <SelectItem value="21">{t("days21")}</SelectItem>
                      <SelectItem value="30">{t("days30")}</SelectItem>
                      <SelectItem value="60">{t("days60")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between pt-4">
                  <h3 className="text-sm font-semibold text-foreground">{t("deliveryAddress")} :</h3>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    onClick={() => setCustomerForm((p) => ({
                      ...p,
                      deliveryCompany: p.companyName,
                      deliveryStreet: p.street,
                      deliveryPostal: p.postalCode,
                      deliveryCity: p.city,
                      deliveryCountry: p.country,
                    }))}
                  >
                    <ArrowDown className="h-3 w-3" /> {t("resetData")}
                  </button>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("companyNameLabel")} :</Label>
                  <Input className="h-9" value={customerForm.deliveryCompany} onChange={(e) => setCustomerForm((p) => ({ ...p, deliveryCompany: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("streetAndNr")} :</Label>
                  <Input className="h-9" value={customerForm.deliveryStreet} onChange={(e) => setCustomerForm((p) => ({ ...p, deliveryStreet: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("postcode")} :</Label>
                  <Input className="h-9 w-32" value={customerForm.deliveryPostal} onChange={(e) => setCustomerForm((p) => ({ ...p, deliveryPostal: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("cityLabel")} :</Label>
                  <Input className="h-9" value={customerForm.deliveryCity} onChange={(e) => setCustomerForm((p) => ({ ...p, deliveryCity: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("country")} :</Label>
                  <Select value={customerForm.deliveryCountry} onValueChange={(v) => setCustomerForm((p) => ({ ...p, deliveryCountry: v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {sortedCountryCodes.map((code) => (
                        <SelectItem key={code} value={code}>{getCountryName(code, lang)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">{t("customerData")} :</h3>
                <div className="grid grid-cols-[140px_1fr] items-start gap-3">
                  <Label className="text-sm pt-2">{t("notes")} :</Label>
                  <Textarea rows={3} value={customerForm.notes} onChange={(e) => setCustomerForm((p) => ({ ...p, notes: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("creditTag")} :</Label>
                  <Input className="h-9" value={customerForm.creditTag} onChange={(e) => setCustomerForm((p) => ({ ...p, creditTag: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("discountPercent")} :</Label>
                  <Input className="h-9" value={customerForm.discount} onChange={(e) => setCustomerForm((p) => ({ ...p, discount: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("priceGroupLabel")} :</Label>
                  <Input className="h-9" value={customerForm.priceGroup === "off" ? "" : customerForm.priceGroup} onChange={(e) => setCustomerForm((p) => ({ ...p, priceGroup: e.target.value || "off" }))} />
                </div>
                <div className="pt-3 grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("email2")} :</Label>
                  <Input className="h-9" value={customerForm.email2} onChange={(e) => setCustomerForm((p) => ({ ...p, email2: e.target.value }))} />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("email3")} :</Label>
                  <Input className="h-9" value={customerForm.email3} onChange={(e) => setCustomerForm((p) => ({ ...p, email3: e.target.value }))} />
                </div>
              </div>
            )}
            {newCustomerError && <div className="text-xs text-destructive mt-3">{newCustomerError}</div>}
          </div>

          <div className="flex justify-center pb-6 border-t border-border pt-4">
            <Button variant="ghost" size="sm" className="gap-2" disabled={newCustomerSaving} onClick={() => void handleCreateCustomer()}>
              {newCustomerSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <AdvanceLoadDialog open={advanceOpen} onOpenChange={setAdvanceOpen} />
      <DeleteConfirmDialog
        open={deleteTargetId != null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteTargetId(null);
        }}
        onConfirm={() => {
          if (deleteTargetId != null) void deleteItem(deleteTargetId);
        }}
      />
      <DeleteConfirmDialog
        open={resetListConfirmOpen}
        onOpenChange={setResetListConfirmOpen}
        onConfirm={() => {
          void resetList();
          setResetListConfirmOpen(false);
        }}
      />
      <Dialog open={productsOpen} onOpenChange={setProductsOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden [&>button:last-child]:hidden">
          <DialogTitle className="sr-only">{t("insertProduct")}</DialogTitle>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
            <Input
              value={productsSearch}
              onChange={(e) => setProductsSearch(e.target.value)}
              placeholder={t("search")}
              className="h-9 max-w-[260px]"
            />
            <Select value={productsVatFilter} onValueChange={setProductsVatFilter}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="original">{t("vatOriginal")}</SelectItem>
                <SelectItem value="0">{t("vatOption0")}</SelectItem>
                <SelectItem value="6">{t("vatOption6")}</SelectItem>
                <SelectItem value="12">{t("vatOption12")}</SelectItem>
                <SelectItem value="21">{t("vatOption21")}</SelectItem>
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={() => setProductsOpen(false)}
              className="ml-auto text-muted-foreground hover:text-foreground"
              aria-label="close products"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-[90px_1.8fr_120px_120px] gap-4 px-6 py-3 text-sm font-semibold border-b border-border">
              <div>PLU</div>
              <div>{t("name")}</div>
              <div>{t("price")}</div>
              <div>{t("stock")}</div>
            </div>
            {productsLoading ? (
              <div className="px-6 py-6 text-sm text-muted-foreground">Loading products...</div>
            ) : productsError ? (
              <div className="px-6 py-6 text-sm text-destructive">{productsError}</div>
            ) : (
              <div className="divide-y divide-border">
                {visibleProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => applyProductToLine(product)}
                    className="w-full text-left grid grid-cols-[90px_1.8fr_120px_120px] gap-4 px-6 py-2 text-sm hover:bg-muted/40 transition-colors"
                  >
                    <div>{product.number}</div>
                    <div>{product.name}</div>
                    <div>{product.price.toFixed(2)}</div>
                    <div>{parseStockQty(product.stock)}</div>
                  </button>
                ))}
                {visibleProducts.length === 0 && (
                  <div className="px-6 py-6 text-sm text-muted-foreground">No products found.</div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={lowStockWarning != null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setLowStockWarning(null);
        }}
      >
        <DialogContent className="max-w-md border-destructive/50 bg-red-50 text-red-950 dark:bg-red-950/30 dark:text-red-100">
          <DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <AlertTriangle className="h-5 w-5" />
            <span>Warning</span>
          </DialogTitle>
          {lowStockWarning ? (
            <DialogDescription className="text-red-800 dark:text-red-200">
              {`${lowStockWarning.name} is out of stock.`}
            </DialogDescription>
          ) : null}
          <div className="flex justify-end pt-2">
            <Button type="button" className="bg-red-600 text-white hover:bg-red-700" onClick={() => setLowStockWarning(null)}>
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={paymentModalOpen}
        onOpenChange={(nextOpen) => {
          setPaymentModalOpen(nextOpen);
          if (!nextOpen) {
            setPaymentSaving(false);
            setPaymentReceivedStr("0.00");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogTitle className="sr-only">{t("invoicingRecordPaymentSr")}</DialogTitle>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {savedDocument ? `#${savedDocument.displayNumber} - ${Number(savedDocument.totalIncl || 0).toFixed(2)}` : "—"}
            </div>
            <div className="space-y-2">
              <Label>{t("invoicingPaymentReceived")}</Label>
              <Input
                value={paymentReceivedStr}
                onChange={(e) => setPaymentReceivedStr(e.target.value)}
                inputMode="decimal"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" onClick={handlePreviewPayments} disabled={paymentSaving}>
                {t("invoicingPaymentLoadFull")}
              </Button>
              <Button type="button" onClick={() => void handlePreviewSavePayment()} disabled={paymentSaving}>
                {paymentSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-center gap-2 text-sm">
      <label className="text-foreground">{label} :</label>
      <div>{children}</div>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center px-3 py-2">
      <span className="text-foreground">{label}</span>
      <span className="font-mono text-right">{value}</span>
    </div>
  );
}
