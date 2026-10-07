import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { CONFIG_LIMITS, JSON_LIMITS, checkText } from '../src/index.js';
import { ARGS, BASE, GOOD, addr, allowed, cli, file, run, text, withDispute, withFiles, withRoles, withStake } from './helpers.js';

// Each test builds input meant to make the tool slow or to exhaust the stack or the memory, and checks that it ends with
// an answer in good time. The time allowed is four times as long under coverage (NODE_V8_COVERAGE is set only when
// coverage is on).

function timed(fn) {
  const start = process.hrtime.bigint();
  const value = fn();
  return { value, ms: Number(process.hrtime.bigint() - start) / 1e6 };
}

test('a hundred thousand arbiters and signers of one address: the first of each limit are read, each compared once, in good time', () => {
  const many = Array.from({ length: 100000 }, () => addr('a'));
  const p = file({ dispute: { ...BASE.dispute, arbiters: many }, roles: { ...BASE.roles, multisig: { ...BASE.roles.multisig, signers: many } } });
  const { value, ms } = timed(() => checkText(text(p)));
  assert.equal(value.read.dispute.arbiters.length, CONFIG_LIMITS.maxArbiters);
  assert.equal(value.read.roles.multisig.signers.length, CONFIG_LIMITS.maxSigners);
  assert.equal(value.findings.filter((f) => f.id === 'field-duplicate').length, CONFIG_LIMITS.maxArbiters - 1 + CONFIG_LIMITS.maxSigners - 1);
  assert.ok(value.notes.includes('the dispute setup lists 100000 arbiters; the tool read the first 1000'));
  assert.ok(ms < allowed(20000), `took ${ms} ms`);
});

test('a hundred thousand milestones and tokens: the first of each limit are read, with a note', () => {
  const milestones = Array.from({ length: 100000 }, (_, i) => ({ name: `M${i}`, shareBps: 1 }));
  const tokens = Array.from({ length: 100000 }, (_, i) => ({ symbol: `T${i}`, native: true, decimals: 18, chainId: 1 }));
  const { value, ms } = timed(() => checkText(text(file({ escrow: { ...BASE.escrow, milestones }, tokens: [...BASE.tokens, ...tokens] }))));
  assert.equal(value.read.escrow.milestones.length, CONFIG_LIMITS.maxMilestones);
  assert.equal(value.read.tokens.length, CONFIG_LIMITS.maxTokens);
  assert.ok(value.notes.includes('the escrow holds 100000 milestones; the tool read the first 100 and left the rest out'));
  assert.ok(ms < allowed(20000), `took ${ms} ms`);
});

test('deep nesting ends with a file-unreadable finding at the limit, never a stack overflow, and the secret scan does not recurse', () => {
  const deep = `${'['.repeat(100000)}${']'.repeat(100000)}`;
  const { value } = timed(() => checkText(deep));
  assert.equal(value.findings[0].id, 'file-unreadable');
  assert.match(value.findings[0].message, new RegExp(`nested more than ${JSON_LIMITS.maxDepth} deep`));
  const nested = text(file()).replace('"chainId": 1,', `"notes": ${'['.repeat(JSON_LIMITS.maxDepth - 2)}"x"${']'.repeat(JSON_LIMITS.maxDepth - 2)}, "chainId": 1,`);
  assert.deepEqual(checkText(nested).findings, []);
  const keyed = `{"privateKey": ${'{"a": '.repeat(JSON_LIMITS.maxDepth - 1)}1${'}'.repeat(JSON_LIMITS.maxDepth - 1)}}`;
  assert.equal(checkText(keyed).findings.filter((f) => f.id === 'secret-in-file').length, 1);
  const salts = `{"salt": ${'{"salt": '.repeat(JSON_LIMITS.maxDepth - 2)}"${'1'.repeat(64)}"${'}'.repeat(JSON_LIMITS.maxDepth - 1)}`;
  assert.deepEqual(checkText(salts).findings.filter((f) => f.id === 'secret-in-file'), [], 'the walk for hashes does not recurse either');
});

test('numbers with thousands of digits and huge exponents are refused, not worked out', () => {
  const huge = `1${'0'.repeat(5000)}`;
  const big = text(file()).replace('"chainId": 1,', `"chainId": ${huge},`).replace('"panelSize": 3', `"panelSize": ${huge}`);
  const { value, ms } = timed(() => checkText(big));
  assert.ok(value.findings.some((f) => f.id === 'field-invalid' && /chainId of the file/.test(f.message)));
  assert.ok(value.findings.some((f) => f.id === 'field-invalid' && /panelSize of the dispute setup/.test(f.message)));
  assert.ok(value.findings.every((f) => f.message.length < 700));
  assert.ok(ms < allowed(3000), `took ${ms} ms`);
  const exp = checkText(text(file()).replace('"bps": 250', '"bps": 1e999999'));
  assert.ok(exp.findings.some((f) => f.id === 'fee-invalid'));
  const stake = checkText(text(withStake({ amount: huge })));
  assert.ok(stake.findings.some((f) => f.id === 'field-invalid' && /amount of the stake/.test(f.message) && f.message.length < 400));
});

test('long strings, long names and long fields are read in good time, and the messages stay short', () => {
  const long = file({ eip712: { ...BASE.eip712, name: 'n'.repeat(200000) }, tokens: [{ ...BASE.tokens[0], symbol: 'S'.repeat(200000) }, BASE.tokens[1]] });
  const { value, ms } = timed(() => checkText(text(long)));
  assert.ok(value.findings.every((x) => x.message.length < 900));
  assert.ok(value.notes.every((n) => n.length < 900));
  assert.ok(ms < allowed(5000), `took ${ms} ms`);
  const wide = checkText(text(withRoles({ owner: `0x${'1'.repeat(200000)}` })));
  const f = wide.findings.find((x) => x.id === 'address-malformed');
  assert.ok(f.message.length < 600);
  const ms2 = checkText(text(file({ escrow: { ...BASE.escrow, milestones: [{ name: 'p'.repeat(200000), shareBps: 0 }] } })));
  assert.ok(ms2.findings.every((x) => x.message.length < 900 && (x.subject ?? '').length < 200));
});

test('names such as __proto__, constructor and toString are only names', () => {
  const t = text(file()).replace('"chainId": 1,', '"__proto__": {"polluted": 1}, "hasOwnProperty": 2, "chainId": 1,');
  const { value } = timed(() => checkText(t));
  assert.ok(value.findings.some((f) => f.id === 'field-unknown' && /"__proto__"/.test(f.message)));
  assert.ok(value.findings.some((f) => f.id === 'field-unknown' && /"hasOwnProperty"/.test(f.message)));
  assert.equal({}.polluted, undefined);
  const tok = checkText(text(file({ tokens: [...BASE.tokens, { symbol: '__proto__', native: true, decimals: 18, chainId: 1 }, { symbol: 'toString', native: true, decimals: 18, chainId: 1 }] })));
  assert.deepEqual(tok.findings, []);
  assert.ok(tok.notes.some((n) => n.includes('__proto__ and toString are not one the tool knows')));
  assert.deepEqual(checkText(text(withStake({ token: 'constructor' }))).findings.map((f) => f.id), ['field-invalid']);
  assert.deepEqual(checkText(text(file({ escrow: { ...BASE.escrow, releaseMode: '__proto__' } }))).findings.map((f) => f.id), ['field-invalid']);
  assert.deepEqual(checkText(text(withDispute({ arbiters: ['constructor', addr('b'), addr('c')] }))).findings.map((f) => f.id), ['address-malformed']);
});

test('a run leaves the folder as it was: the tool writes nothing', async () => {
  await withFiles(GOOD, async (dir) => {
    const before = (await readdir(dir, { recursive: true })).sort();
    await cli([...ARGS, '--format', 'sarif'], dir);
    await cli([...ARGS, '--json', '--explain'], dir);
    assert.deepEqual((await readdir(dir, { recursive: true })).sort(), before);
  });
  assert.equal((await run(GOOD, ARGS)).code, 0);
});
