// Shipped in .env.example, so it is exactly what an unedited deployment config still contains.
const PLACEHOLDER = "REPLACE_ME";

const REQUIRED = [
  "CMS_DATABASE_URL",
  "S3_BUCKET",
  "S3_REGION",
  "S3_PUBLIC_URL",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
] as const;

/** Refuses to boot a process whose configuration would be unsafe rather than letting it serve. */
export function validateEnv(config: Record<string, unknown>) {
  const isProduction = config.NODE_ENV === "production";

  for (const key of REQUIRED) {
    const value = config[key];
    if (!value) throw new Error(`${key} is not set`);
    if (isProduction && String(value).includes(PLACEHOLDER))
      throw new Error(`${key} still holds its ${PLACEHOLDER} placeholder`);
  }

  // A production process pointed at a local endpoint would write media nowhere anyone can read it
  if (isProduction && String(config.S3_ENDPOINT ?? "").includes("localhost"))
    throw new Error("S3_ENDPOINT points at localhost in production");

  return config;
}
