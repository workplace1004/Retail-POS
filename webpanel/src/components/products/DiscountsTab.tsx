import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Percent, ArrowUp, ArrowDown, CalendarIcon, X, Search } from "lucide-react";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudDialog, DeleteDialog } from "../CrudDialog";
import { DataPagination } from "../DataPagination";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { TableCardSkeleton } from "./CustomizePosSkeleton";

type TriggerType = "quantity" | "weight" | "minAmount" | "time";
type DiscountKind = "amount" | "percent" | "free" | "plusQty" | "plusWeight" | "otherPriceGroup";
type ScopeType = "products" | "categories" | "allProducts";

interface DiscountItem { id: string; label: string; }
interface ScopeOption { id: string; label: string; }

interface Discount {
  id: string;
  name: string;
  scope: ScopeType;
  scopeItem: string;
  trigger: TriggerType;
  pieces: number;
  combinable: boolean;
  kind: DiscountKind;
  value: number;
  startDate: Date;
  endDate: Date;
  items: DiscountItem[];
}

export function DiscountsTab() {
  const { t, lang } = useLanguage();
  const [items, setItems] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Discount | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<Discount | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [scopeOptions, setScopeOptions] = useState<Record<ScopeType, ScopeOption[]>>({
    products: [],
    categories: [],
    allProducts: [{ id: "__all__", label: "—" }],
  });

  const emptyForm = (): Discount => ({
    id: "",
    name: "",
    scope: "products",
    scopeItem: "",
    trigger: "quantity",
    pieces: 1,
    combinable: false,
    kind: "amount",
    value: 0,
    startDate: new Date(),
    endDate: new Date(),
    items: [],
  });
  const [form, setForm] = useState<Discount>(emptyForm());
  const [selectedItemIdx, setSelectedItemIdx] = useState<number | null>(null);

  const toDateInput = (value?: string | null) => {
    const d = value ? new Date(value) : new Date();
    return Number.isNaN(d.getTime()) ? new Date() : d;
  };
  const mapTriggerFromApi = (value?: string | null): TriggerType => {
    if (value === "weight") return "weight";
    if (value === "minAmount") return "minAmount";
    if (value === "time") return "time";
    return "quantity";
  };
  const mapTriggerToApi = (value: TriggerType) => (value === "quantity" ? "number" : value);
  const mapKindFromApi = (value?: string | null): DiscountKind => {
    if (value === "percent") return "percent";
    if (value === "free") return "free";
    if (value === "plusQty") return "plusQty";
    if (value === "plusWeight") return "plusWeight";
    if (value === "otherPriceGroup") return "otherPriceGroup";
    return "amount";
  };
  const mapScopeFromApi = (value?: string | null): ScopeType => {
    if (value === "categories") return "categories";
    if (value === "allProducts") return "allProducts";
    return "products";
  };
  const normalizeDiscountFromApi = (
    row: {
      id: string;
      name: string;
      discountOn?: string | null;
      trigger?: string | null;
      pieces?: string | number | null;
      combinable?: boolean;
      type?: string | null;
      value?: string | number | null;
      startDate?: string | null;
      endDate?: string | null;
      targetIdsJson?: string | null;
    },
    optionsByScope: Record<ScopeType, ScopeOption[]>,
  ): Discount => {
    const scope = mapScopeFromApi(row.discountOn);
    let targetIds: string[] = [];
    try {
      targetIds = row.targetIdsJson ? JSON.parse(row.targetIdsJson) : [];
    } catch {
      targetIds = [];
    }
    const scopeLookup = new Map(optionsByScope[scope].map((opt) => [opt.id, opt.label]));
    const mappedItems: DiscountItem[] = targetIds
      .filter(Boolean)
      .map((id) => ({ id: crypto.randomUUID(), label: scopeLookup.get(id) ?? id }));
    const defaultScopeItem = optionsByScope[scope][0]?.label ?? "";
    return {
      id: row.id,
      name: row.name,
      scope,
      scopeItem: mappedItems[0]?.label ?? defaultScopeItem,
      trigger: mapTriggerFromApi(row.trigger),
      pieces: Math.max(1, Number(row.pieces ?? 1) || 1),
      combinable: row.combinable === true,
      kind: mapKindFromApi(row.type),
      value: Number(row.value ?? 0) || 0,
      startDate: toDateInput(row.startDate),
      endDate: toDateInput(row.endDate),
      items: mappedItems,
    };
  };

  const loadOptionsAndDiscounts = async () => {
    setLoading(true);
    try {
      const [products, categories, discounts] = await Promise.all([
        apiRequest<Array<{ id: string; name: string }>>("/api/products/catalog"),
        apiRequest<Array<{ id: string; name: string }>>("/api/categories"),
        apiRequest<Array<{
          id: string;
          name: string;
          discountOn?: string | null;
          trigger?: string | null;
          pieces?: string | number | null;
          combinable?: boolean;
          type?: string | null;
          value?: string | number | null;
          startDate?: string | null;
          endDate?: string | null;
          targetIdsJson?: string | null;
        }>>("/api/discounts"),
      ]);
      const nextOptions: Record<ScopeType, ScopeOption[]> = {
        products: (Array.isArray(products) ? products : []).map((p) => ({ id: p.id, label: p.name })),
        categories: (Array.isArray(categories) ? categories : []).map((c) => ({ id: c.id, label: c.name })),
        allProducts: [{ id: "__all__", label: "—" }],
      };
      setScopeOptions(nextOptions);
      setItems((Array.isArray(discounts) ? discounts : []).map((row) => normalizeDiscountFromApi(row, nextOptions)));
      setForm((prev) => ({ ...prev, scopeItem: nextOptions.products[0]?.label ?? "" }));
    } catch (error) {
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "Failed to load discounts.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOptionsAndDiscounts();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const discounts = await apiRequest<Array<{
            id: string;
            name: string;
            discountOn?: string | null;
            trigger?: string | null;
            pieces?: string | number | null;
            combinable?: boolean;
            type?: string | null;
            value?: string | number | null;
            startDate?: string | null;
            endDate?: string | null;
            targetIdsJson?: string | null;
          }>>("/api/discounts");
          const next = (Array.isArray(discounts) ? discounts : []).map((row) =>
            normalizeDiscountFromApi(row, scopeOptions),
          );
          setItems(next);
        } catch {
          // Silent background refresh: keep current data if polling fails.
        }
      })();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [scopeOptions]);

  const openNew = () => {
    const next = emptyForm();
    next.scopeItem = scopeOptions.products[0]?.label ?? "";
    setEditing(null);
    setForm(next);
    setSelectedItemIdx(null);
    setOpen(true);
  };
  const openEdit = (it: Discount) => { setEditing(it); setForm({ ...it }); setSelectedItemIdx(null); setOpen(true); };
  const submit = async () => {
    try {
      const lookup = new Map(scopeOptions[form.scope].map((opt) => [opt.label, opt.id]));
      const targetIds = form.items.map((item) => lookup.get(item.label) ?? item.label).filter(Boolean);
      const payload = {
        name: form.name,
        discountOn: form.scope,
        trigger: mapTriggerToApi(form.trigger),
        pieces: form.pieces,
        combinable: form.combinable,
        type: form.kind,
        value: form.value,
        startDate: format(form.startDate, "yyyy-MM-dd"),
        endDate: format(form.endDate, "yyyy-MM-dd"),
        targetIds,
      };
      if (editing) {
        await apiRequest(`/api/discounts/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await apiRequest("/api/discounts", { method: "POST", body: JSON.stringify(payload) });
      }
      setOpen(false);
      await loadOptionsAndDiscounts();
    } catch (error) {
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "Failed to save discount.",
      });
    }
  };
  const confirmDelete = async () => {
    if (!deleteItem) return;
    try {
      await apiRequest(`/api/discounts/${deleteItem.id}`, { method: "DELETE" });
      setDeleteItem(null);
      await loadOptionsAndDiscounts();
    } catch (error) {
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "Failed to delete discount.",
      });
    }
  };

  const moveItem = (dir: -1 | 1) => {
    if (selectedItemIdx === null) return;
    const target = selectedItemIdx + dir;
    if (target < 0 || target >= form.items.length) return;
    const next = [...form.items];
    [next[selectedItemIdx], next[target]] = [next[target], next[selectedItemIdx]];
    setForm({ ...form, items: next });
    setSelectedItemIdx(target);
  };

  const addScopeItem = () => {
    setForm({
      ...form,
      items: [...form.items, { id: crypto.randomUUID(), label: form.scopeItem }],
    });
  };

  const removeScopeItem = (id: string) => {
    setForm({ ...form, items: form.items.filter((i) => i.id !== id) });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filtered.slice(startIdx, startIdx + pageSize);
  }, [filtered, currentPage, pageSize]);

  const triggerLabels: Record<TriggerType, string> = {
    quantity: t("quantity"), weight: t("weight"), minAmount: t("minAmount"), time: t("time"),
  };
  const kindLabels: Record<DiscountKind, string> = {
    amount: t("amount"), percent: t("percentage"), free: t("freeProducts"),
    plusQty: t("plusQuantity"), plusWeight: t("plusWeight"), otherPriceGroup: t("otherPriceGroup"),
  };
  const scopeLabels: Record<ScopeType, string> = {
    products: t("products"), categories: t("categories"), allProducts: t("allProducts"),
  };

  const fmtValue = (d: Discount) => {
    if (d.kind === "percent") return `${d.value}%`;
    if (d.kind === "amount") return `€ ${d.value.toFixed(2)}`;
    return kindLabels[d.kind];
  };

  return (
    <>
      <Card className="mb-4 flex max-w-lg flex-wrap items-center gap-2 px-4 py-2.5 shadow-sm mx-auto">
        <Button size="sm" onClick={openNew} className="gap-1.5 bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-sm">
          <Plus className="h-4 w-4" /> {t("newDiscount")}
        </Button>
        <div className="relative ml-auto w-full min-w-[200px] max-w-xs sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t("search")}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </Card>

      {loading && <TableCardSkeleton rows={6} />}

      {!loading && <Card className="overflow-hidden shadow-sm max-w-5xl mx-auto">
        <div className="grid grid-cols-[1fr_140px_140px_140px_100px] gap-4 px-5 py-3 border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <div>{t("name")}</div>
          <div>{t("trigger")}</div>
          <div>{t("discount")}</div>
          <div>{t("validUntil")}</div>
          <div className="text-right">{t("actions")}</div>
        </div>
        <div className="divide-y divide-border">
          {paged.map((it) => (
            <div key={it.id} className="grid grid-cols-[1fr_140px_140px_140px_100px] gap-4 px-5 py-3 items-center hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2 font-medium text-sm">
                <Percent className="h-3.5 w-3.5 text-primary" />{it.name}
              </div>
              <div className="text-sm text-muted-foreground">{triggerLabels[it.trigger]} · {it.pieces}</div>
              <div className="text-sm font-mono tabular-nums">{fmtValue(it)}</div>
              <div className="text-sm text-muted-foreground">{format(it.endDate, "dd-MM-yyyy")}</div>
              <div className="flex items-center justify-end gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(it)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setDeleteItem(it)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">Loading...</div>
          ) : paged.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">—</div>
          )}
        </div>

        <DataPagination
          page={currentPage}
          pageSize={pageSize}
          totalItems={filtered.length}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </Card>}

      {/* New / Edit Discount modal — wide layout */}
      <CrudDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? t("editDiscount") : t("newDiscount")}
        onSubmit={submit}
        size="xl"
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr] gap-5">
          {/* Left column */}
          <div className="space-y-3">
            <div className="grid grid-cols-[110px_1fr] items-center gap-3">
              <Label className="text-right text-sm">{t("name")} :</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-[110px_1fr] items-center gap-3">
              <Label className="text-right text-sm">{t("trigger")} :</Label>
              <Select value={form.trigger} onValueChange={(v) => setForm({ ...form, trigger: v as TriggerType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["quantity", "weight", "minAmount", "time"] as TriggerType[]).map((tr) => (
                    <SelectItem key={tr} value={tr}>{triggerLabels[tr]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-[110px_1fr] items-center gap-3">
              <Label className="text-right text-sm">{t("discount")} :</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as DiscountKind })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["amount", "percent", "free", "plusQty", "plusWeight", "otherPriceGroup"] as DiscountKind[]).map((k) => (
                    <SelectItem key={k} value={k}>{kindLabels[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-[110px_1fr] items-center gap-3">
              <Label className="text-right text-sm">{t("startDate")} :</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start font-normal", !form.startDate && "text-muted-foreground")}>
                    <CalendarIcon className="h-4 w-4" />
                    {format(form.startDate, "dd-MM-yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={form.startDate} onSelect={(d) => d && setForm({ ...form, startDate: d })} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-[110px_1fr] items-center gap-3">
              <Label className="text-right text-sm">{t("endDate")} :</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start font-normal", !form.endDate && "text-muted-foreground")}>
                    <CalendarIcon className="h-4 w-4" />
                    {format(form.endDate, "dd-MM-yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={form.endDate} onSelect={(d) => d && setForm({ ...form, endDate: d })} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Middle column */}
          <div className="space-y-3">
            <div className="grid grid-cols-[110px_1fr] items-center gap-3">
              <Label className="text-right text-sm">{t("discountOn")} :</Label>
              <Select value={form.scope} onValueChange={(v) => {
                const sc = v as ScopeType;
                setForm({
                  ...form,
                  scope: sc,
                  scopeItem: scopeOptions[sc][0]?.label ?? "",
                  items: [],
                });
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["products", "categories", "allProducts"] as ScopeType[]).map((s) => (
                    <SelectItem key={s} value={s}>{scopeLabels[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-[110px_80px_1fr] items-center gap-3">
              <Input
                type="number"
                value={form.pieces}
                onChange={(e) => setForm({ ...form, pieces: +e.target.value })}
                className="text-center"
              />
              <span className="text-sm">{t("pieces")}</span>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={form.combinable} onCheckedChange={(v) => setForm({ ...form, combinable: !!v })} />
                {t("combinable")}
              </label>
            </div>
            {(form.kind === "amount" || form.kind === "percent") && (
              <div className="grid grid-cols-[110px_1fr] items-center gap-3">
                <Input
                  type="number"
                  step="0.01"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: +e.target.value })}
                  className="text-center"
                />
                <span className="text-sm">{form.kind === "percent" ? "%" : t("euro")}</span>
              </div>
            )}
          </div>

          {/* Right column: scope item picker + list with up/down — hidden when scope is "All products" */}
          {form.scope !== "allProducts" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Select value={form.scopeItem} onValueChange={(v) => setForm({ ...form, scopeItem: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {scopeOptions[form.scope].map((opt) => (
                      <SelectItem key={opt.id} value={opt.label}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" size="icon" variant="outline" onClick={addScopeItem} aria-label="Add">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="border border-border rounded-md h-[180px] overflow-y-auto bg-muted/20">
                {form.items.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                    {lang === "nl" ? "Geen items" : "No items"}
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {form.items.map((it, idx) => (
                      <li
                        key={it.id}
                        onClick={() => setSelectedItemIdx(idx)}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-muted/40 transition-colors",
                          selectedItemIdx === idx && "bg-primary/10 text-primary font-medium",
                        )}
                      >
                        <span className="truncate">{it.label}</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeScopeItem(it.id); }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => moveItem(-1)} disabled={selectedItemIdx === null || selectedItemIdx === 0}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => moveItem(1)} disabled={selectedItemIdx === null || selectedItemIdx === form.items.length - 1}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </CrudDialog>

      <DeleteDialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)} itemName={deleteItem?.name ?? ""} onConfirm={confirmDelete} />
    </>
  );
}
