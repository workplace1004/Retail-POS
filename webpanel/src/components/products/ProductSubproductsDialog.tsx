import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";

type SubproductGroup = { id: string; name: string };
type Subproduct = { id: string; name: string };
type ProductSubproductLink = {
  subproductId: string;
  subproductName: string;
  groupId: string;
  groupName: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  loading: boolean;
  saving: boolean;
  groups: SubproductGroup[];
  selectedGroupId: string;
  onSelectGroupId: (groupId: string) => void;
  groupSubproducts: Subproduct[];
  linked: ProductSubproductLink[];
  leftSelected: Set<string>;
  rightSelected: Set<string>;
  onToggleLeft: (id: string, checked: boolean) => void;
  onToggleRight: (id: string, checked: boolean) => void;
  onSelectAllLeft: (checked: boolean) => void;
  onSelectAllRight: (checked: boolean) => void;
  onAddSelected: () => void;
  onRemoveSelected: () => void;
  onSave: () => void;
  /** Marks local edits so server polling does not overwrite in-flight UI changes. */
  onUserEdited?: () => void;
}

export function ProductSubproductsDialog({
  open,
  onOpenChange,
  productName,
  loading,
  saving,
  groups,
  selectedGroupId,
  onSelectGroupId,
  groupSubproducts,
  linked,
  leftSelected,
  rightSelected,
  onToggleLeft,
  onToggleRight,
  onSelectAllLeft,
  onSelectAllRight,
  onAddSelected,
  onRemoveSelected,
  onSave,
  onUserEdited,
}: Props) {
  const { t } = useLanguage();

  const available = useMemo(() => {
    const linkedIds = new Set(linked.map((l) => l.subproductId));
    return groupSubproducts.filter((sp) => !linkedIds.has(sp.id));
  }, [groupSubproducts, linked]);

  const leftAllChecked = available.length > 0 && available.every((sp) => leftSelected.has(sp.id));
  const rightAllChecked = linked.length > 0 && linked.every((sp) => rightSelected.has(sp.subproductId));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t("subproducts")} — {productName || "-"}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t("loadingEllipsis")}
          </div>
        ) : (
          <div
            className="space-y-4"
            onChangeCapture={() => onUserEdited?.()}
            onInputCapture={() => onUserEdited?.()}
          >
            <Select value={selectedGroupId || "__none__"} onValueChange={(v) => onSelectGroupId(v === "__none__" ? "" : v)}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder={t("selectGroup")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("withoutGroup")}</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
              <div className="border rounded-lg overflow-hidden">
                <div className="px-3 py-2 border-b text-sm font-medium">{t("availableInGroup")}</div>
                <label className="flex items-center gap-2 px-3 py-2 border-b text-sm">
                  <Checkbox checked={leftAllChecked} onCheckedChange={(v) => onSelectAllLeft(!!v)} />
                  <span>{t("selectAll")}</span>
                </label>
                <div className="min-h-[280px] max-h-[280px] overflow-auto p-2 space-y-1">
                  {!selectedGroupId ? (
                    <div className="text-sm text-muted-foreground px-2 py-3">{t("selectGroupFirst")}</div>
                  ) : available.length === 0 ? (
                    <div className="text-sm text-muted-foreground px-2 py-3">{t("allLinkedInGroup")}</div>
                  ) : (
                    available.map((sp) => (
                      <label key={sp.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/40 text-sm cursor-pointer">
                        <Checkbox checked={leftSelected.has(sp.id)} onCheckedChange={(v) => onToggleLeft(sp.id, !!v)} />
                        <span className="truncate">{sp.name}</span>
                      </label>
                    ))
                  )}
                </div>
                <div className="p-2 border-t">
                  <Button type="button" className="w-full" onClick={onAddSelected} disabled={!leftSelected.size}>
                    {t("add")}
                  </Button>
                </div>
              </div>

              <div className="hidden md:flex items-center text-muted-foreground px-2">↔</div>

              <div className="border rounded-lg overflow-hidden">
                <div className="px-3 py-2 border-b text-sm font-medium">{t("linkedToProduct")}</div>
                <label className="flex items-center gap-2 px-3 py-2 border-b text-sm">
                  <Checkbox checked={rightAllChecked} onCheckedChange={(v) => onSelectAllRight(!!v)} />
                  <span>{t("selectAll")}</span>
                </label>
                <div className="min-h-[280px] max-h-[280px] overflow-auto p-2 space-y-1">
                  {linked.length === 0 ? (
                    <div className="text-sm text-muted-foreground px-2 py-3">{t("noLinkedSubproductsYet")}</div>
                  ) : (
                    linked.map((l) => (
                      <label key={l.subproductId} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/40 text-sm cursor-pointer">
                        <Checkbox checked={rightSelected.has(l.subproductId)} onCheckedChange={(v) => onToggleRight(l.subproductId, !!v)} />
                        <span className="truncate">{l.subproductName}</span>
                      </label>
                    ))
                  )}
                </div>
                <div className="p-2 border-t">
                  <Button type="button" variant="destructive" className="w-full" onClick={onRemoveSelected} disabled={!rightSelected.size}>
                    {t("delete")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="w-full flex !justify-center shrink-0 gap-10">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={onSave} disabled={saving || loading}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

