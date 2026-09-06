#!/usr/bin/env node
import { main } from '../runtime/server/cli.js'
main().catch(error => { console.error(error.message); process.exitCode = 1 })
