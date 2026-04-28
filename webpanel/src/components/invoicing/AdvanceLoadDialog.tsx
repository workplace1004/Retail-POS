import { useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";

export interface AdvanceItem {
  number: number;
  date: string;
  total: number;
  paid: number;
}

interface AdvanceLoadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect?: (item: AdvanceItem) => void;
  items?: AdvanceItem[];
}

const defaultItems: AdvanceItem[] = [
  { number: 1, date: "30-09-2025", total: 12.12, paid: 6.5 },
];

export function AdvanceLoadDialog({
  open,
  onOpenChange,
  onSelect,
  items = defaultItems,
}: AdvanceLoadDialogProps) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      [String(it.number), it.date, it.total.toFixed(2), it.paid.toFixed(2)]
        .some((v) => v.toLowerCase().includes(q))
    );
  }, [items, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <div className="flex items-center justify-center px-6 pt-5 pb-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 w-64"
          />
        </div>

        <div className="max-h-[70vh] overflow-y-auto pb-6">
          <div className="grid grid-cols-4 gap-4 px-6 py-2 text-sm font-medium text-foreground border-b border-border text-center">
            <div>{t("number")}</div>
            <div>{t("date")}</div>
            <div>{t("total")}</div>
            <div>{t("paid")}</div>
          </div>
          <div className="divide-y divide-border">
            {filtered.map((it, i) => (
              <button
                key={i}
                onClick={() => {
                  onSelect?.(it);
                  onOpenChange(false);
                }}
                className="w-full grid grid-cols-4 gap-4 px-6 py-3 text-sm text-center hover:bg-muted/40 transition-colors"
              >
                <div>{it.number}</div>
                <div>{it.date}</div>
                <div>{it.total.toFixed(2)}</div>
                <div>{it.paid.toFixed(2)}</div>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
