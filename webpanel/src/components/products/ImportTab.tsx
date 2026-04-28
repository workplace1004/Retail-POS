import { useRef, useState } from "react";
import { Upload, FileSpreadsheet, Download, CheckCircle2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "../CrudDialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";

export function ImportTab() {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const onPick = (f: File | null) => {
    if (!f) return;
    if (!/\.(csv|xlsx|xls)$/i.test(f.name)) {
      toast({ title: "Invalid file", description: t("fileFormat"), variant: "destructive" });
      return;
    }
    setFile(f);
  };

  const startImport = () => {
    setConfirmOpen(false);
    toast({ title: "Import started", description: file?.name });
    setFile(null);
  };

  return (
    <>
      <div className="flex w-full justify-center gap-4">
        <Card className="p-6 shadow-sm w-full max-w-2xl">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); onPick(e.dataTransfer.files?.[0] ?? null); }}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
            }`}
          >
            <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
              <Upload className="h-6 w-6" />
            </div>
            <div className="font-semibold text-foreground">{t("dragDropFile")}</div>
            <div className="text-sm text-muted-foreground mt-1">{t("orClickToUpload")}</div>
            <div className="text-xs text-muted-foreground mt-3">{t("fileFormat")}</div>
          </div>

          {file && (
            <div className="mt-4 flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{file.name}</div>
                  <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" onClick={() => setConfirmOpen(true)} className="gap-1.5 bg-gradient-primary text-primary-foreground hover:opacity-90">
                  <CheckCircle2 className="h-4 w-4" /> {t("startImport")}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFile(null)}><X className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6 shadow-sm h-fit max-w-sm">
          <div className="text-sm font-semibold mb-2">{t("downloadTemplate")}</div>
          <p className="text-xs text-muted-foreground mb-4">CSV / XLSX template met de juiste kolommen.</p>
          <Button variant="outline" size="sm" className="w-full gap-1.5">
            <Download className="h-4 w-4" /> products_template.xlsx
          </Button>
          <div className="mt-6 text-xs text-muted-foreground space-y-1">
            <div className="font-medium text-foreground">Kolommen:</div>
            <div>• name, price, category</div>
            <div>• vat, sku, description</div>
          </div>
        </Card>
      </div>

      <CrudDialog open={confirmOpen} onOpenChange={setConfirmOpen} title={t("startImport")}
        description={file?.name} onSubmit={startImport} submitLabel={t("startImport")}>
        <div className="text-sm text-muted-foreground">
          Het bestand wordt geanalyseerd en producten worden toegevoegd aan de catalogus.
        </div>
      </CrudDialog>
    </>
  );
}
