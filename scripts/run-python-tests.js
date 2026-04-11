import { spawnSync } from 'node:child_process';

const args = ['-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py'];
const commands = process.env.PYTHON_TEST_BIN ? [process.env.PYTHON_TEST_BIN] : ['python3', 'python'];

/** @type {import('node:child_process').SpawnSyncReturns<Buffer> | null} */
let lastResult = null;

for (const command of commands) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  lastResult = result;

  if (!result.error) {
    process.exit(result.status ?? 0);
  }

  const errorCode = /** @type {NodeJS.ErrnoException} */ (result.error).code;
  if (errorCode !== 'ENOENT') {
    throw result.error;
  }
}

console.error(`No Python interpreter found for tests. Tried: ${commands.join(', ')}`);

if (typeof lastResult?.status === 'number') {
  process.exit(lastResult.status);
}

process.exit(1);
