const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

/**
 * Генерирует PDF счета в формате, подходящем для российских счетов на оплату.
 * Принимает сумму без НДС (amount) и опциональную ставку НДС (vatRate).
 * @param {Object} params
 * @returns {Promise<Buffer>} PDF буфер
 */
const generateInvoicePdfBuffer = async (params) => {
  const {
    supplierName = 'Поставщик',
    supplierInn,
    supplierAddress,
    recipient = 'Получатель',
    recipientInn,
    bankName,
    bic,
    corrAccount,
    account,
    amount = 0,
    serviceName = 'Услуги',
    invoiceDate,
    invoiceNumber,
    legalAddress,
    payerName,
    payerInn,
    payerAddress,
    payerOgrn,
    vatRate = 0, // процент, например 20
    pricesIncludeVat = false // если true, считать amount как сумму с НДС
  } = params || {};

  const formatMoney = (n) => {
    return Number(n || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽';
  };

  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Prepare QR (ST00012-ish)
      const sumStr = Number(amount).toFixed(2);
      // Purpose should be plain text (not percent-encoded) to display correctly in banking apps.
      const rawPurpose = `Оплата по счету: ${serviceName || ''}`;
      // Sanitize purpose: remove vertical bar and new lines which may break the field separators
      const purpose = rawPurpose.replace(/\|/g, ' ').replace(/\r?\n/g, ' ');
      // Include recipient INN if provided (some bank apps expect INN field)
      const innField = recipientInn ? `|INN=${recipientInn}` : '';
      const qrText = `ST00012|Name=${recipient || ''}${innField}|PersonalAcc=${account || ''}|BankName=${bankName || ''}|BIC=${bic || ''}|CorrespAcc=${corrAccount || ''}|Sum=${sumStr}|Purpose=${purpose}`;
      const qrDataUrl = await QRCode.toDataURL(qrText).catch(() => null);
      const qrBuffer = qrDataUrl ? Buffer.from(qrDataUrl.split(',')[1], 'base64') : null;

      // Font - prefer Cyrillic-capable
      const fontCandidates = [
        path.join(__dirname, 'fonts', 'DejaVuSans.ttf'),
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/Library/Fonts/Arial.ttf',
        '/System/Library/Fonts/Supplemental/Arial.ttf'
      ];
      let fontPath = null;
      for (const f of fontCandidates) {
        try { if (fs.existsSync(f)) { fontPath = f; break; } } catch (e) {}
      }
      if (fontPath) {
        try { doc.registerFont('Main', fontPath); doc.font('Main'); } catch (e) { console.warn('Font register failed', e); }
      }

      // Header
      doc.fontSize(16).text('СЧЕТ НА ОПЛАТУ', { align: 'center' });
      doc.moveDown(0.3);

      // Invoice meta
      const metaY = doc.y;
      doc.fontSize(10).text(`Номер: ${invoiceNumber || ''}`);
      doc.fontSize(10).text(`Дата: ${invoiceDate || new Date().toISOString().split('T')[0]}`);

      // Supplier block
      doc.moveDown(0.5);
      const left = doc.x;
      doc.fontSize(9).text(`${supplierName}`, { continued: false });
      if (supplierInn) doc.text(`ИНН: ${supplierInn}`);
      if (supplierAddress) doc.text(`Адрес: ${supplierAddress}`);

      // Draw box for payer and recipient details
      doc.moveDown(0.6);
      const boxTop = doc.y;
      const pageWidth = doc.page.width - doc.options.margin * 2;
      const col1 = left;
      const col2 = left + pageWidth / 2 + 10;

      // Left column - Плательщик
      doc.fontSize(9).text('Плательщик:', col1, boxTop);
      let yAfterLeft = doc.y;
      if (payerName) {
        doc.fontSize(10).text(payerName, col1, yAfterLeft);
        if (payerInn) doc.text(`ИНН: ${payerInn}`, col1);
        if (payerAddress) doc.text(`Адрес: ${payerAddress}`, col1);
      } else {
        doc.fontSize(10).text('-', col1, yAfterLeft);
      }

      // Right column - Получатель
      doc.fontSize(9).text('Получатель:', col2, boxTop);
      let yAfterRight = boxTop + 12;
      doc.fontSize(10).text(recipient, col2, yAfterRight);
      if (recipientInn) doc.text(`ИНН: ${recipientInn}`, col2);
      if (legalAddress) doc.text(`Юр. адрес: ${legalAddress}`, col2);
      doc.moveDown(1);

      // Bank details
      doc.fontSize(9).text('Банковские реквизиты:', col2);
      if (account) doc.text(`Р/с: ${account}`, col2);
      if (bankName) doc.text(`Банк: ${bankName}`, col2);
      if (bic) doc.text(`БИК: ${bic}`, col2);
      if (corrAccount) doc.text(`К/с: ${corrAccount}`, col2);

      doc.moveDown(0.8);

      // Table header
      const tableTop = doc.y;
      const colWidths = {
        no: 30,
        name: pageWidth - 30 - 60 - 90 - 80,
        qty: 60,
        unitPrice: 90,
        sum: 80
      };

      const startX = left;
      doc.fontSize(9).text('№', startX, tableTop);
      doc.text('Наименование товара/услуги', startX + colWidths.no, tableTop);
      doc.text('Кол-во', startX + colWidths.no + colWidths.name, tableTop, { width: colWidths.qty, align: 'right' });
      doc.text('Цена', startX + colWidths.no + colWidths.name + colWidths.qty, tableTop, { width: colWidths.unitPrice, align: 'right' });
      doc.text('Сумма', startX + colWidths.no + colWidths.name + colWidths.qty + colWidths.unitPrice, tableTop, { width: colWidths.sum, align: 'right' });

      // Row
      const rowY = tableTop + 18;
      const qty = 1;
      let price = Number(amount) || 0;

      // If pricesIncludeVat, extract net price
      if (pricesIncludeVat && vatRate) {
        price = price / (1 + vatRate / 100);
      }

      const lineSum = price * qty;
      const vatAmount = vatRate ? lineSum * (vatRate / 100) : 0;
      const totalNet = lineSum;
      const totalVat = vatAmount;
      const totalWithVat = totalNet + totalVat;

      doc.fontSize(10).text('1', startX, rowY);
      doc.text(serviceName || '-', startX + colWidths.no, rowY, { width: colWidths.name });
      doc.text(qty.toString(), startX + colWidths.no + colWidths.name, rowY, { width: colWidths.qty, align: 'right' });
      doc.text(formatMoney(price), startX + colWidths.no + colWidths.name + colWidths.qty, rowY, { width: colWidths.unitPrice, align: 'right' });
      doc.text(formatMoney(lineSum), startX + colWidths.no + colWidths.name + colWidths.qty + colWidths.unitPrice, rowY, { width: colWidths.sum, align: 'right' });

      // Totals section
      const totalsY = rowY + 40;
      doc.moveTo(startX, totalsY - 8).lineTo(startX + pageWidth, totalsY - 8).stroke();
      doc.fontSize(10).text('Итого без НДС:', startX + pageWidth - 220, totalsY, { continued: true });
      doc.text(formatMoney(totalNet), { align: 'right' });

      if (vatRate) {
        doc.fontSize(10).text(`НДС ${vatRate}%:`, startX + pageWidth - 220, totalsY + 16, { continued: true });
        doc.text(formatMoney(totalVat), { align: 'right' });
        doc.fontSize(11).text('Итого к оплате:', startX + pageWidth - 220, totalsY + 34, { continued: true });
        doc.text(formatMoney(totalWithVat), { align: 'right' });
      } else {
        doc.fontSize(11).text('Всего к оплате:', startX + pageWidth - 220, totalsY + 16, { continued: true });
        doc.text(formatMoney(totalNet), { align: 'right' });
      }

      // Purpose
      doc.moveDown(3);
      doc.fontSize(9).text(`Назначение платежа: Оплата по счету №${invoiceNumber || ''} от ${invoiceDate || ''}`);

      // QR
      if (qrBuffer) {
        const qrSize = 120;
        const qrX = startX + pageWidth - qrSize;
        const qrY = totalsY + 80;
        try { doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize }); } catch (e) { /* ignore */ }
      }

      // Signature and stamp area
      const sigY = doc.page.height - doc.options.margin - 120;
      doc.fontSize(10).text('Руководитель ______________________', startX, sigY);
      doc.text('Главный бухгалтер __________________', startX, sigY + 20);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = {
  generateInvoicePdfBuffer
};
