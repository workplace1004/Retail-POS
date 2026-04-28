import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Trash2, ArrowUp, ArrowDown, Loader2, MessageSquareOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import {
  PRODUCTION_MESSAGES_MODAL_POLL_MS,
  POS_PRODUCTION_MESSAGES_CHANGED_EVENT,
} from "@/lib/optionButtonLayout";

export type ProductionMessageRow = { id: string; text: string; sortOrder: number };

function normalizeProductionMessages(raw: unknown): ProductionMessageRow[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .filter((m): m is Record<string, unknown> => m != null && typeof m === "object")
    .map((m, i) => ({
      id: String(m.id != null && String(m.id).trim() !== "" ? m.id : `pm-${i}`),
      text: String(m.text ?? ""),
      sortOrder: typeof m.sortOrder === "number" && Number.isFinite(m.sortOrder) ? m.sortOrder : i,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((m, i) => ({ ...m, sortOrder: i }));
}

export function ProductionMessages() {
  const { t } = useLanguage();
  const [items, setItems] = useState<ProductionMessageRow[]>([]);
  const [bootLoaded, setBootLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const formDirtyRef = useRef(false);
  const lastSigRef = useRef<string | null>(null);

  const fetchFull = useCallback(async () => {
    try {
      const data = await apiRequest<{ value: unknown[] }>("/api/settings/production-messages");
      const arr = normalizeProductionMessages(data?.value);
      const sig = JSON.stringify(arr);
      if (sig === lastSigRef.current) return;
      if (formDirtyRef.current) return;
      lastSigRef.current = sig;
      setItems(arr);
    } catch {
      toast({ variant: "destructive", description: t("failedLoadProductionMessages") });
    } finally {
      setBootLoaded(true);
    }
  }, [t]);

  const persist = useCallback(
    async (raw: ProductionMessageRow[]) => {
      const normalized = normalizeProductionMessages(raw);
      formDirtyRef.current = true;
      setItems(normalized);
      setSaving(true);
      try {
        await apiRequest("/api/settings/production-messages", {
          method: "PUT",
          body: JSON.stringify({ value: normalized }),
        });
        lastSigRef.current = JSON.stringify(normalized);
        formDirtyRef.current = false;
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(POS_PRODUCTION_MESSAGES_CHANGED_EVENT));
        }
      } catch (e) {
        formDirtyRef.current = false;
        void fetchFull();
        toast({
          variant: "destructive",
          description: e instanceof Error ? e.message : t("saveFailedGeneric"),
        });
      } finally {
        setSaving(false);
      }
    },
    [fetchFull, t],
  );

  useEffect(() => {
    void fetchFull();
  }, [fetchFull]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void fetchFull();
    }, PRODUCTION_MESSAGES_MODAL_POLL_MS);
    const onPush = () => {
      void fetchFull();
    };
    window.addEventListener(POS_PRODUCTION_MESSAGES_CHANGED_EVENT, onPush);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(POS_PRODUCTION_MESSAGES_CHANGED_EVENT, onPush);
    };
  }, [fetchFull]);

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    const next: ProductionMessageRow[] = [
      ...items.map((m) => ({ ...m })),
      { id: `pm-${Date.now()}`, text, sortOrder: items.length },
    ];
    setDraft("");
    void persist(next);
  };

  const remove = (id: string) => {
    const next = items.filter((i) => i.id !== id);
    if (selectedId === id) setSelectedId(null);
    void persist(next);
  };

  const startEdit = (id: string, text: string) => {
    setEditingId(id);
    setEditingText(text);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const next = items.map((i) => (i.id === editingId ? { ...i, text: editingText } : i));
    setEditingId(null);
    setEditingText("");
    void persist(next);
  };

  const move = (dir: -1 | 1) => {
    if (!selectedId) return;
    const idx = items.findIndex((i) => i.id === selectedId);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= items.length) return;
    const copy = [...items];
    [copy[idx], copy[swap]] = [copy[swap], copy[idx]];
    void persist(copy);
  };

  if (!bootLoaded) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
        {t("loadingEllipsis")}
      </div>
    );
  }

  return (
    <Card className="p-6 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-around mx-20 gap-3">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          className="max-w-xs"
          placeholder={t("messageText")}
          disabled={saving}
        />
        <Button
          variant="ghost"
          onClick={() => void add()}
          disabled={saving || !draft.trim()}
          className="text-primary hover:text-primary border border-primary rounded-md"
        >
          {t("addMessage")}
        </Button>
      </div>

      <div className="rounded-lg border border-border max-h-[500px] overflow-y-auto divide-y divide-border">
        {items.length === 0 ? (
          <div
            className="flex min-h-[220px] flex-col items-center justify-center gap-3 px-6 py-12 text-muted-foreground"
            role="status"
            aria-label={t("noProductionMessages")}
          >
            <MessageSquareOff className="h-16 w-16 shrink-0 opacity-60" strokeWidth={1.25} aria-hidden />
            <p className="text-center text-sm font-medium text-muted-foreground">{t("noProductionMessages")}</p>
          </div>
        ) : (
          items.map((item) => {
            const isSelected = selectedId === item.id;
            const isEditing = editingId === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`flex items-center justify-between gap-3 px-5 py-3 cursor-pointer transition-colors ${
                  isSelected ? "bg-accent/40" : "hover:bg-accent/20"
                }`}
              >
                {isEditing ? (
                  <Input
                    autoFocus
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onBlur={() => void saveEdit()}
                    onKeyDown={(e) => e.key === "Enter" && void saveEdit()}
                    className="max-w-md"
                    disabled={saving}
                  />
                ) : (
                  <span className="text-sm font-mono text-foreground/90 truncate">{item.text}</span>
                )}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    disabled={saving}
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(item.id, item.text);
                    }}
                    aria-label={t("editMessage")}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    disabled={saving}
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(item.id);
                    }}
                    aria-label={t("deleteMessage")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {items.length > 0 && (
        <div className="flex items-center justify-center gap-24 pt-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => move(-1)}
            disabled={!selectedId || saving}
            aria-label={t("moveUp")}
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => move(1)}
            disabled={!selectedId || saving}
            aria-label={t("moveDown")}
          >
            <ArrowDown className="h-5 w-5" />
          </Button>
        </div>
      )}
    </Card>
  );
}
