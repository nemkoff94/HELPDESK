const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

/**
 * Генерирует PDF счета с QR кодом
 * @param {Object} params - Параметры счета
 * @returns {Promise<Buffer>} - PDF как буфер
 */
const generateInvoicePdfBuffer = async (params) => {
  const {
    recipient,
    recipientInn,
    bankName,
    bic,
    corrAccount,
    account,
    amount,
    serviceName,
    invoiceDate,
    invoiceNumber,
    legalAddress,
    payerName,
    payerInn,
    payerAddress,
    payerOgrn
  } = params;

  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Prepare QR text in ST00012-like format
      const sumStr = Number(amount).toFixed(2);
      const qrText = `ST00012|Name=${recipient}|PersonalAcc=${account}|BankName=${bankName}|BIC=${bic}|CorrespAcc=${corrAccount}|Sum=${sumStr}|Purpose=${encodeURIComponent('Оплата по счету: ' + serviceName)}`;
      const qrDataUrl = await QRCode.toDataURL(qrText);
      const qrBase64 = qrDataUrl.split(',')[1];
      const qrBuffer = Buffer.from(qrBase64, 'base64');

      // Font selection (DejaVuSans/Arial if available)
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
        try { doc.registerFont('Main', fontPath); doc.font('Main'); } catch (e) { console.warn('Failed to register font', e); }
      } else {
        console.warn('No Cyrillic-capable font found; PDF may show garbled Cyrillic. Place a TTF (e.g. DejaVuSans.ttf) into server/fonts/ to fix.');
      }

      // Header
      doc.fontSize(20).text('СЧЕТ НА ОПЛАТУ', { align: 'center' });
      doc.moveDown(0.5);

      // Meta
      const metaX = doc.page.width - doc.options.margin - 220;
      doc.fontSize(10).text(`Номер: ${invoiceNumber || ''}`, metaX, 80);
      doc.text(`Дата: ${invoiceDate || new Date().toISOString().split('T')[0]}`, { align: 'right' });

      // Payer (Плательщик) and Recipient (Получатель) blocks side by side
      doc.moveDown(1);
      const leftStart = doc.x;
      const mid = doc.page.width / 2;

      // Payer block (from client)
      doc.fontSize(10).text('Плательщик:', leftStart, doc.y, { underline: true });
      doc.moveDown(0.2);
      if (payerName) {
        doc.fontSize(11).text(payerName, leftStart);
        if (payerInn) doc.text(`ИНН: ${payerInn}`);
        if (payerOgrn) doc.text(`ОГРН: ${payerOgrn}`);
        if (payerAddress) doc.text(`Юр. адрес: ${payerAddress}`);
      } else {
        doc.fontSize(11).text('-', leftStart);
      }

      // Recipient block on the right
      const recX = mid + 10;
      let recY = doc.y - 40; // align top approximately
      doc.fontSize(10).text('Получатель:', recX, recY, { underline: true });
      doc.moveDown(0.2);
      recY = doc.y;
      doc.fontSize(11).text(recipient, recX, recY);
      if (recipientInn) doc.text(`ИНН: ${recipientInn}`);
      if (legalAddress) doc.text(`Юр. адрес: ${legalAddress}`);
      doc.moveDown(0.5);

      // Bank details under recipient
      doc.fontSize(10).text('Банковские реквизиты:', recX);
      doc.text(`Р/с: ${account}`);
      doc.text(`Банк: ${bankName}`);
      doc.text(`БИК: ${bic}`);
      doc.text(`К/с: ${corrAccount}`);

      // Separator
      doc.moveDown(0.5);
      const sepY = doc.y;
      doc.moveTo(leftStart, sepY).lineTo(doc.page.width - doc.options.margin, sepY).stroke();

      // Table header
      doc.moveDown(0.5);
      const tableTop = doc.y;
      doc.fontSize(10).text('№', leftStart, tableTop);
      doc.text('Наименование', leftStart + 30, tableTop);
      doc.text('Кол-во', leftStart + 360, tableTop);
      doc.text('Цена', leftStart + 420, tableTop);
      doc.text('Сумма', leftStart + 480, tableTop);

      // Row
      const rowY = tableTop + 18;
      doc.fontSize(11).text('1', leftStart, rowY);
      doc.text(serviceName || '-', leftStart + 30, rowY, { width: 300 });
      doc.text('1', leftStart + 360, rowY);
      doc.text(Number(amount).toFixed(2) + ' ₽', leftStart + 420, rowY);
      doc.text(Number(amount).toFixed(2) + ' ₽', leftStart + 480, rowY);

      // Total
      doc.moveTo(leftStart, rowY + 30).lineTo(doc.page.width - doc.options.margin, rowY + 30).stroke();
      doc.fontSize(12).text('Итого:', leftStart + 360, rowY + 40);
      doc.text(Number(amount).toFixed(2) + ' ₽', leftStart + 480, rowY + 40);

      // QR
      const qrSize = 160;
      const qrX = doc.page.width - doc.options.margin - qrSize;
      const qrY = rowY + 10;
      doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

      // Footer
      doc.moveDown(10);
      doc.fontSize(10).text('Назначение платежа: ' + `Оплата по счету: ${serviceName}`);
      doc.moveDown(2);
      doc.fontSize(10).text('Подпись получателя: ____________________', leftStart);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = {
  generateInvoicePdfBuffer
};
