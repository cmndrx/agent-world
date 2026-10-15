// Same frontend build on every desktop platform; avoid Vite's temporary bundled config.
import { build } from 'vite';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const desktopBuildArgs = platform => [platform === 'win32' ? '--win' : platform === 'darwin' ? '--mac' : '--linux', '--dir'];
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await build({ configFile: false, root: path.join(root, 'web'), build: { outDir: path.join(root, 'dist'), emptyOutDir: true } });
  const child = spawn(process.execPath, [path.join(root, 'node_modules/electron-builder/cli.js'), ...desktopBuildArgs(process.platform)], { cwd: root, stdio: 'inherit', windowsHide: true });
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
}
