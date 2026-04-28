import { CreditCard, Building2, Mail, Phone, MapPin } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";

const Account = () => {
  const { t } = useLanguage();
  return (
    <AppLayout>
      <PageHeader title={t("myAccount")} icon={<CreditCard className="h-5 w-5" />} />

      <div className="max-w-3xl space-y-4">
        <Card className="p-6 shadow-card">
          <div className="flex items-center gap-4 pb-6 border-b border-border">
            <div className="h-16 w-16 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold text-xl shadow-glow">PP</div>
            <div>
              <h3 className="font-semibold text-foreground">Retail POS Webpanel</h3>
              <p className="text-sm text-muted-foreground">info@pospoint.be</p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto">Change avatar</Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6">
            <div><Label className="text-sm flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Company</Label><Input defaultValue="Retail POS Webpanel" className="mt-1.5" /></div>
            <div><Label className="text-sm flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</Label><Input defaultValue="info@pospoint.be" className="mt-1.5" /></div>
            <div><Label className="text-sm flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Phone</Label><Input defaultValue="+32 89 12 34 56" className="mt-1.5" /></div>
            <div><Label className="text-sm flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> City</Label><Input defaultValue="3600 Genk" className="mt-1.5" /></div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" size="sm">{t("cancel")}</Button>
            <Button size="sm" className="bg-gradient-primary text-primary-foreground hover:opacity-90">{t("save")}</Button>
          </div>
        </Card>

        <Card className="p-6 shadow-card">
          <h3 className="font-semibold text-foreground">Subscription</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Current plan and billing</p>
          <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-subtle border border-border">
            <div>
              <div className="font-semibold">Pro plan</div>
              <div className="text-xs text-muted-foreground mt-0.5">€ 49 / month · Renews 24-05-2026</div>
            </div>
            <Button variant="outline" size="sm">Manage</Button>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Account;
