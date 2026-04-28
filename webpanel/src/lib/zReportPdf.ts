import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export const Z_REPORT_PRINT_AREA_ID = "z-report-print-area";

function isCenteredSubtitle(line: string): boolean {
  const s = String(line || "").trim();
  if (!s || s.startsWith("-")) return false;
  if (/^Z\s+(FINANCIEEL|FINANCIAL)\b/i.test(s)) return true;
  return [
    "CATEGORIE TOTALEN",
    "CATEGORY TOTALS",
    "PRODUCT TOTALEN",
    "PRODUCT TOTALS",
    "BTW PER TARIEF",
    "VAT PER RATE",
    "BETALINGEN",
    "PAYMENTS",
    "TAKE-OUT",
    "EAT-IN / TAKE-OUT",
    "TICKET SOORTEN",
    "TICKET TYPES",
    "UUR TOTALEN",
    "HOUR TOTALS",
    "UUR TOTALEN PER GEBRUIKER",
    "HOUR TOTALS PER USER",
  ].includes(s.toUpperCase());
}

function isBoldHeaderLine(line: string): boolean {
  const s = String(line || "").trim();
  if (!s) return false;
  if (/^pospoint demo$/i.test(s)) return true;
  if (/^BE[0-9]+$/i.test(s)) return true;
  if (/^pospoint$/i.test(s)) return true;
  if (/\b(Date|Datum)\s*:/.test(s) && /\b(Time|Tijd)\s*:/.test(s)) return true;
  return false;
}

function isLeftAnchoredLine(line: string): boolean {
  const s = String(line || "").trim();
  if (!s) return false;
  if (s === "Terminals:") return true;
  // User-group separator like "--------------------" above names (e.g. Alice)
  if (/^-+$/.test(s) && s.length < 30) return true;
  // User names in "hour totals per user" blocks.
  if (/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.-]*$/.test(s) && s.length <= 24) {
    if (isCenteredSubtitle(s) || isBoldHeaderLine(s)) return false;
    return true;
  }
  return false;
}

function injectLightThemeForPdfClone(doc: Document) {
  const style = doc.createElement("style");
  style.setAttribute("data-z-report-pdf", "1");
  style.textContent = `
    #${Z_REPORT_PRINT_AREA_ID} {
      background: #ffffff !important;
      color: #171717 !important;
      border: 1px solid #666666 !important;
      box-shadow: none !important;
      margin: 0 auto !important;
      width: fit-content !important;
      padding-top: 2mm !important;
    }
    #${Z_REPORT_PRINT_AREA_ID} * {
      color: #171717 !important;
      box-shadow: none !important;
      border-color: #d4d4d4 !important;
      background: #ffffff !important;
      background-color: #ffffff !important;
      text-shadow: none !important;
      line-height: 1.42 !important;
      letter-spacing: 0 !important;
      text-rendering: geometricPrecision !important;
      -webkit-font-smoothing: antialiased !important;
    }
  `;
  doc.head.appendChild(style);
}

export async function downloadZReportPdf(fileName: string): Promise<void> {
  const textLines = (window as unknown as { __zReportPdfLines?: string[] }).__zReportPdfLines;
  if (Array.isArray(textLines) && textLines.length > 0) {
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginY = 8;
    const normalFontSize = 9.6;
    const subtitleFontSize = 11.6;
    const pageMaxWidth = pageWidth - 16;
    const leftPad = 6;
    const rightPad = 6;
    const getLineWidthMm = (text: string): number => {
      const isSubtitle = isCenteredSubtitle(text);
      const isHeader = isBoldHeaderLine(text);
      pdf.setFont("courier", isSubtitle || isHeader ? "bold" : "normal");
      pdf.setFontSize(isSubtitle ? subtitleFontSize : normalFontSize);
      const pt = pdf.getTextWidth(text || " ");
      return (pt * 25.4) / 72;
    };
    const maxLineWidth = textLines.reduce((m, line) => Math.max(m, getLineWidthMm(String(line ?? ""))), 0);
    const sheetWidth = Math.min(pageMaxWidth, Math.max(110, maxLineWidth + leftPad + rightPad + 2));
    const x = (pageWidth - sheetWidth) / 2;
    const lineHeight = 7;
    const topPad = 5;
    const bottomPad = 5;
    const maxLinesPerPage = Math.max(1, Math.floor((pageHeight - marginY * 2 - topPad - bottomPad) / lineHeight));
    const pages: string[][] = [];
    for (let i = 0; i < textLines.length; i += maxLinesPerPage) pages.push(textLines.slice(i, i + maxLinesPerPage));

    pdf.setFont("courier", "normal");
    pdf.setFontSize(normalFontSize);

    pages.forEach((lines, pageIdx) => {
      if (pageIdx > 0) pdf.addPage();
      const sheetHeight = topPad + bottomPad + lines.length * lineHeight;
      const y = marginY;
      pdf.setDrawColor(90);
      pdf.setLineWidth(0.2);
      pdf.rect(x, y, sheetWidth, sheetHeight);
      let cursorY = y + topPad + 3.7;
      for (const line of lines) {
        const text = String(line ?? "");
        if (isCenteredSubtitle(text)) {
          pdf.setFont("courier", "bold");
          pdf.setFontSize(subtitleFontSize);
          pdf.text(text.trim(), x + sheetWidth / 2, cursorY, { align: "center", baseline: "alphabetic" });
        } else if (isBoldHeaderLine(text)) {
          pdf.setFont("courier", "bold");
          pdf.setFontSize(normalFontSize);
          pdf.text(text, x + sheetWidth / 2, cursorY, { align: "center", baseline: "alphabetic" });
        } else if (isLeftAnchoredLine(text)) {
          pdf.setFont("courier", "normal");
          pdf.setFontSize(normalFontSize);
          pdf.text(text, x + leftPad, cursorY, { baseline: "alphabetic" });
        } else {
          pdf.setFont("courier", "normal");
          pdf.setFontSize(normalFontSize);
          pdf.text(text, x + sheetWidth / 2, cursorY, { align: "center", baseline: "alphabetic" });
        }
        cursorY += lineHeight;
      }
    });

    const safeText = fileName.replace(/[^\w\-]+/g, "_").replace(/_+/g, "_").slice(0, 120) || "z-report";
    pdf.save(`${safeText}.pdf`);
    return;
  }

  const el = document.getElementById(Z_REPORT_PRINT_AREA_ID);
  if (!el) throw new Error("Missing Z report print area");

  const canvas = await html2canvas(el, {
    scale: 3,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    onclone: (clonedDoc) => injectLightThemeForPdfClone(clonedDoc),
  });

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const targetSheetWidth = Math.min(150, pageWidth - margin * 2);
  const xOffset = (pageWidth - targetSheetWidth) / 2;
  const pageInnerHeight = pageHeight - margin * 2;
  const pxPerMm = canvas.width / targetSheetWidth;
  const pageSliceHeightPx = Math.max(1, Math.floor(pageInnerHeight * pxPerMm));
  let sourceY = 0;
  let pageIndex = 0;

  while (sourceY < canvas.height) {
    const sliceHeightPx = Math.min(pageSliceHeightPx, canvas.height - sourceY);
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeightPx;
    const ctx = pageCanvas.getContext("2d");
    if (!ctx) throw new Error("Failed to render Z report PDF page");

    ctx.drawImage(canvas, 0, sourceY, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
    if (pageIndex > 0) pdf.addPage();
    const sliceHeightMm = sliceHeightPx / pxPerMm;
    pdf.addImage(pageCanvas.toDataURL("image/png", 1.0), "PNG", xOffset, margin, targetSheetWidth, sliceHeightMm);
    sourceY += sliceHeightPx;
    pageIndex += 1;
  }

  const safe = fileName.replace(/[^\w\-]+/g, "_").replace(/_+/g, "_").slice(0, 120) || "z-report";
  pdf.save(`${safe}.pdf`);
}

export function buildZReportPdfFileName(parts: string[]): string {
  const joined = parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join("-");
  return joined || "z-report";
}
