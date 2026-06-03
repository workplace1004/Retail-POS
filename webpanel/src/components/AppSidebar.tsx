import { useState } from "react";
import {
  Monitor, BarChart3, Users, Contact, FileText,
  AlarmClock, Truck, Tag, Cpu,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TranslationKey } from "@/lib/translations";
import { cn } from "@/lib/utils";

const items: { url: string; icon: any; key: TranslationKey }[] = [
  { url: "/", icon: Monitor, key: "customizePos" },
  { url: "/reports", icon: BarChart3, key: "posReports" },
  { url: "/users", icon: Users, key: "users" },
  { url: "/registers", icon: Cpu, key: "registers" },
  { url: "/customers", icon: Contact, key: "customers" },
  { url: "/invoicing", icon: FileText, key: "invoicing" },
  { url: "/production", icon: AlarmClock, key: "production" },
  { url: "/suppliers", icon: Truck, key: "suppliers" },
  { url: "/labels", icon: Tag, key: "labels" },
];

const brandIconSrc = `${import.meta.env.BASE_URL}icon.png`;

function SidebarBrandMark({ collapsed }: { collapsed: boolean }) {
  const [useFallback, setUseFallback] = useState(false);
  const box = collapsed ? "h-9 w-9" : "h-11 w-11";
  const imgSize = collapsed ? 36 : 44;
  if (useFallback) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-gradient-primary shadow-glow",
          box,
        )}
      >
        <span className={cn("font-bold text-primary-foreground", collapsed ? "text-sm" : "text-base")}>RP</span>
      </div>
    );
  }
  return (
    <img
      src={brandIconSrc}
      alt=""
      width={imgSize}
      height={imgSize}
      onError={() => setUseFallback(true)}
      className={cn(
        "shrink-0 rounded-lg object-cover shadow-glow ring-1 ring-sidebar-border/30",
        box,
      )}
    />
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { t } = useLanguage();
  const location = useLocation();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border print:hidden">
      <SidebarHeader
        className={cn(
          "flex h-16 min-h-16 shrink-0 items-center justify-center border-b border-sidebar-border px-4",
          "group-data-[collapsible=icon]:px-2",
        )}
      >
        <div
          className={cn(
            "flex w-full items-center gap-3",
            "group-data-[collapsible=icon]:justify-center",
          )}
        >
          <SidebarBrandMark collapsed={collapsed} />
          {!collapsed && (
            <div className="flex flex-col leading-tight overflow-hidden">
              <span className="truncate text-xl font-semibold text-sidebar-foreground">Retail POS Webpanel</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent
        className={cn(
          "px-2.5 py-3",
          "group-data-[collapsible=icon]:px-1.5 group-data-[collapsible=icon]:py-2",
        )}
      >
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5 group-data-[collapsible=icon]:gap-1">
              {items.map((item) => {
                const active =
                  item.url === "/users"
                    ? location.pathname === "/users"
                    : item.url === "/registers"
                      ? location.pathname === "/registers"
                      : location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild tooltip={t(item.key)}>
                      <NavLink
                        to={item.url}
                        end
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 text-base transition-all",
                          "group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-1.5",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm"
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
                        )}
                      >
                        <item.icon className={`h-5 w-5 shrink-0 ${active ? "text-primary" : ""}`} />
                        {!collapsed && <span className="truncate">{t(item.key)}</span>}
                        {active && !collapsed && (
                          <div className="ml-auto h-2 w-2 rounded-full bg-primary" />
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
