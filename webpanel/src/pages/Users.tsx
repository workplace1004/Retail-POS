import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Users as UsersIcon, Plus, Pencil, Trash2, User, Cloud, Save, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { TabsBar } from "@/components/TabsBar";
import { DataPagination } from "@/components/DataPagination";
import { DeleteDialog } from "@/components/CrudDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

type ApiUser = { id: string; name: string; label: string; role: string };
type WebpanelListUser = { id: string; email: string; name: string; createdAt: string };
type PosRole = "admin" | "waiter";

function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function normalizePinInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 4);
}

function isValidFourDigitPin(pin: string): boolean {
  return /^[0-9]{4}$/.test(pin.trim());
}

const permissionKeys = [
  ["finalizeTables", "tableReturns", "cancelPlannedOrders"],
  ["editCustomers", "historyReturns", "cashMachineManualReceive"],
  ["openDrawer", "looseReturns", "createNewCustomer"],
  ["discountPerm", "showInSellerList", "revenueVisible"],
] as const;

type PermissionKey = (typeof permissionKeys)[number][number];

function defaultPermissionsAllGranted(): Record<PermissionKey, boolean> {
  const o = {} as Record<PermissionKey, boolean>;
  for (const key of permissionKeys.flat()) {
    o[key] = true;
  }
  return o;
}

function colorClassForUserId(id: string): string {
  const palette = [
    "bg-sky-400",
    "bg-emerald-500",
    "bg-yellow-400",
    "bg-rose-500",
    "bg-gray-400",
    "bg-slate-800",
    "bg-orange-500",
    "bg-fuchsia-500",
    "bg-pink-300",
    "bg-blue-500",
    "bg-cyan-500",
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

const Users = () => {
  const { t } = useLanguage();
  const { user: authUser } = useAuth();
  const [tab, setTab] = useState("pos");
  const [open, setOpen] = useState(false);
  const [modalTab, setModalTab] = useState<"general" | "permissions">("general");
  const [posPage, setPosPage] = useState(1);
  const [posPageSize, setPosPageSize] = useState(10);

  const [posUsers, setPosUsers] = useState<ApiUser[]>([]);
  const [posLoading, setPosLoading] = useState(true);
  const [modalLoading, setModalLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formPin, setFormPin] = useState("");
  const [formRole, setFormRole] = useState<PosRole>("waiter");
  const [formPermissions, setFormPermissions] = useState<Record<PermissionKey, boolean>>(() =>
    defaultPermissionsAllGranted(),
  );
  const [deleteUser, setDeleteUser] = useState<ApiUser | null>(null);

  const [webUsers, setWebUsers] = useState<WebpanelListUser[]>([]);
  const [webLoading, setWebLoading] = useState(false);
  const [webPage, setWebPage] = useState(1);
  const [webPageSize, setWebPageSize] = useState(10);
  const [webOpen, setWebOpen] = useState(false);
  const [webEditingId, setWebEditingId] = useState<string | null>(null);
  const [webFormEmail, setWebFormEmail] = useState("");
  const [webFormName, setWebFormName] = useState("");
  const [webFormPassword, setWebFormPassword] = useState("");
  const [webSaving, setWebSaving] = useState(false);
  const [deleteWebUser, setDeleteWebUser] = useState<WebpanelListUser | null>(null);

  const loadPosUsers = useCallback(async () => {
    setPosLoading(true);
    try {
      const rows = await apiRequest<ApiUser[]>("/api/webpanel/pos-users");
      setPosUsers(Array.isArray(rows) ? rows : []);
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Failed to load users.",
      });
      setPosUsers([]);
    } finally {
      setPosLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPosUsers();
  }, [loadPosUsers]);

  const loadWebUsers = useCallback(async () => {
    setWebLoading(true);
    try {
      const rows = await apiRequest<WebpanelListUser[]>("/api/webpanel/users");
      setWebUsers(Array.isArray(rows) ? rows : []);
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Failed to load web panel users.",
      });
      setWebUsers([]);
    } finally {
      setWebLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "web") void loadWebUsers();
  }, [tab, loadWebUsers]);

  const pagedPosUsers = useMemo(() => {
    const start = (posPage - 1) * posPageSize;
    return posUsers.slice(start, start + posPageSize);
  }, [posPage, posPageSize, posUsers]);

  const pagedWebUsers = useMemo(() => {
    const start = (webPage - 1) * webPageSize;
    return webUsers.slice(start, start + webPageSize);
  }, [webPage, webPageSize, webUsers]);

  const resetWebForm = () => {
    setWebEditingId(null);
    setWebFormEmail("");
    setWebFormName("");
    setWebFormPassword("");
  };

  const openWebNew = () => {
    resetWebForm();
    setWebOpen(true);
  };

  const openWebEdit = (u: WebpanelListUser) => {
    setWebEditingId(u.id);
    setWebFormEmail(u.email);
    setWebFormName(u.name);
    setWebFormPassword("");
    setWebOpen(true);
  };

  const handleWebSave = async () => {
    const email = webFormEmail.trim().toLowerCase();
    const name = webFormName.trim();
    const password = webFormPassword;
    if (!isValidEmailFormat(email)) {
      toast({ variant: "destructive", description: t("webpanelEmailInvalid") });
      return;
    }
    if (!webEditingId && password.length < 6) {
      toast({ variant: "destructive", description: t("webpanelPasswordRequired") });
      return;
    }
    if (webEditingId && password !== "" && password.length < 6) {
      toast({ variant: "destructive", description: t("webpanelPasswordRequired") });
      return;
    }
    setWebSaving(true);
    try {
      if (webEditingId) {
        const body: { email: string; name: string; password?: string } = {
          email,
          name: name || email,
        };
        if (password !== "") body.password = password;
        await apiRequest(`/api/webpanel/users/${webEditingId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await apiRequest("/api/webpanel/users", {
          method: "POST",
          body: JSON.stringify({
            email,
            name: name || email,
            password,
          }),
        });
      }
      toast({ description: t("save") });
      setWebOpen(false);
      resetWebForm();
      await loadWebUsers();
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      let msg = raw;
      try {
        const j = JSON.parse(raw) as { error?: string };
        if (j?.error) msg = j.error;
      } catch {
        /* plain */
      }
      if (/already registered/i.test(msg)) {
        toast({ variant: "destructive", description: t("webpanelEmailInUse") });
      } else if (/cannot delete your own/i.test(msg)) {
        toast({ variant: "destructive", description: t("webpanelCannotDeleteSelf") });
      } else {
        toast({ variant: "destructive", description: msg || "Failed to save." });
      }
    } finally {
      setWebSaving(false);
    }
  };

  const confirmWebDelete = async () => {
    if (!deleteWebUser) return;
    try {
      await apiRequest(`/api/webpanel/users/${deleteWebUser.id}`, { method: "DELETE" });
      setDeleteWebUser(null);
      await loadWebUsers();
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      let msg = raw;
      try {
        const j = JSON.parse(raw) as { error?: string };
        if (j?.error) msg = j.error;
      } catch {
        /* plain */
      }
      if (/cannot delete your own/i.test(msg)) {
        toast({ variant: "destructive", description: t("webpanelCannotDeleteSelf") });
      } else {
        toast({ variant: "destructive", description: msg || "Failed to delete." });
      }
    }
  };

  const tabs = [
    { id: "pos", label: t("posUsers"), icon: <User className="h-4 w-4" /> },
    { id: "web", label: t("webpanelUsers"), icon: <Cloud className="h-4 w-4" /> },
  ];

  const resetForm = () => {
    setEditingId(null);
    setFormName("");
    setFormPin("");
    setFormRole("waiter");
    setFormPermissions(defaultPermissionsAllGranted());
  };

  const openNew = () => {
    setModalTab("general");
    resetForm();
    setOpen(true);
  };

  const openEdit = async (u: ApiUser) => {
    setModalTab("general");
    setEditingId(u.id);
    setFormName(u.name);
    setFormRole(u.role === "admin" ? "admin" : "waiter");
    setFormPin("");
    setFormPermissions(defaultPermissionsAllGranted());
    setOpen(true);
    setModalLoading(true);
    try {
      const detail = await apiRequest<{ pin?: string }>(`/api/users/${u.id}`);
      setFormPin(normalizePinInput(String(detail.pin ?? "")));
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Failed to load user.",
      });
    } finally {
      setModalLoading(false);
    }
  };

  const handleSave = async () => {
    const name = formName.trim();
    const pinDigits = normalizePinInput(formPin);
    if (!name) {
      toast({ variant: "destructive", description: t("usersNameRequired") });
      return;
    }
    if (!editingId && !isValidFourDigitPin(pinDigits)) {
      toast({ variant: "destructive", description: t("usersPinMustBe4") });
      return;
    }
    if (editingId && pinDigits !== "" && !isValidFourDigitPin(pinDigits)) {
      toast({ variant: "destructive", description: t("usersPinMustBe4") });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const patchBody: { name: string; role: PosRole; pin?: string } = { name, role: formRole };
        if (pinDigits !== "") patchBody.pin = pinDigits;
        await apiRequest(`/api/users/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(patchBody),
        });
      } else {
        await apiRequest("/api/users", {
          method: "POST",
          body: JSON.stringify({
            name,
            pin: pinDigits,
            role: formRole,
          }),
        });
      }
      toast({ description: t("save") });
      setOpen(false);
      resetForm();
      await loadPosUsers();
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Failed to save user.",
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteUser) return;
    try {
      await apiRequest(`/api/users/${deleteUser.id}`, { method: "DELETE" });
      setDeleteUser(null);
      await loadPosUsers();
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Failed to delete user.",
      });
    }
  };

  const roleLabel = (role: string) => (role === "admin" ? t("administrator") : t("userRole"));

  return (
    <AppLayout>
      <PageHeader title={t("users")} description={t("posUsers")} icon={<UsersIcon className="h-5 w-5" />} />
      <TabsBar tabs={tabs} active={tab} onChange={setTab} />

      {tab === "pos" && (
        <>
        <Card className="max-w-3xl mx-auto p-2 shadow-card">
          <div className="flex justify-center py-3 border-b border-border">
            <Button variant="ghost" size="sm" className="gap-1.5 text-primary hover:text-primary" onClick={openNew}>
              <Plus className="h-4 w-4" /> {t("newPosUser")}
            </Button>
          </div>
          {posLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <>
              <div className="divide-y divide-border">
                {pagedPosUsers.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">—</div>
                ) : (
                  pagedPosUsers.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center relative gap-4 px-4 py-3 hover:bg-muted/30 transition-colors rounded-md"
                    >
                      <div
                        className={`h-9 w-9 rounded-full ${colorClassForUserId(u.id)} flex items-center justify-center text-white text-sm font-semibold shrink-0`}
                      >
                        {(u.name || "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{u.name}</div>
                      </div>
                      <Badge variant={u.role === "admin" ? "default" : "secondary"} className="font-normal absolute left-1/2 -translate-x-1/2 shrink-0">
                        {roleLabel(u.role)}
                      </Badge>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void openEdit(u)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:text-destructive"
                          onClick={() => setDeleteUser(u)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <DataPagination
                page={posPage}
                pageSize={posPageSize}
                totalItems={posUsers.length}
                onPageChange={setPosPage}
                onPageSizeChange={(s) => {
                  setPosPageSize(s);
                  setPosPage(1);
                }}
              />
            </>
          )}
        </Card>
        </>
      )}

      {tab === "web" && (
        <Card className="max-w-3xl mx-auto p-2 shadow-card">
          <div className="flex justify-center py-3 border-b border-border">
            <Button variant="ghost" size="sm" className="gap-1.5 text-primary hover:text-primary" onClick={openWebNew}>
              <Plus className="h-4 w-4" /> {t("webpanelNewUser")}
            </Button>
          </div>
          {webLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <>
              <div className="divide-y divide-border">
                {pagedWebUsers.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">—</div>
                ) : (
                  pagedWebUsers.map((u) => {
                    const isSelf = authUser?.id === u.id;
                    return (
                      <div
                        key={u.id}
                        className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors rounded-md"
                      >
                        <div
                          className={`h-9 w-9 rounded-full ${colorClassForUserId(u.id)} flex items-center justify-center text-white text-sm font-semibold shrink-0`}
                        >
                          {(u.name || u.email || "?")[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{u.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                          <div className="text-[11px] text-muted-foreground/80 mt-0.5">
                            {t("webpanelCreated")}: {format(parseISO(u.createdAt), "dd-MM-yyyy HH:mm")}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {isSelf ? (
                            <Badge variant="outline" className="font-normal text-xs">
                              {t("webYouBadge")}
                            </Badge>
                          ) : null}
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openWebEdit(u)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:text-destructive disabled:opacity-40"
                              disabled={isSelf}
                              title={isSelf ? t("webpanelCannotDeleteSelf") : undefined}
                              onClick={() => !isSelf && setDeleteWebUser(u)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <DataPagination
                page={webPage}
                pageSize={webPageSize}
                totalItems={webUsers.length}
                onPageChange={setWebPage}
                onPageSizeChange={(s) => {
                  setWebPageSize(s);
                  setWebPage(1);
                }}
              />
            </>
          )}
        </Card>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            resetForm();
            setModalLoading(false);
          }
        }}
      >
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogTitle className="sr-only">{t("users")}</DialogTitle>
          <DialogDescription className="sr-only">
            {modalTab === "general" ? `${t("general")} — ${t("posUsers")}` : t("permissions")}
          </DialogDescription>
          <div className="flex items-center justify-center gap-16 border-b border-border px-6 pt-5 pb-3">
            <button
              type="button"
              onClick={() => setModalTab("general")}
              className={cn(
                "text-sm font-medium pb-2 -mb-3 border-b-2 transition-colors",
                modalTab === "general"
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground",
              )}
            >
              {t("general")}
            </button>
            <button
              type="button"
              onClick={() => setModalTab("permissions")}
              className={cn(
                "text-sm font-medium pb-2 -mb-3 border-b-2 transition-colors",
                modalTab === "permissions"
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground",
              )}
            >
              {t("permissions")}
            </button>
          </div>

          {modalLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : modalTab === "general" ? (
            <div className="flex flex-col w-full justify-center items-center gap-8 p-8">
              <div className="space-y-5 max-w-md">
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm" htmlFor="user-name">
                    {t("name")}:
                  </Label>
                  <Input
                    id="user-name"
                    className="h-9 bg-muted/50"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm" htmlFor="user-pin">
                    {t("pincode")}:
                  </Label>
                  <Input
                    id="user-pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="0000"
                    className="h-9 bg-muted/50"
                    value={formPin}
                    onChange={(e) => setFormPin(normalizePinInput(e.target.value))}
                    autoComplete="new-password"
                  />
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <Label className="text-sm">{t("role")}:</Label>
                  <Select value={formRole} onValueChange={(v) => setFormRole(v as PosRole)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">{t("administrator")}</SelectItem>
                      <SelectItem value="waiter">{t("userRole")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-x-10 gap-y-5 p-8">
              {permissionKeys.flat().map((key) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <Label className="text-sm text-foreground">{t(key as never)} :</Label>
                  <Checkbox
                    checked={formPermissions[key]}
                    onCheckedChange={(v) =>
                      setFormPermissions((prev) => ({ ...prev, [key]: v === true }))
                    }
                  />
                </div>
              ))}
            </div>
          )}

          {!modalLoading && (
            <div className="flex justify-center pb-6">
              <Button variant="ghost" size="sm" className="gap-2" disabled={saving} onClick={() => void handleSave()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t("save")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={webOpen}
        onOpenChange={(next) => {
          setWebOpen(next);
          if (!next) resetWebForm();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogTitle>{webEditingId ? t("webpanelEditUser") : t("webpanelNewUser")}</DialogTitle>
          <DialogDescription className="sr-only">Web panel user</DialogDescription>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="web-email">{t("email")}</Label>
              <Input
                id="web-email"
                type="email"
                autoComplete="off"
                value={webFormEmail}
                onChange={(e) => setWebFormEmail(e.target.value)}
                disabled={webSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="web-name">{t("name")}</Label>
              <Input
                id="web-name"
                value={webFormName}
                onChange={(e) => setWebFormName(e.target.value)}
                disabled={webSaving}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="web-pw">{t("webpanelPasswordLabel")}</Label>
              <Input
                id="web-pw"
                type="password"
                autoComplete="new-password"
                placeholder={webEditingId ? t("webpanelPasswordPlaceholderEdit") : undefined}
                value={webFormPassword}
                onChange={(e) => setWebFormPassword(e.target.value)}
                disabled={webSaving}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" type="button" onClick={() => setWebOpen(false)} disabled={webSaving}>
              {t("cancel")}
            </Button>
            <Button type="button" disabled={webSaving} onClick={() => void handleWebSave()}>
              {webSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={!!deleteUser}
        onOpenChange={(o) => !o && setDeleteUser(null)}
        itemName={deleteUser?.name ?? ""}
        onConfirm={() => void confirmDelete()}
      />

      <DeleteDialog
        open={!!deleteWebUser}
        onOpenChange={(o) => !o && setDeleteWebUser(null)}
        itemName={deleteWebUser ? `${deleteWebUser.name} (${deleteWebUser.email})` : ""}
        onConfirm={() => void confirmWebDelete()}
      />
    </AppLayout>
  );
};

export default Users;
