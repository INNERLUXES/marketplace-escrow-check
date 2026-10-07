import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from '../src/index.js';
import { BAD, EXPECTED, GOOD, GOOD_EXPECTED, UNWANTED, run } from '../tools/example.mjs';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const saved = (name) => readFile(resolve(root, 'examples/output', name), 'utf8');
const BAD_FILE = 'examples/bad/escrow.json';
const GOOD_FILE = 'examples/good/escrow.json';

test('examples: the bad file fails with the report that is saved in examples/output', async () => {
  const r = await run(BAD);
  assert.equal(r.code, 1);
  assert.equal(r.err, '');
  assert.equal(r.out, await saved('bad.txt'));
  for (const e of EXPECTED) assert.ok(r.out.includes(e), e);
  for (const u of UNWANTED) assert.ok(!r.out.includes(u), u);
});

test('examples: the good file passes at error, warning and info level with the report that is saved', async () => {
  const r = await run(GOOD);
  assert.equal(r.code, 0);
  assert.equal(r.out, await saved('good.txt'));
  for (const e of GOOD_EXPECTED) assert.ok(r.out.includes(e), e);
  assert.equal((await run([...GOOD, '--fail-on', 'warning'])).code, 0);
  assert.equal((await run([...GOOD, '--fail-on', 'info'])).code, 0);
  assert.doesNotMatch(r.out, /ERROR {4}|WARNING {2}|INFO {5}/);
  assert.doesNotMatch(r.out, /\nnote: /);
});

test('examples: every output saved in examples/output is the real output, in all four formats for both files', async () => {
  const outputs = {
    'bad-explain.txt': [...BAD, '--explain'],
    'bad.md': [...BAD, '--format', 'markdown'],
    'bad-explain.md': [...BAD, '--format', 'markdown', '--explain'],
    'bad.json': [...BAD, '--json', '--explain'],
    'bad.sarif': [...BAD, '--format', 'sarif'],
    'good.md': [...GOOD, '--format', 'markdown'],
    'good.json': [...GOOD, '--json'],
    'good.sarif': [...GOOD, '--format', 'sarif'],
    'checks.txt': ['--list-checks'],
    'checks.json': ['--list-checks', '--format', 'json']
  };
  for (const [name, args] of Object.entries(outputs)) assert.equal((await run(args)).out, await saved(name), name);
});

test('examples: every check but three fires on the bad file, each on the line built for it', async () => {
  const report = JSON.parse((await run([...BAD, '--json'])).out);
  const lines = (await readFile(resolve(root, BAD_FILE), 'utf8')).split('\n');
  const at = (needle, n = 1) => {
    let seen = 0;
    for (let i = 0; i < lines.length; i += 1) if (lines[i].includes(needle) && (seen += 1) === n) return `${BAD_FILE}:${i + 1}`;
    throw new Error(`${needle} x${n}`);
  };
  const of = (id) => report.findings.filter((f) => f.id === id).map((f) => f.at).sort();
  const sorted = (...a) => a.sort();
  assert.deepEqual(of('field-missing'), [at('{ "shareBps": 0 }')]);
  assert.deepEqual(of('field-unknown'), [at('"appealWindw"')]);
  assert.deepEqual(of('field-invalid'), [at('"partialRefunds"')]);
  assert.deepEqual(of('field-duplicate'), [at('"arbiters"')]);
  assert.deepEqual(of('secret-in-file'), [at('"mnemonic"')]);
  assert.deepEqual(of('fee-invalid'), [at('"arbiterFeeBps"')]);
  assert.deepEqual(of('release-before-dispute-window'), [at('"releaseTimeout"')]);
  assert.deepEqual(of('no-refund-path'), [at('"refundPath"')]);
  assert.deepEqual(of('fee-too-high'), [at('"platformFee"')]);
  assert.deepEqual(of('fee-recipient-zero'), [at('"platformFee"')]);
  assert.deepEqual(of('milestone-shares-not-100'), [at('"milestones"')]);
  assert.deepEqual(of('milestone-empty'), [at('{ "shareBps": 0 }')]);
  assert.deepEqual(of('quorum-unreachable'), [at('"quorum"')]);
  assert.deepEqual(of('single-arbiter'), [at('"panelSize"')]);
  assert.deepEqual(of('arbiter-is-party'), [at('"arbiters"')]);
  assert.deepEqual(of('arbiter-is-admin'), [at('"arbiters"')]);
  assert.deepEqual(of('appeal-window-missing'), [at('"dispute"')]);
  assert.deepEqual(of('stake-slash-invalid'), [at('"stake"')]);
  assert.deepEqual(of('admin-single-key'), sorted(at('"owner"'), at('"upgrader"'), at('"treasury"')));
  assert.deepEqual(of('multisig-threshold-unreachable'), [at('"multisig"')]);
  assert.deepEqual(of('upgrader-without-timelock'), [at('"upgrader"')]);
  assert.deepEqual(of('eip712-domain-chain-mismatch'), [at('"eip712"')]);
  assert.deepEqual(of('eip712-domain-missing-field'), [at('"eip712"')]);
  assert.deepEqual(of('verifying-contract-zero'), [at('"eip712"')]);
  assert.deepEqual(of('token-chain-mismatch'), [at('"0x12345"')]);
  assert.deepEqual(of('token-decimals-invalid'), [at('"symbol": "USDC"')]);
  assert.deepEqual(of('address-malformed'), [at('"0x12345"')]);
  assert.deepEqual(of('zero-address'), [at('"feeSetter"')]);
  assert.deepEqual(of('max-order-missing'), [`${BAD_FILE}:1`]);
  // file-unreadable needs a file that cannot be read; release-timeout-missing and multisig-threshold-low cannot fire in
  // a file that holds release-before-dispute-window and multisig-threshold-unreachable. test/rules.test.js and
  // test/files.test.js cover them.
  assert.deepEqual(report.rules.filter((r) => r.findings === 0).map((r) => r.id), ['file-unreadable', 'release-timeout-missing', 'multisig-threshold-low']);
  assert.equal(report.rules.length, RULES.length);
});

test('examples: the good file holds no finding and no note, and the table of roles is the one of its file', async () => {
  const report = JSON.parse((await run([...GOOD, '--json'])).out);
  assert.deepEqual(report.findings, []);
  assert.deepEqual(report.notes, []);
  assert.deepEqual(report.roles.map((x) => [x.role, x.heldBy]), [['owner', 'multisig'], ['pauser', 'one key'], ['upgrader', 'timelock'], ['fee setter', 'multisig'], ['treasury', 'multisig'], ['timelock', 'timelock'], ['multisig', '3 of 5 signers']]);
  assert.deepEqual(report.config.escrow.refundPath, ['seller', 'arbiter']);
});

test('examples: the same files written with CRLF line ends and as UTF-16 give the same findings', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'marketplace-escrow-check-crlf-'));
  try {
    await cp(resolve(root, 'examples'), resolve(dir, 'examples'), { recursive: true });
    for (const [file, args] of [[BAD_FILE, BAD], [GOOD_FILE, GOOD]]) {
      const ids = async () => JSON.parse((await run([...args, '--json'], dir)).out).findings.map((f) => `${f.id}:${f.at}:${f.column}`);
      const base = await ids();
      const text = await readFile(resolve(root, file), 'utf8');
      await writeFile(resolve(dir, file), text.split('\n').join('\r\n'));
      assert.deepEqual(await ids(), base, `${file} with CRLF`);
      await writeFile(resolve(dir, file), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]));
      assert.deepEqual(await ids(), base, `${file} as UTF-16`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('examples: the files are plain ASCII with LF line ends, made up, hold no real key, and every address and hash is one character written many times', async () => {
  for (const f of [BAD_FILE, GOOD_FILE]) {
    const text = await readFile(resolve(root, f), 'utf8');
    assert.ok([...text].every((c) => c.charCodeAt(0) < 128), f);
    assert.ok(!text.includes('\r'), f);
    assert.doesNotMatch(text, /\b(?:19|20)\d{2}\b/, f);
    assert.match(text, /Made-up escrow configuration for the examples of marketplace-escrow-check/, f);
    assert.match(text, /nothing here is legal or financial advice/, f);
    for (const m of text.matchAll(/\b0x[0-9a-fA-F]+\b/g)) assert.match(m[0], /^0x(.)\1*$|^0x12345$/i, m[0]);
  }
  for (const o of ['bad.txt', 'bad.json', 'bad.md', 'bad.sarif', 'bad-explain.txt', 'bad-explain.md', 'good.txt', 'good.json', 'good.md', 'good.sarif']) {
    const out = await saved(o);
    assert.ok(!out.includes('lantern'), `${o} does not show the seed`);
    assert.ok(!/[0-9a-f]{64}/.test(out), `${o} shows no hash`);
  }
});

test('examples: the sample output of the bad file is the one the README shows', async () => {
  const readme = (await readFile(resolve(root, 'README.md'), 'utf8')).split('\r\n').join('\n');
  const bad = (await saved('bad.txt')).split('\n');
  assert.ok(readme.includes(bad.slice(0, bad.findIndex((l) => l.startsWith('Findings ('))).join('\n')));
  assert.ok(readme.includes(bad.slice(-4).join('\n')));
});
