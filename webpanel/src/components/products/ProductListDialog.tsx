import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface Product { id: string; name: string; price: number; }

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  products: Product[];
  priceGroups: string[];
  pricesByGroup: Record<string, Record<string, number>>;
  onChange: (productId: string, group: string, price: number) => void;
}

export function ProductListDialog({ open, onOpenChange, products, priceGroups, pricesByGroup, onChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <div className="pt-2">
          <div
            className="grid items-center gap-4 px-4 py-3 border-b border-border text-sm font-medium text-foreground/80"
            style={{ gridTemplateColumns: `1fr repeat(${priceGroups.length}, minmax(140px, 1fr))` }}
          >
            <div />
            {priceGroups.map((g) => (
              <div key={g} className="text-center">{g}</div>
            ))}
          </div>
          <ul className="divide-y divide-border">
            {products.map((p) => (
              <li
                key={p.id}
                className="grid items-center gap-4 px-4 py-2.5 hover:bg-muted/30 transition-colors"
                style={{ gridTemplateColumns: `1fr repeat(${priceGroups.length}, minmax(140px, 1fr))` }}
              >
                <div className="text-sm truncate">{p.name}</div>
                {priceGroups.map((g) => {
                  const value = pricesByGroup[g]?.[p.id] ?? p.price;
                  return (
                    <div key={g} className="flex justify-center">
                      <Input
                        type="number"
                        step="0.01"
                        value={value}
                        onChange={(e) => onChange(p.id, g, +e.target.value)}
                        className="h-7 w-24 text-right font-mono text-sm tabular-nums"
                      />
                    </div>
                  );
                })}
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
