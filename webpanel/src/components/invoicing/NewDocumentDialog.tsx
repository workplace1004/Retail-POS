import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Save, Calendar as CalendarIcon, User, PlusCircle, Download,
  RotateCcw, FileDown, BookOpen, Plus, ArrowDown, ArrowUp, Pencil, Trash2, ArrowLeftRight,
  Bold, Italic, Underline, Strikethrough, Subscript, Superscript,
  Type, Highlighter, Smile, Brush, Wand2, Pilcrow, AlignLeft, ListOrdered,
  List, Indent, Outdent, Quote, Minus, Link as LinkIcon, Image as ImageIcon,
  Video, FileText, Table as TableIcon, Undo2, Redo2, Eraser, MousePointer, Code2,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { ExistingCustomersDialog, type ExistingCustomer } from "./ExistingCustomersDialog";
import { AdvanceLoadDialog } from "./AdvanceLoadDialog";

interface NewDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LineItem {
  id: number;
  qty: number;
  description: string;
  totalIncl: number;
  perPieceIncl: number;
  perPieceExcl: number;
  discount: number;
  vat: number;
}

export function NewDocumentDialog({ open, onOpenChange }: NewDocumentDialogProps) {
  const { t } = useLanguage();

  const [tab, setTab] = useState<"format" | "attachment">("format");
  const [date, setDate] = useState<Date>(new Date());
  const [kind, setKind] = useState("invoice");
  const [layout, setLayout] = useState("standard");
  const [docLang, setDocLang] = useState("nl");
  const [payTerm, setPayTerm] = useState("immediately");
  const [payMethod, setPayMethod] = useState("transfer");
  const [alreadyPaid, setAlreadyPaid] = useState("");
  const [notes, setNotes] = useState("");

  // line entry
  const [qty, setQty] = useState<string>("1");
  const [desc, setDesc] = useState("");
  const [totalIncl, setTotalIncl] = useState("");
  const [perIncl, setPerIncl] = useState("");
  const [perExcl, setPerExcl] = useState("");
  const [discount, setDiscount] = useState("");
  const [vat, setVat] = useState("21");
  const [items, setItems] = useState<LineItem[]>([]);

  // attachment editor
  const [attachmentPos, setAttachmentPos] = useState("above");
  const [attachmentText, setAttachmentText] = useState("");

  // customer
  const [customersOpen, setCustomersOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<ExistingCustomer | null>(null);
  const [advanceOpen, setAdvanceOpen] = useState(false);

  const totals = useMemo(() => {
    const totalInclSum = items.reduce((s, it) => s + it.totalIncl, 0);
    const totalExclSum = items.reduce((s, it) => s + it.perPieceExcl * it.qty, 0);
    const vatSum = totalInclSum - totalExclSum;
    const paid = parseFloat(alreadyPaid || "0") || 0;
    return {
      mvh: totalExclSum,
      vat: vatSum,
      total: totalInclSum,
      paid,
      due: totalInclSum - paid,
    };
  }, [items, alreadyPaid]);

  const addItem = () => {
    const q = parseFloat(qty) || 0;
    if (!q && !desc) return;
    const ti = parseFloat(totalIncl) || 0;
    const pi = parseFloat(perIncl) || (q > 0 ? ti / q : 0);
    const pe = parseFloat(perExcl) || pi / (1 + parseFloat(vat) / 100);
    const newItem: LineItem = {
      id: Date.now(),
      qty: q,
      description: desc,
      totalIncl: ti || pi * q,
      perPieceIncl: pi,
      perPieceExcl: pe,
      discount: parseFloat(discount) || 0,
      vat: parseFloat(vat) || 0,
    };
    setItems((prev) => [...prev, newItem]);
    setQty("1");
    setDesc("");
    setTotalIncl("");
    setPerIncl("");
    setPerExcl("");
    setDiscount("");
  };

  const moveItem = (id: number, dir: -1 | 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  const deleteItem = (id: number) => setItems((prev) => prev.filter((i) => i.id !== id));

  const resetList = () => setItems([]);

  const handleSave = () => onOpenChange(false);

  // Tab nav
  const TopTabs = (
    <div className="flex items-center gap-1 text-sm font-medium">
      <button
        onClick={() => setTab("format")}
        className={cn(
          "px-1 transition-colors",
          tab === "format" ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {t("docFormatting")}
      </button>
      <span className="text-muted-foreground">/</span>
      <button
        onClick={() => setTab("attachment")}
        className={cn(
          "px-1 transition-colors",
          tab === "attachment" ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {t("docAttachment")}
      </button>
    </div>
  );

  // Rich-text toolbar buttons (purely presentational)
  const toolbarRows: { icon: typeof Bold; key: string }[][] = [
    [
      { icon: Bold, key: "b" }, { icon: Italic, key: "i" }, { icon: Underline, key: "u" },
      { icon: Strikethrough, key: "s" }, { icon: Subscript, key: "sub" }, { icon: Superscript, key: "sup" },
      { icon: Type, key: "font" }, { icon: Type, key: "size" }, { icon: Highlighter, key: "color" },
      { icon: Smile, key: "emoji" }, { icon: Brush, key: "brush" }, { icon: Wand2, key: "wand" },
      { icon: Pilcrow, key: "para" }, { icon: AlignLeft, key: "align" }, { icon: ListOrdered, key: "ol" },
    ],
    [
      { icon: List, key: "ul" }, { icon: Outdent, key: "outdent" }, { icon: Indent, key: "indent" },
      { icon: Quote, key: "quote" }, { icon: Minus, key: "hr" },
    ],
    [
      { icon: LinkIcon, key: "link" }, { icon: ImageIcon, key: "image" }, { icon: Video, key: "video" },
      { icon: FileText, key: "file" }, { icon: TableIcon, key: "table" },
      { icon: Undo2, key: "undo" }, { icon: Redo2, key: "redo" },
      { icon: Eraser, key: "clear" }, { icon: MousePointer, key: "cursor" }, { icon: Code2, key: "code" },
    ],
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl p-0 overflow-hidden">
        <div className="bg-muted/40 border-b border-border px-6 pt-5 pb-4">
          {TopTabs}
        </div>

        <div className="px-6 pb-6 max-h-[90vh] overflow-y-auto">
          {tab === "format" && (
            <div className="space-y-5">
              {/* Top section: form + customer card */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
                <div className="bg-muted/30 rounded-md p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                    {/* Left col */}
                    <div className="space-y-3">
                      <Row label={t("date")}>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="h-8 w-40 justify-start text-left font-normal">
                              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                              {format(date, "dd-MM-yyyy")}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
                          </PopoverContent>
                        </Popover>
                      </Row>
                      <Row label={t("docKind")}>
                        <Select value={kind} onValueChange={setKind}>
                          <SelectTrigger className="h-8 w-56"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="invoice">{t("docKindInvoice")}</SelectItem>
                            <SelectItem value="invoice-tickets">{t("docKindInvoiceFromTickets")}</SelectItem>
                            <SelectItem value="quotation">{t("docKindQuotation")}</SelectItem>
                            <SelectItem value="credit">{t("docKindCreditNote")}</SelectItem>
                            <SelectItem value="delivery">{t("docKindDeliveryNote")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </Row>
                      <Row label={t("docLayout")}>
                        <div className="flex gap-2">
                          <Select value={layout} onValueChange={setLayout}>
                            <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="standard">{t("docLayoutStandard")}</SelectItem>
                              <SelectItem value="1">1</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={docLang} onValueChange={setDocLang}>
                            <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="nl">nl</SelectItem>
                              <SelectItem value="en">en</SelectItem>
                              <SelectItem value="fr">fr</SelectItem>
                              <SelectItem value="de">de</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </Row>
                    </div>

                    {/* Right col */}
                    <div className="space-y-3">
                      <Row label={t("paymentTerm")}>
                        <Select value={payTerm} onValueChange={setPayTerm}>
                          <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="immediately">{t("payTermImmediately")}</SelectItem>
                            <SelectItem value="3">{t("days3")}</SelectItem>
                            <SelectItem value="7">{t("days7")}</SelectItem>
                            <SelectItem value="14">{t("days14")}</SelectItem>
                            <SelectItem value="21">{t("days21")}</SelectItem>
                            <SelectItem value="30">{t("days30")}</SelectItem>
                            <SelectItem value="60">{t("days60")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </Row>
                      <Row label={t("paymentMethod")}>
                        <Select value={payMethod} onValueChange={setPayMethod}>
                          <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="transfer">{t("payMethodTransfer")}</SelectItem>
                            <SelectItem value="cash">{t("payMethodCash")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </Row>
                      <Row label={t("alreadyPaid")}>
                        <div className="flex items-center gap-2">
                          <Input
                            value={alreadyPaid}
                            onChange={(e) => setAlreadyPaid(e.target.value)}
                            className="h-8 w-32"
                          />
                          <button
                            type="button"
                            onClick={() => setAlreadyPaid("")}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="reset"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        </div>
                      </Row>
                    </div>
                  </div>

                  <div className="flex justify-center mt-4">
                    <Button
                      variant="ghost"
                      onClick={handleSave}
                      className="gap-2 text-foreground hover:text-primary"
                    >
                      <Save className="h-4 w-4" /> {t("save")}
                    </Button>
                  </div>
                </div>

                {/* Customer card */}
                <div className="bg-card border border-border rounded-md p-4 flex flex-col shadow-sm">
                  {selectedCustomer ? (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm leading-tight">
                          <div className="text-foreground">{selectedCustomer.name}</div>
                          {selectedCustomer.subName && (
                            <div className="text-foreground">{selectedCustomer.subName}</div>
                          )}
                          <div className="text-foreground">{selectedCustomer.street}</div>
                          <div className="text-foreground">{selectedCustomer.postalCity}</div>
                          {selectedCustomer.country && (
                            <div className="text-foreground">{selectedCustomer.country}</div>
                          )}
                          <div className="text-foreground">{selectedCustomer.vatNumber}</div>
                        </div>
                        <button
                          className="text-muted-foreground hover:text-primary transition-colors"
                          aria-label="edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="border-t border-border mt-3 pt-3 flex items-center justify-between text-sm">
                        <button className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors">
                          <PlusCircle className="h-4 w-4" />
                          {t("newCustomer")}
                        </button>
                        <button
                          onClick={() => setCustomersOpen(true)}
                          className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors"
                        >
                          <ArrowLeftRight className="h-4 w-4" />
                          {t("otherCustomer")}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col justify-center gap-4 flex-1">
                      <button
                        onClick={() => setCustomersOpen(true)}
                        className="flex items-center gap-3 text-sm text-foreground hover:text-primary transition-colors"
                      >
                        <User className="h-5 w-5 text-muted-foreground" />
                        {t("chooseExistingCustomer")}
                      </button>
                      <button className="flex items-center gap-3 text-sm text-foreground hover:text-primary transition-colors">
                        <PlusCircle className="h-5 w-5 text-muted-foreground" />
                        {t("createNewCustomerBtn")}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Line entry */}
              <div className="bg-muted/30 rounded-md p-4">
                <div className="grid grid-cols-[60px_1fr_140px_90px_90px_90px_70px_90px_auto] gap-3 items-end text-xs text-muted-foreground">
                  <div>{t("quantity")}</div>
                  <div>{t("description")}</div>
                  <button className="inline-flex items-center gap-1.5 text-foreground/80 hover:text-primary justify-self-start">
                    <Download className="h-3.5 w-3.5" /> {t("insertProduct")}
                  </button>
                  <div className="text-center leading-tight">{t("totalIncl")}<br />btw</div>
                  <div className="text-center leading-tight">{t("perPieceIncl")}</div>
                  <div className="text-center leading-tight">{t("perPieceExcl")}</div>
                  <div>{t("discount")}</div>
                  <div>{t("vatRate")}</div>
                  <div />
                </div>
                <div className="grid grid-cols-[60px_1fr_140px_90px_90px_90px_70px_90px_auto] gap-3 items-center mt-2">
                  <Input value={qty} onChange={(e) => setQty(e.target.value)} className="h-8 text-center" />
                  <Input value={desc} onChange={(e) => setDesc(e.target.value)} className="h-8" />
                  <div />
                  <Input value={totalIncl} onChange={(e) => setTotalIncl(e.target.value)} className="h-8 text-right" />
                  <Input value={perIncl} onChange={(e) => setPerIncl(e.target.value)} className="h-8 text-right" />
                  <Input value={perExcl} onChange={(e) => setPerExcl(e.target.value)} className="h-8 text-right" />
                  <div className="flex items-center gap-1">
                    <Input value={discount} onChange={(e) => setDiscount(e.target.value)} className="h-8 text-right" />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                  <Select value={vat} onValueChange={setVat}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 %</SelectItem>
                      <SelectItem value="6">6 %</SelectItem>
                      <SelectItem value="12">12 %</SelectItem>
                      <SelectItem value="21">21 %</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" onClick={addItem} className="gap-1.5 text-foreground hover:text-primary">
                    <Plus className="h-4 w-4" /> {t("add")}
                  </Button>
                </div>
              </div>

              {/* Items list */}
              <div className="border border-border rounded-md min-h-[260px] max-h-[260px] overflow-y-auto">
                {items.length === 0 ? (
                  <div className="h-[260px]" />
                ) : (
                  <div className="divide-y divide-border">
                    {items.map((it) => (
                      <div
                        key={it.id}
                        className="grid grid-cols-[60px_1fr_140px_90px_90px_90px_70px_90px_auto] gap-3 items-center px-3 py-2 text-sm"
                      >
                        <div className="text-center">{it.qty}</div>
                        <div className="truncate">{it.description}</div>
                        <div />
                        <div className="text-right font-mono">{it.totalIncl.toFixed(2)}</div>
                        <div className="text-right font-mono">{it.perPieceIncl.toFixed(2)}</div>
                        <div className="text-right font-mono">{it.perPieceExcl.toFixed(2)}</div>
                        <div className="text-right">{it.discount.toFixed(2)} %</div>
                        <div className="text-right">{it.vat} %</div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <button onClick={() => moveItem(it.id, 1)} className="hover:text-foreground" aria-label="down">
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button onClick={() => moveItem(it.id, -1)} className="hover:text-foreground" aria-label="up">
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button className="hover:text-primary" aria-label="edit">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => deleteItem(it.id)} className="hover:text-destructive" aria-label="delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer actions + totals */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-8 text-sm">
                    <button onClick={resetList} className="inline-flex items-center gap-1.5 text-foreground hover:text-primary">
                      <RotateCcw className="h-4 w-4" /> {t("resetList")}
                    </button>
                    <button className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                      <FileDown className="h-4 w-4" /> {t("insertDocumentBtn")}
                    </button>
                    <button onClick={() => setAdvanceOpen(true)} className="inline-flex items-center gap-1.5 text-foreground hover:text-primary">
                      <BookOpen className="h-4 w-4" /> {t("advanceLoad")}
                    </button>
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground">{t("notesLabel")} :</label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="mt-1 min-h-[90px] resize-none"
                    />
                  </div>
                </div>

                <div className="border border-border rounded-md divide-y divide-border text-sm self-end">
                  <TotalRow label={`${t("mvh")} :`} value={totals.mvh.toFixed(2)} />
                  <TotalRow label={`${t("btwShort")} ${items[0]?.vat ?? 21} %`} value={totals.vat.toFixed(2)} />
                  <TotalRow label={`${t("totalEuro")} :`} value={totals.total.toFixed(2)} />
                  <TotalRow label={`${t("alreadyPaid")} :`} value={totals.paid.toFixed(2)} />
                  <TotalRow label={`${t("payableBefore")} ${format(date, "dd-MM-yyyy")} :`} value={totals.due.toFixed(2)} />
                </div>
              </div>
            </div>
          )}

          {tab === "attachment" && (
            <div className="pt-4 space-y-4">
              <div className="flex items-center justify-center gap-12">
                <Button
                  variant="ghost"
                  onClick={handleSave}
                  className="gap-2 text-foreground hover:text-primary"
                >
                  <Save className="h-4 w-4" /> {t("save")}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setAttachmentText("")}
                  className="gap-2 text-foreground hover:text-primary"
                >
                  <RotateCcw className="h-4 w-4" /> {t("reset")}
                </Button>
                <Select value={attachmentPos} onValueChange={setAttachmentPos}>
                  <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="above">{t("aboveDocument")}</SelectItem>
                    <SelectItem value="below">{t("belowDocument")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border border-border rounded-md bg-muted/20">
                <div className="border-b border-border px-2 py-2 space-y-1">
                  {toolbarRows.map((row, ri) => (
                    <div key={ri} className="flex flex-wrap items-center gap-1">
                      {row.map(({ icon: Icon, key }) => (
                        <button
                          key={key}
                          type="button"
                          className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-muted text-foreground"
                        >
                          <Icon className="h-4 w-4" />
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
                <Textarea
                  value={attachmentText}
                  onChange={(e) => setAttachmentText(e.target.value)}
                  placeholder={t("typeSomething")}
                  className="min-h-[180px] border-0 rounded-none focus-visible:ring-0 resize-none bg-transparent"
                />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
      <ExistingCustomersDialog
        open={customersOpen}
        onOpenChange={setCustomersOpen}
        onSelect={setSelectedCustomer}
      />
      <AdvanceLoadDialog open={advanceOpen} onOpenChange={setAdvanceOpen} />
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-center gap-2 text-sm">
      <label className="text-foreground">{label} :</label>
      <div>{children}</div>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center px-3 py-2">
      <span className="text-foreground">{label}</span>
      <span className="font-mono text-right">{value}</span>
    </div>
  );
}
