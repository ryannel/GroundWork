// gw-register-depwire-mcp — adds the depwire code-map MCP server to .mcp.json on
// installs that predate the registration (init registers it; update never did).
// Additive only: an existing depwire entry or other servers are never touched, and
// every depwire consumer degrades gracefully when the server is absent — so the
// recorded completion also respects a user who deliberately removes it later.

const fs = require('fs');
const path = require('path');

module.exports = {
  detect({ targetDir }) {
    if (!fs.existsSync(path.join(targetDir, '.groundwork'))) return 'n/a';
    const mcpPath = path.join(targetDir, '.mcp.json');
    if (!fs.existsSync(mcpPath)) return 'pending';
    try {
      const config = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
      return config.mcpServers && config.mcpServers.depwire ? 'done' : 'pending';
    } catch {
      return 'n/a'; // unparseable — touching it risks clobbering the user's file
    }
  },

  run({ targetDir }) {
    const mcpPath = path.join(targetDir, '.mcp.json');
    let config = { mcpServers: {} };
    if (fs.existsSync(mcpPath)) {
      config = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
      if (!config.mcpServers || typeof config.mcpServers !== 'object') config.mcpServers = {};
    }
    if (config.mcpServers.depwire) return; // idempotent — preserve the user's configuration
    config.mcpServers.depwire = { command: 'npx', args: ['-y', 'depwire-cli', 'mcp'] };
    fs.writeFileSync(mcpPath, JSON.stringify(config, null, 2));
  },
};
