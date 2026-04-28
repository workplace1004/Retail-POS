import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Plus, FileBarChart, Users as UsersIcon, Settings, ChevronRight, Pencil, Trash2, Save, Video } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { TabsBar } from "@/components/TabsBar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { TranslationKey } from "@/lib/translations";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { NewDocumentDialog } from "@/components/invoicing/NewDocumentDialog";
import { DataPagination } from "@/components/DataPagination";

type InvoicingDocumentLayoutOptions = {
  firstInvoiceNr: number;
  firstQuotationNr: number;
  firstCreditNoteNr: number;
  firstDeliveryNoteNr: number;
  companyInfoLines: string[];
  footerText: string;
  logoDataUrl: string;
  companyNameSize: "hidden" | "small" | "standard" | "large";
  showTotalIncl: boolean;
  showPriceIncl: boolean;
  showPriceExcl: boolean;
  showTotalExcl: boolean;
  showVatPercent: boolean;
};

const DEFAULT_DOCUMENT_LAYOUT_OPTIONS: InvoicingDocumentLayoutOptions = {
  firstInvoiceNr: 1,
  firstQuotationNr: 1,
  firstCreditNoteNr: 1,
  firstDeliveryNoteNr: 0,
  companyInfoLines: ["", "", "", "", "", ""],
  footerText: "",
  logoDataUrl: "",
  companyNameSize: "standard",
  showTotalIncl: false,
  showPriceIncl: true,
  showPriceExcl: true,
  showTotalExcl: false,
  showVatPercent: false,
};

const Invoicing = () => {
  const { t } = useLanguage();
  const [tab, setTab] = useState("docs");
  const [perTab, setPerTab] = useState<"all" | "open">("open");
  const [settingsTab, setSettingsTab] = useState<"layouts" | "doc" | "general">("layouts");
  const [activeLayout, setActiveLayout] = useState("");
  const [layouts, setLayouts] = useState<string[]>([]);
  const [newLayout, setNewLayout] = useState("");
  const [newDocOpen, setNewDocOpen] = useState(false);
  const [docsPage, setDocsPage] = useState(1);
  const [docsPageSize, setDocsPageSize] = useState(10);
  const [perPage, setPerPage] = useState(1);
  const [perPageSize, setPerPageSize] = useState(10);
  const [docLayoutOptions, setDocLayoutOptions] = useState<InvoicingDocumentLayoutOptions>(DEFAULT_DOCUMENT_LAYOUT_OPTIONS);
  const [docLayoutSaving, setDocLayoutSaving] = useState(false);

  const tabs = [
    { id: "docs", label: t("salesDocuments"), icon: <FileBarChart className="h-4 w-4" /> },
    { id: "per", label: t("perCustomer"), icon: <UsersIcon className="h-4 w-4" /> },
    { id: "settings", label: t("settings"), icon: <Settings className="h-4 w-4" /> },
  ];

  const monthOptions = [
    { value: "all", label: t("allMonths") },
    { value: "q1", label: t("q1") },
    { value: "q2", label: t("q2") },
    { value: "q3", label: t("q3") },
    { value: "q4", label: t("q4") },
    { value: "1", label: t("january") },
    { value: "2", label: t("february") },
    { value: "3", label: t("march") },
    { value: "4", label: t("april") },
    { value: "5", label: t("may") },
    { value: "6", label: t("june") },
    { value: "7", label: t("july") },
    { value: "8", label: t("august") },
    { value: "9", label: t("september") },
    { value: "10", label: t("october") },
    { value: "11", label: t("november") },
    { value: "12", label: t("december") },
  ];

  const yearOptions = Array.from({ length: 11 }).map((_, i) => String(2021 + i));

  const customerRows = [
    { name: "TestCustomer", total: "8.34" },
    { name: "pospoint", total: "5.62" },
  ];

  const docRows: { number: string; date: string; customer: string; total: string; status: string }[] = [];

  const pagedDocRows = useMemo(() => {
    const start = (docsPage - 1) * docsPageSize;
    return docRows.slice(start, start + docsPageSize);
  }, [docRows, docsPage, docsPageSize]);

  const pagedCustomerRows = useMemo(() => {
    const start = (perPage - 1) * perPageSize;
    return customerRows.slice(start, start + perPageSize);
  }, [customerRows, perPage, perPageSize]);

  const settingsNav: { id: typeof settingsTab; label: TranslationKey }[] = [
    { id: "layouts", label: "manageLayouts" },
    { id: "doc", label: "documentLayout" },
    { id: "general", label: "generalSettingsInv" },
  ];

  const saveLayouts = useCallback(async (nextLayouts: string[]) => {
    await apiRequest<{ value: string[] }>("/api/settings/invoicing-layouts", {
      method: "PUT",
      body: JSON.stringify({ value: nextLayouts }),
    });
  }, []);

  const loadLayouts = useCallback(async () => {
    try {
      const response = await apiRequest<{ value: string[] }>("/api/settings/invoicing-layouts");
      const values = Array.isArray(response?.value) ? response.value : [];
      setLayouts(values);
      setActiveLayout((prev) => (prev && values.includes(prev) ? prev : (values[0] ?? "")));
    } catch {
      setLayouts([]);
      setActiveLayout("");
    }
  }, []);

  useEffect(() => {
    void loadLayouts();
  }, [loadLayouts]);

  const loadDocumentLayoutOptions = useCallback(async (layoutName: string) => {
    if (!layoutName) {
      setDocLayoutOptions(DEFAULT_DOCUMENT_LAYOUT_OPTIONS);
      return;
    }
    try {
      const response = await apiRequest<{ value: InvoicingDocumentLayoutOptions }>(
        `/api/settings/invoicing-document-layout/${encodeURIComponent(layoutName)}`
      );
      const value = response?.value;
      if (!value) {
        setDocLayoutOptions(DEFAULT_DOCUMENT_LAYOUT_OPTIONS);
        return;
      }
      setDocLayoutOptions({
        firstInvoiceNr: Number(value.firstInvoiceNr) || 0,
        firstQuotationNr: Number(value.firstQuotationNr) || 0,
        firstCreditNoteNr: Number(value.firstCreditNoteNr) || 0,
        firstDeliveryNoteNr: Number(value.firstDeliveryNoteNr) || 0,
        companyInfoLines: Array.from({ length: 6 }).map((_, idx) => String(value.companyInfoLines?.[idx] ?? "")),
        footerText: String(value.footerText ?? ""),
        logoDataUrl: String(value.logoDataUrl ?? ""),
        companyNameSize: (["hidden", "small", "standard", "large"].includes(String(value.companyNameSize))
          ? value.companyNameSize
          : "standard") as InvoicingDocumentLayoutOptions["companyNameSize"],
        showTotalIncl: value.showTotalIncl === true,
        showPriceIncl: value.showPriceIncl === true,
        showPriceExcl: value.showPriceExcl === true,
        showTotalExcl: value.showTotalExcl === true,
        showVatPercent: value.showVatPercent === true,
      });
    } catch {
      setDocLayoutOptions(DEFAULT_DOCUMENT_LAYOUT_OPTIONS);
    }
  }, []);

  useEffect(() => {
    void loadDocumentLayoutOptions(activeLayout);
  }, [activeLayout, loadDocumentLayoutOptions]);

  const saveDocumentLayoutOptions = async () => {
    if (!activeLayout) return;
    setDocLayoutSaving(true);
    try {
      await apiRequest(`/api/settings/invoicing-document-layout/${encodeURIComponent(activeLayout)}`, {
        method: "PUT",
        body: JSON.stringify({ value: docLayoutOptions }),
      });
      toast({ description: t("invoicingDocLayoutSaved") });
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : t("saveFailedGeneric"),
      });
    } finally {
      setDocLayoutSaving(false);
    }
  };

  const onLogoFileChange = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl.startsWith("data:image/")) return;
      setDocLayoutOptions((prev) => ({ ...prev, logoDataUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  };


  const addLayout = async () => {
    const name = newLayout.trim();
    if (!name) return;
    const next = layouts.includes(name) ? layouts : [...layouts, name];
    setLayouts(next);
    if (!activeLayout) setActiveLayout(name);
    try {
      await saveLayouts(next);
    } catch {
      void loadLayouts();
    }
    setNewLayout("");
  };

  const removeLayout = async (name: string) => {
    const next = layouts.filter((l) => l !== name);
    setLayouts(next);
    if (activeLayout === name) setActiveLayout(next[0] ?? "");
    try {
      await saveLayouts(next);
    } catch {
      void loadLayouts();
    }
  };


  const LayoutTabs = () => (
    <div className="flex items-center gap-6 justify-center pb-3 border-b border-border mb-5">
      {layouts.map((l) => {
        const isActive = activeLayout === l;
        return (
          <button
            key={l}
            onClick={() => setActiveLayout(l)}
            className={cn(
              "text-sm font-medium transition-colors",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {l}
          </button>
        );
      })}
    </div>
  );

  const FormRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="grid grid-cols-[180px_1fr] items-center gap-4 py-1.5">
      <label className="text-sm text-foreground">{label} :</label>
      <div>{children}</div>
    </div>
  );

  return (
    <AppLayout>

      <TabsBar tabs={tabs} active={tab} onChange={setTab} />

      {tab === "docs" && (
        <>
          <div className="flex flex-wrap gap-3 mb-4 justify-center">
            <Button
              size="sm"
              onClick={() => setNewDocOpen(true)}
              className="gap-1.5 bg-gradient-primary text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> {t("newDocument")}
            </Button>
            <Select defaultValue="invoices">
              <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="invoices">{t("invoices")}</SelectItem>
                <SelectItem value="quotations">{t("quotations")}</SelectItem>
                <SelectItem value="credit">{t("creditNotes")}</SelectItem>
                <SelectItem value="delivery">{t("deliveryNotes")}</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="all">
              <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select defaultValue="2026">
              <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card className="overflow-hidden shadow-card max-w-7xl mx-auto">
            <div className="grid grid-cols-6 gap-4 px-5 py-3 border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <div>{t("number")}</div>
              <div>{t("date")}</div>
              <div className="col-span-2">{t("customer")}</div>
              <div className="text-right">{t("total")}</div>
              <div className="text-right">{t("sent")} / {t("paid")}</div>
            </div>
            {pagedDocRows.length === 0 ? (
              <div className="px-5 py-16 text-center text-sm  text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>—</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {pagedDocRows.map((r, idx) => (
                  <div key={idx} className="grid grid-cols-6 gap-4 px-5 py-3 items-center text-sm">
                    <div>{r.number}</div>
                    <div>{r.date}</div>
                    <div className="col-span-2">{r.customer}</div>
                    <div className="text-right font-mono">{r.total}</div>
                    <div className="text-right">{r.status}</div>
                  </div>
                ))}
              </div>
            )}
            <DataPagination
              page={docsPage}
              pageSize={docsPageSize}
              totalItems={docRows.length}
              onPageChange={setDocsPage}
              onPageSizeChange={(s) => { setDocsPageSize(s); setDocsPage(1); }}
            />
          </Card>
        </>
      )}

      {tab === "per" && (
        <Card className="max-w-3xl mx-auto p-6 shadow-card">
          <div className="flex items-center justify-center gap-16 border-b border-border pb-3 mb-5">
            <button
              onClick={() => setPerTab("all")}
              className={cn(
                "text-sm font-medium transition-colors",
                perTab === "all" ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("allLabel")}
            </button>
            <button
              onClick={() => setPerTab("open")}
              className={cn(
                "text-sm font-medium transition-colors",
                perTab === "open" ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("openLabel")}
            </button>
          </div>

          <div className="grid grid-cols-[1fr_180px_40px] gap-4 px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
            <div>{t("customer")}</div>
            <div className="text-right">{t("totalInclVat")}</div>
            <div />
          </div>
          <div className="divide-y divide-border">
            {pagedCustomerRows.map((c) => (
              <div key={c.name} className="grid grid-cols-[1fr_180px_40px] gap-4 px-2 py-3 items-center hover:bg-muted/30 transition-colors text-sm">
                <div className="font-medium text-foreground">{c.name}</div>
                <div className="text-right font-mono">{c.total}</div>
                <div className="flex justify-end">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
          <DataPagination
            page={perPage}
            pageSize={perPageSize}
            totalItems={customerRows.length}
            onPageChange={setPerPage}
            onPageSizeChange={(s) => { setPerPageSize(s); setPerPage(1); }}
            className="-mx-6 -mb-6 mt-4"
          />
        </Card>
      )}

      {tab === "settings" && (
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 max-w-6xl mx-auto">
          {/* Left nav */}
          <Card className="p-2 h-fit shadow-card">
            <div className="flex flex-col">
              {settingsNav.map((s) => {
                const isActive = settingsTab === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSettingsTab(s.id)}
                    className={cn(
                      "text-left px-4 py-2.5 text-sm rounded-md transition-colors",
                      isActive ? "text-primary font-medium bg-primary/5" : "text-foreground hover:bg-muted/50"
                    )}
                  >
                    {t(s.label)}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Right panel */}
          <div className="space-y-4">
            {settingsTab === "layouts" && (
              <Card className="p-6 shadow-card max-w-md">
                <div className="flex items-center gap-2 mb-4">
                  <Input
                    value={newLayout}
                    onChange={(e) => setNewLayout(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addLayout()}
                    className="h-9"
                  />
                  <Button size="icon" variant="ghost" onClick={addLayout} className="text-primary">
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>
                <div className="divide-y divide-border border border-border rounded-md">
                  {layouts.length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                      <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
                      <p>No layouts yet.</p>
                    </div>
                  ) : (
                    layouts.map((l) => (
                      <div key={l} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <span className="text-foreground">{l}</span>
                        <div className="flex items-center gap-2">
                          <button className="text-muted-foreground hover:text-primary"><Pencil className="h-4 w-4" /></button>
                          <button className="text-muted-foreground hover:text-destructive" onClick={() => removeLayout(l)}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            )}

            {settingsTab === "doc" && (
              <Card className="p-6 shadow-card">
                <LayoutTabs />
                <div className="max-w-2xl mx-auto space-y-1">
                  <FormRow label={t("firstInvoiceNr")}>
                    <Input
                      type="number"
                      value={String(docLayoutOptions.firstInvoiceNr)}
                      onChange={(e) =>
                        setDocLayoutOptions((prev) => ({ ...prev, firstInvoiceNr: Number(e.target.value) || 0 }))
                      }
                      className="h-9 max-w-xs"
                    />
                  </FormRow>
                  <FormRow label={t("firstQuotationNr")}>
                    <Input
                      type="number"
                      value={String(docLayoutOptions.firstQuotationNr)}
                      onChange={(e) =>
                        setDocLayoutOptions((prev) => ({ ...prev, firstQuotationNr: Number(e.target.value) || 0 }))
                      }
                      className="h-9 max-w-xs"
                    />
                  </FormRow>
                  <FormRow label={t("firstCreditNoteNr")}>
                    <Input
                      type="number"
                      value={String(docLayoutOptions.firstCreditNoteNr)}
                      onChange={(e) =>
                        setDocLayoutOptions((prev) => ({ ...prev, firstCreditNoteNr: Number(e.target.value) || 0 }))
                      }
                      className="h-9 max-w-xs"
                    />
                  </FormRow>
                  <FormRow label={t("firstDeliveryNoteNr")}>
                    <Input
                      type="number"
                      value={String(docLayoutOptions.firstDeliveryNoteNr)}
                      onChange={(e) =>
                        setDocLayoutOptions((prev) => ({ ...prev, firstDeliveryNoteNr: Number(e.target.value) || 0 }))
                      }
                      className="h-9 max-w-xs"
                    />
                  </FormRow>
                  <div className="grid grid-cols-[180px_1fr] items-start gap-4 py-2">
                    <label className="text-sm text-foreground pt-2">{t("companyInfo")} :</label>
                    <div className="space-y-2 max-w-md">
                      {docLayoutOptions.companyInfoLines.map((line, i) => (
                        <Input
                          key={i}
                          value={line}
                          onChange={(e) =>
                            setDocLayoutOptions((prev) => ({
                              ...prev,
                              companyInfoLines: prev.companyInfoLines.map((item, idx) => (idx === i ? e.target.value : item)),
                            }))
                          }
                          className="h-9"
                        />
                      ))}
                    </div>
                  </div>
                  <FormRow label={t("footerTextInv")}>
                    <Input
                      value={docLayoutOptions.footerText}
                      onChange={(e) => setDocLayoutOptions((prev) => ({ ...prev, footerText: e.target.value }))}
                      className="h-9 max-w-md"
                    />
                  </FormRow>
                  <FormRow label={t("companyNameSize")}>
                    <Select
                      value={docLayoutOptions.companyNameSize}
                      onValueChange={(value) =>
                        setDocLayoutOptions((prev) => ({
                          ...prev,
                          companyNameSize: value as InvoicingDocumentLayoutOptions["companyNameSize"],
                        }))
                      }
                    >
                      <SelectTrigger className="h-9 max-w-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hidden">{t("sizeNotShown")}</SelectItem>
                        <SelectItem value="small">{t("sizeSmall")}</SelectItem>
                        <SelectItem value="standard">{t("sizeStandard")}</SelectItem>
                        <SelectItem value="large">{t("sizeLarge")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormRow>
                  {[
                    { k: "totalIncl", c: docLayoutOptions.showTotalIncl, field: "showTotalIncl" },
                    { k: "priceIncl", c: docLayoutOptions.showPriceIncl, field: "showPriceIncl" },
                    { k: "priceExcl", c: docLayoutOptions.showPriceExcl, field: "showPriceExcl" },
                    { k: "totalExcl", c: docLayoutOptions.showTotalExcl, field: "showTotalExcl" },
                    { k: "vatPercent", c: docLayoutOptions.showVatPercent, field: "showVatPercent" },
                  ].map((row) => (
                    <div key={row.k} className="grid grid-cols-[180px_1fr] items-center gap-4 py-1">
                      <label className="text-sm text-foreground">{t(row.k as TranslationKey)} :</label>
                      <Checkbox
                        checked={row.c}
                        onCheckedChange={(checked) =>
                          setDocLayoutOptions((prev) => ({ ...prev, [row.field]: checked === true }))
                        }
                      />
                    </div>
                  ))}
                  <div className="grid grid-cols-[180px_1fr] items-center gap-4 py-3">
                    <label className="text-sm text-foreground">{t("logoLabel")} :</label>
                    <div className="flex items-center gap-4">
                      <label className="h-16 w-24 rounded border border-border overflow-hidden cursor-pointer bg-foreground/10 flex items-center justify-center text-foreground">
                        {docLayoutOptions.logoDataUrl ? (
                          <img src={docLayoutOptions.logoDataUrl} alt="Layout logo" className="h-full w-full object-contain bg-white" />
                        ) : (
                          <Video className="h-7 w-7" />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => onLogoFileChange(e.target.files?.[0] ?? null)}
                        />
                      </label>
                      <button
                        type="button"
                        className="text-sm text-primary hover:underline"
                        onClick={() => setDocLayoutOptions((prev) => ({ ...prev, logoDataUrl: "" }))}
                      >
                        {t("removeLabel")}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-center pt-3">
                    <Button
                      variant="ghost"
                      className="gap-2 text-foreground"
                      onClick={() => void saveDocumentLayoutOptions()}
                      disabled={!activeLayout || docLayoutSaving}
                    >
                      <Save className="h-4 w-4 text-primary" /> {t("save")}
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {settingsTab === "general" && (
              <Card className="p-6 shadow-card">
                <div className="max-w-2xl mx-auto space-y-1">
                  <FormRow label={t("defaultType")}>
                    <Select>
                      <SelectTrigger className="h-9 max-w-xs"><SelectValue placeholder="" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="invoice">{t("docKindInvoice")}</SelectItem>
                        <SelectItem value="quotation">{t("docKindQuotation")}</SelectItem>
                        <SelectItem value="credit">{t("docKindCreditNote")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormRow>
                  <FormRow label={t("displayedPeriod")}>
                    <Select defaultValue="year">
                      <SelectTrigger className="h-9 max-w-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="year">{t("fullYear")}</SelectItem>
                        <SelectItem value="month">{t("currentMonth")}</SelectItem>
                        <SelectItem value="quarter">{t("currentQuarter")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormRow>
                  <FormRow label={t("vatRecalculation")}>
                    <Select defaultValue="excl">
                      <SelectTrigger className="h-9 max-w-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="excl">{t("keepExclAmount")}</SelectItem>
                        <SelectItem value="incl">{t("keepInclAmount")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormRow>
                  <FormRow label={t("notificationEmail")}><Input className="h-9 max-w-xs" /></FormRow>
                  <FormRow label={t("notifyOnQuotationOpen")}>
                    <Select defaultValue="off">
                      <SelectTrigger className="h-9 max-w-[120px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="on">{t("onLabelInv")}</SelectItem>
                        <SelectItem value="off">{t("offLabelInv")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormRow>
                  <FormRow label={t("defaultVatTicketImport")}>
                    <Select defaultValue="vat">
                      <SelectTrigger className="h-9 max-w-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vat">{t("perVatRate")}</SelectItem>
                        <SelectItem value="all">{t("allDetail")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormRow>
                  <FormRow label={t("languageOption")}>
                    <Select defaultValue="off">
                      <SelectTrigger className="h-9 max-w-[120px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="on">{t("onLabelInv")}</SelectItem>
                        <SelectItem value="off">{t("offLabelInv")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormRow>
                  <FormRow label={t("defaultAttachmentOrder")}>
                    <Select defaultValue="above">
                      <SelectTrigger className="h-9 max-w-[120px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="above">{t("above")}</SelectItem>
                        <SelectItem value="below">{t("below")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormRow>
                  <FormRow label={t("overdueInvoicesRed")}>
                    <Select defaultValue="off">
                      <SelectTrigger className="h-9 max-w-[120px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="on">{t("onLabelInv")}</SelectItem>
                        <SelectItem value="off">{t("offLabelInv")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormRow>
                  <div className="grid grid-cols-[180px_1fr] items-center gap-4 py-1.5">
                    <label className="text-sm text-foreground">{t("pdfInvoiceInEmail")} :</label>
                    <div className="flex items-center gap-3">
                      <Select defaultValue="off">
                        <SelectTrigger className="h-9 w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="on">{t("onLabelInv")}</SelectItem>
                          <SelectItem value="off">{t("offLabelInv")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground">{t("noTrackingNote")}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-[180px_1fr] items-center gap-4 py-1.5">
                    <label className="text-sm text-foreground">{t("ublInvoiceInEmail")} :</label>
                    <div className="flex items-center gap-3">
                      <Select defaultValue="off">
                        <SelectTrigger className="h-9 w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="on">{t("onLabelInv")}</SelectItem>
                          <SelectItem value="off">{t("offLabelInv")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground">{t("noTrackingNote")}</span>
                    </div>
                  </div>
                  <FormRow label={t("copyEmailAddress")}><Input className="h-9 max-w-xs" /></FormRow>
                  <FormRow label={t("insertProduct")}>
                    <Select defaultValue="with">
                      <SelectTrigger className="h-9 max-w-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="with">{t("withPrice")}</SelectItem>
                        <SelectItem value="without">{t("withoutPrice")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormRow>
                  <div className="flex justify-center pt-3">
                    <Button variant="ghost" className="gap-2 text-foreground"><Save className="h-4 w-4 text-primary" /> {t("save")}</Button>
                  </div>
                </div>
              </Card>
            )}

          </div>
        </div>
      )}

      <NewDocumentDialog open={newDocOpen} onOpenChange={setNewDocOpen} />
    </AppLayout>
  );
};

export default Invoicing;
