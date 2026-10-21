// Runs a command and checks that its output contains a text (cross-platform).
// Usage: node scripts/e2e/expect.js "<command>" "<expected text>"
const { spawnSync } = require("node:child_process");

const [command, expected] = process.argv.slice(2);
if (!command || !expected) {
  console.error('Usage: node scripts/e2e/expect.js "<command>" "<expected text>"');
  process.exit(2);
}
const result = spawnSync(command, { shell: true, encoding: "utf8" });
const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
console.log(`$ ${command}\n${output}`);
if (result.status !== 0 || !output.includes(expected)) {
  console.error(`\nExpected the output of '${command}' to succeed and contain '${expected}'`);
  process.exit(1);
}
