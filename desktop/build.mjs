// Builds the Windows exe into desktop/dist/:
//   Neon Trench <version> Portable.exe   one file, double-click to play, nothing installed
//   Neon Trench Setup <version>.exe      installer with Start-menu and desktop shortcuts
// The version comes from the repo root package.json, so the desktop build never needs its own bump.
// Usage (from desktop/):  npm run build            both exes
//                         npm run build -- portable   only the portable one
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const builder = require('electron-builder');
const { version } = require('../package.json');

const which = process.argv[2];
const targets = which === 'portable' ? ['portable'] : which === 'setup' ? ['nsis'] : ['portable', 'nsis'];

await builder.build({
  targets: builder.Platform.WINDOWS.createTarget(targets, builder.Arch.x64),
  config: {
    appId: 'com.czinabu.neontrench',
    productName: 'Neon Trench',
    copyright: 'Copyright © Caleb',
    extraMetadata: { version },
    directories: { output: 'dist', buildResources: 'build' },
    files: [
      'main.js',
      'build/icon.png',
      // the web game itself, straight from the repo root
      { from: '..', to: 'game', filter: ['index.html', 'css/**', 'js/**', 'vendor/**'] },
    ],
    asar: true,
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
console.log('Done: see desktop/dist/');
