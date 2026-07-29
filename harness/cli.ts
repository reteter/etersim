import { printHelp, runCommand } from "./runCommand.ts";

/**
 * `harness run` entry point (#233). All the logic lives in `runCommand.ts`
 * (importable and testable without shelling out); this file is the thin
 * shim `npm run harness -- run ...` invokes.
 */
function main(): void {
  const [, , command, ...rest] = process.argv;
  if (command === "run") {
    process.exitCode = runCommand(rest).exitCode;
    return;
  }
  printHelp();
  process.exitCode = command ? 1 : 0;
}

main();
