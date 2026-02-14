import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const backendDir = path.join(rootDir, "backend");
const frontendDir = path.join(rootDir, "frontend");

const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function walk(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".next") {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function parseImportSpecifiers(content) {
  const specs = new Set();
  const regexes = [
    /(?:import|export)\\s+(?:[^'"`]*?from\\s+)?['"]([^'"`]+)['"]/g,
    /import\\(\\s*['"]([^'"`]+)['"]\\s*\\)/g,
    /require\\(\\s*['"]([^'"`]+)['"]\\s*\\)/g
  ];

  for (const regex of regexes) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      specs.add(match[1]);
    }
  }

  return [...specs];
}

function isPathInside(targetPath, expectedRoot) {
  const relative = path.relative(expectedRoot, targetPath);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function resolveRelativeImport(filePath, specifier) {
  if (!specifier.startsWith(".")) {
    return null;
  }

  return path.resolve(path.dirname(filePath), specifier);
}

function checkScope(scopeRoot, forbiddenRoot, scopeName) {
  const files = walk(scopeRoot);
  const violations = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf8");
    const importSpecifiers = parseImportSpecifiers(content);

    for (const specifier of importSpecifiers) {
      const relativeTarget = resolveRelativeImport(filePath, specifier);

      if (relativeTarget && isPathInside(relativeTarget, forbiddenRoot)) {
        violations.push(`${filePath}: import relativo cruza fronteira -> ${specifier}`);
        continue;
      }

      const normalized = specifier.replaceAll("\\", "/");
      const directForbiddenAlias = scopeName === "backend"
        ? normalized.includes("frontend/") || normalized.startsWith("@primeira-fila/shared")
        : normalized.includes("backend/") || normalized.startsWith("@primeira-fila/backend");

      if (directForbiddenAlias) {
        violations.push(`${filePath}: import proibido por fronteira -> ${specifier}`);
      }
    }
  }

  return violations;
}

const violations = [
  ...checkScope(backendDir, frontendDir, "backend"),
  ...checkScope(frontendDir, backendDir, "frontend")
];

if (violations.length > 0) {
  console.error("Falha de arquitetura: imports cruzados entre backend e frontend detectados.\n");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Arquitetura valida: sem imports cruzados entre backend e frontend.");
