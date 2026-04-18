import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

export const generatePDF = async (elementId: string, filename: string) => {
  const file = await getPDFFile(elementId, filename);
  if (!file) {
    alert('Failed to generate PDF. Please try again.');
    return;
  }
  
  // Download it
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const getPDFFile = async (elementId: string, filename: string): Promise<File | null> => {
  const element = document.getElementById(elementId);
  if (!element) return null;

  try {
    // Yield to the main thread so UI updates (like spinners) can render before the heavy freeze
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // We use html-to-image instead of html2canvas (via html2pdf.js) because 
    // html2canvas throws an error when trying to parse modern oklch() color functions from Tailwind v4.
    const dataUrl = await toPng(element, { 
      quality: 0.90, // Reduced slightly for memory optimization
      pixelRatio: 1.5, // Reduced from 2x for faster generation while maintaining readability
      cacheBust: true
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pdfWidth = pdf.internal.pageSize.getWidth(); // typically 210mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // typically 297mm
    const margin = 10;
    const printWidth = pdfWidth - (margin * 2);

    const imgProps = pdf.getImageProperties(dataUrl);
    const printHeight = (imgProps.height * printWidth) / imgProps.width;
    
    const usableHeight = pdfHeight - (margin * 2);
    
    let heightLeft = printHeight;
    let pageNum = 0;

    // Draw first page
    pdf.addImage(dataUrl, 'PNG', margin, margin, printWidth, printHeight);
    heightLeft -= usableHeight;

    // Cover bottom margin if it overflows
    if (heightLeft > 0) {
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, pdfHeight - margin, pdfWidth, margin, 'F');
    }

    // Draw subsequent pages if the invoice content is very long
    while (heightLeft > 0) {
      pageNum++;
      pdf.addPage();
      
      // Shift the long image up globally per page
      const position = margin - (usableHeight * pageNum);
      pdf.addImage(dataUrl, 'PNG', margin, position, printWidth, printHeight);
      
      // Paint white over the top margin to cover scrolled image
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pdfWidth, margin, 'F');
      
      // Paint white over the bottom margin
      pdf.rect(0, pdfHeight - margin, pdfWidth, margin, 'F');
      
      heightLeft -= usableHeight;
    }

    const pdfBlob = pdf.output('blob');
    return new File([pdfBlob], filename, { type: 'application/pdf' });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return null;
  }
};
