import fs from 'fs';
import path from 'path';
import { createHandler } from '../_lib/http';
import { cleanString, err, RECEIPT_FOLDER } from '../_lib/payment-shared';

export default createHandler(
  async (req, _res, ctx) => {
    const paymentId = cleanString(req.body?.paymentId, 80);
    const publicId = cleanString(req.body?.publicId, 200);
    const base64Data = req.body?.base64;
    const contentType = cleanString(req.body?.contentType, 50) || 'image/jpeg';

    if (!paymentId || !base64Data) {
      throw err('invalid-argument', 'Missing receipt image data.');
    }

    const receiptsDir = path.resolve(process.cwd(), '.data', 'receipts');
    if (!fs.existsSync(receiptsDir)) {
      fs.mkdirSync(receiptsDir, { recursive: true });
    }

    const ext = contentType.includes('png') ? '.png' : contentType.includes('webp') ? '.webp' : '.jpg';
    const filename = `${paymentId}_${ctx.uid}${ext}`;
    const filePath = path.join(receiptsDir, filename);

    // Strip data URI prefix if present
    const rawBase64 = String(base64Data).replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    const buffer = Buffer.from(rawBase64, 'base64');

    if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
      throw err('invalid-argument', 'Receipt image must be 5 MB or smaller.');
    }

    fs.writeFileSync(filePath, buffer);

    const host = req.headers?.host || 'localhost:8081';
    const secure_url = `http://${host}/api/payments/receiptDev?id=${filename}`;

    return {
      secure_url,
      public_id: publicId || `${RECEIPT_FOLDER}/${paymentId}_${ctx.uid}`,
    };
  },
  { auth: true, method: 'POST' }
);
