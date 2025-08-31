let createRouteHandler;
// Try multiple require paths to be resilient to package layout differences in the deployment bundle
(() => {
  const tryPaths = [
    'uploadthing/next',
    'uploadthing/next/index.cjs',
    'uploadthing',
    'uploadthing/index.cjs',
    'uploadthing/next-legacy',
  ];
  for (const p of tryPaths) {
    try {
      const mod = require(p);
      // module may export helper directly or as default
      createRouteHandler = mod.createRouteHandler || (mod.default && mod.default.createRouteHandler) || undefined;
      if (createRouteHandler) {
        console.log('[uploadthing-route] imported createRouteHandler from', p);
        break;
      }
      console.warn('[uploadthing-route] module loaded from', p, 'but createRouteHandler not found');
    } catch (err) {
      console.warn('[uploadthing-route] failed to require', p, '-', err && err.code ? err.code : (err && err.message) || err);
    }
  }
  if (!createRouteHandler) {
    const err = new Error('createRouteHandler not found on uploadthing package');
    console.error('[uploadthing-route] import failure', err.stack || err.message || err);
    throw err;
  }
})();
import { ourFileRouter } from "./core";

const uploadHandler = createRouteHandler({ router: ourFileRouter });

// Wrap the UploadThing handler to add CORS headers and handle preflight requests
export default async function handler(req, res) {
  // Permissive CORS: allow all origins and common methods/headers
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

  try {
    console.log('[uploadthing-route] incoming request', { method: req.method, url: req.url });
    // Delegate to the new createRouteHandler API which exposes POST/GET
    if (req.method === 'POST') {
      const result = await uploadHandler.POST(req);
      return forwardFetchResultToRes(result, res);
    }
    if (req.method === 'GET') {
      const result = await uploadHandler.GET(req);
      return forwardFetchResultToRes(result, res);
    }
    res.setHeader('Allow', 'GET,POST,OPTIONS');
    return res.status(405).end();
  } catch (err) {
    console.error('[uploadthing-route] handler error', err && err.stack ? err.stack : err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.status(500).json({ message: 'UploadThing internal error', error: (err && err.message) || String(err) });
  }
}

// Helper: forward a Fetch/Response-like result to Next.js res
function forwardFetchResultToRes(result, res) {
  if (!result) return res.end();
  // If result looks like an object with status
  const status = result.status || 200;

  // Copy headers if present
  try {
    const hdrs = result.headers;
    if (hdrs) {
      // Headers instance
      if (typeof hdrs.entries === 'function') {
        for (const [k, v] of hdrs.entries()) res.setHeader(k, v);
      } else if (typeof hdrs.forEach === 'function') {
        hdrs.forEach((v, k) => res.setHeader(k, v));
      } else if (typeof hdrs === 'object') {
        for (const k of Object.keys(hdrs)) res.setHeader(k, hdrs[k]);
      }
    }
  } catch (e) {
    // ignore header copy errors
  }

  // Body handling
  if (typeof result.json === 'function') {
    return result.json().then((body) => res.status(status).json(body)).catch(() => res.status(status).end());
  }
  if (typeof result.text === 'function') {
    return result.text().then((body) => res.status(status).send(body)).catch(() => res.status(status).end());
  }
  if (result.body) {
    // assume string or buffer
    return res.status(status).send(result.body);
  }
  return res.status(status).end();
}