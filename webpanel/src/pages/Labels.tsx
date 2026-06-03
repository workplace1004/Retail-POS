import { useCallback, useEffect, useMemo, useState } from "react";
import JsBarcode from "jsbarcode";
import { Tag, Save, Printer, RotateCcw, Pencil, Trash2, Loader2, Search } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { DataPagination } from "@/components/DataPagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface LabelRow {
  id: string;
  name: string;
  count: number;
  price: number | null;
  barcode: string | null;
}

type ProductSearchHit = {
  id: string;
  name: string;
  number: number;
  barcode: string;
  price: number;
  unit: string;
  categoryName: string;
};

type QueueRowDto = {
  id: string;
  productId: string | null;
  name: string;
  count: number;
  price?: number | null;
  barcode?: string | null;
};

const LABELS_REPORT_PRINT_AREA_ID = "labels-report-print-area";
const LABELS_REPORT_PRINT_BODY_CLASS = "print-labels-only";

function clearSvg(svg: SVGElement) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
}

function drawBarcodesInArea(area: HTMLElement) {
  const svgs = area.querySelectorAll<SVGSVGElement>("svg.labels-shelf-barcode");
  for (const svg of svgs) {
    clearSvg(svg);
    const value = svg.getAttribute("data-barcode");
    if (!value || !String(value).trim()) continue;
    const trimmed = String(value).trim();
    const digits = trimmed.replace(/\D/g, "");
    const formats =
      digits.length === 13 ? (["EAN13", "CODE128"] as const) : digits.length === 8 ? (["EAN8", "CODE128"] as const) : (["CODE128"] as const);
    for (const format of formats) {
      try {
        JsBarcode(svg, trimmed, {
          format,
          width: format === "CODE128" ? 1.45 : 1.15,
          height: 44,
          displayValue: true,
          fontSize: 15,
          textMargin: 2,
          margin: 0,
          background: "#ffffff",
          lineColor: "#000000",
        });
        break;
      } catch {
        clearSvg(svg);
      }
    }
  }
}

function formatShelfPrice(price: number | null): string {
  if (price == null || !Number.isFinite(price)) return "—";
  return `€ ${price.toFixed(2)}`;
}

const Labels = () => {
  const { t, lang } = useLanguage();
  const [list, setList] = useState<LabelRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [product, setProduct] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);
  const [selectedBarcode, setSelectedBarcode] = useState<string | null>(null);
  const [count, setCount] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  /** `null` = no search yet; array (possibly empty) = last search response */
  const [searchHits, setSearchHits] = useState<ProductSearchHit[] | null>(null);

  const moneyFmt = useMemo(
    () =>
      new Intl.NumberFormat(lang === "nl" ? "nl-BE" : "en-GB", {
        style: "currency",
        currency: "EUR",
      }),
    [lang],
  );

  const labelPrintCards = useMemo(
    () =>
      list.flatMap((row) =>
        Array.from({ length: row.count }, (_, copyIndex) => ({
          key: `${row.id}-${copyIndex}`,
          row,
        })),
      ),
    [list],
  );

  const loadQueue = useCallback(async () => {
    setListLoading(true);
    try {
      const rows = await apiRequest<QueueRowDto[]>("/api/webpanel/labels/queue");
      if (!Array.isArray(rows)) {
        setList([]);
        return;
      }
      setList(
        rows.map((r) => {
          const pr = r.price;
          const price = pr != null && Number.isFinite(Number(pr)) ? Math.round(Number(pr) * 100) / 100 : null;
          const bc = r.barcode != null && String(r.barcode).trim() !== "" ? String(r.barcode).trim().slice(0, 64) : null;
          return {
            id: r.id,
            name: String(r.name ?? "").slice(0, 200),
            count: Math.min(999, Math.max(1, Math.floor(Number(r.count) || 1))),
            price,
            barcode: bc,
          };
        }),
      );
    } catch (e) {
      setList([]);
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : t("labelsLoadFailed"),
      });
    } finally {
      setListLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    return () => {
      document.body.classList.remove(LABELS_REPORT_PRINT_BODY_CLASS);
    };
  }, []);

  const handlePrintLabels = useCallback(() => {
    const totalLabels = list.reduce((s, r) => s + r.count, 0);
    if (totalLabels === 0) {
      toast({ variant: "destructive", description: t("labelsNothingToPrint") });
      return;
    }
    const area = document.getElementById(LABELS_REPORT_PRINT_AREA_ID);
    if (!area) return;

    const prevClass = area.className;
    const prevStyle = area.getAttribute("style");
    area.className = "grid grid-cols-5 gap-2 bg-white text-black print:grid print:grid-cols-5 print:max-w-none";
    area.style.cssText =
      "position:fixed;left:-9999px;top:0;width:190mm;max-height:none;height:auto;overflow:visible;visibility:visible;opacity:1;z-index:2147483646;padding:4mm;";

    drawBarcodesInArea(area);

    let finished = false;
    const cleanup = () => {
      if (finished) return;
      finished = true;
      document.body.classList.remove(LABELS_REPORT_PRINT_BODY_CLASS);
      window.removeEventListener("afterprint", cleanup);
      area.className = prevClass;
      if (prevStyle != null) area.setAttribute("style", prevStyle);
      else area.removeAttribute("style");
      for (const svg of area.querySelectorAll<SVGSVGElement>("svg.labels-shelf-barcode")) clearSvg(svg);
    };

    document.body.classList.add(LABELS_REPORT_PRINT_BODY_CLASS);
    window.addEventListener("afterprint", cleanup);
    window.setTimeout(cleanup, 60_000);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        // Inline off-screen positioning wins over @media print rules and yields a blank page.
        area.removeAttribute("style");
        window.print();
      });
    });
  }, [list, t]);

  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return list.slice(startIdx, startIdx + pageSize);
  }, [list, currentPage, pageSize]);

  const handleSearch = useCallback(async () => {
    const q = product.trim();
    if (!q) {
      setSearchHits(null);
      return;
    }
    setSearchLoading(true);
    setSearchHits(null);
    try {
      const qs = new URLSearchParams({ q });
      const data = await apiRequest<ProductSearchHit[]>(`/api/webpanel/products/label-search?${qs.toString()}`);
      setSearchHits(Array.isArray(data) ? data : []);
    } catch (e) {
      setSearchHits([]);
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : t("labelsSearchFailed"),
      });
    } finally {
      setSearchLoading(false);
    }
  }, [product, t]);

  const handleSelectHit = useCallback((hit: ProductSearchHit) => {
    setProduct(hit.name);
    setSelectedProductId(hit.id);
    setSelectedPrice(Number.isFinite(hit.price) ? hit.price : null);
    setSelectedBarcode(hit.barcode && String(hit.barcode).trim() ? String(hit.barcode).trim() : null);
    setSearchHits(null);
  }, []);

  const handleAdd = useCallback(async () => {
    const name = product.trim().slice(0, 200);
    const n = Number(count);
    if (!name || !Number.isFinite(n) || n < 1) return;
    setAddSaving(true);
    try {
      const body: Record<string, unknown> = {
        productName: name,
        count: Math.min(999, Math.floor(n)),
      };
      if (selectedProductId) body.productId = selectedProductId;
      if (selectedPrice != null && Number.isFinite(selectedPrice)) body.price = selectedPrice;
      if (selectedBarcode) body.barcode = selectedBarcode;
      await apiRequest<QueueRowDto>("/api/webpanel/labels/queue", {
        method: "POST",
        body: JSON.stringify(body),
      });
      await loadQueue();
      setProduct("");
      setCount("");
      setSelectedProductId(null);
      setSelectedPrice(null);
      setSelectedBarcode(null);
      setSearchHits(null);
      setPage(1);
      toast({ description: t("labelsSaved") });
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : t("labelsSaveFailed"),
      });
    } finally {
      setAddSaving(false);
    }
  }, [product, count, selectedProductId, selectedPrice, selectedBarcode, loadQueue, t]);

  const handleClearList = useCallback(async () => {
    try {
      await apiRequest("/api/webpanel/labels/queue/all", { method: "DELETE" });
      setList([]);
      setPage(1);
      setConfirmOpen(false);
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : t("labelsDeleteFailed"),
      });
    }
  }, [t]);

  const handleDeleteConfirm = useCallback(async () => {
    if (deleteId === null) return;
    const id = deleteId;
    try {
      await apiRequest(`/api/webpanel/labels/queue/${encodeURIComponent(id)}`, { method: "DELETE" });
      setList((prev) => prev.filter((r) => r.id !== id));
      setDeleteId(null);
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : t("labelsDeleteFailed"),
      });
    }
  }, [deleteId, t]);

  return (
    <AppLayout>
      <PageHeader title={t("labels")} icon={<Tag className="h-5 w-5" />} />

      <div className="flex justify-center gap-10 mb-6">
        <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)} className="gap-2 text-foreground">
          <RotateCcw className="h-4 w-4" />
          {t("resetList")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-2 text-foreground"
          title={t("print")}
          onClick={() => handlePrintLabels()}
        >
          <Printer className="h-4 w-4" />
          {t("print")}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 shadow-card max-w-md w-full justify-self-end">
          <div className="space-y-4">
            <div className="grid grid-cols-[110px_1fr_auto] items-center gap-2">
              <Label className="text-sm">{t("product")} :</Label>
              <Input
                value={product}
                onChange={(e) => {
                  setProduct(e.target.value);
                  setSelectedProductId(null);
                  setSelectedPrice(null);
                  setSelectedBarcode(null);
                }}
                maxLength={100}
                placeholder={t("labelsSearchPlaceholder")}
                className="h-8"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleSearch();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                disabled={searchLoading}
                aria-busy={searchLoading}
                aria-label={searchLoading ? t("labelsSearching") : t("search")}
                onClick={() => void handleSearch()}
              >
                {searchLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Search className="h-3.5 w-3.5" aria-hidden />
                )}
                {t("search")}
              </Button>
            </div>

            {searchHits !== null && (
              <div className="rounded-md border border-border bg-muted/20">
                <div className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("labelsSearchResults")}
                </div>
                {searchHits.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-muted-foreground">{t("labelsNoProductsFound")}</div>
                ) : (
                  <ul className="max-h-56 divide-y divide-border overflow-y-auto">
                    {searchHits.map((hit) => (
                      <li
                        key={hit.id}
                        className="flex flex-col gap-1 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="font-medium text-foreground">{hit.name}</div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            <span>
                              {t("labelsBarcode")}: {hit.barcode || "—"}
                            </span>
                            <span>
                              {t("number")}: {hit.number}
                            </span>
                            <span>
                              {t("labelsCategory")}: {hit.categoryName || "—"}
                            </span>
                            <span className="tabular-nums">{moneyFmt.format(hit.price)}</span>
                          </div>
                        </div>
                        <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={() => handleSelectHit(hit)}>
                          {t("labelsUseProduct")}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="grid grid-cols-[110px_1fr_auto] items-center gap-2">
              <Label className="text-sm">{t("numberOfPrints")} :</Label>
              <Input
                type="number"
                min={1}
                max={999}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="h-8 w-24"
              />
              <span />
            </div>

            <div className="flex justify-center pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleAdd()}
                disabled={addSaving}
                className="gap-2 text-foreground"
              >
                {addSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                {t("add")}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="flex max-w-xl flex-col overflow-hidden shadow-card">
          {/* Shelf-style labels for system print (hidden on screen; see `index.css` @media print) */}
          <div
            id={LABELS_REPORT_PRINT_AREA_ID}
            className="hidden grid-cols-5 gap-2 print:grid print:grid-cols-5 print:max-w-none"
          >
            {labelPrintCards.length === 0 ? (
              <div className="px-2 py-8 text-center text-sm">—</div>
            ) : (
              labelPrintCards.map(({ key, row }) => (
                <section key={key} className="labels-shelf-card">
                  <p className="labels-shelf-name">{row.name}</p>
                  <p className="labels-shelf-price">{formatShelfPrice(row.price)}</p>
                  <div className="labels-shelf-barcode-wrap">
                    {row.barcode ? (
                      <svg className="labels-shelf-barcode" data-barcode={row.barcode} xmlns="http://www.w3.org/2000/svg" />
                    ) : (
                      <p className="labels-shelf-barcode-placeholder">—</p>
                    )}
                  </div>
                </section>
              ))
            )}
          </div>

          <div className="flex flex-col print:hidden">
            <div className="grid grid-cols-[1fr_150px_100px] gap-4 border-b border-border bg-muted/30 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <div>{t("product")}</div>
              <div>{t("numberOfPrints")}</div>
              <div className="text-right">{t("actions")}</div>
            </div>
            <div className="divide-y divide-border">
              {listLoading && (
                <div className="flex justify-center px-5 py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
                </div>
              )}
              {!listLoading && paged.length === 0 && (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">—</div>
              )}
              {!listLoading &&
                paged.map((l) => (
                  <div key={l.id} className="grid grid-cols-[1fr_150px_100px] gap-4 px-5 py-3 items-center text-sm">
                    <div className="text-foreground">{l.name}</div>
                    <div className="text-foreground tabular-nums">{l.count}</div>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-7 w-7 hover:text-destructive")}
                        onClick={() => setDeleteId(l.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
            {!listLoading && list.length > 0 && (
              <DataPagination
                page={currentPage}
                pageSize={pageSize}
                totalItems={list.length}
                onPageChange={setPage}
                onPageSizeChange={(s) => {
                  setPageSize(s);
                  setPage(1);
                }}
              />
            )}
          </div>
        </Card>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmClearList")}</AlertDialogTitle>
            <AlertDialogDescription className="sr-only">{t("confirmClearList")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("no")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handleClearList();
              }}
            >
              {t("yes")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <DeleteConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        onConfirm={() => {
          void handleDeleteConfirm();
        }}
      />
    </AppLayout>
  );
};

export default Labels;
