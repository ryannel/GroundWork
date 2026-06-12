// gw-seed-config-toml — installs the user-owned config file on installs that
// predate it. init seeds config.toml once and update never touches it (it is
// user-owned), so projects initialized before the file existed never get one.
// Seeding the commented default is purely additive: an empty/absent file and the
// default behave identically, so this cannot change behavior.

const fs = require('fs');
const path = require('path');

module.exports = {
  detect({ targetDir }) {
    if (!fs.existsSync(path.join(targetDir, '.groundwork'))) return 'n/a';
    return fs.existsSync(path.join(targetDir, '.groundwork', 'config', 'config.toml'))
      ? 'done'
      : 'pending';
  },

  run({ targetDir, packageRoot }) {
    const src = path.join(packageRoot, 'src', 'config', 'config.toml');
    const dest = path.join(targetDir, '.groundwork', 'config', 'config.toml');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  },
};
