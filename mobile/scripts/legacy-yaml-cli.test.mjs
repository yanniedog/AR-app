import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import checks from './lib/legacy-yaml-cli-checks.cjs';

const projectDir = fileURLToPath(new URL('..', import.meta.url));
checks.registerLegacyYamlCliChecks(projectDir);
test('Istanbul loads its actual legacy YAML configuration', () => checks.checkIstanbulYamlConfig(path.resolve(projectDir)));
