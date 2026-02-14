const DEFAULT_TIMEOUT_MS = 8_000;

function readArg(name) {
  const prefix = `--${name}=`;
  const direct = process.argv.find((arg) => arg.startsWith(prefix));
  if (direct) {
    return direct.slice(prefix.length);
  }

  const index = process.argv.findIndex((arg) => arg === `--${name}`);
  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }

  return undefined;
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function normalizePath(value) {
  return value.startsWith("/") ? value : `/${value}`;
}

function toNumber(value, fallback) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json"
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function assertHealth(baseUrl, healthPath, timeoutMs) {
  const url = `${baseUrl}${healthPath}`;
  const response = await fetchWithTimeout(url, timeoutMs);

  if (!response.ok) {
    throw new Error(`Health check falhou em ${url} (status ${response.status}).`);
  }

  const body = await response.json().catch(() => null);
  if (!body || body.status !== "ok") {
    throw new Error(`Health check retornou payload inesperado em ${url}.`);
  }
}

async function assertCriticalRead(baseUrl, criticalPath, timeoutMs) {
  const url = `${baseUrl}${criticalPath}`;
  const response = await fetchWithTimeout(url, timeoutMs);

  if (!response.ok) {
    throw new Error(`Endpoint crítico falhou em ${url} (status ${response.status}).`);
  }

  const body = await response.json().catch(() => null);
  if (!body || (!body.openapi && !body.status && !body.data)) {
    throw new Error(`Endpoint crítico retornou payload inesperado em ${url}.`);
  }
}

async function main() {
  const baseUrl =
    readArg("base-url") ??
    process.env.BACKEND_BASE_URL ??
    process.env.SMOKE_BASE_URL;

  if (!baseUrl) {
    throw new Error(
      "Informe a URL do backend com --base-url ou BACKEND_BASE_URL (exemplo: https://api.exemplo.com)."
    );
  }

  const healthPath = normalizePath(readArg("health-path") ?? process.env.SMOKE_HEALTH_PATH ?? "/health");
  const criticalPath = normalizePath(
    readArg("critical-path") ?? process.env.SMOKE_CRITICAL_PATH ?? "/docs-json"
  );
  const timeoutMs = toNumber(readArg("timeout-ms") ?? process.env.SMOKE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  console.log(`Smoke test backend: ${normalizedBaseUrl}`);
  console.log(`- Health endpoint: ${healthPath}`);
  console.log(`- Endpoint crítico de leitura: ${criticalPath}`);

  await assertHealth(normalizedBaseUrl, healthPath, timeoutMs);
  console.log("OK - Health check passou.");

  await assertCriticalRead(normalizedBaseUrl, criticalPath, timeoutMs);
  console.log("OK - Endpoint crítico de leitura passou.");

  console.log("Smoke test concluído com sucesso.");
}

main().catch((error) => {
  console.error(`Falha no smoke test: ${error.message}`);
  process.exit(1);
});
