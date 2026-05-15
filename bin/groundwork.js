#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const command = process.argv[2];

function printHelp() {
  const targetDir = process.cwd();
  const docsIndex = path.join(targetDir, 'docs', 'index.md');
  const hasDocs = fs.existsSync(docsIndex);

  console.log(`
\x1b[1m\x1b[36m▲ GroundWork\x1b[0m

`);

  if (!hasDocs) {
    console.log(`\x1b[33m[warn]\x1b[0m No architecture documentation found in this repository.

To get started with GroundWork:
  1. Run \x1b[36mnpx groundwork init\x1b[0m to install the BMAD skills.
  2. Ask your AI Agent to run the \x1b[36mgroundwork-setup\x1b[0m skill.

This will scan your codebase and generate a complete, living architecture documentation site in the \`docs/\` directory.
`);
  } else {
    console.log(`\x1b[32m✔\x1b[0m Architecture documentation found at ./docs/
    
Your architecture is being tracked by GroundWork.
`);
  }

  console.log(`\x1b[1mCommands:\x1b[0m
  \x1b[36minit\x1b[0m      Install GroundWork skills into the current project
  \x1b[36mupdate\x1b[0m    Trigger the groundwork-update skill for a slice
  \x1b[36mcheck\x1b[0m     Run the groundwork-check staleness detection

\x1b[1mExamples:\x1b[0m
  npx groundwork init
  npx groundwork check
`);
}

function initGroundWork() {
  const targetDir = process.cwd();
  const targetSkillsDir = path.join(targetDir, '.agents', 'skills');
  const targetHiddenSkillsDir = path.join(targetDir, '.agents', 'groundwork', 'skills');
  const targetConfigDir = path.join(targetDir, '.agents', 'config');
  
  const sourceSkillsDir = path.join(__dirname, '..', 'src', 'skills');
  const sourceHiddenSkillsDir = path.join(__dirname, '..', 'src', 'hidden-skills');
  const sourceConfigDir = path.join(__dirname, '..', 'src', 'config');

  console.log(`\n\x1b[1m\x1b[36m▲ GroundWork\x1b[0m\n`);
  console.log(`\x1b[34m[info]\x1b[0m Initializing in \x1b[2m${targetDir}\x1b[0m\n`);

  if (path.resolve(targetSkillsDir) === path.resolve(sourceSkillsDir)) {
    console.warn(`\x1b[33m[warn]\x1b[0m You are running this command inside the GroundWork source repository itself.`);
    console.warn(`       Skipping skill installation to prevent recursive copying.\n`);
    return;
  }

  const dirsToCreate = [targetSkillsDir, targetHiddenSkillsDir, targetConfigDir];
  let createdDirs = false;
  dirsToCreate.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      createdDirs = true;
    }
  });
  
  if (createdDirs) {
    console.log(`\x1b[32m✔\x1b[0m Created .agents directories`);
  }

  // Copy Registered Skills
  try {
    execSync(`cp -R "${sourceSkillsDir}/"* "${targetSkillsDir}/"`);
    console.log(`\x1b[32m✔\x1b[0m Installed Orchestrator and Registered Skills`);
  } catch (err) {
    console.error(`\x1b[31m✖\x1b[0m Failed to install registered skills:`, err.message);
  }

  // Copy Hidden Methodology Skills
  try {
    execSync(`cp -R "${sourceHiddenSkillsDir}/"* "${targetHiddenSkillsDir}/"`);
    console.log(`\x1b[32m✔\x1b[0m Installed Hidden Methodology Skills`);
  } catch (err) {
    console.error(`\x1b[31m✖\x1b[0m Failed to install hidden skills:`, err.message);
  }

  // Copy config manifest
  const sourceManifest = path.join(sourceConfigDir, 'groundwork-help.csv');
  const targetManifest = path.join(targetConfigDir, 'groundwork-help.csv');
  
  if (fs.existsSync(sourceManifest)) {
    try {
      fs.copyFileSync(sourceManifest, targetManifest);
      console.log(`\x1b[32m✔\x1b[0m Configured orchestration manifest`);
    } catch (err) {
      console.error(`\x1b[31m✖\x1b[0m Failed to configure manifest:`, err.message);
    }
  }

  console.log(`\n\x1b[32m[success]\x1b[0m GroundWork initialization complete!`);
  console.log(`          Ask your AI to run the \x1b[36mgroundwork-orchestrator\x1b[0m skill to find out what to do next.\n`);
}

if (!command || command === 'help') {
  printHelp();
  process.exit(0);
}

switch (command) {
  case 'init':
    initGroundWork();
    break;
  case 'update':
    console.log('Triggering groundwork-update...');
    // Implementation for invoking the update skill will go here
    break;
  case 'check':
    console.log('Running groundwork-check...');
    // Implementation for running the CI staleness check will go here
    break;
  default:
    console.log(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
}
