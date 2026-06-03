import { useState, useMemo, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

interface Product { id: string; name: string; }
interface Category { id: string; name: string; }

interface PlacedItem { productId: string; color: string; }

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  categories: Category[];
  productsByCategory: Record<string, Product[]>;
}

// Keep same order/colors as retail/frontend Control positioning palette.
const SWATCHES = [
  "#1F8E41", // green
  "#B45309", // orange
  "#1D4ED8", // blue
  "#B91C1C", // red
  "#6D28D9", // purple
  "#CA8A04", // gold
];
const GRID_ROWS = 8;
const GRID_COLS = 6;
const CATS_VISIBLE = 4;
const COLOR_BY_ID: Record<string, string> = {
  green: "#1F8E41",
  orange: "#B45309",
  blue: "#1D4ED8",
  pink: "#B91C1C",
  gray: "#6D28D9",
  yellow: "#CA8A04",
};

const HEX_TO_COLOR_ID: Record<string, string> = Object.fromEntries(
  Object.entries(COLOR_BY_ID).map(([id, hex]) => [hex.toLowerCase(), id]),
);

function colorIdFromHex(hex: string): string {
  const key = hex.trim().toLowerCase();
  return HEX_TO_COLOR_ID[key] ?? "green";
}

export function ProductOrderingDialog({ open, onOpenChange, categories, productsByCategory }: Props) {
  const { t } = useLanguage();
  const [catOffset, setCatOffset] = useState(0);
  const [activeCat, setActiveCat] = useState(categories[0]?.id ?? "");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedCellIdx, setSelectedCellIdx] = useState<number | null>(null);
  const [gridByCat, setGridByCat] = useState<Record<string, (PlacedItem | null)[]>>({});
  const [layoutByCategory, setLayoutByCategory] = useState<Record<string, (string | null)[]>>({});
  const [colorByCategory, setColorByCategory] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  /** When true, skip polling server into layout/colors so local edits are not overwritten. */
  const layoutPollSkipRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    if (categories.length === 0) {
      setActiveCat("");
      setCatOffset(0);
      return;
    }
    if (!activeCat || !categories.some((c) => c.id === activeCat)) {
      setActiveCat(categories[0].id);
    }
    setCatOffset((prev) => Math.min(prev, Math.max(0, categories.length - CATS_VISIBLE)));
  }, [categories, activeCat, open]);

  useEffect(() => {
    if (!open) return;
    layoutPollSkipRef.current = false;
    void (async () => {
      try {
        const [layoutRes, colorsRes] = await Promise.all([
          apiRequest<{ value?: Record<string, unknown> }>("/api/settings/product-positioning-layout"),
          apiRequest<{ value?: Record<string, unknown> }>("/api/settings/product-positioning-colors"),
        ]);
        setLayoutByCategory((layoutRes?.value && typeof layoutRes.value === "object" ? layoutRes.value : {}) as Record<string, (string | null)[]>);
        setColorByCategory((colorsRes?.value && typeof colorsRes.value === "object" ? colorsRes.value : {}) as Record<string, Record<string, string>>);
      } catch {
        setLayoutByCategory({});
        setColorByCategory({});
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const id = window.setInterval(() => {
      if (layoutPollSkipRef.current || saving) return;
      void (async () => {
        try {
          const [layoutRes, colorsRes] = await Promise.all([
            apiRequest<{ value?: Record<string, unknown> }>("/api/settings/product-positioning-layout"),
            apiRequest<{ value?: Record<string, unknown> }>("/api/settings/product-positioning-colors"),
          ]);
          setLayoutByCategory(
            (layoutRes?.value && typeof layoutRes.value === "object" ? layoutRes.value : {}) as Record<string, (string | null)[]>,
          );
          setColorByCategory(
            (colorsRes?.value && typeof colorsRes.value === "object" ? colorsRes.value : {}) as Record<string, Record<string, string>>,
          );
        } catch {
          // silent poll
        }
      })();
    }, 2500);
    return () => window.clearInterval(id);
  }, [open, saving]);

  useEffect(() => {
    if (!open || categories.length === 0) return;
    if (layoutPollSkipRef.current) return;
    const pageSize = GRID_ROWS * GRID_COLS;
    const next: Record<string, (PlacedItem | null)[]> = {};
    for (const category of categories) {
      const products = productsByCategory[category.id] ?? [];
      const productIds = new Set(products.map((p) => p.id));
      const rawLayout = Array.isArray(layoutByCategory[category.id]) ? layoutByCategory[category.id] : [];
      const colorMap = colorByCategory[category.id] && typeof colorByCategory[category.id] === "object"
        ? colorByCategory[category.id]
        : {};
      const normalized = Array.from({ length: pageSize }, (_, idx) => {
        const raw = rawLayout[idx];
        if (!raw || typeof raw !== "string") return null;
        const resolvedId = raw.startsWith("p:") ? raw.slice(2) : raw;
        if (!productIds.has(resolvedId)) return null;
        const colorId = colorMap[String(idx)];
        return {
          productId: resolvedId,
          color: COLOR_BY_ID[colorId] ?? SWATCHES[0],
        } as PlacedItem;
      });
      next[category.id] = normalized;
    }
    setGridByCat(next);
  }, [categories, productsByCategory, layoutByCategory, colorByCategory, open]);

  useEffect(() => {
    if (open) return;
    layoutPollSkipRef.current = false;
    setSelectedProductId(null);
    setSelectedCellIdx(null);
    setCatOffset(0);
    setSaving(false);
  }, [open]);

  const grid = gridByCat[activeCat] ?? Array(GRID_ROWS * GRID_COLS).fill(null);
  const products = productsByCategory[activeCat] ?? [];
  const placedIds = new Set(grid.filter(Boolean).map((c) => (c as PlacedItem).productId));
  const unplaced = products.filter((p) => !placedIds.has(p.id));

  const visibleCats = useMemo(
    () => categories.slice(catOffset, catOffset + CATS_VISIBLE),
    [categories, catOffset],
  );

  const setGrid = (next: (PlacedItem | null)[]) => {
    layoutPollSkipRef.current = true;
    setGridByCat((prev) => ({ ...prev, [activeCat]: next }));
  };

  const handleCellClick = (idx: number) => {
    const cell = grid[idx];
    const fromIdx = selectedCellIdx;
    if (cell) {
      if (fromIdx !== null && fromIdx !== idx && grid[fromIdx]) {
        const next = [...grid];
        const a = next[fromIdx] as PlacedItem;
        const b = next[idx] as PlacedItem;
        next[fromIdx] = b;
        next[idx] = a;
        setGrid(next);
        setSelectedCellIdx(null);
        setSelectedProductId(null);
        return;
      }
      setSelectedCellIdx(idx);
      setSelectedProductId(null);
      return;
    }
    if (fromIdx !== null && grid[fromIdx]) {
      const next = [...grid];
      const item = next[fromIdx] as PlacedItem;
      next[fromIdx] = null;
      next[idx] = item;
      setGrid(next);
      setSelectedCellIdx(null);
      setSelectedProductId(null);
      return;
    }
    if (selectedProductId) {
      const next = [...grid];
      next[idx] = { productId: selectedProductId, color: SWATCHES[0] };
      setGrid(next);
      setSelectedProductId(null);
    }
  };

  const removeSelected = () => {
    if (selectedCellIdx === null) return;
    const next = [...grid];
    next[selectedCellIdx] = null;
    setGrid(next);
    setSelectedCellIdx(null);
  };

  const applySwatch = (color: string) => {
    if (selectedCellIdx === null) return;
    const next = [...grid];
    const cur = next[selectedCellIdx];
    if (cur) next[selectedCellIdx] = { ...cur, color };
    setGrid(next);
    setSelectedCellIdx(null);
    setSelectedProductId(null);
  };

  const moveProduct = (dir: -1 | 1) => {
    if (!selectedProductId) return;
    const idx = unplaced.findIndex((p) => p.id === selectedProductId);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= unplaced.length) return;
  };

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "";

  const buildPayloadFromGrids = () => {
    const pageSize = GRID_ROWS * GRID_COLS;
    const layout: Record<string, (string | null)[]> = {};
    const colors: Record<string, Record<string, string>> = {};
    for (const category of categories) {
      const savedLayout = Array.isArray(layoutByCategory[category.id]) ? layoutByCategory[category.id] : [];
      const baseRow: (PlacedItem | null)[] = Array.from({ length: pageSize }, (_, idx) => {
        const raw = savedLayout[idx];
        if (!raw || typeof raw !== "string") return null;
        const resolvedId = raw.startsWith("p:") ? raw.slice(2) : raw;
        const colorId = colorByCategory[category.id]?.[String(idx)];
        return {
          productId: resolvedId,
          color: COLOR_BY_ID[colorId] ?? SWATCHES[0],
        };
      });
      const row = gridByCat[category.id] ?? baseRow;
      const layoutRow: (string | null)[] = Array.from({ length: pageSize }, () => null);
      const colorRow: Record<string, string> = { ...(colorByCategory[category.id] ?? {}) };
      for (let idx = 0; idx < pageSize; idx++) {
        const cell = row[idx];
        if (cell) {
          layoutRow[idx] = `p:${cell.productId}`;
          colorRow[String(idx)] = colorIdFromHex(cell.color);
        } else {
          layoutRow[idx] = null;
          delete colorRow[String(idx)];
        }
      }
      layout[category.id] = layoutRow;
      colors[category.id] = colorRow;
    }
    return { layout, colors };
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { layout, colors } = buildPayloadFromGrids();
      await Promise.all([
        apiRequest("/api/settings/product-positioning-layout", {
          method: "PUT",
          body: JSON.stringify({ value: layout }),
        }),
        apiRequest("/api/settings/product-positioning-colors", {
          method: "PUT",
          body: JSON.stringify({ value: colors }),
        }),
      ]);
      setLayoutByCategory(layout);
      setColorByCategory(colors);
      layoutPollSkipRef.current = false;
      toast({ description: t("positioningLayoutSaved") });
      onOpenChange(false);
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Failed to save layout.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <div className="flex items-center justify-center gap-2 pt-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            disabled={catOffset === 0}
            onClick={() => setCatOffset(Math.max(0, catOffset - 1))}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex">
            {visibleCats.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={cn(
                  "px-8 py-3 text-sm font-medium border-b-2 transition-colors min-w-[140px]",
                  c.id === activeCat
                    ? "bg-primary text-primary-foreground border-primary"
                    : "text-foreground/80 border-transparent hover:bg-muted",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            disabled={catOffset + CATS_VISIBLE >= categories.length}
            onClick={() => setCatOffset(catOffset + 1)}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid grid-cols-[240px_1fr] gap-6 mt-4">
          <div className="flex flex-col">
            <div className="border border-border rounded-md bg-card flex-1 min-h-[420px] p-2">
              <ul className="space-y-1">
                {unplaced.map((p) => (
                  <li
                    key={p.id}
                    onClick={() => { setSelectedProductId(p.id); setSelectedCellIdx(null); }}
                    className={cn(
                      "px-3 py-2 text-sm rounded cursor-pointer text-center transition-colors",
                      selectedProductId === p.id ? "bg-primary/15 text-primary font-medium" : "hover:bg-muted/40",
                    )}
                  >
                    {p.name}
                  </li>
                ))}
                {unplaced.length === 0 && (
                  <li className="px-3 py-6 text-center text-xs text-muted-foreground">—</li>
                )}
              </ul>
            </div>
            <div className="flex items-center justify-center gap-8 mt-3">
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => moveProduct(-1)}>
                <ArrowUp className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => moveProduct(1)}>
                <ArrowDown className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="flex flex-col">
            <div className="grid grid-cols-6 gap-2">
              {grid.map((cell, idx) => {
                const isSelected = selectedCellIdx === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => handleCellClick(idx)}
                    style={cell ? { backgroundColor: cell.color } : undefined}
                    className={cn(
                      "aspect-[4/3] border border-border rounded text-xs font-medium p-1 flex items-center justify-center text-center break-words transition-all",
                      !cell && "bg-card hover:bg-muted/50",
                      cell && "text-foreground/90",
                      isSelected && "ring-2 ring-primary ring-offset-1",
                    )}
                  >
                    {cell ? productName(cell.productId) : ""}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-4">
              <button
                type="button"
                onClick={removeSelected}
                disabled={selectedCellIdx === null}
                className="text-sm text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
              >
                {t("removeFromPlace")}
              </button>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                  {t("cancel")}
                </Button>
                <Button type="button" onClick={() => void handleSave()} disabled={saving}>
                  {saving ? "…" : t("save")}
                </Button>
              </DialogFooter>
              <div className="grid grid-cols-3 gap-2">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    onClick={() => applySwatch(c)}
                    style={{ backgroundColor: c }}
                    className="h-6 w-10 rounded border border-border hover:scale-110 transition-transform"
                    aria-label={`color ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
