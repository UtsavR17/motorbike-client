// Test-only module resolution for `npm test`: lets Node's test runner import the app's
// TypeScript modules that use the "@/..." alias and extensionless relative imports.
import { register } from 'node:module';

register('./ts-resolve-hooks.mjs', import.meta.url);
