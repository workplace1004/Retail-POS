import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export const STOCK_REPORT_PRINT_AREA_ID = "stock-report-print-area";

function injectLightThemeForPdfClone(doc: Document) {
  const style = doc.createElement("style");
  style.setAttribute("data-stock-report-pdf", "1");
  style.textContent = `
    #${STOCK_REPORT_PRINT_AREA_ID} {
      background: #ffffff !important;
      background-color: #ffffff !important;
      color: #171717 !important;
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
      border-radius: 0 !important;
    }
    #${STOCK_REPORT_PRINT_AREA_ID} * {
      background: #ffffff !important;
      background-color: #ffffff !important;
      background-image: none !important;
      color: #171717 !important;
      box-shadow: none !important;
      text-shadow: none !important;
      border-color: #d4d4d4 !important;
    }
    #${STOCK_REPORT_PRINT_AREA_ID} table,
    #${STOCK_REPORT_PRINT_AREA_ID} thead,
    #${STOCK_REPORT_PRINT_AREA_ID} tbody,
    #${STOCK_REPORT_PRINT_AREA_ID} tr,
    #${STOCK_REPORT_PRINT_AREA_ID} th,
    #${STOCK_REPORT_PRINT_AREA_ID} td {
      background: #ffffff !important;
      background-color: #ffffff !important;
      color: #171717 !important;
    }
  `;
  doc.head.appendChild(style);
}

export async function downloadStockReportPdf(fileName: string): Promise<void> {
  const el = document.getElementById(STOCK_REPORT_PRINT_AREA_ID);
  if (!el) {
    throw new Error("Missing stock report print area");
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

  const imgData = canvas.toDataURL("image/png", 1.0);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const imgWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const pageInnerHeight = pageHeight - margin * 2;

  let heightLeft = imgHeight;
  let y = margin;

  pdf.addImage(imgData, "PNG", margin, y, imgWidth, imgHeight);
  heightLeft -= pageInnerHeight;

  while (heightLeft > 0) {
    y = margin + (heightLeft - imgHeight);
    pdf.addPage();
    pdf.addImage(imgData, "PNG", margin, y, imgWidth, imgHeight);
    heightLeft -= pageInnerHeight;
  }

  const safe = fileName.replace(/[^\w\-]+/g, "_").replace(/_+/g, "_").slice(0, 120) || "stock-report";
  pdf.save(`${safe}.pdf`);
}

export function buildStockReportPdfFileName(parts: string[]): string {
  const joined = parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join("-");
  return joined || "stock-report";
}
