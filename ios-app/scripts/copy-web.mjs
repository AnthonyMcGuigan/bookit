// Copies the web game into www/, which Capacitor bundles into the iPhone app.
// The app runs the very same index.html as https://anthonymcguigan.github.io/bookit/, so run this
// (npm run sync) after every game update, then build a new version in Xcode or Codemagic.
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..', '..'), www = join(here, '..', 'www');
rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });
for (const f of ['index.html', 'manifest.webmanifest', 'privacy.html', 'icons', 'sounds', 'lib']) {
  if (existsSync(join(root, f))) cpSync(join(root, f), join(www, f), { recursive: true });
}
const v = /const VERSION = '([^']+)'/.exec(readFileSync(join(root, 'index.html'), 'utf8'))?.[1] ?? '?';
console.log('Copied BookIt v' + v + ' into ios-app/www');
