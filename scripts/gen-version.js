// Writes src/environments/version.ts with the current build/serve timestamp.
// Run automatically via the npm "prestart"/"prebuild" hooks and by build-apk.sh,
// so the version shown in the app always reflects the running build.
const fs = require('fs');
const path = require('path');

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const stamp =
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
  `${pad(now.getHours())}:${pad(now.getMinutes())}`;

const out = path.join(__dirname, '..', 'src', 'environments', 'version.ts');
fs.writeFileSync(
  out,
  `// AUTO-GENERATED at build/serve start — do not edit by hand.\n` +
  `export const APP_VERSION = '${stamp}';\n`
);
console.log('Stamped version:', stamp);
