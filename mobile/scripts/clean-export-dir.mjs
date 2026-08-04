import { rm } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.cwd());
const dist = path.resolve(root, 'dist');
if (path.dirname(dist) !== root || path.basename(dist) !== 'dist') {
  throw new Error(`Refusing to clean unexpected export directory: ${dist}`);
}
await rm(dist, { recursive: true, force: true });
