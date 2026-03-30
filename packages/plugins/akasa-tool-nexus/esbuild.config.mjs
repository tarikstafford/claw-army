import esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

// Worker entry point — the plugin's main code loaded by Paperclip PluginWorkerManager
const workerCtx = await esbuild.context({
  entryPoints: ['src/worker.ts'],
  outdir: 'dist',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  // Externalize workspace packages — resolved at runtime via pnpm workspace
  external: [
    '@claw/db',
    '@claw/akasa-server',
    '@paperclipai/plugin-sdk',
    '@paperclipai/shared',
    'drizzle-orm',
  ],
});

// Manifest entry point — plugin metadata
const manifestCtx = await esbuild.context({
  entryPoints: ['src/manifest.ts'],
  outdir: 'dist',
  bundle: false,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  sourcemap: true,
});

if (watch) {
  await Promise.all([workerCtx.watch(), manifestCtx.watch()]);
  console.log('esbuild watch mode enabled for worker and manifest');
} else {
  await Promise.all([workerCtx.rebuild(), manifestCtx.rebuild()]);
  await Promise.all([workerCtx.dispose(), manifestCtx.dispose()]);
}
