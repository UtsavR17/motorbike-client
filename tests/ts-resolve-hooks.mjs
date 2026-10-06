// Resolve hooks used by tests/register-ts.mjs (test only, never part of the app build).
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));

function withTs(path) {
  for (const candidate of [path, `${path}.ts`, `${path}.tsx`, `${path}/index.ts`]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const file = withTs(SRC + specifier.slice(2));
    if (file) return next(pathToFileURL(file).href, context);
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
    const base = fileURLToPath(new URL(specifier, context.parentURL));
    if (!/\.[cm]?[jt]sx?$/.test(base)) {
      const file = withTs(base);
      if (file) return next(pathToFileURL(file).href, context);
    }
  }
  return next(specifier, context);
}
