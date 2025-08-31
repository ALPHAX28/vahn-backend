import { createNextPageApiHandler } from "uploadthing/next-legacy";
import { ourFileRouter } from "./core";

const uploadHandler = createNextPageApiHandler({
  router: ourFileRouter,
});

// Wrap the UploadThing handler to add CORS headers and handle preflight requests
export default async function handler(req, res) {
  const allowedOrigin = process.env.FRONTEND_URL || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return uploadHandler(req, res);
}