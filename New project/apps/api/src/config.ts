import { join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../../../../", import.meta.url));

function resolveDataPath(envVar: string, defaultRelative: string): string {
  const value = process.env[envVar];
  if (value) {
    return value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value)
      ? value
      : join(projectRoot, value);
  }
  return join(projectRoot, defaultRelative);
}

export const config = {
  port: Number(process.env["PORT"] ?? 5173),
  databasePath: resolveDataPath("CLINIC_DATABASE_PATH", "data/clinic.sqlite"),
  backupsPath: resolveDataPath("CLINIC_BACKUPS_PATH", "data/backups"),
  mediaPath: resolveDataPath("CLINIC_MEDIA_PATH", "data/media"),
  env: process.env["APP_ENV"] ?? "development",
} as const;
