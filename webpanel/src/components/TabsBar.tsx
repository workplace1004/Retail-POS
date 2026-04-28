import { ReactNode } from "react";

interface TabItem { id: string; label: string; icon?: ReactNode; }
interface TabsBarProps {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
  variant?: "primary" | "secondary";
}

export function TabsBar({ tabs, active, onChange, variant = "primary" }: TabsBarProps) {
  if (variant === "secondary") {
    return (
      <div className="flex items-center gap-1 mb-4 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center">
      <div className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-lg border border-border bg-secondary/60 p-1 mb-6">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-sm rounded-md transition-all ${isActive
                  ? "bg-card text-foreground shadow-sm font-medium"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
