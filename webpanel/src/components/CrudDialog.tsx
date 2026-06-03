import { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface CrudDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  onSubmit: () => void;
  submitLabel?: string;
  size?: "default" | "lg" | "xl";
  hideFooter?: boolean;
  hideHeader?: boolean;
}

export function CrudDialog({ open, onOpenChange, title, description, children, onSubmit, submitLabel, size = "default", hideFooter, hideHeader }: CrudDialogProps) {
  const { t } = useLanguage();
  const sizeClass = size === "xl" ? "max-w-5xl" : size === "lg" ? "max-w-2xl" : "max-w-lg";
  const accessibleDescription = description ?? title;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={sizeClass}>
        {hideHeader ? (
          <DialogHeader className="sr-only">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{accessibleDescription}</DialogDescription>
          </DialogHeader>
        ) : (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{accessibleDescription}</DialogDescription>
          </DialogHeader>
        )}
        <div className="grid gap-4 py-2">{children}</div>
        {!hideFooter && (
          <DialogFooter className="w-full flex !justify-center shrink-0 gap-10">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
            <Button onClick={onSubmit} className="bg-gradient-primary text-primary-foreground hover:opacity-90">
              {submitLabel ?? t("save")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  onConfirm: () => void;
}

export function DeleteDialog({ open, onOpenChange, itemName, onConfirm }: DeleteDialogProps) {
  const { t, lang } = useLanguage();
  const language = lang;
  const title = language === "nl" ? "Verwijderen bevestigen" : "Confirm deletion";
  const desc = language === "nl"
    ? `Weet je zeker dat je "${itemName}" wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.`
    : `Are you sure you want to delete "${itemName}"? This action cannot be undone.`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
          <Button variant="destructive" onClick={onConfirm}>{t("delete")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
