// src/utils/pdfGenerator.ts
// Genera el PDF de una factura con pdfkit (JS puro, sin Chromium).
// Devuelve un Buffer listo para persistir y/o servir via HTTP.
//
// Rediseno v2.1.0:
//   - Respeta company.currency (VES -> es-VE / Bs., USD -> en-US / $)
//   - Paleta del design system (Apple HIG) hardcodeada porque PDFKit no lee CSS
//   - Header con barra de color de marca + layout de 2 columnas
//   - Tabla con header gris, filas alternas y bordes sutiles
//   - Badge de estado (color segun PENDING/PAID/OVERDUE)
//   - Totales alineados con separador antes del TOTAL
//   - Multi-pagina con header de tabla repetido
//   - Footer con timestamp de generacion

import PDFDocument from 'pdfkit';

export interface InvoiceForPdf {
  invoice: {
    id: string;
    number: string;
    date: string;
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

// ─── Paleta (Apple HIG, hardcodeada porque PDFKit no lee CSS) ───

const COLORS = {
  primary: '#0A84FF',
  primarySoft: '#E5F1FF',
  text: '#1D1D1F',
  textMuted: '#6E6E73',
  textSubtle: '#A1A1A6',
  border: '#D2D2D7',
  borderSubtle: '#E5E5E7',
  surfaceAlt: '#F5F5F7',
  white: '#FFFFFF',
  success: '#34C759',
  warning: '#FF9500',
  danger: '#FF3B30',
};

const PAGE = {
  width: 595.28,   // A4 pt
  height: 841.89,
  marginX: 48,
  marginTop: 56,
  marginBottom: 48,
};

const TABLE_COLS = {
  productName: { x: PAGE.marginX, width: 260 },
  price: { x: PAGE.marginX + 260, width: 90 },
  quantity: { x: PAGE.marginX + 350, width: 60 },
  subtotal: { x: PAGE.marginX + 410, width: 89 },
};

// ─── Helpers de formato ────────────────────────────────────────

function localeFor(currency: string): string {
  return currency === 'USD' ? 'en-US' : 'es-VE';
}

function fmtMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat(localeFor(currency), {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-VE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function fmtTimestamp(): string {
  return new Date().toLocaleString('es-VE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusColor(status: string): string {
  if (status === 'PAID') return COLORS.success;
  if (status === 'OVERDUE') return COLORS.danger;
  return COLORS.warning;
}

function statusLabel(status: string): string {
  if (status === 'PAID') return 'PAGADA';
  if (status === 'OVERDUE') return 'VENCIDA';
  return 'PENDIENTE';
}

// ─── Render de secciones ───────────────────────────────────────

function drawTopBar(doc: PDFKit.PDFDocument): void {
  doc.rect(0, 0, PAGE.width, 6).fill(COLORS.primary);
}

function drawHeader(doc: PDFKit.PDFDocument, data: InvoiceForPdf): void {
  drawTopBar(doc);

  const topY = PAGE.marginTop + 12;

  // Columna izquierda: empresa
  doc.fillColor(COLORS.primary)
    .font('Helvetica-Bold')
    .fontSize(22)
    .text('VENDRA', PAGE.marginX, topY);

  doc.fillColor(COLORS.text)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(data.company.name, PAGE.marginX, topY + 34);

  doc.fillColor(COLORS.textMuted)
    .font('Helvetica')
    .fontSize(9)
    .text(`RIF: ${data.company.rif}`, PAGE.marginX, topY + 50)
    .text(data.company.address, PAGE.marginX, topY + 63, {
      width: 280,
    });

  // Columna derecha: factura + estado
  const rightX = PAGE.width - PAGE.marginX - 200;
  const rightWidth = 200;

  doc.fillColor(COLORS.textMuted)
    .font('Helvetica')
    .fontSize(8)
    .text('FACTURA', rightX, topY, { width: rightWidth, align: 'right' });

  doc.fillColor(COLORS.text)
    .font('Helvetica-Bold')
    .fontSize(16)
    .text(data.invoice.number, rightX, topY + 12, {
      width: rightWidth,
      align: 'right',
    });

  doc.fillColor(COLORS.textMuted)
    .font('Helvetica')
    .fontSize(9)
    .text(`Fecha: ${fmtDate(data.invoice.date)}`, rightX, topY + 34, {
      width: rightWidth,
      align: 'right',
    });

  // Badge de estado (pill)
  const badgeY = topY + 50;
  const label = statusLabel(data.invoice.status);
  const badgeWidth = 76;
  const badgeHeight = 18;
  const badgeX = rightX + rightWidth - badgeWidth;

  doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 9)
    .fill(statusColor(data.invoice.status));

  doc.fillColor(COLORS.white)
    .font('Helvetica-Bold')
    .fontSize(8)
    .text(label, badgeX, badgeY + 5, {
      width: badgeWidth,
      align: 'center',
    });
}

function drawClientSection(doc: PDFKit.PDFDocument, data: InvoiceForPdf): void {
  const y = PAGE.marginTop + 130;

  doc.moveTo(PAGE.marginX, y)
    .lineTo(PAGE.width - PAGE.marginX, y)
    .strokeColor(COLORS.borderSubtle)
    .lineWidth(1)
    .stroke();

  doc.fillColor(COLORS.textMuted)
    .font('Helvetica-Bold')
    .fontSize(8)
    .text('FACTURADO A', PAGE.marginX, y + 14);

  doc.fillColor(COLORS.text)
    .font('Helvetica-Bold')
    .fontSize(12)
    .text(data.invoice.client, PAGE.marginX, y + 28);
}

function drawTableHeader(doc: PDFKit.PDFDocument, y: number): number {
  const rowHeight = 22;

  doc.rect(PAGE.marginX, y, PAGE.width - PAGE.marginX * 2, rowHeight)
    .fill(COLORS.surfaceAlt);

  const textY = y + 7;
  doc.fillColor(COLORS.textMuted)
    .font('Helvetica-Bold')
    .fontSize(8);

  doc.text('PRODUCTO', TABLE_COLS.productName.x + 8, textY, {
    width: TABLE_COLS.productName.width - 8,
    align: 'left',
  });
  doc.text('PRECIO', TABLE_COLS.price.x, textY, {
    width: TABLE_COLS.price.width,
    align: 'right',
  });
  doc.text('CANT.', TABLE_COLS.quantity.x, textY, {
    width: TABLE_COLS.quantity.width,
    align: 'center',
  });
  doc.text('SUBTOTAL', TABLE_COLS.subtotal.x, textY, {
    width: TABLE_COLS.subtotal.width - 8,
    align: 'right',
  });

  return y + rowHeight;
}

function drawTableRow(
  doc: PDFKit.PDFDocument,
  y: number,
  item: InvoiceForPdf['items'][number],
  currency: string,
  isEven: boolean,
): number {
  const rowHeight = 20;

  if (isEven) {
    doc.rect(PAGE.marginX, y, PAGE.width - PAGE.marginX * 2, rowHeight)
      .fill(COLORS.white);
  } else {
    doc.rect(PAGE.marginX, y, PAGE.width - PAGE.marginX * 2, rowHeight)
      .fill(COLORS.surfaceAlt);
  }

  const textY = y + 6;
  doc.fillColor(COLORS.text)
    .font('Helvetica')
    .fontSize(9);

  doc.text(item.productName, TABLE_COLS.productName.x + 8, textY, {
    width: TABLE_COLS.productName.width - 12,
    align: 'left',
    ellipsis: true,
    lineBreak: false,
  });
  doc.text(fmtMoney(item.price, currency), TABLE_COLS.price.x, textY, {
    width: TABLE_COLS.price.width,
    align: 'right',
    lineBreak: false,
  });
  doc.text(String(item.quantity), TABLE_COLS.quantity.x, textY, {
    width: TABLE_COLS.quantity.width,
    align: 'center',
    lineBreak: false,
  });
  doc.text(fmtMoney(item.subtotal, currency), TABLE_COLS.subtotal.x, textY, {
    width: TABLE_COLS.subtotal.width - 8,
    align: 'right',
    lineBreak: false,
  });

  // Borde inferior sutil
  doc.moveTo(PAGE.marginX, y + rowHeight)
    .lineTo(PAGE.width - PAGE.marginX, y + rowHeight)
    .strokeColor(COLORS.borderSubtle)
    .lineWidth(0.5)
    .stroke();

  return y + rowHeight;
}

function drawTotals(
  doc: PDFKit.PDFDocument,
  y: number,
  data: InvoiceForPdf,
): void {
  const boxWidth = 220;
  const boxX = PAGE.width - PAGE.marginX - boxWidth;

  // Subtotal = sum(items) para no depender de invoice.total
  const subtotal = data.items.reduce((acc, i) => acc + i.subtotal, 0);
  const total = data.invoice.total;
  const iva = Math.max(0, Math.round((total - subtotal) * 100) / 100);

  doc.fillColor(COLORS.textMuted)
    .font('Helvetica')
    .fontSize(9);

  // Subtotal
  doc.text('Subtotal', boxX, y);
  doc.fillColor(COLORS.text)
    .text(fmtMoney(subtotal, data.company.currency), boxX, y, {
      width: boxWidth,
      align: 'right',
    });

  // IVA
  const y2 = y + 16;
  doc.fillColor(COLORS.textMuted).text('IVA', boxX, y2);
  doc.fillColor(COLORS.text)
    .text(fmtMoney(iva, data.company.currency), boxX, y2, {
      width: boxWidth,
      align: 'right',
    });

  // Separador
  const lineY = y2 + 20;
  doc.moveTo(boxX, lineY)
    .lineTo(PAGE.width - PAGE.marginX, lineY)
    .strokeColor(COLORS.border)
    .lineWidth(1)
    .stroke();

  // TOTAL
  const totalY = lineY + 10;
  doc.fillColor(COLORS.text)
    .font('Helvetica-Bold')
    .fontSize(12)
    .text('TOTAL', boxX, totalY);

  doc.fillColor(COLORS.primary)
    .font('Helvetica-Bold')
    .fontSize(14)
    .text(fmtMoney(total, data.company.currency), boxX, totalY - 2, {
      width: boxWidth,
      align: 'right',
    });
}

function drawFooter(doc: PDFKit.PDFDocument): void {
  const y = PAGE.height - PAGE.marginBottom - 24;

  doc.moveTo(PAGE.marginX, y)
    .lineTo(PAGE.width - PAGE.marginX, y)
    .strokeColor(COLORS.borderSubtle)
    .lineWidth(0.5)
    .stroke();

  doc.fillColor(COLORS.textSubtle)
    .font('Helvetica')
    .fontSize(8)
    .text(
      `Generado por Vendra - Sistema de Gestion de Inventario y Facturacion`,
      PAGE.marginX,
      y + 8,
      { width: PAGE.width - PAGE.marginX * 2, align: 'center' },
    );

  doc.text(
    `Emitido el ${fmtTimestamp()}`,
    PAGE.marginX,
    y + 20,
    { width: PAGE.width - PAGE.marginX * 2, align: 'center' },
  );
}

// ─── Generador principal ───────────────────────────────────────

export async function generateInvoicePdf(
  data: InvoiceForPdf,
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        info: {
          Title: `Factura ${data.invoice.number}`,
          Author: 'Vendra',
          Subject: `Factura emitida a ${data.invoice.client}`,
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── Pagina 1: header + cliente + tabla
      drawHeader(doc, data);
      drawClientSection(doc, data);

      let y = PAGE.marginTop + 190;
      y = drawTableHeader(doc, y);

      const tableBottomLimit = PAGE.height - PAGE.marginBottom - 120;

      for (let i = 0; i < data.items.length; i++) {
        if (y + 20 > tableBottomLimit) {
          drawFooter(doc);
          doc.addPage();
          drawTopBar(doc);

          y = PAGE.marginTop;
          doc.fillColor(COLORS.text)
            .font('Helvetica-Bold')
            .fontSize(11)
            .text(`${data.invoice.number} (continuacion)`, PAGE.marginX, y);
          y += 24;

          y = drawTableHeader(doc, y);
        }
        y = drawTableRow(doc, y, data.items[i], data.company.currency, i % 2 === 0);
      }

      // ── Totales (posicionados dinamicamente, pero con minimo)
      const totalsY = Math.max(y + 16, tableBottomLimit + 20);
      drawTotals(doc, totalsY, data);

      // ── Footer en cada pagina (pagina 1 y la ultima, para no complicar)
      drawFooter(doc);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}