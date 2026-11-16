import fs from 'fs';
import path from 'path';

export default async function handler(req: any, res: any) {
  const url = new URL(req.url, 'http://localhost:8081');
  const id = url.searchParams.get('id') || '';
  const safeId = path.basename(id);
  const receiptsDir = path.resolve(process.cwd(), '.data', 'receipts');
  const filePath = path.join(receiptsDir, safeId);

  if (!safeId || !fs.existsSync(filePath)) {
    res.statusCode = 404;
    res.end('Receipt not found');
    return;
  }

  const ext = path.extname(safeId).toLowerCase();
  const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
}
