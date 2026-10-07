// Runs the README examples, checks that they report what the README shows, and writes the reports of the two made-up
// escrow configurations to examples/output. CI runs it and then fails if those files changed, so the example output in
// the repository is always the real output.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../src/index.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');

// The arguments of the examples; every path is relative to the root of the repository.
export const BAD = ['examples/bad/escrow.json'];
export const GOOD = ['examples/good/escrow.json'];

// Runs the tool on files of the repository; the paths shown in the report are relative to the root of the repository.
export async function run(argv, base = root) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, base);
  return { code, out, err };
}

// What the README says of the bad file: the counts, a finding of nearly every check, and the result.
export const EXPECTED = [
  'chain id: 1',
  'findings: 31 (19 error, 9 warning, 3 info)',
  'Token USDC has 18 decimal places, but USDC keeps 6, so every amount in it would be off by a factor of 10^12.',
  'The address of token WETH, "0x12345", has 5 characters after 0x, not 40',
  'Token WETH is declared on chain id 10, but the escrow is deployed on chain id 1',
  'The platform fee of 1,500 basis points (15%) goes to the zero address',
  'The platform fee is 1,500 basis points (15%), above the 1,000 basis points (10%) of --max-fee-bps.',
  'The escrow releases funds after 259,200 seconds (3 days), before its dispute window of 604,800 seconds (7 days) closes',
  'The escrow names "none" as its refundPath',
  'The partialRefunds of the escrow is "yes"; it must be true or false.',
  'The shares of the 3 milestones of the escrow add up to 8,000 basis points (80%), not 10,000 basis points (100%)',
  'Milestone 3 has no name.',
  'Milestone 3 has a share of 0, so it releases nothing.',
  'Arbiter 3 of the dispute setup, 0x7777777777777777777777777777777777777777, is also arbiter 1; it was counted once.',
  'The quorum of a dispute is 2 votes, but a panel holds 1 arbiter',
  'A panel of a dispute holds one arbiter, so one person decides every dispute alone.',
  'The arbiterFeeBps of the dispute setup is "2.5"',
  'The key "appealWindw" of the dispute setup is not one the tool reads, so its value was left out of every check. Did you mean "appealWindow"?',
  'The dispute setup gives no appealWindow, so a ruling is final at once.',
  'Arbiter 1 of the dispute setup, 0x7777777777777777777777777777777777777777, is also the treasury',
  'Arbiter 2 of the dispute setup, 0x5555555555555555555555555555555555555555, is also the pauser of the escrow',
  'The slashBps of the stake is "12000"',
  'The owner of the escrow, 0x1111111111111111111111111111111111111111, is not the multisig of the file, so one key can change every rule of the escrow.',
  'The fee setter of the roles is the zero address',
  'The file holds the key "mnemonic", which names a seed, a mnemonic or a private key.',
  'The multisig needs 3 signatures but lists 2 signers, so it can never act.',
  'The upgrader of the escrow, 0x6666666666666666666666666666666666666666, is not a timelock, and the roles name none',
  'The chainId of the EIP-712 domain is 10, but the escrow is deployed on chain id 1.',
  'The EIP-712 domain has no version',
  'The verifyingContract of the EIP-712 domain is the zero address',
  'The file sets no limits.maxOrderValue',
  'not legal or financial advice, not an audit of the escrow contracts and not a guarantee that funds will be released or refunded as intended',
  'RESULT: FAIL - 19 findings at or above error (19 error, 9 warning, 3 info)'
];
// What must not be reported: the checks the bad file does not hold, the seed, and a pass.
export const UNWANTED = ['ERROR    file-unreadable', 'WARNING  release-timeout-missing', 'WARNING  multisig-threshold-low', 'lantern', 'RESULT: PASS'];

// What the README says of the good file: no finding.
export const GOOD_EXPECTED = [
  'chain id: 1',
  'findings: 0',
  'RESULT: PASS - no finding at or above error'
];

const problems = [];
function expect(name, result, code, expected, unwanted, stream = 'out') {
  const text = result[stream];
  const missing = expected.filter((e) => !text.includes(e));
  const wrong = unwanted.filter((e) => text.includes(e));
  if (result.code !== code || missing.length || wrong.length) {
    problems.push(`${name}: unexpected report (exit code ${result.code}, expected ${code}; missing: ${missing.join(' / ') || 'none'}; should not appear: ${wrong.join(' / ') || 'none'})${result.err ? `\n${result.err}` : ''}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bad = await run(BAD);
  process.stdout.write(bad.out);
  expect('bad file', bad, 1, EXPECTED, UNWANTED);

  const good = await run(GOOD);
  expect('good file', good, 0, GOOD_EXPECTED, ['ERROR    ', 'WARNING  ', 'INFO     ', 'RESULT: FAIL', 'c'.repeat(64), 'd'.repeat(64)]);
  // The good file also passes when warnings and notes fail the run.
  expect('good, fail on warning', await run([...GOOD, '--fail-on', 'warning']), 0, ['RESULT: PASS - no finding at or above warning'], []);
  expect('good, fail on info', await run([...GOOD, '--fail-on', 'info']), 0, ['RESULT: PASS - no finding at or above info'], []);
  // A lower fee threshold makes the good file warn, and the warning fails the run at warning.
  expect('good, max fee 200', await run([...GOOD, '--max-fee-bps', '200', '--fail-on', 'warning']), 1, ['WARNING  fee-too-high', 'The platform fee is 250 basis points (2.5%), above the 200 basis points (2%) of --max-fee-bps.'], []);
  // The bad file with only the errors shown still counts the rest.
  expect('bad, errors only', await run([...BAD, '--min-severity', 'error']), 1, ['findings: 19 (19 error); 12 below error not shown'], ['WARNING  ', 'INFO     ']);
  // A file that is not there stops the run with no report, and so does a --max-fee-bps that is not a whole number.
  expect('missing file', await run(['examples/none/escrow.json']), 2, ['examples/none/escrow.json: does not exist'], [], 'err');
  expect('max fee not whole', await run([...GOOD, '--max-fee-bps', '2.5']), 2, ['--max-fee-bps: 2.5 is not a whole number of basis points from 0 to 10000'], [], 'err');

  // The README shows the head of the report of the bad file with its table of checks, one finding, the table of roles
  // and the end of the report, and the end of the report of the good file.
  const readme = (await readFile(resolve(root, 'README.md'), 'utf8')).split('\r\n').join('\n');
  const lines = bad.out.split('\n');
  const head = lines.slice(0, lines.findIndex((l) => l.startsWith('Findings ('))).join('\n');
  if (!readme.includes(head)) problems.push('README: the head of the sample output of the bad file differs from a real run');
  const explained = (await run([...BAD, '--explain'])).out.split('\n');
  const at = explained.findIndex((l) => l.includes('eip712-domain-chain-mismatch') && l.includes('examples/bad/escrow.json:'));
  const sample = explained.slice(at, at + 4).join('\n');
  if (at < 0 || !readme.includes(sample)) problems.push('README: the sample finding of the EIP-712 domain differs from a real run');
  const t = lines.findIndex((l) => l.startsWith('Roles ('));
  const table = lines.slice(t, t + 10).join('\n');
  if (t < 0 || !readme.includes(table)) problems.push('README: the table of roles of the bad file differs from a real run');
  const tail = lines.slice(-4).join('\n');
  if (!readme.includes(tail)) problems.push('README: the tail of the sample output of the bad file differs from a real run');
  const goodTail = good.out.split('\n').slice(-17).join('\n');
  if (!readme.includes(goodTail)) problems.push('README: the tail of the sample output of the good file differs from a real run');

  await mkdir(resolve(root, 'examples/output'), { recursive: true });
  await writeFile(resolve(root, 'examples/output/bad.txt'), bad.out);
  await writeFile(resolve(root, 'examples/output/good.txt'), good.out);
  const outputs = [
    ['bad-explain.txt', [...BAD, '--explain'], 1],
    ['bad.md', [...BAD, '--format', 'markdown'], 1],
    ['bad-explain.md', [...BAD, '--format', 'markdown', '--explain'], 1],
    ['bad.json', [...BAD, '--json', '--explain'], 1],
    ['bad.sarif', [...BAD, '--format', 'sarif'], 1],
    ['good.md', [...GOOD, '--format', 'markdown'], 0],
    ['good.json', [...GOOD, '--json'], 0],
    ['good.sarif', [...GOOD, '--format', 'sarif'], 0],
    ['checks.txt', ['--list-checks'], 0],
    ['checks.json', ['--list-checks', '--format', 'json'], 0]
  ];
  for (const [name, args, code] of outputs) {
    const r = await run(args);
    if (r.code !== code) problems.push(`${name}: exit code ${r.code}, expected ${code}`);
    await writeFile(resolve(root, 'examples/output', name), r.out);
  }

  if (problems.length) {
    for (const p of problems) console.error(`example: ${p}`);
    process.exit(1);
  }
}
