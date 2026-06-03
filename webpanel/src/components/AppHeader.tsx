import { Moon, Sun, Languages, User, LogOut, ChevronDown } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

function initialsFromEmail(email: string) {
  const part = email.split("@")[0] || email;
  if (part.length >= 2) return part.slice(0, 2).toUpperCase();
  return (part[0] || "?").toUpperCase();
}

export function AppHeader() {
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t } = useLanguage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 h-16 min-h-16 shrink-0 border-b border-border bg-background/80 backdrop-blur-xl print:hidden">
      <div className="h-full flex items-center gap-3 px-4 lg:px-6">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <div className="h-5 w-px bg-border mx-1" />

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLang}
            className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Languages className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase">{lang}</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <div className="h-5 w-px bg-border mx-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  "h-auto py-1.5 pl-1 pr-2 rounded-lg gap-2.5",
                  "text-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <div className="h-8 w-8 rounded-full overflow-hidden bg-gradient-primary flex items-center justify-center text-primary-foreground text-xs font-semibold shrink-0 ring-1 ring-border/40">
                  {user?.avatarDataUrl ? (
                    <img src={user.avatarDataUrl} alt="" className="h-full w-full object-cover" />
                  ) : user ? (
                    initialsFromEmail(user.email)
                  ) : (
                    "—"
                  )}
                </div>
                <div className="hidden sm:flex flex-col items-start leading-tight text-left min-w-0 max-w-[200px]">
                  <span className="text-xs font-medium truncate w-full">{user?.email ?? "—"}</span>
                  <span className="text-[10px] text-muted-foreground truncate w-full">
                    {user?.name || t("administrator")}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link to="/profile" className="flex cursor-pointer items-center gap-2">
                  <User className="h-4 w-4" />
                  {t("myProfile")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive gap-2"
                onSelect={() => {
                  logout();
                  navigate("/login", { replace: true });
                }}
              >
                <LogOut className="h-4 w-4" />
                {t("logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
