import * as fs from "node:fs";
import * as path from "node:path";

function removeWrappingQuotes(value: string): string {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function applyEnvFile(filePath: string): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const normalized = trimmed.startsWith("export ") ? trimmed.slice(7) : trimmed;
    const separatorIndex = normalized.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalized.slice(0, separatorIndex).trim();
    const rawValue = normalized.slice(separatorIndex + 1);

    if (!key || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = removeWrappingQuotes(rawValue);
  }

  return true;
}

function isSupabasePoolerUrl(value: string): boolean {
  return value.includes("pooler.supabase.com:6543");
}

const cwd = process.cwd();
const candidateEnvFiles = [
  path.resolve(cwd, "backend/.env.local"),
  path.resolve(cwd, ".env.local"),
  path.resolve(__dirname, "../.env.local"),
  path.resolve(__dirname, "../../.env.local"),
  path.resolve(cwd, "backend/.env"),
  path.resolve(cwd, ".env"),
  path.resolve(__dirname, "../.env"),
  path.resolve(__dirname, "../../.env")
];

for (const file of candidateEnvFiles) {
  if (applyEnvFile(file)) {
    break;
  }
}

const currentDatabaseUrl = process.env.DATABASE_URL;
const directDatabaseUrl = process.env.DIRECT_URL;
const isProduction = process.env.NODE_ENV === "production";

if (
  directDatabaseUrl &&
  (!currentDatabaseUrl || (!isProduction && isSupabasePoolerUrl(currentDatabaseUrl)))
) {
  process.env.DATABASE_URL = directDatabaseUrl;
}
