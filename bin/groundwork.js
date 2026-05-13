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
=========================================
      GroundWork Architecture CLI
=========================================
`);

  if (!hasDocs) {
    console.log(`⚠️  No architecture documentation found in this repository.

To get started with GroundWork:
1. Run \`npx groundwork init\` to install the BMAD skills.
2. Ask your AI Agent to run the \`groundwork-setup\` skill.

This will scan your codebase and generate a complete, living architecture documentation site in the \`docs/\` directory.
`);
  } else {
    console.log(`✅ Architecture documentation found at ./docs/

Your architecture is being tracked by GroundWork.
`);
  }

  console.log(`Available Commands:
  init      - Install GroundWork skills into the current project
  update    - Trigger the groundwork-update skill for a slice
  check     - Run the groundwork-check staleness detection

Examples:
  npx groundwork init
  npx groundwork check
`);
}

function initGroundWork() {
  const targetDir = process.cwd();
  const targetSkillsDir = path.join(targetDir, '.agents', 'skills');
  const sourceSkillsDir = path.join(__dirname, '..', '.agents', 'skills');

  console.log('Initializing GroundWork in', targetDir);

  if (!fs.existsSync(targetSkillsDir)) {
    console.log('Creating .agents/skills directory...');
    fs.mkdirSync(targetSkillsDir, { recursive: true });
  }

  // Define skills to copy
  const skills = ['groundwork-setup', 'groundwork-update', 'groundwork-check', 'skill-creator'];

  skills.forEach(skill => {
    const sourceSkillPath = path.join(sourceSkillsDir, skill);
    const targetSkillPath = path.join(targetSkillsDir, skill);

    if (fs.existsSync(sourceSkillPath)) {
      console.log(`Copying skill: ${skill}...`);
      if (!fs.existsSync(targetSkillPath)) {
        fs.mkdirSync(targetSkillPath, { recursive: true });
      }
      
      // Use cp -R to copy directories safely across platforms
      try {
        execSync(`cp -R "${sourceSkillPath}/"* "${targetSkillPath}/"`);
        console.log(`  ✓ Successfully installed ${skill}`);
      } catch (err) {
        console.error(`  ✗ Failed to copy ${skill}:`, err.message);
      }
    } else {
      console.warn(`Warning: Could not find source for ${skill} at ${sourceSkillPath}`);
    }
  });

  console.log('\\nGroundWork initialization complete!');
  console.log('Run the setup workflow by triggering the groundwork-setup agent.');
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
