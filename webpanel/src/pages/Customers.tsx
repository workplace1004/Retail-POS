import { useCallback, useEffect, useMemo, useState } from "react";
import { Contact, Plus, Receipt, Eye, X, Save, ArrowDown, Pencil, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { TabsBar } from "@/components/TabsBar";
import { Button } from "@/components/ui/button";
import { DataPagination } from "@/components/DataPagination";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useLanguage } from "@/contexts/LanguageContext";
import { getCountryName, getSortedCountryCodes } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";

type CustomerRow = {
  id: string;
  name: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  vatNumber: string | null;
  discount: string | null;
  priceGroup: string | null;
  creditTag: string | null;
};

function rowFromApi(r: Record<string, unknown>): CustomerRow {
  const str = (v: unknown) => (v == null ? null : String(v));
  return {
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    companyName: str(r.companyName),
    firstName: str(r.firstName),
    lastName: str(r.lastName),
    street: str(r.street),
    postalCode: str(r.postalCode),
    city: str(r.city),
    country: str(r.country),
    phone: str(r.phone),
    email: str(r.email),
    vatNumber: str(r.vatNumber),
    discount: str(r.discount),
    priceGroup: str(r.priceGroup),
    creditTag: str(r.creditTag),
  };
}

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

function rowToForm(row: CustomerRow): CustomerFormState {
  const pg = (row.priceGroup ?? "").trim();
  return {
    companyName: row.companyName ?? "",
    name: row.name ?? "",
    firstName: row.firstName ?? "",
    attention: row.lastName ?? "",
    street: row.street ?? "",
    postalCode: row.postalCode ?? "",
    city: row.city ?? "",
    country: (row.country ?? "BE").trim() || "BE",
    vatNumber: row.vatNumber ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    paymentTerm: "0",
    deliveryCompany: "",
    deliveryStreet: "",
    deliveryPostal: "",
    deliveryCity: "",
    deliveryCountry: "BE",
    notes: "",
    creditTag: row.creditTag ?? "",
    discount: row.discount ?? "",
    priceGroup: pg === "" ? "off" : pg,
    email2: "",
    email3: "",
  };
}

function toNullableTrim(s: string): string | null {
  const x = s.trim();
  return x === "" ? null : x;
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

type PriceGroupRow = { id: string; name: string };

function customerSubline(c: CustomerRow): string | null {
  const parts: string[] = [];
  const cn = (c.companyName ?? "").trim();
  const displayName = (c.name ?? "").trim();
  if (cn && cn !== displayName) parts.push(cn);
  const fl = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  if (fl) parts.push(fl);
  return parts.length ? parts.join(" · ") : null;
}

const DateField = ({ value, onChange }: { value: Date; onChange: (d: Date) => void }) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline" className="h-9 w-32 justify-center font-normal text-sm">
        {format(value, "dd-MM-yyyy")}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar mode="single" selected={value} onSelect={(d) => d && onChange(d)} initialFocus className="p-3 pointer-events-auto" />
    </PopoverContent>
  </Popover>
);

const Customers = () => {
  const { t, lang } = useLanguage();
  const sortedCountryCodes = useMemo(() => getSortedCountryCodes(lang), [lang]);
  const [tab, setTab] = useState("all");
  const [invoiceTab, setInvoiceTab] = useState<"open" | "history">("open");
  const [open, setOpen] = useState(false);
  const [modalTab, setModalTab] = useState<"general" | "advanced">("general");
  const [from, setFrom] = useState<Date>(new Date());
  const [to, setTo] = useState<Date>(new Date());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [customerForm, setCustomerForm] = useState<CustomerFormState>(() => emptyCustomerForm());
  const [customerSaving, setCustomerSaving] = useState(false);
  const [priceGroups, setPriceGroups] = useState<PriceGroupRow[]>([]);

  const loadPriceGroups = useCallback(async () => {
    try {
      const rows = await apiRequest<Array<Record<string, unknown>>>("/api/price-groups");
      setPriceGroups(
        (Array.isArray(rows) ? rows : [])
          .map((r) => ({ id: String(r.id ?? ""), name: String(r.name ?? "").trim() }))
          .filter((r) => r.id && r.name),
      );
    } catch {
      setPriceGroups([]);
    }
  }, []);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await apiRequest<Array<Record<string, unknown>>>("/api/customers");
      setCustomers((Array.isArray(rows) ? rows : []).map(rowFromApi).filter((r) => r.id));
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : (lang === "nl" ? "Klanten laden mislukt." : "Failed to load customers."),
      });
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    if (open) void loadPriceGroups();
  }, [open, loadPriceGroups]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => {
      const hay = [
        c.name,
        c.companyName,
        c.firstName,
        c.lastName,
        c.street,
        c.postalCode,
        c.city,
        c.country,
        getCountryName(((c.country ?? "BE").trim() || "BE").slice(0, 2), lang).toLowerCase(),
        c.phone,
        c.email,
        c.vatNumber,
        c.priceGroup,
      ]
        .map((x) => (x == null ? "" : String(x)).toLowerCase())
        .join(" ");
      return hay.includes(q);
    });
  }, [customers, searchQuery, lang]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageRows = filteredCustomers.slice(pageStart, pageStart + pageSize);

  const orphanedPriceGroupName = useMemo(() => {
    const v = customerForm.priceGroup.trim();
    if (v === "" || v === "off") return null;
    if (priceGroups.some((p) => p.name === v)) return null;
    return v;
  }, [customerForm.priceGroup, priceGroups]);

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    const nextLen = filteredCustomers.filter((c) => c.id !== id).length;
    try {
      await apiRequest(`/api/customers/${id}`, { method: "DELETE" });
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      setDeleteId(null);
      setPage((p) => Math.min(p, Math.max(1, Math.ceil(nextLen / pageSize) || 1)));
      toast({
        description: lang === "nl" ? "Klant verwijderd." : "Customer deleted.",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : (lang === "nl" ? "Verwijderen mislukt." : "Delete failed."),
      });
    }
  };

  const tabs = [
    { id: "all", label: t("showAllCustomers"), icon: <Eye className="h-4 w-4" /> },
    { id: "invoice", label: t("toInvoice"), icon: <Receipt className="h-4 w-4" /> },
  ];

  const openNew = () => {
    setEditingCustomerId(null);
    setCustomerForm(emptyCustomerForm());
    setModalTab("general");
    setOpen(true);
  };

  const openExisting = (row: CustomerRow) => {
    setEditingCustomerId(row.id);
    setCustomerForm(rowToForm(row));
    setModalTab("general");
    setOpen(true);
  };

  const handleSaveCustomer = async () => {
    const payload = buildCustomerPayload(customerForm);
    if (!payload.name.trim()) {
      toast({
        variant: "destructive",
        description: lang === "nl" ? "Vul minstens een naam of bedrijfsnaam in." : "Enter at least a name or company name.",
      });
      return;
    }
    setCustomerSaving(true);
    try {
      if (editingCustomerId) {
        await apiRequest(`/api/customers/${editingCustomerId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest("/api/customers", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      toast({
        description: lang === "nl" ? "Klant opgeslagen." : "Customer saved.",
      });
      setOpen(false);
      setEditingCustomerId(null);
      setCustomerForm(emptyCustomerForm());
      await loadCustomers();
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : (lang === "nl" ? "Opslaan mislukt." : "Save failed."),
      });
    } finally {
      setCustomerSaving(false);
    }
  };

  return (
    <AppLayout>

      <div className="flex items-center justify-center gap-4">
        <TabsBar tabs={tabs} active={tab} onChange={setTab} />
        <PageHeader
          title={t("customers")}
          description={t("showAllCustomers")}
          icon={<Contact className="h-5 w-5" />}
          actions={
            <>
              <Input
                placeholder={t("search") + "..."}
                className="w-48 h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={t("search")}
              />
            </>
          }
        />

      </div>

      {tab === "all" && (
        <div className="flex flex-col justify-center gap-4 max-w-7xl mx-auto">
          <div className="flex justify-center">
            <Button
              size="sm"
              className="gap-1.5 bg-gradient-primary text-primary-foreground hover:opacity-90"
              onClick={openNew}
              disabled={loading}
            >
              <Plus className="h-4 w-4" /> {t("newCustomer")}
            </Button>
          </div>
          <Card className="overflow-hidden shadow-card">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_140px] gap-4 px-5 py-3 border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <div>{t("name")}</div>
                  <div>{t("country")}</div>
                  <div>{t("streetNumber")}</div>
                  <div>{t("postalCity")}</div>
                  <div>{t("vatNumber")}</div>
                  <div className="text-right">{t("actions")}</div>
                </div>
                <div className="divide-y divide-border">
                  {pageRows.length === 0 ? (
                    <div className="px-5 py-10 text-center text-sm text-muted-foreground">—</div>
                  ) : (
                    pageRows.map((c) => {
                      const sub = customerSubline(c);
                      const postalCity = [c.postalCode, c.city].filter(Boolean).join(" ") || "—";
                      const countryCode = ((c.country ?? "BE").trim() || "BE").slice(0, 2).toUpperCase();
                      return (
                        <div
                          key={c.id}
                          className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_140px] gap-4 px-5 py-3 items-center hover:bg-muted/30 transition-colors text-sm"
                        >
                          <div className="min-w-0">
                            <div className="font-medium text-foreground truncate">{c.name || "—"}</div>
                            {sub ? <div className="text-xs text-muted-foreground truncate">{sub}</div> : null}
                          </div>
                          <div className="min-w-0 text-foreground/80 truncate" title={countryCode}>
                            <span className="block truncate">{getCountryName(countryCode, lang)}</span>
                            <span className="text-[11px] text-muted-foreground font-mono">{countryCode}</span>
                          </div>
                          <div className="text-foreground/80 truncate">{c.street || "—"}</div>
                          <div className="text-foreground/80 truncate">{postalCity}</div>
                          <div className="font-mono text-xs text-foreground/80 truncate">{c.vatNumber || "—"}</div>
                          <div className="flex justify-end gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openExisting(c)} aria-label={t("view")}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openExisting(c)} aria-label={t("edit")}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:text-destructive"
                              onClick={() => setDeleteId(c.id)}
                              aria-label={t("delete")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {filteredCustomers.length > 0 && (
                  <DataPagination
                    page={currentPage}
                    pageSize={pageSize}
                    totalItems={filteredCustomers.length}
                    onPageChange={setPage}
                    onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
                  />
                )}
              </>
            )}
          </Card>
        </div>
      )
      }

      {
        tab === "invoice" && (
          <Card className="max-w-3xl mx-auto p-6 shadow-card">
            <div className="flex items-center justify-center gap-16 border-b border-border pb-3 mb-6">
              <button
                onClick={() => setInvoiceTab("open")}
                className={cn(
                  "text-sm font-medium transition-colors",
                  invoiceTab === "open" ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t("open")}
              </button>
              <button
                onClick={() => setInvoiceTab("history")}
                className={cn(
                  "text-sm font-medium transition-colors",
                  invoiceTab === "history" ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t("historyTab")}
              </button>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="text-sm">{t("period")} :</Label>
                <div className="flex items-center gap-2">
                  <DateField value={from} onChange={setFrom} />
                  <span className="text-xs text-muted-foreground">{t("until")}</span>
                  <DateField value={to} onChange={setTo} />
                </div>
              </div>
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="text-sm">{t("paymentMethod")} :</Label>
                <Select defaultValue="overwrite">
                  <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overwrite">{t("overwrite")}</SelectItem>
                    <SelectItem value="all">{t("all")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t border-border pt-5">
                <div className="grid grid-cols-[1fr_180px] gap-4 items-center">
                  <div className="text-sm text-muted-foreground">{t("customer")}</div>
                  <div className="text-sm text-muted-foreground text-right">{t("openInclVat")}</div>
                </div>
                <div className="py-10 text-center text-sm text-muted-foreground">—</div>
              </div>
            </div>
          </Card>
        )
      }

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setEditingCustomerId(null);
            setCustomerForm(emptyCustomerForm());
            setCustomerSaving(false);
          }
        }}
      >
        <DialogContent className="max-w-xl p-0 overflow-hidden [&>button:last-child]:hidden">
          <DialogTitle className="sr-only">
            {editingCustomerId ? t("edit") : t("newCustomer")}
          </DialogTitle>
          <DialogDescription className="sr-only">{t("customerData")}</DialogDescription>
          <div className="flex items-center justify-center gap-16 border-b border-border px-6 pt-5 pb-3 relative">
            <button
              type="button"
              onClick={() => setModalTab("general")}
              className={cn(
                "text-sm font-medium pb-2 -mb-3 border-b-2 transition-colors",
                modalTab === "general" ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
              )}
            >
              {t("general")}
            </button>
            <button
              type="button"
              onClick={() => setModalTab("advanced")}
              className={cn(
                "text-sm font-medium pb-2 -mb-3 border-b-2 transition-colors",
                modalTab === "advanced" ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
              )}
            >
              {t("advanced")}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto px-8 py-6">
            {modalTab === "general" ? (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">{t("customerData")} :</h3>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("companyNameLabel")} :</Label>
                  <Input
                    className="h-9"
                    value={customerForm.companyName}
                    onChange={(e) => setCustomerForm((p) => ({ ...p, companyName: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("name")} :</Label>
                  <Input
                    className="h-9"
                    value={customerForm.name}
                    onChange={(e) => setCustomerForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("firstName")} :</Label>
                  <Input
                    className="h-9"
                    value={customerForm.firstName}
                    onChange={(e) => setCustomerForm((p) => ({ ...p, firstName: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("attentionOf")} :</Label>
                  <Input
                    className="h-9"
                    value={customerForm.attention}
                    onChange={(e) => setCustomerForm((p) => ({ ...p, attention: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("streetAndNr")} :</Label>
                  <Input
                    className="h-9"
                    value={customerForm.street}
                    onChange={(e) => setCustomerForm((p) => ({ ...p, street: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("postcode")} :</Label>
                  <Input
                    className="h-9 w-32"
                    value={customerForm.postalCode}
                    onChange={(e) => setCustomerForm((p) => ({ ...p, postalCode: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("cityLabel")} :</Label>
                  <Input
                    className="h-9"
                    value={customerForm.city}
                    onChange={(e) => setCustomerForm((p) => ({ ...p, city: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("country")} :</Label>
                  <Select
                    value={customerForm.country}
                    onValueChange={(v) => setCustomerForm((p) => ({ ...p, country: v }))}
                  >
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
                  <Input
                    className="h-9"
                    value={customerForm.vatNumber}
                    onChange={(e) => setCustomerForm((p) => ({ ...p, vatNumber: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("phone")} :</Label>
                  <Input
                    className="h-9"
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("email")} :</Label>
                  <Input
                    className="h-9"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("paymentTerm")} :</Label>
                  <Select
                    value={customerForm.paymentTerm}
                    onValueChange={(v) => setCustomerForm((p) => ({ ...p, paymentTerm: v }))}
                  >
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
                    onClick={() =>
                      setCustomerForm((p) => ({
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
                  <Input
                    className="h-9"
                    value={customerForm.deliveryCompany}
                    onChange={(e) => setCustomerForm((p) => ({ ...p, deliveryCompany: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("streetAndNr")} :</Label>
                  <Input
                    className="h-9"
                    value={customerForm.deliveryStreet}
                    onChange={(e) => setCustomerForm((p) => ({ ...p, deliveryStreet: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("postcode")} :</Label>
                  <Input
                    className="h-9 w-32"
                    value={customerForm.deliveryPostal}
                    onChange={(e) => setCustomerForm((p) => ({ ...p, deliveryPostal: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("cityLabel")} :</Label>
                  <Input
                    className="h-9"
                    value={customerForm.deliveryCity}
                    onChange={(e) => setCustomerForm((p) => ({ ...p, deliveryCity: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("country")} :</Label>
                  <Select
                    value={customerForm.deliveryCountry}
                    onValueChange={(v) => setCustomerForm((p) => ({ ...p, deliveryCountry: v }))}
                  >
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
                  <Textarea
                    rows={3}
                    value={customerForm.notes}
                    onChange={(e) => setCustomerForm((p) => ({ ...p, notes: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("creditTag")} :</Label>
                  <Input
                    className="h-9"
                    value={customerForm.creditTag}
                    onChange={(e) => setCustomerForm((p) => ({ ...p, creditTag: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("discountPercent")} :</Label>
                  <Input
                    className="h-9"
                    value={customerForm.discount}
                    onChange={(e) => setCustomerForm((p) => ({ ...p, discount: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("priceGroupLabel")} :</Label>
                  <Select
                    value={customerForm.priceGroup}
                    onValueChange={(v) => setCustomerForm((p) => ({ ...p, priceGroup: v }))}
                  >
                    <SelectTrigger className="h-9 min-w-[12rem] w-full max-w-md">
                      <SelectValue placeholder={t("disabledLabel")} />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="off">{t("disabledLabel")}</SelectItem>
                      {orphanedPriceGroupName ? (
                        <SelectItem value={orphanedPriceGroupName}>{orphanedPriceGroupName}</SelectItem>
                      ) : null}
                      {priceGroups.map((pg) => (
                        <SelectItem key={pg.id} value={pg.name}>
                          {pg.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="pt-3 grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("email2")} :</Label>
                  <Input
                    className="h-9"
                    value={customerForm.email2}
                    onChange={(e) => setCustomerForm((p) => ({ ...p, email2: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("email3")} :</Label>
                  <Input
                    className="h-9"
                    value={customerForm.email3}
                    onChange={(e) => setCustomerForm((p) => ({ ...p, email3: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-center pb-6 border-t border-border pt-4">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              disabled={customerSaving}
              onClick={() => void handleSaveCustomer()}
            >
              {customerSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </AppLayout>
  );
};

export default Customers;
