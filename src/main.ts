#! /usr/bin/env node

import { createResetDeploy, addFileToDeploy } from "./lib";

function usage() {
  console.error('Usage: suiteinclude <reset|PATH>\n')
  console.error('\t reset: creates/resets the deploy.xml file')
  console.error('\t PATH: a path to a file to include')
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length !== 1) {
    usage();
    return;
  }

  if (args[0] === 'reset') {
    createResetDeploy();
    return;
  } else {
    addFileToDeploy(args[0]);
    return;
  }
}

main().catch(() => console.error('Unexpected error'))
