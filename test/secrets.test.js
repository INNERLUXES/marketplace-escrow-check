import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HASH_KEYS, SECRET_KEYS, checkText, fileSecrets, findSecrets, hashNodes, isSecretKey, readJson, secretShape } from '../src/index.js';
import { ARGS, BASE, addr, file, findingsOf, hash, lineOf, run, text, withDomain, withEscrow, withRoles, withStake } from './helpers.js';

// Shapes built from repeated characters, so that no file of the repository holds anything that could be a real seed or
// key.
const MNEMONIC = Array.from({ length: 12 }, () => 'lantern').join(' ');
const MNEMONIC_24 = Array.from({ length: 24 }, (_, i) => (i % 2 ? 'harbor' : 'lantern')).join(' ');
const XPRV = `x${'prv'}${'9'.repeat(107)}`;
const HEX = `0x${'ab'.repeat(32)}`;
const WIF = `5${'H'.repeat(50)}`;

// A domain with a salt, and an escrow with the hash of its terms.
const SALTED = withDomain({ salt: hash('4') });
const TERMS = withEscrow({ termsHash: hash('3') });

test('secretShape: a mnemonic of 12 to 24 words, an extended private key, a key in hex and a key in WIF', () => {
  assert.equal(secretShape(MNEMONIC), 'a mnemonic');
  assert.equal(secretShape(MNEMONIC_24), 'a mnemonic');
  assert.equal(secretShape(`  ${MNEMONIC}  `), 'a mnemonic');
  assert.equal(secretShape(XPRV), 'an extended private key');
  assert.equal(secretShape(HEX), 'a private key in hex');
  assert.equal(secretShape(HEX.slice(2)), 'a private key in hex');
  assert.equal(secretShape(WIF), 'a private key in WIF');
  assert.equal(secretShape(`K${'z'.repeat(51)}`), 'a private key in WIF');
});

test('secretShape: addresses, names, symbols and other near misses are not secrets', () => {
  for (const ok of [addr(), addr('ab'), 'Example Escrow', 'example escrow', `0x${'ab'.repeat(31)}`, Array.from({ length: 11 }, () => 'lantern').join(' '), `x${'pub'}${'9'.repeat(107)}`, '7', 'USDC', 'buyer-confirm', '']) assert.equal(secretShape(ok), null, ok);
});

test('isSecretKey: names of keys and seeds in any case and with any separator, and near misses', () => {
  for (const k of ['privateKey', 'private_key', 'PRIVATE-KEY', 'mnemonic', 'seedPhrase', 'seed phrase', 'xprv', 'wif', 'secret', 'passphrase', 'password']) assert.ok(isSecretKey(k), k);
  for (const k of ['owner', 'treasury', 'signers', 'salt', 'termsHash', 'verifyingContract', 'recipient', 'publicKey']) assert.ok(!isSecretKey(k), k);
  assert.ok(SECRET_KEYS.includes('privatekey'));
});

test('secret-in-file: a key named for a seed in the roles, at its line, reported once and never shown in any format', async () => {
  const p = withRoles({ seedPhrase: MNEMONIC });
  const f = findingsOf(p);
  assert.deepEqual(f.map((x) => x.id), ['secret-in-file'], 'the key is reported once, as a secret, and not as unknown');
  assert.match(f[0].message, /^The file holds the key "seedPhrase", which names a seed, a mnemonic or a private key\. The tool never reads one, and the value is not shown\.$/);
  assert.equal(f[0].line, lineOf(text(p), '"seedPhrase"'));
  assert.equal(f[0].file, 'config');
  for (const format of ['text', 'markdown', 'json', 'sarif']) {
    const r = await run({ 'escrow.json': text(p) }, [...ARGS, '--format', format]);
    assert.equal(r.code, 1, format);
    assert.ok(!r.out.includes('lantern'), format);
  }
});

test('secret-in-file: a value shaped like a key under any field, the field left out of the checks and never echoed', async () => {
  for (const [shape, value] of [['a mnemonic', MNEMONIC], ['an extended private key', XPRV], ['a private key in hex', HEX], ['a private key in WIF', WIF]]) {
    const p = withRoles({ pauser: value, treasury: value });
    const r = checkText(text(p));
    const secrets = r.findings.filter((f) => f.id === 'secret-in-file');
    assert.equal(secrets.length, 2, shape);
    assert.match(secrets.find((f) => f.message.includes('"pauser"')).message, new RegExp(`^The value of "pauser" is shaped like ${shape}\\. The tool never reads a seed or a key, and the value is not shown\\.$`));
    assert.ok(!r.findings.some((f) => f.message.includes(value)), shape);
    assert.deepEqual(r.findings.map((f) => f.id), ['secret-in-file', 'secret-in-file'], `${shape}: the fields are there, but not read`);
    const out = await run({ 'escrow.json': text(p) }, [...ARGS, '--json', '--explain']);
    assert.ok(!out.out.includes(value), shape);
  }
});

test('a hash under salt or termsHash is read as a hash, not as a key, and never shown', async () => {
  const p = file({ eip712: SALTED.eip712, escrow: TERMS.escrow });
  assert.deepEqual(findingsOf(p), []);
  assert.deepEqual(HASH_KEYS, ['salt', 'termsHash']);
  assert.equal(hashNodes(readJson(text(p))).length, 2);
  assert.deepEqual(fileSecrets(readJson(text(p))), []);
  assert.equal(findSecrets(readJson(text(p))).length, 2, 'the search of the sibling tools alone takes both hashes for keys');
  for (const format of ['text', 'markdown', 'json', 'sarif']) {
    const r = await run({ 'escrow.json': text(p) }, [...ARGS, '--format', format]);
    assert.ok(!r.out.includes('3'.repeat(64)) && !r.out.includes('4'.repeat(64)), format);
  }
  assert.deepEqual(findingsOf(withDomain({ salt: 'ab'.repeat(32) })), [], 'a hash with no 0x in front');
  assert.deepEqual(findingsOf(withDomain({ salt: '0x1234' })).map((f) => f.id), ['field-invalid'], 'a salt of another form');
});

test('a 64-hex value under any other key is still a key, and a mnemonic or a WIF under salt is still a secret', () => {
  assert.deepEqual(findingsOf(withRoles({ notes: hash('4') })).map((f) => f.id), ['secret-in-file']);
  assert.deepEqual(findingsOf(file({ notes: { salt: hash('4') } })).map((f) => f.id), [], 'a hash under salt in the notes is a hash in a note no one reads');
  assert.deepEqual(findingsOf(withDomain({ domainHash: hash('4') })).map((f) => f.id), ['secret-in-file', 'field-unknown'], 'domainHash is not a key of this tool, so its value is a key, and the key is unknown');
  for (const value of [MNEMONIC, WIF, XPRV]) {
    const f = findingsOf(withDomain({ salt: value }));
    assert.deepEqual(f.map((x) => x.id), ['secret-in-file'], 'the salt is there but not read, as every secret field is');
    assert.ok(!f.some((x) => x.message.includes(value)));
  }
  const keyed = findingsOf(withRoles({ privateKey: { salt: hash('4') } }));
  assert.deepEqual(keyed.map((f) => f.id), ['secret-in-file'], 'a hash under a key named for a key stays hidden');
});

test('secret-in-file: a key shaped like a mnemonic is not shown, and a secret in a list or under a secret key is reported once', () => {
  const r = checkText(text({ ...file(), [MNEMONIC]: 1, extra: [HEX], privateKey: { nested: XPRV } }));
  const secrets = r.findings.filter((f) => f.id === 'secret-in-file');
  assert.equal(secrets.length, 3);
  assert.ok(secrets.some((f) => /a key shaped like a mnemonic/.test(f.message)));
  assert.ok(secrets.some((f) => /^The value of "extra" is shaped like a private key in hex/.test(f.message)));
  assert.ok(secrets.some((f) => /the key "privateKey"/.test(f.message)));
  assert.ok(!r.findings.some((f) => f.message.includes('lantern') || f.message.includes(HEX) || f.message.includes(XPRV)));
  assert.ok(r.findings.some((f) => f.id === 'field-unknown' && /"extra"/.test(f.message)), 'a list under an unknown key is still an unknown key');
});

test('secret-in-file: a secret value where a number, a list or a part belongs is not described and not reported as missing', () => {
  const only = (p) => assert.deepEqual(findingsOf(p).map((f) => f.id), ['secret-in-file'], JSON.stringify(p).slice(0, 80));
  only(file({ chainId: HEX }));
  only(file({ tokens: WIF }));
  only(file({ tokens: [BASE.tokens[0], BASE.tokens[1], WIF] }));
  only(withEscrow({ milestones: WIF }));
  only(withEscrow({ milestones: [...BASE.escrow.milestones, WIF] }));
  only(withEscrow({ refundPath: WIF }));
  only(withEscrow({ refundPath: ['seller', WIF] }));
  only(withEscrow({ releaseMode: WIF }));
  only(withRoles({ multisig: { ...BASE.roles.multisig, signers: [...BASE.roles.multisig.signers, WIF] } }));
  only(withRoles({ multisig: { ...BASE.roles.multisig, signers: WIF } }));
  only(withStake({ amount: WIF }));
  only(withStake({ slashBps: WIF }));
  only(withRoles({ owner: WIF }));
  only(file({ dispute: { ...BASE.dispute, arbiters: WIF } }));
  only(file({ dispute: { ...BASE.dispute, appealWindow: WIF } }));
  only(file({ tokens: [{ ...BASE.tokens[0], decimals: WIF }, BASE.tokens[1]] }));
  only(file({ platformFee: WIF }));
});
