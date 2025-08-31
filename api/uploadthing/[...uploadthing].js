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

  // Delegate to UploadThing's Next legacy handler
  return uploadHandler(req, res);
}
