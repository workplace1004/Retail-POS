import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CrudDialog, DeleteDialog } from "../CrudDialog";
import { DataPagination } from "../DataPagination";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { TableCardSkeleton } from "./CustomizePosSkeleton";

interface Category { id: string; name: string; inWebshop: boolean; }

export function CategoriesTab() {
  const { t } = useLanguage();
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: "", inWebshop: true });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const loadCategories = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const rows = await apiRequest<Array<{ id: string; name: string; inWebshop: boolean; sortOrder: number }>>("/api/categories");
      setItems(Array.isArray(rows) ? rows : []);
    } catch (error) {
      if (!silent) {
        toast({
          variant: "destructive",
          description: error instanceof Error ? error.message : "Failed to load categories.",
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      void loadCategories(true);
    }, 2500);
    return () => window.clearInterval(id);
  }, []);

  const openNew = () => { setEditing(null); setForm({ name: "", inWebshop: true }); setOpen(true); };
  const openEdit = (it: Category) => { setEditing(it); setForm({ name: it.name, inWebshop: it.inWebshop }); setOpen(true); };
  const submit = async () => {
    try {
      if (editing) {
        await apiRequest(`/api/categories/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: form.name, inWebshop: form.inWebshop }),
        });
      } else {
        await apiRequest("/api/categories", {
          method: "POST",
          body: JSON.stringify({ name: form.name, inWebshop: form.inWebshop }),
        });
      }
      setOpen(false);
      await loadCategories();
    } catch (error) {
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "Failed to save category.",
      });
    }
  };
  const confirmDelete = async () => {
    if (!deleteItem) return;
    try {
      await apiRequest(`/api/categories/${deleteItem.id}`, { method: "DELETE" });
      setDeleteItem(null);
      await loadCategories();
    } catch (error) {
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "Failed to delete category.",
      });
    }
  };

  const move = (id: string, dir: -1 | 1) => {
    const idx = items.findIndex((i) => i.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= items.length) return;
    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    setItems(next);
    void (async () => {
      try {
        await Promise.all(
          next.map((category, index) =>
            apiRequest(`/api/categories/${category.id}`, {
              method: "PATCH",
              body: JSON.stringify({ sortOrder: index + 1 }),
            }),
          ),
        );
      } catch {
        // keep optimistic order in UI; next refresh restores backend order
      }
    })();
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

  return (
    <>
      <Card className="mb-4 flex max-w-lg flex-wrap items-center gap-2 px-4 py-2.5 shadow-sm mx-auto">
        <Button size="sm" onClick={openNew} className="gap-1.5 bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-sm">
          <Plus className="h-4 w-4" /> {t("newCategory")}
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
        <div className="grid grid-cols-[150px_1fr_220px_200px] gap-4 px-5 py-3 border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <div>{t("sortOrder")}</div>
          <div>{t("name")}</div>
          <div className="text-center">{t("inWebshop")}</div>
          <div className="text-right">{t("actions")}</div>
        </div>
        <div className="divide-y divide-border">
          {paged.map((it) => {
            const globalIdx = items.findIndex((i) => i.id === it.id);
            return (
              <div key={it.id} className="grid grid-cols-[150px_1fr_220px_200px] gap-4 px-5 py-3 items-center hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={globalIdx === items.length - 1} onClick={() => move(it.id, 1)} aria-label={t("moveDown")}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={globalIdx === 0} onClick={() => move(it.id, -1)} aria-label={t("moveUp")}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="font-medium text-sm">{it.name}</div>
                <div className="flex justify-center">
                  <Checkbox
                    checked={it.inWebshop}
                    onCheckedChange={(v) => {
                      const nextValue = !!v;
                      setItems(items.map((i) => (i.id === it.id ? { ...i, inWebshop: nextValue } : i)));
                      void apiRequest(`/api/categories/${it.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ inWebshop: nextValue }),
                      }).catch(() => {
                        setItems(items);
                      });
                    }}
                  />
                </div>
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(it)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setDeleteItem(it)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
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

      <CrudDialog open={open} onOpenChange={setOpen} title={editing ? t("editCategory") : t("newCategory")} onSubmit={submit}>
        <div className="grid grid-cols-[120px_1fr] items-center gap-4">
          <Label className="text-right">{t("name")} :</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-[120px_1fr] items-center gap-4">
          <Label className="text-right">{t("inWebshop")} :</Label>
          <div>
            <Checkbox checked={form.inWebshop} onCheckedChange={(v) => setForm({ ...form, inWebshop: !!v })} />
          </div>
        </div>
      </CrudDialog>

      <DeleteDialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)} itemName={deleteItem?.name ?? ""} onConfirm={confirmDelete} />
    </>
  );
}
