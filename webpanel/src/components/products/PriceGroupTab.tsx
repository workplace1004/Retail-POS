import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Tag, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudDialog, DeleteDialog } from "../CrudDialog";
import { DataPagination } from "../DataPagination";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { TableCardSkeleton } from "./CustomizePosSkeleton";

interface PriceGroup { id: string; name: string; vat: string; sortOrder?: number; }

const vatOptions = ["Standaard", "Take-out", "Eat-in"];

export function PriceGroupTab() {
  const { t } = useLanguage();
  const [items, setItems] = useState<PriceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PriceGroup | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<PriceGroup | null>(null);
  const [form, setForm] = useState({ name: "", vat: vatOptions[0] });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const loadPriceGroups = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const rows = await apiRequest<Array<{ id: string; name: string; tax: string | null; sortOrder?: number }>>("/api/price-groups");
      setItems(
        (Array.isArray(rows) ? rows : []).map((row) => ({
          id: row.id,
          name: row.name,
          vat: row.tax || vatOptions[0],
          sortOrder: row.sortOrder,
        })),
      );
    } catch (error) {
      if (!silent) {
        toast({
          variant: "destructive",
          description: error instanceof Error ? error.message : "Failed to load price groups.",
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void loadPriceGroups();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      void loadPriceGroups(true);
    }, 2500);
    return () => window.clearInterval(id);
  }, []);

  const openNew = () => { setEditing(null); setForm({ name: "", vat: vatOptions[0] }); setOpen(true); };
  const openEdit = (it: PriceGroup) => { setEditing(it); setForm({ name: it.name, vat: it.vat || vatOptions[0] }); setOpen(true); };
  const submit = async () => {
    try {
      if (editing) {
        await apiRequest(`/api/price-groups/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: form.name, tax: form.vat }),
        });
      } else {
        await apiRequest("/api/price-groups", {
          method: "POST",
          body: JSON.stringify({ name: form.name, tax: form.vat }),
        });
      }
      setOpen(false);
      await loadPriceGroups();
    } catch (error) {
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "Failed to save price group.",
      });
    }
  };
  const confirmDelete = async () => {
    if (!deleteItem) return;
    try {
      await apiRequest(`/api/price-groups/${deleteItem.id}`, { method: "DELETE" });
      setDeleteItem(null);
      await loadPriceGroups();
    } catch (error) {
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "Failed to delete price group.",
      });
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || i.vat.toLowerCase().includes(q),
    );
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
          <Plus className="h-4 w-4" /> {t("newPriceGroup")}
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
        <div className="grid grid-cols-[1fr_2fr_100px] gap-4 px-5 py-3 border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <div>{t("name")}</div>
          <div>{t("vat")}</div>
          <div className="text-right">{t("actions")}</div>
        </div>
        <div className="divide-y divide-border">
          {paged.map((it) => (
            <div key={it.id} className="grid grid-cols-[1fr_2fr_100px] gap-4 px-5 py-3 items-center hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2 font-medium text-sm">
                <Tag className="h-3.5 w-3.5 text-primary" />{it.name}
              </div>
              <div className="text-sm text-muted-foreground">{it.vat}</div>
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

      <CrudDialog open={open} onOpenChange={setOpen} title={editing ? t("editPriceGroup") : t("newPriceGroup")} onSubmit={submit}>
        <div className="grid grid-cols-[100px_1fr] items-center gap-4">
          <Label className="text-right">{t("name")} :</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-[100px_1fr] items-center gap-4">
          <Label className="text-right">{t("vat")} :</Label>
          <Select value={form.vat} onValueChange={(v) => setForm({ ...form, vat: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {vatOptions.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CrudDialog>

      <DeleteDialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)} itemName={deleteItem?.name ?? ""} onConfirm={confirmDelete} />
    </>
  );
}
