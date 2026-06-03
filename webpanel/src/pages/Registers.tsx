import { useCallback, useEffect, useState } from "react";
import { Monitor, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

type PosUserOption = { id: string; name: string; label: string; role: string };
type PosRegisterRow = {
  id: string;
  name: string;
  ipAddress: string;
  users: { id: string; name: string }[];
  createdAt: string;
  updatedAt: string;
};

const Registers = () => {
  const { t } = useLanguage();
  const [rows, setRows] = useState<PosRegisterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [posUsers, setPosUsers] = useState<PosUserOption[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PosRegisterRow | null>(null);
  const [formName, setFormName] = useState("");
  const [formIp, setFormIp] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const [deleteRow, setDeleteRow] = useState<PosRegisterRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [regs, users] = await Promise.all([
        apiRequest<PosRegisterRow[]>("/api/webpanel/pos-registers"),
        apiRequest<PosUserOption[]>("/api/webpanel/pos-users"),
      ]);
      setRows(Array.isArray(regs) ? regs : []);
      setPosUsers(Array.isArray(users) ? users : []);
    } catch (e) {
      setRows([]);
      setPosUsers([]);
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : t("registersLoadFailed"),
      });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setFormName("");
    setFormIp("");
    setSelectedUserIds(new Set());
    setDialogOpen(true);
  };

  const openEdit = (r: PosRegisterRow) => {
    setEditing(r);
    setFormName(r.name || "");
    setFormIp(r.ipAddress);
    setSelectedUserIds(new Set(r.users.map((u) => u.id)));
    setDialogOpen(true);
  };

  const toggleUser = (id: string, checked: boolean) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const save = async () => {
    const name = formName.trim();
    if (!name) {
      toast({ variant: "destructive", description: t("registerNameRequired") });
      return;
    }
    const ip = formIp.trim();
    if (!ip) {
      toast({ variant: "destructive", description: t("registerIpRequired") });
      return;
    }
    setSaving(true);
    try {
      const userIds = [...selectedUserIds];
      if (editing) {
        await apiRequest(`/api/webpanel/pos-registers/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name,
            ipAddress: ip,
            userIds,
          }),
        });
      } else {
        await apiRequest("/api/webpanel/pos-registers", {
          method: "POST",
          body: JSON.stringify({
            name,
            ipAddress: ip,
            userIds,
          }),
        });
      }
      toast({ description: t("registerSaved") });
      setDialogOpen(false);
      await load();
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : t("registerSaveFailed"),
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteRow) return;
    try {
      await apiRequest(`/api/webpanel/pos-registers/${deleteRow.id}`, { method: "DELETE" });
      setDeleteRow(null);
      toast({ description: t("registerDeleted") });
      await load();
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : t("registerDeleteFailed"),
      });
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title={t("registers")}
        description={t("registersPageDescription")}
        icon={<Monitor className="h-5 w-5" />}
      />
      <div className="flex justify-center mb-4">
        <Button
          size="sm"
          onClick={openCreate}
          disabled={loading}
          className="gap-1.5 bg-gradient-primary text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> {t("newRegister")}
        </Button>
      </div>

      <Card className="max-w-4xl mx-auto overflow-hidden shadow-card">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">—</div>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-1 sm:grid-cols-[1fr_140px_1fr_auto] gap-3 px-5 py-4 items-center hover:bg-muted/30 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate">{r.name || "—"}</div>
                  <div className="text-xs text-muted-foreground font-mono">{r.ipAddress}</div>
                </div>
                <div className="text-muted-foreground text-xs sm:text-sm">
                  {r.users.length ? r.users.map((u) => u.name).join(", ") : "—"}
                </div>
                <div className="text-xs text-muted-foreground hidden sm:block truncate">
                  {new Date(r.createdAt).toLocaleString()}
                </div>
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => setDeleteRow(r)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t("editRegister") : t("newRegister")}</DialogTitle>
            <DialogDescription>{t("registerFormIpHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="register-display-name">{t("registerDisplayName")}</Label>
              <Input
                id="register-display-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t("registerDisplayNamePlaceholder")}
                required
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("registerIpLabel")}</Label>
              <Input
                value={formIp}
                onChange={(e) => setFormIp(e.target.value)}
                placeholder="192.168.1.10"
                className="font-mono"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("registerAssignedUsers")}</Label>
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border p-3">
                {posUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("noPosUsersForRegister")}</p>
                ) : (
                  posUsers.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={selectedUserIds.has(u.id)} onCheckedChange={(c) => toggleUser(u.id, c === true)} />
                      <span>{u.name || u.label}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="button" disabled={saving} onClick={() => void save()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteRow}
        onOpenChange={(o) => !o && setDeleteRow(null)}
        title={t("deleteRegisterConfirm")}
        description={deleteRow ? `${deleteRow.name || deleteRow.ipAddress}` : ""}
        onConfirm={() => void confirmDelete()}
      />
    </AppLayout>
  );
};

export default Registers;
