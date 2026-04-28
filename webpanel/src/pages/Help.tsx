import { HelpCircle, BookOpen, MessageCircle, Video, Mail } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";

const items = [
  { icon: BookOpen, title: "Documentation", desc: "Browse our complete user guide and API reference." },
  { icon: Video, title: "Video tutorials", desc: "Watch step-by-step videos to get up to speed quickly." },
  { icon: MessageCircle, title: "Live chat", desc: "Talk to our support team in real time during business hours." },
  { icon: Mail, title: "Contact support", desc: "Send us an email — we usually reply within 24 hours." },
];

const Help = () => {
  const { t } = useLanguage();
  return (
    <AppLayout>
      <PageHeader title={t("help")} description="How can we help you today?" icon={<HelpCircle className="h-5 w-5" />} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
        {items.map((it) => (
          <Card key={it.title} className="p-6 shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition-all cursor-pointer group">
            <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-gradient-primary group-hover:text-primary-foreground transition-all">
              <it.icon className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-foreground">{it.title}</h3>
            <p className="text-sm text-muted-foreground mt-1.5">{it.desc}</p>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
};

export default Help;
