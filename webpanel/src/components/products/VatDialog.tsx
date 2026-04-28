import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Product { id: string; name: string; }

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  products: Product[];
  vatByProduct: Record<string, { takeOut: string }>;
  onApply: (productIds: string[], value: string) => void | Promise<void>;
  saving?: boolean;
}

const VAT_OPTIONS = ["---", "0 %", "6 %", "9 %", "12 %", "21 %"];

export function VatDialog({ open, onOpenChange, products, vatByProduct, onApply, saving = false }: Props) {
  const { t } = useLanguage();
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(products.map((p) => [p.id, true])),
  );
  const [adjustValue, setAdjustValue] = useState("---");

  const toggle = (id: string) => setChecked({ ...checked, [id]: !checked[id] });

  const apply = () => {
    if (adjustValue === "---" || saving) return;
    const ids = products.filter((p) => checked[p.id]).map((p) => p.id);
    void onApply(ids, adjustValue);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <div className="grid grid-cols-[1fr_280px] gap-8 pt-2">
          <div className="flex flex-col min-w-0">
            <div className="py-2 text-sm font-medium text-foreground">
              {t("takeOut")}
            </div>
            <ul className="mt-2 max-h-[420px] overflow-y-auto divide-y divide-border border border-border rounded-md">
              {products.map((p) => {
                const value = vatByProduct[p.id]?.takeOut ?? "---";
                return (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <Checkbox checked={!!checked[p.id]} onCheckedChange={() => toggle(p.id)} />
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">{value}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex flex-col items-center justify-center gap-6 pt-10">
            <div className="flex flex-col items-center gap-3">
              <span className="text-sm">{t("adjustTo")} :</span>
              <Select value={adjustValue} onValueChange={setAdjustValue} disabled={saving}>
                <SelectTrigger className="h-8 w-24 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VAT_OPTIONS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <button
              type="button"
              onClick={apply}
              disabled={adjustValue === "---" || saving}
              className="flex items-center gap-2 text-sm hover:text-primary transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t("adjust")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
