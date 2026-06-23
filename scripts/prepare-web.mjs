import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const www = join(root, 'www');

await rm(www, { recursive: true, force: true });
await mkdir(www, { recursive: true });

for (const file of ['index.html', 'styles.css', 'style-options.html']) {
  await cp(join(root, file), join(www, file));
}

await cp(join(root, 'src'), join(www, 'src'), { recursive: true });
