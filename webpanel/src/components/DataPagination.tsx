import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface DataPaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export function DataPagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 25, 50],
  className,
}: DataPaginationProps) {
  const { lang } = useLanguage();
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  const labels = lang === "nl"
    ? { rows: "Rijen per pagina", page: "Pagina", of: "van", showing: "Toont", to: "tot", entries: "items" }
    : { rows: "Rows per page", page: "Page", of: "of", showing: "Showing", to: "to", entries: "items" };

  // Build page numbers with ellipsis
  const getPages = (): (number | "...")[] => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    const startP = Math.max(2, currentPage - 1);
    const endP = Math.min(totalPages - 1, currentPage + 1);
    for (let i = startP; i <= endP; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className={cn("flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-3 border-t border-border bg-muted/20", className)}>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>
          {labels.showing} <span className="font-medium text-foreground">{start}-{end}</span> {labels.of}{" "}
          <span className="font-medium text-foreground">{totalItems}</span> {labels.entries}
        </span>
        {onPageSizeChange && (
          <div className="hidden sm:flex items-center gap-2">
            <span>{labels.rows}:</span>
            <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
              <SelectTrigger className="h-7 w-[70px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((s) => (
                  <SelectItem key={s} value={String(s)} className="text-xs">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          aria-label="First page"
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>

        {getPages().map((p, idx) =>
          p === "..." ? (
            <span key={`e-${idx}`} className="px-2 text-xs text-muted-foreground">…</span>
          ) : (
            <Button
              key={p}
              variant={p === currentPage ? "default" : "ghost"}
              size="icon"
              className={cn(
                "h-7 w-7 text-xs font-medium",
                p === currentPage && "bg-gradient-primary text-primary-foreground hover:opacity-90",
              )}
              onClick={() => onPageChange(p)}
            >
              {p}
            </Button>
          ),
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          aria-label="Last page"
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
