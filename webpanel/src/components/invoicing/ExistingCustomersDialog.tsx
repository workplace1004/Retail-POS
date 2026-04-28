import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";

export interface ExistingCustomer {
  name: string;
  subName?: string;
  street: string;
  postalCity: string;
  country?: string;
  vatNumber: string;
}

interface ExistingCustomersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (customer: ExistingCustomer) => void;
  customers?: ExistingCustomer[];
}

const defaultCustomers: ExistingCustomer[] = [
  { name: "pospoint", subName: "musti musti", street: "Mezenstraat", postalCity: "3600 Genk", country: "België", vatNumber: "BE1234567890" },
  { name: "TestCustomer", street: "Street NoTest.", postalCity: "12000 Tirana", vatNumber: "123456789" },
];

export function ExistingCustomersDialog({
  open,
  onOpenChange,
  onSelect,
  customers = defaultCustomers,
}: ExistingCustomersDialogProps) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.name, c.subName, c.street, c.postalCity, c.vatNumber]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q))
    );
  }, [customers, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden">
        <div className="flex items-center gap-4 px-5 py-3 border-b border-border bg-muted/30">
          <button
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 flex justify-center">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search")}
              className="h-8 w-72"
            />
          </div>
          <div className="w-5" />
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-[1.2fr_1.2fr_1fr_1fr] gap-4 px-6 py-3 text-sm font-medium text-foreground border-b border-border">
            <div>{t("name")}</div>
            <div>{t("streetNumber")}</div>
            <div>{t("postalCity")}</div>
            <div>{t("vatNumber")}</div>
          </div>
          <div className="divide-y divide-border">
            {filtered.map((c, i) => (
              <button
                key={i}
                onClick={() => {
                  onSelect(c);
                  onOpenChange(false);
                }}
                className="w-full text-left grid grid-cols-[1.2fr_1.2fr_1fr_1fr] gap-4 px-6 py-3 text-sm hover:bg-muted/40 transition-colors"
              >
                <div className="leading-tight">
                  <div className="text-foreground">{c.name}</div>
                  {c.subName && <div className="text-foreground/80">{c.subName}</div>}
                </div>
                <div className="text-foreground/80">{c.street}</div>
                <div className="text-foreground/80">{c.postalCity}</div>
                <div className="text-foreground/80">{c.vatNumber}</div>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
