import { Toaster as Sonner, toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-right"
      offset="1rem"
      toastOptions={{
        classNames: {
          toast:
            "group toast rounded-xl border border-border/70 bg-card/95 text-foreground shadow-2xl backdrop-blur-md dark:bg-zinc-950/95 dark:ring-1 dark:ring-white/10",
          title: "group-[.toast]:font-semibold group-[.toast]:tracking-tight",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-sm",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      className="toaster group"
      {...props}
    />
  );
};

export { Toaster, toast };
