#!/usr/bin/env node
/**
 * Copy the Goose Warehouse Picking Planner's shared floor-plan editor into
 * this app (src/renderer/warehouse-planner/).
 *
 * The editor lives in the planner repo and is the source of truth; the copy
 * here is committed so CI can build the app without the planner repo present.
 * The WP-only entry point and JSX shim (src/wp/) are excluded.
 *
 * Usage:
 *   npm run sync:warehouse-editor
 *   npm run sync:warehouse-editor -- "<path to planner>/editor/src"
 *   GWPP_EDITOR_SRC="<path>" npm run sync:warehouse-editor
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_SRC = 'C:\\Users\\giles\\Local Sites\\Goose Warehouse Picking Planner\\editor\\src';
const EXCLUDE = new Set(['wp']);

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.resolve(process.argv[2] || process.env.GWPP_EDITOR_SRC || DEFAULT_SRC);
const dest = path.join(repoRoot, 'src', 'renderer', 'warehouse-planner');

if (!fs.existsSync(path.join(src, 'index.ts'))) {
  console.error(`Editor source not found (no index.ts in ${src}).`);
  console.error('Pass the planner repo\'s editor/src path as an argument or set GWPP_EDITOR_SRC.');
  process.exit(1);
}

// Clear the target first so files deleted upstream don't linger here.
fs.rmSync(dest, { recursive: true, force: true });

let copied = 0;
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const fromPath = path.join(from, entry.name);
    const toPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      if (from === src && EXCLUDE.has(entry.name)) continue;
      copyDir(fromPath, toPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(fromPath, toPath);
      copied++;
    }
  }
}
copyDir(src, dest);

fs.writeFileSync(
  path.join(dest, 'README.md'),
  `# Warehouse planner editor (generated copy)

**Do not edit files in this folder.** They are copied from the Goose Warehouse
Picking Planner repo (\`editor/src\`, minus the WP-only \`wp/\` folder) and are
overwritten on every sync.

To change the editor, edit it in the planner repo, then re-run:

    npm run sync:warehouse-editor

and commit the result. The source path defaults to the planner repo's
\`editor/src\`; override it with a CLI argument or the \`GWPP_EDITOR_SRC\`
environment variable.
`,
);

console.log(`Synced ${copied} files from ${src} to ${path.relative(repoRoot, dest)}`);
