import { useState } from "react";
import { Settings, Cog, Printer } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { DeviceSettings } from "./DeviceSettings";
import { SystemSettings } from "./SystemSettings";
import { ProductionMessages } from "./ProductionMessages";

type Section = "device" | "system" | "production";

export function PosSettingsTab() {
  const { t } = useLanguage();
  const [section, setSection] = useState<Section>("device");

  const sections: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: "device", label: t("deviceSettings"), icon: <Settings className="h-4 w-4" /> },
    { id: "system", label: t("systemSettings"), icon: <Cog className="h-4 w-4" /> },
    { id: "production", label: t("productionMessages"), icon: <Printer className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex flex-wrap gap-2 w-full justify-center pb-3">
        {sections.map((s) => {
          const isActive = s.id === section;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground font-medium"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {s.icon}
              {s.label}
            </button>
          );
        })}
      </div>

      {section === "device" && <DeviceSettings />}
      {section === "system" && <SystemSettings />}
      {section === "production" && <ProductionMessages />}
    </div>
  );
}
