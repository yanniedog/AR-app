import fs from 'fs';
import path from 'path';

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools', 'app-explorer', 'shots.json'), 'utf8')) as {
  name: string; open: string; scroll?: number; why: string;
}[];

describe('app explorer shots manifest', () => {
  it('holds at most 20 uniquely named shots', () => {
    expect(manifest.length).toBeGreaterThan(0);
    expect(manifest.length).toBeLessThanOrEqual(20);
    expect(new Set(manifest.map(s => s.name)).size).toBe(manifest.length);
  });

  it('opens routes that exist and says why each shot is taken', () => {
    const appDir = path.join(__dirname, '..', 'app');
    for (const shot of manifest) {
      expect(shot.open.startsWith('/')).toBe(true);
      expect(shot.why.trim().length).toBeGreaterThan(0);
      const route = shot.open.split('?')[0].replace(/^\//, '');
      const exists = ['.tsx', '/index.tsx'].some(ext => fs.existsSync(path.join(appDir, route + ext)))
        || fs.readdirSync(path.join(appDir, '(tabs)')).some(f => f.replace(/\.tsx$/, '') === route);
      expect({ route: shot.open, exists }).toEqual({ route: shot.open, exists: true });
    }
  });
});
