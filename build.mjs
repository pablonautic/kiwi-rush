// Bundles each version with esbuild and inlines it into a single self-contained HTML file.
import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const targets = [
  { name: 'v1 (2D)', entry: 'src/main.ts', template: 'src/index.template.html', out: 'index.html' },
  { name: 'v2 (3D)', entry: 'v2/src/main.ts', template: 'v2/index.template.html', out: 'v2.html', pwa: true },
];

for (const t of targets) {
  const result = await build({
    entryPoints: [t.entry],
    bundle: true,
    minify: true,
    format: 'iife',
    target: 'es2020',
    write: false,
  });
  const js = result.outputFiles[0].text.replace(/<\/script>/gi, '<\\/script>');
  const html = readFileSync(t.template, 'utf8').replace('/*__BUNDLE__*/', () => js);
  writeFileSync(t.out, html.replace('<!--PWA-->', ''));
  console.log(`${t.out} (${t.name}) written: ${(html.length / 1024).toFixed(0)} KB`);

  // v2 is also packaged as an installable web app (PWA) in docs/ (served by GitHub Pages)
  if (t.pwa) {
    mkdirSync('docs/icons', { recursive: true });
    const tags = [
      '<link rel="manifest" href="manifest.webmanifest">',
      '<link rel="icon" type="image/png" href="icons/icon-192.png">',
      '<link rel="apple-touch-icon" href="icons/icon-192.png">',
    ].join('\n');
    writeFileSync('docs/index.html', html.replace('<!--PWA-->', tags));
    cpSync('v2/pwa/manifest.webmanifest', 'docs/manifest.webmanifest');
    cpSync('v2/pwa/icons', 'docs/icons', { recursive: true });
    writeFileSync('docs/sw.js', readFileSync('v2/pwa/sw.js', 'utf8').replace('__VERSION__', Date.now().toString(36)));
    console.log('docs/ (installable web app) written');
  }
}
