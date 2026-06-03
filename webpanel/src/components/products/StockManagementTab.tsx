import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Save, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { DataPagination } from "../DataPagination";
import { apiRequest } from "@/lib/api";
import { TwoPaneSkeleton } from "./CustomizePosSkeleton";

interface StockItem {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  unit: "Kg" | "st";
  qty: number;
}

function parseStockQty(raw: string | number | null | undefined): number {
  if (raw == null || raw === "") return 0;
  const n = Number(String(raw).trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** POS purchase unit: only Kg uses decimal qty display; Piece / other → count (st). */
function stockDisplayUnit(unit: string | null | undefined): "Kg" | "st" {
  return String(unit ?? "").trim() === "Kg" ? "Kg" : "st";
}

/** Hide browser default steppers on number inputs (Chrome / Safari / Firefox). */
const stockAdjustInputClass =
  "h-8 text-sm text-right [-moz-appearance:textfield] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

function mapCatalogToStockItems(
  productRows: Array<{
    id: string;
    name: string;
    categoryId: string;
    categoryName?: string;
    unit?: string | null;
    stock?: string | number | null;
  }>,
  catMap: Map<string, string>,
): StockItem[] {
  return (Array.isArray(productRows) ? productRows : []).map((row) => ({
    id: row.id,
    name: row.name,
    categoryId: row.categoryId,
    categoryName: row.categoryName || catMap.get(row.categoryId) || "",
    unit: stockDisplayUnit(row.unit),
    qty: parseStockQty(row.stock),
  }));
}

export function StockManagementTab() {
  const { t, lang } = useLanguage();
  const [items, setItems] = useState<StockItem[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [activeCat, setActiveCat] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [adjust, setAdjust] = useState<Record<string, { plus: string; minus: string }>>({});
  const adjustRef = useRef(adjust);
  adjustRef.current = adjust;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setLoading(true);
    try {
      const [categoryRows, productRows] = await Promise.all([
        apiRequest<Array<{ id: string; name: string }>>("/api/categories"),
        apiRequest<Array<{ id: string; name: string; categoryId: string; categoryName?: string; unit?: string | null; stock?: string | number | null }>>("/api/products/catalog"),
      ]);
      const cats = Array.isArray(categoryRows) ? categoryRows : [];
      const catMap = new Map(cats.map((c) => [c.id, c.name]));
      setCategories(cats);
      setActiveCat((prev) => (prev && cats.some((c) => c.id === prev) ? prev : cats[0]?.id ?? ""));
      const mapped = mapCatalogToStockItems(productRows, catMap);
      if (silent) {
        setItems((prev) => {
          const prevById = new Map(prev.map((p) => [p.id, p]));
          return mapped.map((row) => {
            const a = adjustRef.current[row.id];
            if (a && (String(a.plus).trim() !== "" || String(a.minus).trim() !== "")) {
              return prevById.get(row.id) ?? row;
            }
            return row;
          });
        });
      } else {
        setItems(mapped);
      }
    } catch (error) {
      if (!silent) {
        toast({
          variant: "destructive",
          description: error instanceof Error ? error.message : "Failed to load stock items.",
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void loadData({ silent: true });
    }, 2500);
    return () => window.clearInterval(id);
  }, [loadData]);

  const labels = lang === "nl"
    ? { quantity: "Aantal", name: "Naam", save: "Opslaan", saved: "Stockwijzigingen opgeslagen" }
    : { quantity: "Quantity", name: "Name", save: "Save", saved: "Stock changes saved" };

  const itemCountByCategoryId = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of categories) m[c.id] = 0;
    for (const i of items) m[i.categoryId] = (m[i.categoryId] ?? 0) + 1;
    return m;
  }, [items, categories]);

  const filtered = useMemo(
    () =>
      items.filter(
        (i) => i.categoryId === activeCat && i.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [items, activeCat, search],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const formatQty = (item: StockItem) => {
    if (item.unit === "Kg") return `${item.qty.toFixed(3)} Kg`;
    return `${item.qty} st`;
  };

  const setField = (id: string, field: "plus" | "minus", value: string) => {
    setAdjust((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { plus: "", minus: "" }), [field]: value } }));
  };

  const handleSave = () => {
    const updates = items
      .map((it) => {
        const a = adjust[it.id];
        if (!a) return null;
        const plus = parseFloat(a.plus) || 0;
        const minus = parseFloat(a.minus) || 0;
        return {
          id: it.id,
          stock: String(it.qty + plus - minus),
        };
      })
      .filter(Boolean) as Array<{ id: string; stock: string }>;
    if (updates.length === 0) return;
    setItems((prev) => prev.map((it) => {
      const update = updates.find((u) => u.id === it.id);
      if (!update) return it;
      return { ...it, qty: parseStockQty(update.stock) };
    }));
    void Promise.all(
      updates.map((u) =>
        apiRequest(`/api/products/${u.id}`, {
          method: "PATCH",
          body: JSON.stringify({ stock: u.stock }),
        }),
      ),
    ).catch(() => {
      void loadData({ silent: true });
    });
    setAdjust({});
    toast({ description: labels.saved });
  };

  return (
    <>
      {/* Toolbar */}
      <Card className="mb-4 px-4 py-2.5 flex flex-wrap items-center gap-2 shadow-sm max-w-md mx-auto">
        <Button
          size="sm"
          onClick={handleSave}
          className="gap-1.5 bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-sm"
        >
          <Save className="h-4 w-4" /> {labels.save}
        </Button>
        <div className="relative ml-auto w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search")}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </Card>

      {loading && <TwoPaneSkeleton />}

      {!loading && <div className="flex w-full justify-center gap-4">
        {/* Categories sidebar */}
        <Card className="p-2 h-fit shadow-sm max-w-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2">
            {t("categories")}
          </div>
          <div className="space-y-0.5">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCat(c.id)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm rounded-md transition-all flex items-center justify-between gap-2 min-w-0",
                  c.id === activeCat
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground/80 hover:bg-secondary",
                )}
              >
                <span className="truncate">{c.name}</span>
                <Badge variant="secondary" className="shrink-0 text-xs tabular-nums">
                  {itemCountByCategoryId[c.id] ?? 0}
                </Badge>
              </button>
            ))}
          </div>
        </Card>

        {/* Stock table */}
        <Card className="overflow-hidden shadow-sm h-fit">
          <div className="grid grid-cols-[140px_300px_180px_180px] gap-4 px-5 py-3 border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <div className="text-left">{labels.quantity}</div>
            <div>{labels.name}</div>
            <div className="text-center">+</div>
            <div className="text-center">−</div>
          </div>
          <div className="divide-y divide-border">
            {loading ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">Loading...</div>
            ) : paged.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">—</div>
            )}
            {paged.map((it) => {
              const a = adjust[it.id] ?? { plus: "", minus: "" };
              const negative = it.qty < 0;
              return (
                <div
                  key={it.id}
                  className="grid grid-cols-[140px_300px_180px_180px] gap-4 px-5 py-2.5 items-center hover:bg-muted/30 transition-colors"
                >
                  <div
                    className={`text-left font-mono text-sm tabular-nums ${
                      negative ? "text-destructive" : "text-foreground"
                    }`}
                  >
                    {formatQty(it)}
                  </div>
                  <div className="font-medium text-sm">{it.name}</div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      step="any"
                      value={a.plus}
                      onChange={(e) => setField(it.id, "plus", e.target.value)}
                      className={stockAdjustInputClass}
                    />
                    <span className="text-xs text-muted-foreground w-6">{it.unit}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      step="any"
                      value={a.minus}
                      onChange={(e) => setField(it.id, "minus", e.target.value)}
                      className={stockAdjustInputClass}
                    />
                    <span className="text-xs text-muted-foreground w-6">{it.unit}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <DataPagination
            page={currentPage}
            pageSize={pageSize}
            totalItems={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        </Card>
      </div>}
    </>
  );
}
