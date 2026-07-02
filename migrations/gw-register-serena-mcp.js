// gw-register-serena-mcp — registers the Serena code-intelligence MCP server in .mcp.json
// and removes the retired depwire server. init registers Serena directly; this heals older
// installs (which registered depwire, or nothing) on update. Additive toward other servers:
// only the depwire entry is removed. Every Serena consumer degrades gracefully when the
// server is absent, so the recorded completion also respects a user who removes it later.

const fs = require('fs');
const path = require('path');

const SERENA_MCP_SERVER = {
  command: 'uvx',
  args: ['--from', 'serena-agent==1.5.3', 'serena', 'start-mcp-server', '--context', 'ide-assistant', '--project', '.', '--open-web-dashboard', 'false'],
};

module.exports = {
  detect({ targetDir }) {
    if (!fs.existsSync(path.join(targetDir, '.groundwork'))) return 'n/a';
    const mcpPath = path.join(targetDir, '.mcp.json');
    if (!fs.existsSync(mcpPath)) return 'pending';
    try {
      const servers = (JSON.parse(fs.readFileSync(mcpPath, 'utf8')).mcpServers) || {};
      // Done only once Serena is present and the retired depwire server is gone.
      return servers.serena && !servers.depwire ? 'done' : 'pending';
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
    const hadDepwire = Boolean(config.mcpServers.depwire);
    if (hadDepwire) delete config.mcpServers.depwire; // pull out the retired server
    if (config.mcpServers.serena && !hadDepwire) return; // idempotent — nothing to change
    config.mcpServers.serena = SERENA_MCP_SERVER;
    fs.writeFileSync(mcpPath, JSON.stringify(config, null, 2));
  },
};
