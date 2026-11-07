// src/utils/pdfGenerator.ts
// Genera el PDF de una factura con pdfkit (JS puro, sin Chromium).
// Devuelve un Buffer listo para persistir y/o servir via HTTP.

import PDFDocument from 'pdfkit';

export interface InvoiceForPdf {
  invoice: {
    id: string;
    number: string;
    date: string; // ISO
    client: string;
    total: number;
    status: string;
  };
  company: {
    name: string;
    rif: string;
    address: string;
    currency: string;
  };
  items: Array<{
    productName: string;
    price: number;
    quantity: number;
    subtotal: number;
  }>;
}

const moneyFmt = new Intl.NumberFormat('es-VE', {
  style: 'currency',
  currency: 'VES',
});

function fmtMoney(n: number): string {
  return moneyFmt.format(n);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-VE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export async function generateInvoicePdf(data: InvoiceForPdf): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header empresa
      doc.fontSize(20).font('Helvetica-Bold').text(data.company.name, { align: 'left' });
      doc.fontSize(10).font('Helvetica');
      doc.text(`RIF: ${data.company.rif}`);
      doc.text(data.company.address);
      doc.moveDown(0.5);

      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      // Cabecera factura
      doc.fontSize(16).font('Helvetica-Bold').text('FACTURA', { align: 'right' });
      doc.fontSize(11).font('Helvetica');
      doc.text(data.invoice.number, { align: 'right' });
      doc.text(`Fecha: ${fmtDate(data.invoice.date)}`, { align: 'right' });
      doc.text(`Estado: ${data.invoice.status}`, { align: 'right' });
      doc.moveDown(0.8);

      doc.fontSize(11).font('Helvetica-Bold').text(`Cliente: ${data.invoice.client}`);
      doc.moveDown(1);

      // Tabla items
      const tableTop = doc.y;
      const colX = { name: 50, price: 350, qty: 430, subtotal: 490 };

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Producto', colX.name, tableTop);
      doc.text('Precio', colX.price, tableTop);
      doc.text('Cant.', colX.qty, tableTop);
      doc.text('Subtotal', colX.subtotal, tableTop);
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);

      doc.font('Helvetica').fontSize(9);
      let y = doc.y;
      for (const item of data.items) {
        if (y > 720) {
          doc.addPage();
          y = 50;
        }
        doc.text(item.productName, colX.name, y, { width: 290 });
        doc.text(fmtMoney(item.price), colX.price, y);
        doc.text(String(item.quantity), colX.qty, y);
        doc.text(fmtMoney(item.subtotal), colX.subtotal, y);
        y += 20;
      }
      doc.y = y;
      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.8);

      // Total
      doc.fontSize(14).font('Helvetica-Bold');
      doc.text(`TOTAL: ${fmtMoney(data.invoice.total)}`, { align: 'right' });
      doc.moveDown(2);

      // Footer
      doc.fontSize(8).font('Helvetica').fillColor('gray');
      doc.text(
        'Generado por Vendra - Sistema de Gestion de Inventario y Facturacion',
        50,
        780,
        { align: 'center', width: 495 },
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}