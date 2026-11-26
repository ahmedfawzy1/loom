import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    // Where the Next rewrite forwards /admin/* — see next.config.ts
    CMS_API_URL: z.url().default("http://localhost:4000"),
  },
  client: {},
  runtimeEnv: {
    CMS_API_URL: process.env.CMS_API_URL,
  },
});
