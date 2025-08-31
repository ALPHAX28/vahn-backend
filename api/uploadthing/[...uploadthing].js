import { createNextPageApiHandler } from "uploadthing/next-legacy";
import { ourFileRouter } from "./core";

const uploadHandler = createNextPageApiHandler({ router: ourFileRouter });

export default async function handler(req, res) {
  // Permissive CORS for the upload endpoints (adjust for production)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  const reqHeaders = req.headers['access-control-request-headers'];
  if (reqHeaders) {
    res.setHeader('Access-Control-Allow-Headers', reqHeaders);
  } else {
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  // Small server-side logging to help debugging in Vercel logs
  try {
    console.log('[uploadthing] incoming request', { method: req.method, url: req.url });
    return await uploadHandler(req, res);
  } catch (err) {
    console.error('[uploadthing] handler error', err && err.stack ? err.stack : err);
    // Ensure CORS headers are present on error responses too
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.status(500).json({ message: 'UploadThing internal error', error: (err && err.message) || String(err) });
  }
}
