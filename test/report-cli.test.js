import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MAX_FEE_BPS, MAX_FEE_BPS, RULES, USAGE, VERSION, buildReport, checkText, listChecksJson, listChecksMarkdown, listChecksText, parseArgs, toJson, toMarkdown, toSarif, toText } from '../src/index.js';
import { ARGS, BAD, BASE, ETH, GOOD, MULTISIG, USDC, addr, cli, file, multisig, run, text, withDispute, withEscrow, withFee, withRoles, withTokens } from './helpers.js';

const ch = (...codes) => String.fromCharCode(...codes);
// A file with an error and a warning: no refund path, and a fee above the threshold.
const MIXED = { 'escrow.json': text(file({ escrow: { ...BASE.escrow, refundPath: 'none' }, platformFee: { bps: 1500, recipient: MULTISIG } })) };
const mem = { file: 'mem.json', bytes: 1, lines: 1 };

test('exit codes: 0 for a pass, 1 for a finding at or above the fail-on level, 2 for a usage or input error', async () => {
  assert.equal((await run(GOOD, ARGS)).code, 0);
  assert.equal((await run(BAD, ARGS)).code, 1);
  assert.equal((await run(GOOD, ['nothing.json'])).code, 2);
  assert.equal((await run(GOOD, [])).code, 2);
  assert.equal((await run(GOOD, ['escrow.json', 'other.json'])).code, 2);
  assert.equal((await run(GOOD, ['escrow.json', '--bogus'])).code, 2);
  const none = await run({}, ['a.json']);
  assert.equal(none.code, 2);
  assert.match(none.err, /the input has a problem:\n {2}a\.json: does not exist\n/);
});

test('--fail-on and --min-severity: a warning fails the run at warning, and a hidden finding still counts for the result', async () => {
  const w = { 'w.json': text(withFee({ bps: 1500 })) };
  assert.equal((await run(w, ['w.json'])).code, 0);
  assert.equal((await run(w, ['w.json', '--fail-on', 'warning'])).code, 1);
  assert.equal((await run(w, ['w.json', '--fail-on', 'info'])).code, 1);
  const r = await run(MIXED, [...ARGS, '--min-severity', 'error']);
  assert.match(r.out, /findings: 1 \(1 error\); 1 below error not shown\n/);
  const hidden = await run(w, ['w.json', '--min-severity', 'error', '--fail-on', 'warning']);
  assert.match(hidden.out, /findings: 0; 1 below error not shown/);
  assert.equal(hidden.code, 1);
  const info = { 'i.json': text(withDispute({ appealWindow: undefined })) };
  assert.equal((await run(info, ['i.json'])).code, 0);
  assert.equal((await run(info, ['i.json', '--fail-on', 'info'])).code, 1, 'a note fails the run at info');
});

test('--max-fee-bps: a whole number of basis points from 0 to 10000, given once, that moves fee-too-high', async () => {
  assert.equal(DEFAULT_MAX_FEE_BPS, 1000);
  assert.equal(MAX_FEE_BPS, 10000);
  assert.equal(parseArgs(['e.json']).maxFeeBps, null);
  assert.equal(parseArgs(['e.json', '--max-fee-bps', '0']).maxFeeBps, 0);
  assert.equal(parseArgs(['e.json', '--max-fee-bps', '10000']).maxFeeBps, 10000);
  for (const bad of ['-1', '2.5', '010', '10001', 'ten', '1e3']) assert.throws(() => parseArgs(['e.json', '--max-fee-bps', bad]), /--max-fee-bps: .* is not a whole number of basis points from 0 to 10000/, bad);
  assert.throws(() => parseArgs(['e.json', '--max-fee-bps', '1', '--max-fee-bps', '2']), /given twice/);
  const r = await run(GOOD, [...ARGS, '--max-fee-bps', '100']);
  assert.match(r.out, /WARNING {2}fee-too-high/);
  assert.match(r.out, /\nmax fee: 100 basis points \(1%\), from --max-fee-bps\n/);
  const json = JSON.parse((await run(GOOD, [...ARGS, '--json', '--max-fee-bps', '300'])).out);
  assert.deepEqual(json.options, { minSeverity: 'info', failOn: 'error', maxFeeBps: 300 });
});

test('the text report names the file, the configuration, the checks, each finding with its line and fix, the roles, and ends with the notice and the result', async () => {
  const r = await run(MIXED, ARGS);
  assert.match(r.out, /^marketplace-escrow-check: escrow\.json\n/);
  assert.match(r.out, /\nfile: escrow\.json \(JSON, \d+ lines, [\d,]+ bytes\)\n/);
  assert.match(r.out, /\nchain id: 1\n/);
  assert.match(r.out, /\ntokens: 2: USDC, at 0x8{40}, 6 decimals, chain id 1; ETH, native, 18 decimals, chain id 1\n/);
  assert.match(r.out, /\nplatform fee: 1,500 basis points \(15%\) to 0x2{40}\n/);
  assert.match(r.out, /\nescrow: release on buyer confirmation or after a timeout; release timeout 1,209,600 seconds \(14 days\); dispute window 604,800 seconds \(7 days\); refund path none; partial refunds allowed; 3 milestones \(Design 30%, Build 30%, Handover 40%\)\n/);
  assert.match(r.out, /\ndispute: 5 arbiters, panel of 3, quorum of 2, arbiter fee 100 basis points \(1%\), appeal window 259,200 seconds \(3 days\)\n/);
  assert.match(r.out, /\nstake: 100 USDC, slash 5,000 basis points \(50%\)\n/);
  assert.match(r.out, /\neip712 domain: name Example Escrow, version 1, chain id 1, verifying contract 0x1{40}\n/);
  assert.match(r.out, /\nmax order: 50000 USDC\n/);
  assert.match(r.out, /\nfindings: 2 \(1 error, 1 warning\)\n/);
  assert.match(r.out, /ERROR {4}no-refund-path {18}escrow\.json:\d+\n/);
  assert.match(r.out, /fix: Name at least one refund path/);
  assert.match(r.out, /\nChecks \(32\)\n/);
  assert.ok(r.out.includes(['Roles (7)', '', '  role        address                                     held by', `  owner       ${MULTISIG}  multisig`].join('\n')));
  assert.match(r.out, /refunded as intended\.\n\nRESULT: FAIL - 1 finding at or above error \(1 error, 1 warning\)\n$/);
  const good = await run(GOOD, ARGS);
  assert.match(good.out, /Findings \(0\)\n\n {2}none\n/);
});

test('the text report of a file read in part: what was not read, and no table of roles without roles', async () => {
  const bare = (await run({ 'e.json': text(file({ chainId: 'x', tokens: [{ symbol: 'ABC', address: addr('7'), decimals: 'x', chainId: 'x' }], platformFee: { bps: 'x' }, escrow: { releaseMode: 'x', disputeWindow: 'x', refundPath: 'x', milestones: [{ name: 'A', shareBps: 'x' }] }, dispute: { arbiters: 'x', panelSize: 'x', quorum: 'x', appealWindow: 'x' }, stake: { amount: 'x', token: 'ABC', slashBps: 'x' }, roles: undefined, eip712: {}, limits: { maxOrderValue: 'x', token: 'ABC' } })) }, ['e.json'])).out;
  assert.match(bare, /\nchain id: not read\n/);
  assert.match(bare, /\ntokens: 1: ABC, at 0x7{40}, decimals not read, chain id not read\n/);
  assert.match(bare, /\nplatform fee: bps not read\n/);
  assert.match(bare, /\nescrow: release mode not read; dispute window not read; no refund path read; 1 milestone \(A share not read\)\n/);
  assert.match(bare, /\ndispute: arbiters not read, panel of not read, quorum of not read, appeal window none\n/);
  assert.match(bare, /\nstake: amount not read ABC, slash not read\n/);
  assert.match(bare, /\neip712 domain: name none, version none, chain id none, verifying contract none\n/);
  assert.match(bare, /\nmax order: not set\n/);
  assert.doesNotMatch(bare, /\nRoles \(/);
  const empty = (await run({ 'e.json': text({ tokens: [] }) }, ['e.json'])).out;
  assert.match(empty, /\ntokens: none read\nplatform fee: not read\nescrow: not read\ndispute: not read\nstake: none declared\neip712 domain: not read\n/);
  const partial = JSON.parse((await run({ 'e.json': text(file({ escrow: { ...BASE.escrow, partialRefunds: undefined, milestones: [] }, stake: { slashBps: 0, amount: '1', token: 'DOGE' } })) }, ['e.json', '--json'])).out);
  assert.equal(partial.config.escrow.partialRefunds, null);
  assert.deepEqual(partial.config.stake, { amount: '1', token: null, slashBps: 0 });
  const escrowLine = (await run({ 'e.json': text(withEscrow({ partialRefunds: false, milestones: [], releaseMode: 'buyer-confirm', releaseTimeout: undefined })) }, ['e.json'])).out;
  assert.match(escrowLine, /\nescrow: release on buyer confirmation only; dispute window 604,800 seconds \(7 days\); refund by seller and arbiter; partial refunds not allowed; 0 milestones\n/);
  assert.match((await run({ 'e.json': text(withEscrow({ releaseMode: 'timeout' })) }, ['e.json'])).out, /\nescrow: release after a timeout only;/);
});

test('the table of roles: who holds each role, a dash for a role not given, and the multisig with its threshold', async () => {
  const r = JSON.parse((await run({ 'e.json': text(withRoles({ pauser: undefined, owner: '0x11', feeSetter: addr('0'), multisig: multisig({ threshold: 'x' }) })) }, ['e.json', '--json'])).out);
  assert.deepEqual(r.roles, [
    { role: 'owner', address: '0x11', heldBy: 'malformed address' },
    { role: 'pauser', address: null, heldBy: null },
    { role: 'upgrader', address: addr('9'), heldBy: 'timelock' },
    { role: 'fee setter', address: addr('0'), heldBy: 'zero address' },
    { role: 'treasury', address: MULTISIG, heldBy: 'multisig' },
    { role: 'timelock', address: addr('9'), heldBy: 'timelock' },
    { role: 'multisig', address: MULTISIG, heldBy: 'not read' }
  ]);
  const t = (await run({ 'e.json': text(withRoles({ pauser: undefined })) }, ['e.json'])).out;
  assert.ok(t.includes('  pauser      -                                           -\n'));
  assert.ok(t.includes(`  multisig    ${MULTISIG}  3 of 5 signers\n`));
  const one = JSON.parse((await run({ 'e.json': text(withRoles({ owner: addr('1'), multisig: undefined })) }, ['e.json', '--json'])).out);
  assert.deepEqual(one.roles[0], { role: 'owner', address: addr('1'), heldBy: 'one key' });
  assert.equal(one.roles.length, 6);
});

test('--explain adds the points of the pages to text, markdown and JSON, and the tool\'s own choice to a best practice check', async () => {
  const set = { 'escrow.json': text(file({ eip712: { ...BASE.eip712, chainId: 10 }, escrow: { ...BASE.escrow, refundPath: 'none' } })) };
  const r = await run(set, [...ARGS, '--explain']);
  assert.match(r.out, /basis: In the signing domain of EIP-712 the chainId field holds the EIP-155 id of the chain.*\(EIP-712: Typed structured data hashing and signing, https:\/\/eips\.ethereum\.org\/EIPS\/eip-712\)/);
  assert.match(r.out, /the tool's own choice: asking for a refund path is a best practice of this tool/);
  const md = (await run(set, [...ARGS, '--format', 'markdown', '--explain'])).out;
  assert.match(md, /## Basis\n\n### no-refund-path\n\n- The tool's own choice: asking for a refund path/);
  assert.match(md, /### eip712-domain-chain-mismatch\n\n- In the signing domain of EIP-712/);
  const input = (await run({ 'e.json': text(file({ chainID: 1 })) }, ['e.json', '--format', 'markdown', '--explain'])).out;
  assert.match(input, /### field-unknown\n\n- A problem with the file itself; it rests on no page\./);
  const json = JSON.parse((await run(set, [...ARGS, '--json', '--explain'])).out);
  assert.equal(json.findings.find((f) => f.id === 'eip712-domain-chain-mismatch').basis[0].url, 'https://eips.ethereum.org/EIPS/eip-712');
  const plain = JSON.parse((await run(set, [...ARGS, '--json'])).out);
  assert.equal(plain.findings[0].basis, undefined);
  assert.equal((await run(set, [...ARGS, '--format', 'sarif', '--explain'])).code, 2);
  const roles = (await run({ 'e.json': text(withRoles({ owner: addr('1') })) }, ['e.json', '--explain'])).out;
  assert.match(roles, /basis: The ethereum\.org page on smart contract security calls one address as the owner of a contract a single point of failure.*\(Smart contract security, ethereum\.org developer documentation, https:\/\/ethereum\.org\/en\/developers\/docs\/smart-contracts\/security\/\)/);
});

test('the JSON report: the tool, the input, the configuration, totals by level, the rules, the findings, the roles and the result', async () => {
  const r = JSON.parse((await run(BAD, [...ARGS, '--json'])).out);
  assert.equal(r.tool, 'marketplace-escrow-check');
  assert.equal(r.version, VERSION);
  assert.equal(r.input.file, 'escrow.json');
  assert.equal(r.input.format, 'json');
  assert.equal(r.config.chainId, 1);
  assert.deepEqual(r.config.tokens[1], { symbol: 'ETH', address: 'native', decimals: 18, chainId: 1 });
  assert.deepEqual(r.config.fee, { bps: 250, percent: '2.5%', recipient: MULTISIG });
  assert.deepEqual(r.config.escrow.refundPath, 'none');
  assert.deepEqual(r.config.dispute, { arbiters: 5, panelSize: 3, quorum: 2, arbiterFeeBps: 100, appealWindow: 259200 });
  assert.deepEqual(r.config.maxOrder, { value: '50000', token: 'USDC' });
  assert.deepEqual(r.totals, { findings: 1, byLevel: { error: 1, warning: 0, info: 0 }, hidden: 0 });
  assert.equal(r.rules.length, RULES.length);
  const f = r.findings[0];
  assert.deepEqual(Object.keys(f), ['id', 'severity', 'message', 'file', 'line', 'column', 'at', 'subject', 'fix', 'kind']);
  assert.deepEqual([f.id, f.file, f.at.startsWith('escrow.json:'), f.subject], ['no-refund-path', 'escrow.json', true, null]);
  assert.deepEqual(r.result, { pass: false, failOn: 'error', text: 'FAIL - 1 finding at or above error (1 error)' });
  const subject = JSON.parse((await run({ 'e.json': text(withTokens({ ...USDC, chainId: 5 }, ETH)) }, ['e.json', '--json'])).out);
  assert.equal(subject.findings[0].subject, 'USDC');
});

test('the SARIF report: version 2.1.0, every check as a rule, the file as the artifact and a result with its line and column', async () => {
  const s = JSON.parse((await run(MIXED, [...ARGS, '--format', 'sarif'])).out);
  assert.equal(s.version, '2.1.0');
  const runOf = s.runs[0];
  assert.equal(runOf.tool.driver.name, 'marketplace-escrow-check');
  assert.equal(runOf.tool.driver.rules.length, RULES.length);
  assert.deepEqual(runOf.artifacts.map((a) => a.location.uri), ['escrow.json']);
  assert.deepEqual(runOf.results.map((x) => [x.ruleId, x.level, x.locations[0].physicalLocation.artifactLocation.uri]), [['no-refund-path', 'error', 'escrow.json'], ['fee-too-high', 'warning', 'escrow.json']]);
  assert.ok(runOf.results[0].locations[0].physicalLocation.region.startLine > 1);
  assert.equal(runOf.results[0].ruleIndex, RULES.findIndex((x) => x.id === 'no-refund-path'));
  assert.equal(runOf.properties.sources.length, 2);
  const info = JSON.parse((await run({ 'e.json': text(withDispute({ appealWindow: 0 })) }, ['e.json', '--format', 'sarif'])).out);
  assert.equal(info.runs[0].results[0].level, 'note');
});

test('the markdown report escapes what markdown gives a meaning to, and every format replaces control and direction characters', async () => {
  const name = `Example [link](https://x.example) | ${ch(0x1b)}[31m red ${ch(0x202e)}rtl ${ch(7)}`;
  const set = { 'escrow.json': text(file({ eip712: { ...BASE.eip712, name }, escrow: { ...BASE.escrow, milestones: [{ name: `M|${ch(0x1b)}1`, shareBps: 5000 }, { name: `M${ch(0x2028)}2`, shareBps: 4000 }] } })) };
  for (const format of ['text', 'markdown', 'json', 'sarif']) {
    const out = (await run(set, [...ARGS, '--format', format])).out;
    assert.ok(![...out].some((c) => [0x1b, 0x202e, 0x2028, 7].includes(c.charCodeAt(0))), format);
  }
  const md = (await run(set, [...ARGS, '--format', 'markdown'])).out;
  assert.match(md, /M\\\| 1 50%/);
  assert.doesNotMatch(md, /\]\(https/);
  assert.match(md, /## Roles \(7\)\n\n\| Role \| Address \| Held by \|/);
  assert.match(md, /## Findings\n\n\| Level \| Check \| Where \| Message \|/);
  assert.match((await run(GOOD, [...ARGS, '--format', 'markdown'])).out, /## Findings\n\nNone\./);
});

test('--list-checks in text, markdown and JSON, and no SARIF form', async () => {
  assert.match((await cli(['--list-checks'], process.cwd())).out, /^marketplace-escrow-check checks\n\n {2}file-unreadable/);
  assert.equal(listChecksText().split('\n').filter((l) => /^ {2}[a-z]/.test(l)).length, RULES.length);
  assert.match(listChecksText(), /None of it is legal or financial advice\./);
  assert.match(listChecksText(), /A documented check rests on EIP-712 and the smart contract security page of ethereum\.org;/);
  assert.match(listChecksMarkdown(), /\| eip712-domain-chain-mismatch \| error \| documented \|/);
  assert.equal(JSON.parse(listChecksJson()).length, RULES.length);
  assert.equal((await cli(['--list-checks', '--format', 'markdown'], process.cwd())).code, 0);
  assert.equal((await cli(['--list-checks', '--format', 'sarif'], process.cwd())).code, 2);
});

test('--help, --version and usage errors: the usage names every check and option, and a value that looks like an option is refused', async () => {
  const help = await cli(['--help'], process.cwd());
  assert.equal(help.code, 0);
  for (const r of RULES) assert.ok(help.out.includes(r.id), r.id);
  for (const o of ['--format', '--json', '--min-severity', '--fail-on', '--max-fee-bps', '--explain', '--list-checks', '--help', '--version']) assert.ok(USAGE.includes(o), o);
  assert.match(USAGE, /is\s+not\s+legal\s+or\s+financial\s+advice/);
  assert.equal((await cli(['-h'], process.cwd())).code, 0);
  assert.equal((await cli(['--version'], process.cwd())).out, `${VERSION}\n`);
  assert.equal((await cli(['-v'], process.cwd())).out, `${VERSION}\n`);
  assert.throws(() => parseArgs(['a', '--fail-on', '--json']), /--fail-on needs a value/);
  assert.throws(() => parseArgs(['a', '--max-fee-bps']), /--max-fee-bps needs a value/);
  assert.throws(() => parseArgs(['a', '--fail-on', 'fatal']), /unknown level fatal/);
  assert.throws(() => parseArgs(['a', '--min-severity', 'all']), /--min-severity: unknown level all/);
  assert.throws(() => parseArgs(['a', '--format', 'xml']), /unknown format xml/);
  assert.throws(() => parseArgs(['a', '--json', '--format', 'text']), /ask for two formats/);
  assert.equal(parseArgs(['a', '--json', '--format', 'json']).format, 'json');
  assert.throws(() => parseArgs(['-']), /standard input is not supported/);
  assert.throws(() => parseArgs(['a', '--format', '-']), /standard input is not supported/);
  assert.throws(() => parseArgs(['https://example.com/escrow.json']), /never fetches a URL/);
  assert.throws(() => parseArgs(['a', '--fail-on', 'error', '--fail-on', 'warning']), /given twice/);
  assert.throws(() => parseArgs([]), /give the configuration file/);
  const err = await cli(['--bogus'], process.cwd());
  assert.match(err.err, /^marketplace-escrow-check: unknown argument --bogus\n\nUsage:/);
});

test('an error that is not about the input is reported with exit code 2 and no report', async () => {
  const r = await cli(['escrow.json'], `${process.cwd()}\u0000`);
  assert.equal(r.code, 2);
  assert.equal(r.out, '');
  assert.match(r.err, /^marketplace-escrow-check: /);
});

test('buildReport and the formats can be used without the file system, and a file that could not be read', () => {
  const report = buildReport({ file: mem, checked: checkText(text(file())), version: '0' });
  assert.match(toText(report), /^marketplace-escrow-check: mem\.json/);
  assert.match(toMarkdown(report), /^# marketplace-escrow-check: mem\.json/);
  assert.equal(JSON.parse(toJson(report)).input.file, 'mem.json');
  assert.equal(JSON.parse(toSarif(report)).runs[0].results.length, 0);
  const none = buildReport({ file: mem, checked: checkText('['), version: '0' });
  assert.match(toText(none), /\nconfig: not read\n/);
  assert.equal(none.config, null);
  assert.equal(none.roles, null);
  assert.match(toMarkdown(none), /- Config: not read/);
  const top = buildReport({ file: mem, checked: checkText('[1]'), version: '0' });
  assert.equal(top.config, null);
  assert.throws(() => checkText(null), TypeError, 'an error that is not one of the reader is not swallowed');
  const notes = toMarkdown(buildReport({ file: mem, checked: checkText(text(file({ stake: undefined }))), version: '0' }));
  assert.match(notes, /Note: the file declares no stake of a seller/);
});
