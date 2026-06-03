import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Layers, Search, Settings2, Image as ImageIcon, ArrowUp, ArrowDown, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudDialog, DeleteDialog } from "../CrudDialog";
import { DataPagination } from "../DataPagination";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { TwoPaneSkeleton } from "./CustomizePosSkeleton";

interface Subproduct {
  id: string;
  name: string;
  keyName: string;
  group: string;
  price: number;
  vatTakeOut: string;
  kioskPhoto?: string;
  linkedCategories: string[];
}

const vatOptions = ["--", "0%", "6%", "12%", "21%"];

function normalizeVatForSelect(raw: string | null | undefined): string {
  if (raw == null || raw === "") return "--";
  const s = String(raw).trim();
  if (s === "--") return "--";
  if (vatOptions.includes(s)) return s;
  const digits = s.replace(/%/g, "").trim();
  const withPct = /^\d+$/.test(digits) ? `${digits}%` : s;
  return vatOptions.includes(withPct) ? withPct : "--";
}

function namesEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  return a.every((x, i) => x === b[i]);
}

function mapEqual(a: Record<string, string>, b: Record<string, string>) {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => a[k] === b[k]);
}

export function SubproductsTab() {
  const { t, lang } = useLanguage();
  const [groups, setGroups] = useState<string[]>([]);
  const [groupIdByName, setGroupIdByName] = useState<Record<string, string>>({});
  const [subproductCountByGroupId, setSubproductCountByGroupId] = useState<Record<string, number>>({});
  const [items, setItems] = useState<Subproduct[]>([]);
  const [activeGroup, setActiveGroup] = useState("");
  const [loading, setLoading] = useState(true);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Subproduct | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<Subproduct | null>(null);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editingGroupValue, setEditingGroupValue] = useState("");
  const [selectedGroupIdx, setSelectedGroupIdx] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [selectedCatIdx, setSelectedCatIdx] = useState<number | null>(null);

  const emptyForm = (): Omit<Subproduct, "id"> => ({
    name: "", keyName: "", group: activeGroup, price: 0, vatTakeOut: "--", linkedCategories: [],
  });
  const [form, setForm] = useState<Omit<Subproduct, "id">>(emptyForm());

  const groupsSyncRef = useRef({ groups: [] as string[], groupIdByName: {} as Record<string, string> });
  groupsSyncRef.current = { groups, groupIdByName };

  const loadSubproductCounts = useCallback(async (map: Record<string, string>) => {
    const entries = Object.entries(map);
    if (entries.length === 0) {
      setSubproductCountByGroupId({});
      return;
    }
    try {
      const counts = await Promise.all(
        entries.map(async ([, groupId]) => {
          const rows = await apiRequest<Array<{ id: string }>>(`/api/subproduct-groups/${groupId}/subproducts`);
          return [groupId, Array.isArray(rows) ? rows.length : 0] as const;
        }),
      );
      setSubproductCountByGroupId(Object.fromEntries(counts));
    } catch {
      // Keep previous counts if any request fails.
    }
  }, []);

  const loadGroups = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    let names: string[] = [];
    try {
      const rows = await apiRequest<Array<{ id: string; name: string; sortOrder?: number }>>("/api/subproduct-groups");
      names = (Array.isArray(rows) ? rows : []).map((g) => g.name);
      const map = Object.fromEntries((Array.isArray(rows) ? rows : []).map((g) => [g.name, g.id]));
      const { groups: curG, groupIdByName: curM } = groupsSyncRef.current;
      if (namesEqual(curG, names) && mapEqual(curM, map)) {
        if (names.length === 0) {
          setItems([]);
          setLoading(false);
        }
        return;
      }
      setGroups(names);
      setGroupIdByName(map);
      void loadSubproductCounts(map);
      setActiveGroup((prev) => (prev && map[prev] ? prev : names[0] || ""));
    } catch (error) {
      if (!silent) {
        toast({ variant: "destructive", description: error instanceof Error ? error.message : "Failed to load subproduct groups." });
        setGroups([]);
        setGroupIdByName({});
        setSubproductCountByGroupId({});
        setActiveGroup("");
      }
    } finally {
      if (names.length === 0) {
        setItems([]);
        setLoading(false);
      }
    }
  }, [loadSubproductCounts]);

  const loadSubproducts = useCallback(async (groupName: string, silent = false) => {
    const groupId = groupIdByName[groupName];
    if (!groupId) {
      setItems([]);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const rows = await apiRequest<
        Array<{ id: string; name: string; price?: number | null; keyName?: string | null; vatTakeOut?: string | null }>
      >(`/api/subproduct-groups/${groupId}/subproducts`);
      setItems(
        (Array.isArray(rows) ? rows : []).map((row) => ({
          id: row.id,
          name: row.name,
          keyName: row.keyName != null && String(row.keyName).trim() !== "" ? String(row.keyName).trim() : "",
          group: groupName,
          price: Number(row.price ?? 0),
          vatTakeOut: normalizeVatForSelect(row.vatTakeOut ?? undefined),
          linkedCategories: [],
        })),
      );
    } catch (error) {
      if (!silent) {
        toast({ variant: "destructive", description: error instanceof Error ? error.message : "Failed to load subproducts." });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [groupIdByName]);

  useEffect(() => {
    void loadGroups();
    void (async () => {
      try {
        const categories = await apiRequest<Array<{ name: string }>>("/api/categories");
        setAllCategories((Array.isArray(categories) ? categories : []).map((c) => c.name));
      } catch {
        setAllCategories([]);
      }
    })();
  }, [loadGroups]);

  useEffect(() => {
    if (!activeGroup || Object.keys(groupIdByName).length === 0) return;
    void loadSubproducts(activeGroup);
  }, [activeGroup, groupIdByName, loadSubproducts]);

  useEffect(() => {
    if (!activeGroup || Object.keys(groupIdByName).length === 0) return;
    const timer = window.setInterval(() => {
      void (async () => {
        // Groups first so sidebar / Manage groups dialog pick up retail changes, then subproducts.
        await loadGroups({ silent: true });
        void loadSubproducts(activeGroup, true);
        void loadSubproductCounts(groupIdByName);
        try {
          const categories = await apiRequest<Array<{ name: string }>>("/api/categories");
          setAllCategories((Array.isArray(categories) ? categories : []).map((c) => c.name));
        } catch {
          // ignore
        }
      })();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [activeGroup, groupIdByName, loadGroups, loadSubproductCounts, loadSubproducts]);

  const openNew = () => { setEditing(null); setForm(emptyForm()); setSelectedCatIdx(null); setOpen(true); };
  const openEdit = (it: Subproduct) => {
    setEditing(it);
    setForm({ name: it.name, keyName: it.keyName, group: it.group, price: it.price, vatTakeOut: it.vatTakeOut, kioskPhoto: it.kioskPhoto, linkedCategories: [...it.linkedCategories] });
    setSelectedCatIdx(null);
    setOpen(true);
  };
  const submit = async () => {
    try {
      const groupId = groupIdByName[form.group];
      if (!groupId) throw new Error("Please select a valid group.");
      const keyName = form.keyName.trim() || form.name.trim();
      const vatTakeOut = form.vatTakeOut === "--" ? null : form.vatTakeOut;
      if (editing) {
        await apiRequest(`/api/subproducts/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: form.name, price: form.price, keyName: keyName || null, vatTakeOut }),
        });
      } else {
        await apiRequest("/api/subproducts", {
          method: "POST",
          body: JSON.stringify({ name: form.name, groupId, price: form.price, keyName: keyName || null, vatTakeOut }),
        });
      }
      setOpen(false);
      await loadSubproducts(activeGroup);
    } catch (error) {
      toast({ variant: "destructive", description: error instanceof Error ? error.message : "Failed to save subproduct." });
    }
  };
  const confirmDelete = async () => {
    if (!deleteItem) return;
    try {
      await apiRequest(`/api/subproducts/${deleteItem.id}`, { method: "DELETE" });
      setDeleteItem(null);
      await loadSubproducts(activeGroup);
    } catch (error) {
      toast({ variant: "destructive", description: error instanceof Error ? error.message : "Failed to delete subproduct." });
    }
  };

  const toggleCategory = (cat: string) => {
    const has = form.linkedCategories.includes(cat);
    setForm({
      ...form,
      linkedCategories: has ? form.linkedCategories.filter((c) => c !== cat) : [...form.linkedCategories, cat],
    });
  };
  const moveCategory = (dir: -1 | 1) => {
    if (selectedCatIdx === null) return;
    const target = selectedCatIdx + dir;
    if (target < 0 || target >= form.linkedCategories.length) return;
    const next = [...form.linkedCategories];
    [next[selectedCatIdx], next[target]] = [next[target], next[selectedCatIdx]];
    setForm({ ...form, linkedCategories: next });
    setSelectedCatIdx(target);
  };

  const addGroup = () => {
    const name = newGroupName.trim();
    if (!name || groups.includes(name)) return;
    void (async () => {
      try {
        await apiRequest("/api/subproduct-groups", { method: "POST", body: JSON.stringify({ name }) });
        setNewGroupName("");
        await loadGroups();
      } catch (error) {
        toast({ variant: "destructive", description: error instanceof Error ? error.message : "Failed to create group." });
      }
    })();
  };
  const removeGroup = (g: string) => {
    if (groups.length <= 1) return;
    const groupId = groupIdByName[g];
    if (!groupId) return;
    void (async () => {
      try {
        await apiRequest(`/api/subproduct-groups/${groupId}`, { method: "DELETE" });
        await loadGroups();
        if (activeGroup === g) {
          const next = groups.find((x) => x !== g) || "";
          setActiveGroup(next);
        }
        setSelectedGroupIdx(null);
      } catch (error) {
        toast({ variant: "destructive", description: error instanceof Error ? error.message : "Failed to delete group." });
      }
    })();
  };
  const startEditGroup = (g: string) => {
    setEditingGroup(g);
    setEditingGroupValue(g);
  };
  const commitEditGroup = () => {
    if (!editingGroup) return;
    const newName = editingGroupValue.trim();
    if (!newName || (newName !== editingGroup && groups.includes(newName))) {
      setEditingGroup(null);
      return;
    }
    const groupId = groupIdByName[editingGroup];
    if (!groupId) {
      setEditingGroup(null);
      return;
    }
    void (async () => {
      try {
        await apiRequest(`/api/subproduct-groups/${groupId}`, {
          method: "PATCH",
          body: JSON.stringify({ name: newName }),
        });
        if (activeGroup === editingGroup) setActiveGroup(newName);
        setEditingGroup(null);
        await loadGroups();
      } catch (error) {
        toast({ variant: "destructive", description: error instanceof Error ? error.message : "Failed to rename group." });
        setEditingGroup(null);
      }
    })();
  };
  const moveGroup = (dir: -1 | 1) => {
    if (selectedGroupIdx === null) return;
    const target = selectedGroupIdx + dir;
    if (target < 0 || target >= groups.length) return;
    const next = [...groups];
    [next[selectedGroupIdx], next[target]] = [next[target], next[selectedGroupIdx]];
    setGroups(next);
    setSelectedGroupIdx(target);
    void (async () => {
      try {
        await Promise.all(
          next.map((name, index) =>
            apiRequest(`/api/subproduct-groups/${groupIdByName[name]}`, {
              method: "PATCH",
              body: JSON.stringify({ sortOrder: index }),
            }),
          ),
        );
      } catch {
        // ignore and keep optimistic order in UI
      }
    })();
  };

  const filtered = useMemo(
    () => items.filter((i) => i.group === activeGroup && i.name.toLowerCase().includes(search.toLowerCase())),
    [items, activeGroup, search],
  );
  const paged = useMemo(() => {
    const startIdx = (page - 1) * pageSize;
    return filtered.slice(startIdx, startIdx + pageSize);
  }, [filtered, page, pageSize]);

  return (
    <>
      {/* Toolbar */}
      <Card className="mb-4 px-4 py-2.5 flex items-center max-w-3xl mx-auto justify-between gap-3 shadow-sm">
        <Button size="sm" onClick={openNew} className="gap-1.5 bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-sm">
          <Plus className="h-4 w-4" /> {t("newSubproduct")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setGroupsOpen(true)} className="gap-1.5">
          <Settings2 className="h-4 w-4" /> {t("manageGroups")}
        </Button>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t("search")}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </Card>

      {loading && <TwoPaneSkeleton />}

      {!loading && <div className="flex w-full justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
          <Card className="p-2 h-fit shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2">{t("group")}</div>
            <div className="space-y-0.5">
              {groups.map((g) => (
                <button
                  key={g}
                  onClick={() => { setActiveGroup(g); setPage(1); }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm rounded-md transition-all flex items-center justify-between",
                    g === activeGroup ? "bg-primary/10 text-primary font-medium" : "text-foreground/80 hover:bg-secondary",
                  )}
                >
                  <span className="flex items-center gap-2"><Layers className="h-3.5 w-3.5" />{g}</span>
                  <Badge variant="secondary" className="text-xs">{subproductCountByGroupId[groupIdByName[g]] ?? 0}</Badge>
                </button>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden shadow-sm h-fit">
            <div className="grid grid-cols-[300px_100px_200px] gap-4 px-5 py-3 border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <div>{t("name")}</div><div className="text-right">{t("price")}</div><div className="text-right">{t("actions")}</div>
            </div>
            <div className="divide-y divide-border">
              {paged.length === 0 && <div className="px-5 py-8 text-center text-sm text-muted-foreground">—</div>}
              {paged.map((it) => (
                <div key={it.id} className="grid grid-cols-[300px_100px_200px] gap-4 px-5 py-3 items-center hover:bg-muted/30 transition-colors">
                  <div className="font-medium text-sm">{it.name}</div>
                  <div className="text-right font-mono text-sm tabular-nums">€ {it.price.toFixed(2)}</div>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(it)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setDeleteItem(it)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>

            <DataPagination
              page={page}
              pageSize={pageSize}
              totalItems={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </Card>
        </div>
      </div>}

      {/* New / edit subproduct modal */}
      <CrudDialog open={open} onOpenChange={setOpen} title={editing ? t("editSubproduct") : t("newSubproduct")} onSubmit={submit} size="xl">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_240px] gap-6">
          {/* Left column */}
          <div className="space-y-3">
            <div className="grid grid-cols-[110px_1fr] items-center gap-3">
              <Label className="text-right text-sm">{t("name")} :</Label>
              <Input
                value={form.name}
                onChange={(e) => {
                  const nextName = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    name: nextName,
                    // Keep key name synced while user hasn't intentionally customized it.
                    keyName: prev.keyName.trim() === "" || prev.keyName === prev.name ? nextName : prev.keyName,
                  }));
                }}
              />
            </div>
            <div className="grid grid-cols-[110px_1fr] items-center gap-3">
              <Label className="text-right text-sm">{t("keyName")} :</Label>
              <Input value={form.keyName} onChange={(e) => setForm({ ...form, keyName: e.target.value })} />
            </div>
            <div className="grid grid-cols-[110px_1fr] items-center gap-3">
              <Label className="text-right text-sm">{t("price")} :</Label>
              <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: +e.target.value })} />
            </div>
            <div className="grid grid-cols-[110px_1fr] items-center gap-3">
              <Label className="text-right text-sm">{t("btwTakeOut")} :</Label>
              <Select value={form.vatTakeOut} onValueChange={(v) => setForm({ ...form, vatTakeOut: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {vatOptions.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Middle column */}
          <div className="space-y-3">
            <div className="grid grid-cols-[110px_1fr] items-center gap-3">
              <Label className="text-right text-sm">{t("group")} :</Label>
              <Select value={form.group} onValueChange={(v) => setForm({ ...form, group: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {groups.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-[110px_1fr] items-start gap-3">
              <Label className="text-right text-sm pt-2">{t("kioskPhoto")} :</Label>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-md h-28 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors text-muted-foreground">
                <ImageIcon className="h-6 w-6 mb-1" />
                <span className="text-xs">{lang === "nl" ? "Foto uploaden" : "Upload photo"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setForm({ ...form, kioskPhoto: URL.createObjectURL(f) });
                }} />
              </label>
            </div>
          </div>

          {/* Right column: linked categories */}
          <div className="space-y-2">
            <Label className="text-sm">{t("linkTo")}</Label>
            <div className="border border-border rounded-md h-[220px] overflow-y-auto bg-muted/10">
              <ul>
                {allCategories.map((cat) => {
                  const linkedIdx = form.linkedCategories.indexOf(cat);
                  const isLinked = linkedIdx >= 0;
                  return (
                    <li
                      key={cat}
                      onClick={() => {
                        toggleCategory(cat);
                        setSelectedCatIdx(isLinked ? null : form.linkedCategories.length);
                      }}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-muted/40 transition-colors",
                        isLinked && "bg-primary/10 text-primary font-medium",
                      )}
                    >
                      <span>{cat}</span>
                      {isLinked && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleCategory(cat); }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="flex items-center justify-around gap-2">
              <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => moveCategory(-1)} disabled={selectedCatIdx === null || selectedCatIdx <= 0}>
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => moveCategory(1)} disabled={selectedCatIdx === null || selectedCatIdx >= form.linkedCategories.length - 1}>
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CrudDialog>

      {/* Manage groups dialog */}
      <CrudDialog open={groupsOpen} onOpenChange={setGroupsOpen} title={t("manageGroups")} onSubmit={() => setGroupsOpen(false)} hideFooter hideHeader size="lg">
        <div className="flex items-center justify-center gap-3 pt-2">
          <Input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            className="h-9 w-56 bg-muted/60"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addGroup(); } }}
          />
          <button
            type="button"
            onClick={addGroup}
            className="text-sm text-foreground hover:text-primary transition-colors px-2 py-1"
          >
            {t("add")}
          </button>
        </div>
        <div className="border border-border rounded-md bg-card max-h-[560px] overflow-y-auto">
          {groups.length === 0 ? (
            <div className="flex h-[180px] flex-col items-center justify-center gap-2 text-muted-foreground">
              <Layers className="h-6 w-6" />
              <span className="text-sm">{lang === "nl" ? "Geen groepen" : "No groups"}</span>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {groups.map((g, idx) => {
                const isSelected = selectedGroupIdx === idx;
                const isEditing = editingGroup === g;
                return (
                  <li
                    key={g}
                    onClick={() => setSelectedGroupIdx(idx)}
                    className={cn(
                      "flex items-center justify-between px-4 py-3 text-sm cursor-pointer transition-colors",
                      isSelected ? "bg-primary/10" : "hover:bg-muted/40",
                    )}
                  >
                    {isEditing ? (
                      <Input
                        autoFocus
                        value={editingGroupValue}
                        onChange={(e) => setEditingGroupValue(e.target.value)}
                        onBlur={commitEditGroup}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); commitEditGroup(); }
                          if (e.key === "Escape") setEditingGroup(null);
                        }}
                        className="h-7 max-w-xs"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span>{g}</span>
                    )}
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); startEditGroup(g); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); removeGroup(g); }}
                        disabled={groups.length <= 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-center gap-16 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => moveGroup(-1)}
            disabled={selectedGroupIdx === null || selectedGroupIdx <= 0}
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => moveGroup(1)}
            disabled={selectedGroupIdx === null || selectedGroupIdx >= groups.length - 1}
          >
            <ArrowDown className="h-5 w-5" />
          </Button>
        </div>
      </CrudDialog>

      <DeleteDialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)} itemName={deleteItem?.name ?? ""} onConfirm={confirmDelete} />
    </>
  );
}
