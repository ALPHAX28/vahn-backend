const https = require('https');

function postToImgbb(key, b64) {
  const data = `key=${encodeURIComponent(key)}&image=${encodeURIComponent(b64)}`;
  const options = {
    hostname: 'api.imgbb.com',
    path: '/1/upload',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(data),
    },
  };
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed && parsed.data) {
            // prefer a direct image URL (display_url or image.url), fall back to page url
            const data = parsed.data;
            const direct = data.display_url || (data.image && data.image.url) || (data.thumb && data.thumb.url) || data.url;
            if (direct) return resolve(direct);
          }
          return reject(new Error('Invalid imgbb response'));
        } catch (e) {
          return reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
  const body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
  const { images } = body; // expect array of base64 strings (data URLs) or raw base64 strings
  if (!images || !Array.isArray(images) || !images.length) return res.status(400).json({ message: 'No images provided' });
  if (images.length > 10) return res.status(400).json({ message: 'Maximum 10 images allowed' });
    const key = process.env.IMGBB_API_KEY;
    if (!key) return res.status(500).json({ message: 'IMGBB_API_KEY not configured' });
    const uploads = images.map((b64) => {
      const raw = String(b64 || '');
      // Accept data URLs like: data:image/png;base64,.... or data:image/svg+xml;base64,....
      const cleaned = raw.replace(/^data:[^;]+;base64,/, '');
      if (!cleaned) return Promise.resolve({ error: 'Invalid image data' });
      return postToImgbb(key, cleaned).catch((e) => ({ error: (e && e.message) || String(e) }));
    });
    const results = await Promise.all(uploads);
  const urls = results.map((r) => (typeof r === 'string' ? r : null));
  const errors = results.map((r, i) => ({ index: i, error: r && r.error ? r.error : null })).filter(x => x.error);
  const successful = urls.filter(Boolean);
  if (!successful.length && errors.length) return res.status(500).json({ message: 'All uploads failed', errors });
  // Ensure CORS header present on response
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).json({ urls: successful, errors: errors.length ? errors : undefined });
  } catch (err) {
    console.error('upload-imgbb error', err && err.stack ? err.stack : err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ message: 'Upload failed', error: (err && err.message) || String(err) });
  }
};
