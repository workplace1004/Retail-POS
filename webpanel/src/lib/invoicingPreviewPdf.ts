import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export const INVOICING_PREVIEW_PRINT_AREA_ID = "invoicing-preview-print-area";

function injectLightThemeForPdfClone(doc: Document) {
  const style = doc.createElement("style");
  style.setAttribute("data-invoicing-preview-pdf", "1");
  style.textContent = `
    #${INVOICING_PREVIEW_PRINT_AREA_ID} {
      background: #ffffff !important;
      color: #171717 !important;
      border: 1px solid #e5e5e5 !important;
      box-shadow: none !important;
    }
    #${INVOICING_PREVIEW_PRINT_AREA_ID} * {
      color: #171717 !important;
      border-color: #d4d4d4 !important;
      box-shadow: none !important;
      text-shadow: none !important;
    }
  `;
  doc.head.appendChild(style);
}

async function buildInvoicingPreviewPdf(scale = 2): Promise<jsPDF> {
  const el = document.getElementById(INVOICING_PREVIEW_PRINT_AREA_ID);
  if (!el) throw new Error("Missing invoicing preview print area");

  const canvas = await html2canvas(el, {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    onclone: (clonedDoc) => injectLightThemeForPdfClone(clonedDoc),
  });

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const imgData = canvas.toDataURL("image/png", 1.0);
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
  return pdf;
}

export async function downloadInvoicingPreviewPdf(fileName: string): Promise<void> {
  const pdf = await buildInvoicingPreviewPdf();
  const safe = fileName.replace(/[^\w\-]+/g, "_").replace(/_+/g, "_").slice(0, 120) || "invoicing-document";
  pdf.save(`${safe}.pdf`);
}

export async function buildInvoicingPreviewPdfBase64(scale = 1.2): Promise<string> {
  const pdf = await buildInvoicingPreviewPdf(scale);
  const blob = pdf.output("blob");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read generated PDF."));
    reader.readAsDataURL(blob);
  });
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx < 0) throw new Error("Invalid generated PDF payload.");
  return dataUrl.slice(commaIdx + 1);
}

