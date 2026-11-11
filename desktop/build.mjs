// Builds the Windows exe into desktop/dist/:
//   Neon Trench <version> Portable.exe   one file, double-click to play, nothing installed
//   Neon Trench Setup <version>.exe      installer with Start-menu and desktop shortcuts
// The version comes from the repo root package.json, so the desktop build never needs its own bump.
// Usage (from desktop/):  npm run build            both exes
//                         npm run build -- portable   only the portable one
// The release workflow (.github/workflows/windows-exe.yml) also sets:
//   BUILD_NUMBER=<n>   version becomes MAJOR.MINOR.<n> (root MAJOR.MINOR), so every release is newer
//                      than the last and installed copies update to it
//   PUBLISH=always     upload the exes and latest.yml to a GitHub release tagged v<version>
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const builder = require('electron-builder');
const root = require('../package.json').version;
const build = process.env.BUILD_NUMBER;
const version = build ? root.split('.').slice(0, 2).concat(String(Number(build))).join('.') : root;

const which = process.argv[2];
const targets = which === 'portable' ? ['portable'] : which === 'setup' ? ['nsis'] : ['portable', 'nsis'];

await builder.build({
  publish: process.env.PUBLISH || 'never',
  targets: builder.Platform.WINDOWS.createTarget(targets, builder.Arch.x64),
  config: {
    appId: 'com.czinabu.neontrench',
    productName: 'Neon Trench',
    copyright: 'Copyright © Caleb',
    extraMetadata: { version },
    directories: { output: 'dist', buildResources: 'build' },
    files: [
      'main.js',
      'preload.js',
      'build/icon.png',
      // the web game itself, straight from the repo root
      { from: '..', to: 'game', filter: ['index.html', 'css/**', 'js/**', 'vendor/**', 'icons/**'] },
    ],
    asar: true,
    // where installed copies look for updates (desktop/main.js, electron-updater)
    publish: [{ provider: 'github', owner: 'czinabu', repo: 'neon-trench', releaseType: 'release' }],
    win: { icon: 'build/icon.png' },
    portable: { artifactName: '${productName} ${version} Portable.${ext}' },
    nsis: {
      oneClick: false,
      perMachine: false,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      artifactName: '${productName} Setup ${version}.${ext}',
    },
  },
});
console.log('Done: Neon Trench ' + version + ', see desktop/dist/');
