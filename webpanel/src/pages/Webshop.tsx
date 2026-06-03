import { ShoppingCart, ExternalLink, TrendingUp, Package2, DollarSign } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const Webshop = () => {
  const { t } = useLanguage();
  const stats = [
    { icon: DollarSign, label: t("revenue"), value: "€ 12,840", change: "+18%" },
    { icon: Package2, label: t("activeOrders"), value: "47", change: "+5" },
    { icon: TrendingUp, label: "Conversion", value: "3.2%", change: "+0.4%" },
  ];

  return (
    <AppLayout>
      <PageHeader
        title={t("webshop")}
        description={t("overview")}
        icon={<ShoppingCart className="h-5 w-5" />}
        actions={
          <Button size="sm" className="gap-1.5 bg-gradient-primary text-primary-foreground hover:opacity-90">
            <ExternalLink className="h-4 w-4" /> Open store
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {stats.map((s) => (
          <Card key={s.label} className="p-5 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <s.icon className="h-4 w-4" />
              </div>
              <span className="text-xs text-success font-medium">{s.change}</span>
            </div>
            <div className="text-sm text-muted-foreground">{s.label}</div>
            <div className="text-2xl font-semibold tracking-tight text-foreground mt-1">{s.value}</div>
          </Card>
        ))}
      </div>

      <Card className="p-12 text-center shadow-card">
        <ShoppingCart className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-40" />
        <h3 className="text-lg font-semibold text-foreground">Configure your webshop</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          Set up products, payment methods, shipping zones, and more from a single dashboard.
        </p>
        <Button className="mt-5 bg-gradient-primary text-primary-foreground hover:opacity-90">Get started</Button>
      </Card>
    </AppLayout>
  );
};

export default Webshop;
