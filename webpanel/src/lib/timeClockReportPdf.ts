import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export const TIME_CLOCK_REPORT_PRINT_AREA_ID = "time-clock-report-print-area";

function injectLightThemeForPdfClone(doc: Document) {
  const style = doc.createElement("style");
  style.setAttribute("data-time-clock-report-pdf", "1");
  style.textContent = `
    #${TIME_CLOCK_REPORT_PRINT_AREA_ID} {
      background: #ffffff !important;
      color: #171717 !important;
      border: none !important;
      box-shadow: none !important;
    }
    #${TIME_CLOCK_REPORT_PRINT_AREA_ID} * {
      color: #171717 !important;
      box-shadow: none !important;
      border-color: #d4d4d4 !important;
    }
    #${TIME_CLOCK_REPORT_PRINT_AREA_ID} table,
    #${TIME_CLOCK_REPORT_PRINT_AREA_ID} thead,
    #${TIME_CLOCK_REPORT_PRINT_AREA_ID} tbody,
    #${TIME_CLOCK_REPORT_PRINT_AREA_ID} tr,
    #${TIME_CLOCK_REPORT_PRINT_AREA_ID} th,
    #${TIME_CLOCK_REPORT_PRINT_AREA_ID} td {
      background: #ffffff !important;
      background-color: #ffffff !important;
      color: #171717 !important;
    }
    /* Keep visible separators between user groups in exported PDF */
    #${TIME_CLOCK_REPORT_PRINT_AREA_ID} tr.border-t-2 > td,
    #${TIME_CLOCK_REPORT_PRINT_AREA_ID} tr.border-t-2 > th {
      border-top-width: 2px !important;
      border-top-style: solid !important;
      border-top-color: #9ca3af !important;
    }
  `;
  doc.head.appendChild(style);
}

export async function downloadTimeClockReportPdf(fileName: string): Promise<void> {
  const el = document.getElementById(TIME_CLOCK_REPORT_PRINT_AREA_ID);
  if (!el) throw new Error("Missing time clock report print area");

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
    if (!ctx) throw new Error("Failed to render time clock PDF page");

    ctx.drawImage(canvas, 0, sourceY, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
    if (pageIndex > 0) pdf.addPage();
    const sliceHeightMm = sliceHeightPx / pxPerMm;
    pdf.addImage(pageCanvas.toDataURL("image/png", 1.0), "PNG", margin, margin, imgWidth, sliceHeightMm);
    sourceY += sliceHeightPx;
    pageIndex += 1;
  }

  const safe = fileName.replace(/[^\w\-]+/g, "_").replace(/_+/g, "_").slice(0, 120) || "time-clock-report";
  pdf.save(`${safe}.pdf`);
}

export function buildTimeClockReportPdfFileName(parts: string[]): string {
  const joined = parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join("-");
  return joined || "time-clock-report";
}
