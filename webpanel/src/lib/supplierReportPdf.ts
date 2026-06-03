import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export const SUPPLIER_REPORT_PRINT_AREA_ID = "supplier-report-print-area";

function injectLightThemeForPdfClone(doc: Document) {
  const style = doc.createElement("style");
  style.setAttribute("data-supplier-report-pdf", "1");
  style.textContent = `
    #${SUPPLIER_REPORT_PRINT_AREA_ID} {
      background: #ffffff !important;
      color: #171717 !important;
    }
    #${SUPPLIER_REPORT_PRINT_AREA_ID} * {
      color: #171717 !important;
      box-shadow: none !important;
    }
    #${SUPPLIER_REPORT_PRINT_AREA_ID} .supplier-report-stat-box {
      background: #ffffff !important;
      border: 1px solid #d4d4d4 !important;
      border-radius: 6px !important;
    }
  `;
  doc.head.appendChild(style);
}

/** Rasterize the supplier report sheet and save as a multi-page A4 PDF. */
export async function downloadSupplierReportPdf(fileName: string): Promise<void> {
  const el = document.getElementById(SUPPLIER_REPORT_PRINT_AREA_ID);
  if (!el) {
    throw new Error("Missing supplier report print area");
  }

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    onclone: (clonedDoc) => {
      injectLightThemeForPdfClone(clonedDoc);
    },
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
    if (!ctx) {
      throw new Error("Failed to render supplier PDF page");
    }

    ctx.drawImage(
      canvas,
      0,
      sourceY,
      canvas.width,
      sliceHeightPx,
      0,
      0,
      canvas.width,
      sliceHeightPx,
    );

    if (pageIndex > 0) {
      pdf.addPage();
    }
    const sliceHeightMm = sliceHeightPx / pxPerMm;
    pdf.addImage(pageCanvas.toDataURL("image/png", 1.0), "PNG", margin, margin, imgWidth, sliceHeightMm);
    sourceY += sliceHeightPx;
    pageIndex += 1;
  }

  const safe = fileName.replace(/[^\w\-]+/g, "_").replace(/_+/g, "_").slice(0, 120) || "supplier-report";
  pdf.save(`${safe}.pdf`);
}

export function buildSupplierReportPdfFileName(parts: string[]): string {
  const joined = parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join("-");
  return joined || "supplier-report";
}
