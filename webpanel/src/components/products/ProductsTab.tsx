import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShoppingCart, Pencil, Trash2, Plus, Search, ArrowUpDown, List as ListIcon, Percent } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DeleteDialog } from "../CrudDialog";
import { ProductFormDialog } from "./ProductFormDialog";
import { DataPagination } from "../DataPagination";
import { useLanguage } from "@/contexts/LanguageContext";
import { ProductOrderingDialog } from "./ProductOrderingDialog";
import { VatDialog } from "./VatDialog";
import { ProductListDialog } from "./ProductListDialog";
import { ProductSubproductsDialog } from "./ProductSubproductsDialog";
import { apiRequest } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { TwoPaneSkeleton } from "./CustomizePosSkeleton";
import {
  POS_PRODUCT_SUBPRODUCT_LINKS_CHANGED_EVENT,
  PRODUCT_SUBPRODUCT_LINKS_MODAL_POLL_MS,
} from "@/lib/optionButtonLayout";

interface Product { id: string; name: string; price: number; categoryId: string; categoryName: string; }

/** Align DB `vatTakeOut` (e.g. "6", "12") with `VatDialog` option labels ("6 %", "12 %"). */
function formatVatTakeOutForDialog(raw: string | null | undefined): string {
  const s = String(raw ?? "")
    .trim()
    .replace(/%/g, "")
    .replace(",", ".");
  if (!s) return "---";
  const n = Number(s);
  if (!Number.isFinite(n)) return "---";
  const int = Math.round(n);
  return `${int} %`;
}

/** "12 %" → "12" for `PATCH /api/products/:id` { vatTakeOut }. */
function vatDialogValueToApi(displayValue: string): string | null {
  const trimmed = displayValue.replace(/\s*%/g, "").trim();
  if (!trimmed || displayValue === "---") return null;
  return trimmed;
}
interface Category { id: string; name: string; }
interface SubproductGroup { id: string; name: string; }
interface Subproduct { id: string; name: string; }
interface ProductSubproductLink { subproductId: string; subproductName: string; groupId: string; groupName: string; }

interface Props { newOpen: boolean; setNewOpen: (b: boolean) => void; }

export function ProductsTab({ newOpen, setNewOpen }: Props) {
  const { t } = useLanguage();
  const [items, setItems] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [priceGroups, setPriceGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [orderingOpen, setOrderingOpen] = useState(false);
  const [vatOpen, setVatOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  const [vatByProduct, setVatByProduct] = useState<Record<string, { takeOut: string }>>({});
  const [vatBulkSaving, setVatBulkSaving] = useState(false);
  const [pricesByGroup, setPricesByGroup] = useState<Record<string, Record<string, number>>>({});
  const [subproductsOpen, setSubproductsOpen] = useState(false);
  const [subproductsLoading, setSubproductsLoading] = useState(false);
  const [subproductsSaving, setSubproductsSaving] = useState(false);
  const [subproductsProduct, setSubproductsProduct] = useState<Product | null>(null);
  const [subproductGroups, setSubproductGroups] = useState<SubproductGroup[]>([]);
  const [subproductsGroupId, setSubproductsGroupId] = useState("");
  const [groupSubproducts, setGroupSubproducts] = useState<Subproduct[]>([]);
  const [linkedSubproducts, setLinkedSubproducts] = useState<ProductSubproductLink[]>([]);
  const [leftSelectedSubproducts, setLeftSelectedSubproducts] = useState<Set<string>>(new Set());
  const [rightSelectedSubproducts, setRightSelectedSubproducts] = useState<Set<string>>(new Set());
  const subproductsLinksDirtyRef = useRef(false);

  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setLoading(true);
    try {
      const [categoryRows, productRows, priceGroupRows] = await Promise.all([
        apiRequest<Array<{ id: string; name: string }>>("/api/categories"),
        apiRequest<
          Array<{
            id: string;
            name: string;
            price: number;
            categoryId: string;
            categoryName?: string;
            vatTakeOut?: string | null;
          }>
        >("/api/products/catalog"),
        apiRequest<Array<{ name: string }>>("/api/price-groups"),
      ]);
      const cats = Array.isArray(categoryRows) ? categoryRows : [];
      const catMap = new Map(cats.map((c) => [c.id, c.name]));
      const rawProductRows = Array.isArray(productRows) ? productRows : [];
      const mappedProducts = rawProductRows.map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price ?? 0),
        categoryId: p.categoryId,
        categoryName: p.categoryName || catMap.get(p.categoryId) || "",
      }));
      const groupNames = (Array.isArray(priceGroupRows) ? priceGroupRows : []).map((row) => row.name);

      setCategories(cats);
      setItems(mappedProducts);
      setPriceGroups(groupNames);
      setActiveCat((prev) => (prev && cats.some((c) => c.id === prev) ? prev : cats[0]?.id ?? ""));
      setVatByProduct(() => {
        const next: Record<string, { takeOut: string }> = {};
        for (const p of mappedProducts) {
          const row = rawProductRows.find((r) => r.id === p.id);
          next[p.id] = { takeOut: formatVatTakeOutForDialog(row?.vatTakeOut) };
        }
        return next;
      });
      setPricesByGroup(
        Object.fromEntries(groupNames.map((g) => [g, Object.fromEntries(mappedProducts.map((p) => [p.id, p.price]))])),
      );
    } catch (error) {
      if (!silent) {
        toast({
          variant: "destructive",
          description: error instanceof Error ? error.message : "Failed to load products.",
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Keep products and categories in sync when retail (or another client) adds/edits data.
  useEffect(() => {
    const id = window.setInterval(() => {
      void loadData({ silent: true });
    }, 2500);
    return () => window.clearInterval(id);
  }, [loadData]);

  const productModalOpen = newOpen || editOpen;
  const closeProductModal = useCallback(
    (openNext: boolean) => {
      if (!openNext) {
        setNewOpen(false);
        setEditOpen(false);
        setEditing(null);
      }
    },
    [setNewOpen],
  );

  const openNew = () => {
    setEditing(null);
    setEditOpen(false);
    setNewOpen(true);
  };
  const openEdit = (p: Product) => {
    setEditing(p);
    setNewOpen(false);
    setEditOpen(true);
  };
  const confirmDelete = async () => {
    if (!deleteItem) return;
    try {
      await apiRequest(`/api/products/${deleteItem.id}`, { method: "DELETE" });
      setDeleteItem(null);
      await loadData();
    } catch (error) {
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "Failed to delete product.",
      });
    }
  };

  const filtered = items.filter(
    (i) => i.categoryId === activeCat && i.name.toLowerCase().includes(search.toLowerCase()),
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filtered.slice(startIdx, startIdx + pageSize);
  }, [filtered, currentPage, pageSize]);

  const productsByCategory = useMemo(() => {
    const map: Record<string, Product[]> = {};
    for (const c of categories) map[c.id] = [];
    for (const p of items) (map[p.categoryId] ??= []).push(p);
    return map;
  }, [items, categories]);

  const applyVat = useCallback(
    async (productIds: string[], value: string) => {
      const vatApi = vatDialogValueToApi(value);
      if (vatApi == null) return;
      if (productIds.length === 0) {
        toast({ variant: "destructive", description: t("vatBulkNoSelection") });
        return;
      }
      setVatBulkSaving(true);
      try {
        await Promise.all(
          productIds.map((id) =>
            apiRequest(`/api/products/${id}`, {
              method: "PATCH",
              body: JSON.stringify({ vatTakeOut: vatApi }),
            }),
          ),
        );
        setVatByProduct((prev) => {
          const next = { ...prev };
          const display = formatVatTakeOutForDialog(vatApi);
          for (const id of productIds) {
            next[id] = { takeOut: display };
          }
          return next;
        });
        toast({ description: t("vatBulkSaved") });
      } catch (error) {
        toast({
          variant: "destructive",
          description: error instanceof Error ? error.message : t("vatBulkFailed"),
        });
      } finally {
        setVatBulkSaving(false);
      }
    },
    [t],
  );

  const updateGroupPrice = (productId: string, group: string, price: number) => {
    setPricesByGroup({
      ...pricesByGroup,
      [group]: { ...(pricesByGroup[group] ?? {}), [productId]: price },
    });
  };

  const resetSubproductsState = useCallback(() => {
    setSubproductsGroupId("");
    setGroupSubproducts([]);
    setLinkedSubproducts([]);
    setLeftSelectedSubproducts(new Set());
    setRightSelectedSubproducts(new Set());
  }, []);

  const openProductSubproducts = useCallback(async (product: Product) => {
    subproductsLinksDirtyRef.current = false;
    setSubproductsProduct(product);
    setSubproductsOpen(true);
    setSubproductsLoading(true);
    resetSubproductsState();
    try {
      const [groupsRes, linksRes] = await Promise.all([
        apiRequest<Array<{ id: string; name: string }>>("/api/subproduct-groups"),
        apiRequest<Array<{ subproductId: string; subproductName: string; groupId?: string; groupName?: string }>>(
          `/api/products/${product.id}/subproduct-links`,
        ),
      ]);
      const groups = Array.isArray(groupsRes) ? groupsRes : [];
      const links = Array.isArray(linksRes) ? linksRes : [];
      setSubproductGroups(groups.map((g) => ({ id: String(g.id), name: String(g.name) })));
      setLinkedSubproducts(
        links.map((l) => ({
          subproductId: String(l.subproductId),
          subproductName: String(l.subproductName),
          groupId: String(l.groupId ?? ""),
          groupName: String(l.groupName ?? ""),
        })),
      );
      const firstGroup = links.find((l) => l?.groupId)?.groupId;
      if (firstGroup && groups.some((g) => g.id === firstGroup)) setSubproductsGroupId(String(firstGroup));
    } catch (error) {
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "Failed to load product subproducts.",
      });
    } finally {
      setSubproductsLoading(false);
    }
  }, [resetSubproductsState]);

  useEffect(() => {
    if (!subproductsOpen || !subproductsProduct?.id || subproductsLoading || subproductsSaving) return;
    const productId = subproductsProduct.id;
    const linksSig = (rows: ProductSubproductLink[]) =>
      JSON.stringify(
        [...rows]
          .map((r) => ({ i: r.subproductId, g: r.groupId || "", n: r.subproductName }))
          .sort((a, b) => a.i.localeCompare(b.i)),
      );
    const pull = async () => {
      if (subproductsLinksDirtyRef.current) return;
      try {
        const linksRes = await apiRequest<Array<{ subproductId: string; subproductName: string; groupId?: string; groupName?: string }>>(
          `/api/products/${productId}/subproduct-links`,
        );
        const links = Array.isArray(linksRes) ? linksRes : [];
        const mapped: ProductSubproductLink[] = links.map((l) => ({
          subproductId: String(l.subproductId),
          subproductName: String(l.subproductName),
          groupId: String(l.groupId ?? ""),
          groupName: String(l.groupName ?? ""),
        }));
        setLinkedSubproducts((prev) => (linksSig(prev) === linksSig(mapped) ? prev : mapped));
      } catch {
        /* ignore poll errors */
      }
    };
    void pull();
    const intervalId = window.setInterval(() => {
      void pull();
    }, PRODUCT_SUBPRODUCT_LINKS_MODAL_POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void pull();
    };
    const onLinksChanged = (e: Event) => {
      const ce = e as CustomEvent<{ productId?: string }>;
      if (ce.detail?.productId === productId) void pull();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(POS_PRODUCT_SUBPRODUCT_LINKS_CHANGED_EVENT, onLinksChanged);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(POS_PRODUCT_SUBPRODUCT_LINKS_CHANGED_EVENT, onLinksChanged);
    };
  }, [subproductsOpen, subproductsProduct?.id, subproductsLoading, subproductsSaving]);

  useEffect(() => {
    if (!subproductsOpen || !subproductsGroupId) {
      setGroupSubproducts([]);
      setLeftSelectedSubproducts(new Set());
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const rows = await apiRequest<Array<{ id: string; name: string }>>(`/api/subproduct-groups/${subproductsGroupId}/subproducts`);
        if (cancelled) return;
        setGroupSubproducts((Array.isArray(rows) ? rows : []).map((sp) => ({ id: String(sp.id), name: String(sp.name) })));
        setLeftSelectedSubproducts(new Set());
      } catch {
        if (cancelled) return;
        setGroupSubproducts([]);
        setLeftSelectedSubproducts(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subproductsOpen, subproductsGroupId]);

  const addSelectedSubproducts = useCallback(() => {
    if (!leftSelectedSubproducts.size) return;
    subproductsLinksDirtyRef.current = true;
    const selectedGroup = subproductGroups.find((g) => g.id === subproductsGroupId);
    const available = groupSubproducts.filter(
      (sp) => !linkedSubproducts.some((l) => l.subproductId === sp.id),
    );
    const toAdd = available.filter((sp) => leftSelectedSubproducts.has(sp.id));
    if (!toAdd.length) return;
    setLinkedSubproducts((prev) => [
      ...prev,
      ...toAdd.map((sp) => ({
        subproductId: sp.id,
        subproductName: sp.name,
        groupId: selectedGroup?.id || subproductsGroupId,
        groupName: selectedGroup?.name || "",
      })),
    ]);
    setLeftSelectedSubproducts(new Set());
  }, [groupSubproducts, leftSelectedSubproducts, linkedSubproducts, subproductGroups, subproductsGroupId]);

  const removeSelectedSubproducts = useCallback(() => {
    if (!rightSelectedSubproducts.size) return;
    subproductsLinksDirtyRef.current = true;
    setLinkedSubproducts((prev) => prev.filter((l) => !rightSelectedSubproducts.has(l.subproductId)));
    setRightSelectedSubproducts(new Set());
  }, [rightSelectedSubproducts]);

  const saveProductSubproducts = useCallback(async () => {
    if (!subproductsProduct?.id) return;
    setSubproductsSaving(true);
    try {
      const links = linkedSubproducts.map((l) => ({ groupId: l.groupId || "", subproductId: l.subproductId }));
      await apiRequest(`/api/products/${subproductsProduct.id}/subproduct-links`, {
        method: "PUT",
        body: JSON.stringify({ links }),
      });
      subproductsLinksDirtyRef.current = false;
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(POS_PRODUCT_SUBPRODUCT_LINKS_CHANGED_EVENT, { detail: { productId: subproductsProduct.id } }),
        );
      }
      void loadData({ silent: true });
      toast({ description: t("subproductsSaved") });
      setSubproductsOpen(false);
      setSubproductsProduct(null);
      resetSubproductsState();
    } catch (error) {
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "Failed to save product subproducts.",
      });
    } finally {
      setSubproductsSaving(false);
    }
  }, [linkedSubproducts, loadData, resetSubproductsState, subproductsProduct, t]);

  return (
    <>
      {/* Toolbar */}
      <Card className="mb-4 px-4 py-2.5 flex flex-wrap items-center gap-2 shadow-sm max-w-3xl mx-auto">
        <Button size="sm" onClick={openNew} className="gap-1.5 bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-sm">
          <Plus className="h-4 w-4" /> {t("newProduct")}
        </Button>
        <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setOrderingOpen(true)}>
          <ArrowUpDown className="h-4 w-4" /> {t("productOrdering")}
        </Button>
        {/* <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setOrderingOpen(true)}>
          <LayoutGrid className="h-4 w-4" /> {t("kioskOrdering")}
        </Button> */}
        <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setListOpen(true)}>
          <ListIcon className="h-4 w-4" /> {t("list")}
        </Button>
        <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setVatOpen(true)}>
          <Percent className="h-4 w-4" /> {t("vat")}
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

      {!loading && <div className="flex w-full justify-center flex gap-4">
        <Card className="p-2 h-fit shadow-sm max-w-xs w-full">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2">{t("categories")}</div>
          <div className="space-y-0.5">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCat(c.id)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm rounded-md transition-all flex items-center justify-between gap-2 min-w-0",
                  c.id === activeCat ? "bg-primary/10 text-primary font-medium" : "text-foreground/80 hover:bg-secondary",
                )}
              >
                <span className="truncate">{c.name}</span>
                <Badge variant="secondary" className="shrink-0 text-xs tabular-nums">
                  {(productsByCategory[c.id] ?? []).length}
                </Badge>
              </button>
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden shadow-sm h-fit">
          <div className="grid grid-cols-[250px_120px_140px_100px] gap-4 px-5 py-3 border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <div>{t("name")}</div><div className="text-right">{t("price")}</div><div>{t("options")}</div><div className="text-right">{t("actions")}</div>
          </div>
          <div className="divide-y divide-border">
            {loading ? <div className="px-5 py-8 text-center text-sm text-muted-foreground">Loading...</div> : paged.length === 0 && <div className="px-5 py-8 text-center text-sm text-muted-foreground">—</div>}
            {paged.map((p) => (
              <div key={p.id} className="grid grid-cols-[250px_120px_140px_100px] gap-4 px-5 py-3 items-center hover:bg-muted/30 transition-colors">
                <div className="font-medium text-sm">{p.name}</div>
                <div className="text-right font-mono text-sm tabular-nums">€ {p.price.toFixed(2)}</div>
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={() => void openProductSubproducts(p)}
                  >
                    <Badge variant="secondary" className="font-normal text-xs">{t("subproducts")}</Badge>
                  </Button>
                </div>
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7"><ShoppingCart className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setDeleteItem(p)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>

          {filtered.length > 0 && (
            <DataPagination
              page={currentPage}
              pageSize={pageSize}
              totalItems={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          )}
        </Card>
      </div>}

      <ProductFormDialog
        open={productModalOpen}
        onOpenChange={closeProductModal}
        productId={editOpen && editing ? editing.id : null}
        categories={categories}
        defaultCategoryId={activeCat || categories[0]?.id || ""}
        onSaved={() => void loadData()}
      />

      <DeleteDialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)} itemName={deleteItem?.name ?? ""} onConfirm={confirmDelete} />

      <ProductOrderingDialog
        open={orderingOpen}
        onOpenChange={setOrderingOpen}
        categories={categories}
        productsByCategory={productsByCategory}
      />
      <VatDialog
        open={vatOpen}
        onOpenChange={setVatOpen}
        products={items}
        vatByProduct={vatByProduct}
        onApply={applyVat}
        saving={vatBulkSaving}
      />
      <ProductListDialog
        open={listOpen}
        onOpenChange={setListOpen}
        products={items}
        priceGroups={priceGroups}
        pricesByGroup={pricesByGroup}
        onChange={updateGroupPrice}
      />
      <ProductSubproductsDialog
        open={subproductsOpen}
        onOpenChange={(open) => {
          setSubproductsOpen(open);
          if (!open) {
            subproductsLinksDirtyRef.current = false;
            setSubproductsProduct(null);
            resetSubproductsState();
          }
        }}
        productName={subproductsProduct?.name || ""}
        loading={subproductsLoading}
        saving={subproductsSaving}
        groups={subproductGroups}
        selectedGroupId={subproductsGroupId}
        onSelectGroupId={(id) => {
          subproductsLinksDirtyRef.current = true;
          setSubproductsGroupId(id);
        }}
        groupSubproducts={groupSubproducts}
        linked={linkedSubproducts}
        leftSelected={leftSelectedSubproducts}
        rightSelected={rightSelectedSubproducts}
        onToggleLeft={(id, checked) => {
          setLeftSelectedSubproducts((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
          });
        }}
        onToggleRight={(id, checked) => {
          setRightSelectedSubproducts((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
          });
        }}
        onSelectAllLeft={(checked) => {
          if (!checked) {
            setLeftSelectedSubproducts(new Set());
            return;
          }
          const linkedIds = new Set(linkedSubproducts.map((l) => l.subproductId));
          setLeftSelectedSubproducts(new Set(groupSubproducts.filter((sp) => !linkedIds.has(sp.id)).map((sp) => sp.id)));
        }}
        onSelectAllRight={(checked) => {
          if (!checked) {
            setRightSelectedSubproducts(new Set());
            return;
          }
          setRightSelectedSubproducts(new Set(linkedSubproducts.map((l) => l.subproductId)));
        }}
        onAddSelected={addSelectedSubproducts}
        onRemoveSelected={removeSelectedSubproducts}
        onSave={saveProductSubproducts}
        onUserEdited={() => {
          subproductsLinksDirtyRef.current = true;
        }}
      />
    </>
  );
}
