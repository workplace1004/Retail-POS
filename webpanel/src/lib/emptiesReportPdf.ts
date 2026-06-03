import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export const EMPTIES_REPORT_PRINT_AREA_ID = "empties-report-print-area";

function injectLightThemeForPdfClone(doc: Document) {
  const style = doc.createElement("style");
  style.setAttribute("data-empties-report-pdf", "1");
  style.textContent = `
    #${EMPTIES_REPORT_PRINT_AREA_ID} {
      background: #ffffff !important;
      color: #171717 !important;
      border: none !important;
      box-shadow: none !important;
    }
    #${EMPTIES_REPORT_PRINT_AREA_ID} * {
      color: #171717 !important;
      box-shadow: none !important;
      border-color: #d4d4d4 !important;
      background: #ffffff !important;
      background-color: #ffffff !important;
      line-height: 1.35 !important;
      letter-spacing: 0 !important;
      text-rendering: geometricPrecision !important;
      -webkit-font-smoothing: antialiased !important;
    }
    #${EMPTIES_REPORT_PRINT_AREA_ID} .truncate {
      overflow: visible !important;
      text-overflow: clip !important;
      white-space: normal !important;
    }
  `;
  doc.head.appendChild(style);
}

export async function downloadEmptiesReportPdf(fileName: string): Promise<void> {
  const el = document.getElementById(EMPTIES_REPORT_PRINT_AREA_ID);
  if (!el) throw new Error("Missing empties report print area");

  const canvas = await html2canvas(el, {
    scale: 2,
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
  const imgWidth = pageWidth - margin * 2;
  const pageInnerHeight = pageHeight - margin * 2;
  const pxPerMm = canvas.width / imgWidth;
  const pageSliceHeightPx = Math.max(1, Math.floor(pageInnerHeight * pxPerMm));
  let sourceY = 0;
  let pageIndex = 0;

  while (sourceY < canvas.height) {
    const sliceHeightPx = Math.min(pageSliceHeightPx, canvas.height - sourceY);
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeightPx;
    const ctx = pageCanvas.getContext("2d");
    if (!ctx) throw new Error("Failed to render empties PDF page");

    ctx.drawImage(canvas, 0, sourceY, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
    if (pageIndex > 0) pdf.addPage();
    const sliceHeightMm = sliceHeightPx / pxPerMm;
    pdf.addImage(pageCanvas.toDataURL("image/png", 1.0), "PNG", margin, margin, imgWidth, sliceHeightMm);
    sourceY += sliceHeightPx;
    pageIndex += 1;
  }

  const safe = fileName.replace(/[^\w\-]+/g, "_").replace(/_+/g, "_").slice(0, 120) || "empties-report";
  pdf.save(`${safe}.pdf`);
}

export function buildEmptiesReportPdfFileName(parts: string[]): string {
  const joined = parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join("-");
  return joined || "empties-report";
}
