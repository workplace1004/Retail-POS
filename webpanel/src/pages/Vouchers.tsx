import { Ticket, Plus } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const vouchers = [
  { code: "GIFT-2024-001", value: 50, used: false, expires: "31-12-2026" },
  { code: "GIFT-2024-002", value: 100, used: true, expires: "31-12-2026" },
  { code: "GIFT-2024-003", value: 25, used: false, expires: "30-06-2026" },
  { code: "GIFT-2024-004", value: 75, used: false, expires: "31-12-2026" },
];

const Vouchers = () => {
  const { t } = useLanguage();
  return (
    <AppLayout>
      <PageHeader
        title={t("vouchers")}
        icon={<Ticket className="h-5 w-5" />}
        actions={
          <Button size="sm" className="gap-1.5 bg-gradient-primary text-primary-foreground hover:opacity-90">
            <Plus className="h-4 w-4" /> New voucher
          </Button>
        }
      />

      <Card className="overflow-hidden shadow-card">
        <div className="grid grid-cols-4 gap-4 px-5 py-3 border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <div>Code</div><div>Value</div><div>Status</div><div>Expires</div>
        </div>
        <div className="divide-y divide-border">
          {vouchers.map((v) => (
            <div key={v.code} className="grid grid-cols-4 gap-4 px-5 py-3 items-center hover:bg-muted/30 text-sm">
              <div className="font-mono text-xs text-foreground">{v.code}</div>
              <div className="font-mono tabular-nums text-foreground">€ {v.value.toFixed(2)}</div>
              <div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${v.used ? "bg-muted text-muted-foreground" : "bg-success/10 text-success"}`}>
                  {v.used ? "Used" : "Active"}
                </span>
              </div>
              <div className="text-muted-foreground font-mono text-xs">{v.expires}</div>
            </div>
          ))}
        </div>
      </Card>
    </AppLayout>
  );
};

export default Vouchers;
