import { useCallback, useEffect, useMemo, useState } from "react";
import { Truck, Plus, Save, Eye, Pencil, Trash2, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { DataPagination } from "@/components/DataPagination";
import { COUNTRY_CODES, getCountryName, getSortedCountryCodes } from "@/lib/countries";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TranslationKey } from "@/lib/translations";
import { apiRequest } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type SupplierForm = {
  companyName: string;
  vatNumber: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  remarks: string;
};

type SupplierRow = SupplierForm & { id: string };

const emptyForm: SupplierForm = {
  companyName: "", vatNumber: "", street: "", postalCode: "",
  city: "", country: "BE", phone: "", email: "", remarks: "",
};

type SupplierFieldErrorKey = Partial<Record<keyof SupplierForm, TranslationKey>>;

function getSupplierFieldErrors(form: SupplierForm): SupplierFieldErrorKey {
  const e: SupplierFieldErrorKey = {};

  const company = form.companyName.trim();
  if (!company) e.companyName = "supplierValCompanyRequired";
  else if (company.length < 2) e.companyName = "supplierValCompanyShort";
  else if (company.length > 100) e.companyName = "supplierValCompanyLong";

  const vat = form.vatNumber.trim();
  if (vat) {
    if (
      vat.length < 3
      || vat.length > 50
      || !/^[\dA-Za-z][-\dA-Za-z\s.+/]{1,48}[\dA-Za-z]$/.test(vat)
    ) {
      e.vatNumber = "supplierValVatFormat";
    }
  }

  const street = form.street.trim();
  if (!street) e.street = "supplierValStreetRequired";
  else if (street.length < 2) e.street = "supplierValStreetShort";

  const postal = form.postalCode.trim();
  if (!postal) e.postalCode = "supplierValPostalRequired";
  else if (postal.length < 2 || postal.length > 15 || !/^[A-Za-z0-9](?:[A-Za-z0-9\s-]{0,13}[A-Za-z0-9])?$/.test(postal)) {
    e.postalCode = "supplierValPostalFormat";
  }

  const city = form.city.trim();
  if (!city) e.city = "supplierValCityRequired";
  else if (city.length < 2) e.city = "supplierValCityShort";

  const country = (form.country || "").trim().toUpperCase();
  if (!country || !COUNTRY_CODES.includes(country)) e.country = "supplierValCountryInvalid";

  const phone = form.phone.trim();
  if (phone) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 6 || phone.length > 30) e.phone = "supplierValPhoneFormat";
  }

  const email = form.email.trim();
  if (email) {
    if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      e.email = "supplierValEmailFormat";
    }
  }

  if (form.remarks.length > 1000) e.remarks = "supplierValRemarksMax";

  return e;
}

function rowFromApi(r: Record<string, unknown>): SupplierRow {
  return {
    id: String(r.id ?? ""),
    companyName: String(r.companyName ?? ""),
    vatNumber: String(r.vatNumber ?? ""),
    street: String(r.street ?? ""),
    postalCode: String(r.postalCode ?? ""),
    city: String(r.city ?? ""),
    country: String(r.country ?? "BE") || "BE",
    phone: String(r.phone ?? ""),
    email: String(r.email ?? ""),
    remarks: String(r.remarks ?? ""),
  };
}

const Suppliers = () => {
  const { t, lang } = useLanguage();
  const sortedCountryCodes = useMemo(() => getSortedCountryCodes(lang), [lang]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"create" | "view" | "edit" | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<SupplierFieldErrorKey>({});
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await apiRequest<Array<Record<string, unknown>>>("/api/suppliers");
      setSuppliers((Array.isArray(rows) ? rows : []).map(rowFromApi).filter((r) => r.id));
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Failed to load suppliers.",
      });
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  const totalPages = Math.max(1, Math.ceil(suppliers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageRows = suppliers.slice(pageStart, pageStart + pageSize);

  const update = <K extends keyof SupplierForm>(k: K, v: SupplierForm[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
    setFieldErrors((prev) => {
      if (!prev[k]) return prev;
      const next = { ...prev };
      delete next[k];
      return next;
    });
  };

  const openCreate = () => {
    setForm(emptyForm);
    setFieldErrors({});
    setActiveId(null);
    setMode("create");
  };

  const openView = (row: SupplierRow) => {
    setForm({ ...row });
    setFieldErrors({});
    setActiveId(row.id);
    setMode("view");
  };

  const openEdit = (row: SupplierRow) => {
    setForm({ ...row });
    setFieldErrors({});
    setActiveId(row.id);
    setMode("edit");
  };

  const handleSave = async () => {
    const errs = getSupplierFieldErrors(form);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      const first = (Object.keys(errs) as (keyof SupplierForm)[])[0];
      const key = errs[first];
      if (key) toast({ variant: "destructive", description: t(key) });
      return;
    }
    setFieldErrors({});
    const companyName = form.companyName.trim();
    setSaving(true);
    try {
      if (mode === "create") {
        const created = await apiRequest<Record<string, unknown>>("/api/suppliers", {
          method: "POST",
          body: JSON.stringify({
            companyName,
            vatNumber: form.vatNumber.trim() || null,
            street: form.street.trim() || null,
            postalCode: form.postalCode.trim() || null,
            city: form.city.trim() || null,
            country: form.country || "BE",
            phone: form.phone.trim() || null,
            email: form.email.trim() || null,
            remarks: form.remarks.trim() || null,
          }),
        });
        setSuppliers((prev) => [...prev, rowFromApi(created)].sort((a, b) => a.companyName.localeCompare(b.companyName)));
      } else if (mode === "edit" && activeId) {
        const updated = await apiRequest<Record<string, unknown>>(`/api/suppliers/${activeId}`, {
          method: "PATCH",
          body: JSON.stringify({
            companyName,
            vatNumber: form.vatNumber.trim() || null,
            street: form.street.trim() || null,
            postalCode: form.postalCode.trim() || null,
            city: form.city.trim() || null,
            country: form.country || "BE",
            phone: form.phone.trim() || null,
            email: form.email.trim() || null,
            remarks: form.remarks.trim() || null,
          }),
        });
        const next = rowFromApi(updated);
        setSuppliers((prev) =>
          prev.map((s) => (s.id === next.id ? next : s)).sort((a, b) => a.companyName.localeCompare(b.companyName)),
        );
      }
      setMode(null);
      toast({
        description: lang === "nl" ? "Leverancier opgeslagen." : "Supplier saved.",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Failed to save supplier.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    const nextLen = suppliers.filter((s) => s.id !== id).length;
    try {
      await apiRequest(`/api/suppliers/${id}`, { method: "DELETE" });
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
      setDeleteId(null);
      setPage((p) => Math.min(p, Math.max(1, Math.ceil(nextLen / pageSize))));
      toast({
        description: lang === "nl" ? "Leverancier verwijderd." : "Supplier deleted.",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Failed to delete supplier.",
      });
    }
  };

  const readOnly = mode === "view";
  const dialogOpen = mode !== null;
  const title =
    mode === "create" ? t("newSupplier")
      : mode === "edit" ? t("edit")
        : t("details");

  return (
    <AppLayout>

      <div className="flex items-center justify-center">
        <PageHeader
          title={t("suppliers")}
          icon={<Truck className="h-5 w-5" />}
          actions={
            <Button
              size="sm"
              onClick={openCreate}
              disabled={loading}
              className="gap-1.5 bg-gradient-primary text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> {t("newSupplier")}
            </Button>
          }
        />
      </div>
      <Card className="overflow-hidden shadow-card max-w-7xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_1fr_1fr_140px] gap-4 px-5 py-3 border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <div className="text-primary">{t("name")}</div>
              <div>{t("street")}</div>
              <div>{t("city")}</div>
              <div className="text-right">{t("actions")}</div>
            </div>
            <div className="divide-y divide-border">
              {pageRows.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">—</div>
              ) : (
                pageRows.map((s) => (
                  <div
                    key={s.id}
                    className="grid grid-cols-[1fr_1fr_1fr_140px] gap-4 px-5 py-3 items-center hover:bg-muted/30 text-sm"
                  >
                    <div className="font-medium text-foreground truncate">{s.companyName}</div>
                    <div className="text-foreground/80 truncate">{s.street || "—"}</div>
                    <div className="text-foreground/80 truncate">{s.city || "—"}</div>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openView(s)} aria-label={t("view")}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)} aria-label={t("edit")}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:text-destructive"
                        onClick={() => setDeleteId(s.id)}
                        aria-label={t("delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {suppliers.length > 0 && (
              <DataPagination
                page={currentPage}
                pageSize={pageSize}
                totalItems={suppliers.length}
                onPageChange={setPage}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
              />
            )}
          </>
        )}
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (!o) {
            setMode(null);
            setFieldErrors({});
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="sr-only">{title}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {[
              { k: "companyName", label: t("companyNameLabel") },
              { k: "vatNumber", label: t("vatNumber") },
              { k: "street", label: t("street") },
              { k: "postalCode", label: t("postalCode") },
              { k: "city", label: t("city") },
            ].map((f) => {
              const k = f.k as keyof SupplierForm;
              const errKey = fieldErrors[k];
              return (
                <div key={f.k} className="grid grid-cols-[140px_1fr] items-start gap-3">
                  <Label className="text-sm pt-2">{f.label} :</Label>
                  <div className="space-y-1 min-w-0">
                    <Input
                      value={form[k]}
                      onChange={(e) => update(k, e.target.value)}
                      maxLength={100}
                      readOnly={readOnly}
                      aria-invalid={!!errKey}
                      className={cn("h-9", errKey && "border-destructive focus-visible:ring-destructive")}
                    />
                    {errKey && <p className="text-xs text-destructive">{t(errKey)}</p>}
                  </div>
                </div>
              );
            })}

            <div className="grid grid-cols-[140px_1fr] items-start gap-3">
              <Label className="text-sm pt-2">{t("country")} :</Label>
              <div className="space-y-1 min-w-0">
                <Select value={form.country} onValueChange={(v) => update("country", v)} disabled={readOnly}>
                  <SelectTrigger
                    aria-invalid={!!fieldErrors.country}
                    className={cn("h-9", fieldErrors.country && "border-destructive focus:ring-destructive")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {sortedCountryCodes.map((code) => (
                      <SelectItem key={code} value={code}>{getCountryName(code, lang)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.country && <p className="text-xs text-destructive">{t(fieldErrors.country)}</p>}
              </div>
            </div>

            <div className="grid grid-cols-[140px_1fr] items-start gap-3">
              <Label className="text-sm pt-2">{t("phone")} :</Label>
              <div className="space-y-1 min-w-0">
                <Input
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  maxLength={30}
                  readOnly={readOnly}
                  aria-invalid={!!fieldErrors.phone}
                  className={cn("h-9", fieldErrors.phone && "border-destructive focus-visible:ring-destructive")}
                />
                {fieldErrors.phone && <p className="text-xs text-destructive">{t(fieldErrors.phone)}</p>}
              </div>
            </div>

            <div className="grid grid-cols-[140px_1fr] items-start gap-3">
              <Label className="text-sm pt-2">{t("emailAddress")} :</Label>
              <div className="space-y-1 min-w-0">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  maxLength={255}
                  readOnly={readOnly}
                  aria-invalid={!!fieldErrors.email}
                  className={cn("h-9", fieldErrors.email && "border-destructive focus-visible:ring-destructive")}
                />
                {fieldErrors.email && <p className="text-xs text-destructive">{t(fieldErrors.email)}</p>}
              </div>
            </div>

            <div className="grid grid-cols-[140px_1fr] items-start gap-3">
              <Label className="text-sm pt-2">{t("remarks")} :</Label>
              <div className="space-y-1 min-w-0">
                <Textarea
                  value={form.remarks}
                  onChange={(e) => update("remarks", e.target.value)}
                  maxLength={1000}
                  readOnly={readOnly}
                  aria-invalid={!!fieldErrors.remarks}
                  className={cn(
                    "min-h-[100px] resize-none",
                    fieldErrors.remarks && "border-destructive focus-visible:ring-destructive",
                  )}
                />
                {fieldErrors.remarks && <p className="text-xs text-destructive">{t(fieldErrors.remarks)}</p>}
              </div>
            </div>

            {!readOnly && (
              <div className="flex justify-center pt-2">
                <Button variant="ghost" onClick={() => void handleSave()} disabled={saving} className="gap-2 text-foreground">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {t("save")}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        onConfirm={() => void handleDelete()}
      />
    </AppLayout>
  );
};

export default Suppliers;
