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
          if (parsed && parsed.data && parsed.data.url) return resolve(parsed.data.url);
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
    const { images } = body; // expect array of base64 strings (data URLs)
    if (!images || !Array.isArray(images) || !images.length) return res.status(400).json({ message: 'No images provided' });
    const key = process.env.IMGBB_API_KEY;
    if (!key) return res.status(500).json({ message: 'IMGBB_API_KEY not configured' });
    const urls = [];
    for (const b64 of images) {
      // strip data:image/...;base64, if present
      const cleaned = b64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
      const url = await postToImgbb(key, cleaned);
      urls.push(url);
    }
    // Ensure CORS header present on response
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ urls });
  } catch (err) {
    console.error('upload-imgbb error', err && err.stack ? err.stack : err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ message: 'Upload failed', error: (err && err.message) || String(err) });
  }
};
