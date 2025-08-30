import { createNextPageApiHandler } from "uploadthing/next-legacy";
import { ourFileRouter } from "./core";

const handler = createNextPageApiHandler({
  router: ourFileRouter,
});

export default handler;