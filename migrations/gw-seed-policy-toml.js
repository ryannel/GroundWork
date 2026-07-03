// gw-seed-policy-toml — installs the additive team policy file on installs that
// predate it. init seeds policy.toml once and update never touches it (it is
// user-owned), so projects initialized before the policy layer existed never get
// one. Seeding the commented default is purely additive: an empty/absent file and
// the default behave identically, so this cannot change behavior. Also seeds the
// config .gitignore entry for the personal policy.user.toml when absent.

const fs = require('fs');
const path = require('path');

module.exports = {
  detect({ targetDir }) {
    if (!fs.existsSync(path.join(targetDir, '.groundwork'))) return 'n/a';
    return fs.existsSync(path.join(targetDir, '.groundwork', 'config', 'policy.toml'))
      ? 'done'
      : 'pending';
  },

  run({ targetDir, packageRoot }) {
    const configDir = path.join(targetDir, '.groundwork', 'config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.copyFileSync(path.join(packageRoot, 'src', 'config', 'policy.toml'), path.join(configDir, 'policy.toml'));

    const ignore = path.join(configDir, '.gitignore');
    const line = 'policy.user.toml';
    if (!fs.existsSync(ignore)) {
      fs.writeFileSync(ignore, `# Personal, machine-local policy overrides — never committed.\n${line}\n`);
    } else if (!fs.readFileSync(ignore, 'utf8').split(/\r?\n/).includes(line)) {
      fs.appendFileSync(ignore, `${line}\n`);
    }
  },
};
