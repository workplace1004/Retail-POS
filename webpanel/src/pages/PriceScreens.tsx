import { MonitorSmartphone, Plus } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const screens = [
  { name: "Main display", status: "Active", res: "1920×1080" },
  { name: "Bar screen", status: "Active", res: "1280×720" },
  { name: "Kitchen display", status: "Offline", res: "1920×1080" },
];

const PriceScreens = () => {
  const { t } = useLanguage();
  return (
    <AppLayout>
      <PageHeader
        title={t("priceScreens")}
        icon={<MonitorSmartphone className="h-5 w-5" />}
        actions={
          <Button size="sm" className="gap-1.5 bg-gradient-primary text-primary-foreground hover:opacity-90">
            <Plus className="h-4 w-4" /> New screen
          </Button>
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {screens.map((s) => (
          <Card key={s.name} className="overflow-hidden shadow-card hover:shadow-elevated transition-all">
            <div className="aspect-video bg-gradient-to-br from-secondary to-muted flex items-center justify-center border-b border-border">
              <MonitorSmartphone className="h-12 w-12 text-muted-foreground/40" />
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">{s.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === "Active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                  {s.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-1">{s.res}</p>
            </div>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
};

export default PriceScreens;
