import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface ExportPdfOptions {
  fileName?: string;
  onProgress?: (status: string) => void;
}

/**
 * Exports an HTML element directly to a clean, high-resolution A4 PDF document.
 * This guarantees the exact visual representation of the invoice is exported without dashboard elements.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  options?: ExportPdfOptions
): Promise<void> {
  const fileName = options?.fileName || 'Invoice.pdf';

  try {
    options?.onProgress?.('Preparing document...');

    // Render the element to a high-DPI canvas
    const canvas = await (html2canvas as any)(element, {
      scale: 2, // 2x resolution ensures crisp 300 DPI text and lines
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1024, // Consistent desktop-rendered layout
    });

    options?.onProgress?.('Generating PDF...');

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm

    // Calculate scaled image height in mm matching A4 width
    const imgHeight = (canvas.height * pageWidth) / canvas.width;
    const imgData = canvas.toDataURL('image/png');

    let heightLeft = imgHeight;
    let position = 0;

    // Add first page
    pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;

    // For long invoices spanning multiple pages
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
    }

    pdf.save(fileName);
  } catch (error) {
    console.error('Failed to export invoice PDF:', error);
    throw error;
  }
}
