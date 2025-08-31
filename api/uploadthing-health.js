export default function handler(req, res) {
  try {
    const resolved = require.resolve('uploadthing/next');
    console.log('[uploadthing-health] resolved uploadthing/next ->', resolved);
    return res.status(200).json({ ok: true, resolved });
  } catch (err) {
    console.error('[uploadthing-health] failed to resolve uploadthing/next', err && err.stack ? err.stack : err);
    return res.status(500).json({ ok: false, error: (err && err.message) || String(err) });
  }
}
