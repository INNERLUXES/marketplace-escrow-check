import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG_LIMITS, DOMAIN_KEYS, ESCROW_KEYS, REFUND_PATHS, RELEASE_MODES, ROLES, ROLE_KEYS, Reader, TOKEN_KEYS, TOP_KEYS, checkText, cut, describe, oneEdit, readAmount, readBps, readConfig, readJson, suggestKey } from '../src/index.js';
import { BASE, ETH, USDC, addr, file, findingsOf, idsOf, lineOf, multisig, ofCheck, text, withDispute, withDomain, withEscrow, withFee, withPart, withRoles, withStake, withTokens } from './helpers.js';

const messages = (p, id) => ofCheck(p, id).map((f) => f.message);

test('the keys the reader knows, and the choices of the release mode and the refund path', () => {
  assert.deepEqual(TOP_KEYS, ['chainId', 'tokens', 'platformFee', 'escrow', 'dispute', 'stake', 'roles', 'eip712', 'limits', 'notes']);
  assert.ok(TOKEN_KEYS.includes('native'));
  assert.ok(ESCROW_KEYS.includes('termsHash'));
  assert.ok(ROLE_KEYS.includes('timelock'));
  assert.ok(DOMAIN_KEYS.includes('salt'));
  assert.deepEqual(RELEASE_MODES, ['buyer-confirm', 'timeout', 'both']);
  assert.deepEqual(REFUND_PATHS, ['seller', 'arbiter', 'timeout']);
  assert.deepEqual(ROLES.map(([k]) => k), ['owner', 'pauser', 'upgrader', 'feeSetter', 'treasury', 'timelock']);
  assert.equal(CONFIG_LIMITS.maxTokens, 100);
});

test('field-missing: every required part of the file, each named at its place', () => {
  const none = findingsOf({ notes: 'x' });
  assert.deepEqual(none.map((f) => f.id).sort(), [...Array(7).fill('field-missing'), 'max-order-missing'].sort());
  for (const m of ['The file has no chainId', 'The file has no tokens', 'The file has no platformFee.', 'The file has no escrow.', 'The file has no dispute.', 'The file has no roles.', 'The file has no eip712.']) assert.ok(none.some((f) => f.message.startsWith(m)), m);
  assert.match(messages(file({ tokens: [] }), 'field-missing')[0], /The tokens of the file are an empty list/);
  assert.deepEqual(idsOf(file({ stake: undefined })), [], 'a stake may be left out');
  const notes = checkText(text(file({ stake: undefined }))).notes;
  assert.deepEqual(notes, ['the file declares no stake of a seller, so stake-slash-invalid did not run']);
});

test('field-missing: the fields of a token, the fee, the escrow, a milestone, the dispute, the stake, the roles and the multisig', () => {
  const t = withTokens({ decimals: 6 }, { ...USDC, symbol: 'DAI', decimals: 18, address: addr('7'), chainId: undefined });
  assert.deepEqual(messages(t, 'field-missing'), ['Token 1 has no symbol.', 'Token 1 has no address; write "native": true for the currency of the chain.', 'Token 1 has no chainId.', 'Token DAI has no chainId.']);
  assert.deepEqual(messages(withTokens({ symbol: 'USDC', address: addr('8'), chainId: 1 }, ETH), 'field-missing'), ['Token USDC has no decimals.']);
  assert.deepEqual(messages(withFee({ bps: undefined }), 'field-missing'), ['The platform fee has no bps; write 0 for a marketplace that takes no fee.']);
  assert.deepEqual(messages(withFee({ recipient: undefined }), 'field-missing'), ['The platform fee has no recipient.']);
  assert.deepEqual(idsOf(withFee({ bps: 0, recipient: undefined })), [], 'no recipient for a fee of 0');
  assert.deepEqual(messages(withEscrow({ releaseMode: undefined }), 'field-missing'), ['The escrow has no releaseMode; write one of buyer-confirm, timeout, both.']);
  assert.deepEqual(messages(withEscrow({ disputeWindow: undefined }), 'field-missing'), ['The escrow has no disputeWindow, the seconds a buyer has to open a dispute.']);
  assert.deepEqual(messages(withEscrow({ releaseTimeout: undefined }), 'field-missing'), ['The escrow releases by time (releaseMode both) and has no releaseTimeout.']);
  assert.deepEqual(messages(withEscrow({ releaseMode: 'timeout', releaseTimeout: '' }), 'field-missing'), ['The escrow releases by time (releaseMode timeout) and has no releaseTimeout.']);
  const ms = withEscrow({ milestones: [{ shareBps: 5000 }, { name: 'Build' }, { name: 'Ship', shareBps: 5000 }] });
  assert.deepEqual(messages(ms, 'field-missing'), ['Milestone 1 has no name.', 'Milestone Build has no shareBps.']);
  assert.deepEqual(idsOf(ms), ['field-missing', 'field-missing'], 'the sum is not worked out when a share is missing');
  assert.deepEqual(messages(withDispute({ arbiters: undefined, panelSize: undefined, quorum: undefined }), 'field-missing'), ['The dispute setup has no arbiters.', 'The dispute setup has no panelSize, the number of arbiters on a dispute.', 'The dispute setup has no quorum, the votes that decide a dispute.']);
  assert.deepEqual(messages(withDispute({ arbiters: [] }), 'field-missing'), ['The dispute setup lists no arbiter.']);
  assert.deepEqual(messages(withStake({ amount: undefined, token: undefined, slashBps: undefined }), 'field-missing'), ['The stake has no token.', 'The stake has no amount.', 'The stake has no slashBps; write 0 for a stake that is never slashed.']);
  assert.deepEqual(messages(withRoles({ owner: undefined }), 'field-missing'), ['The roles have no owner.']);
  assert.deepEqual(messages(withRoles({ owner: ' ' }), 'field-missing'), ['The roles have no owner.']);
  const m = withRoles({ multisig: { notes: 'x' } });
  assert.deepEqual(messages(m, 'field-missing'), ['The multisig has no address.', 'The multisig has no threshold.', 'The multisig has no signers.']);
  assert.deepEqual(messages(withRoles({ multisig: multisig({ signers: [] }) }), 'field-missing'), ['The multisig lists no signer.']);
  assert.deepEqual(messages(withPart('limits', { token: undefined }), 'field-missing'), ['The limits has no token.']);
  assert.deepEqual(messages(withPart('limits', { maxOrderValue: undefined }), 'field-missing'), ['The limits has no maxOrderValue.']);
});

test('field-missing: each finding is at the line of the part or the field', () => {
  const p = withEscrow({ disputeWindow: undefined });
  assert.equal(ofCheck(p, 'field-missing')[0].line, lineOf(text(p), '"escrow"'));
  const q = withTokens({ ...USDC, decimals: undefined }, ETH);
  assert.equal(ofCheck(q, 'field-missing')[0].line, lineOf(text(q), '"symbol": "USDC"') - 1);
});

test('field-unknown: a misspelt key at every level, with the key it is probably meant to be', () => {
  const p = file({ chainID: 1, chainId: undefined });
  assert.match(messages(p, 'field-unknown')[0], /^The key "chainID" of the file is not one the tool reads, so its value was left out of every check\. Did you mean "chainId"\?/);
  assert.match(messages(withEscrow({ dispute_window: 1, disputeWindow: undefined }), 'field-unknown')[0], /Did you mean "disputeWindow"\?/);
  assert.match(messages(withRoles({ feeSeter: addr('2') }), 'field-unknown')[0], /Did you mean "feeSetter"\?/);
  assert.match(messages(withDomain({ verifying: addr('1') }), 'field-unknown')[0], /Did you mean "verifyingContract"\?/);
  assert.doesNotMatch(messages(withDomain({ zz: 1 }), 'field-unknown')[0], /Did you mean/);
  assert.equal(suggestKey('panelsize', ['panelSize']), 'panelSize');
  assert.equal(suggestKey('qorum', ['quorum']), 'quorum');
  assert.equal(suggestKey('ab', ['abc']), null);
  assert.ok(oneEdit('abc', 'abd') && oneEdit('abc', 'ab') && oneEdit('ab', 'abc') && !oneEdit('abc', 'abc') && !oneEdit('abc', 'xyzw'));
});

test('field-invalid: values of the wrong type or form in every part', () => {
  const cases = [
    [file({ chainId: '1x' }), /The chainId of the file is "1x"; it must be a whole number of a chain id from 1 to/],
    [file({ chainId: 0 }), /The chainId of the file is the number 0/],
    [file({ tokens: {} }), /The tokens of the file are an object; they must be a list of objects\./],
    [file({ tokens: [USDC, 7] }), /Item 2 of the tokens of the file is the number 7; it must be an object\./],
    [file({ platformFee: 250 }), /The platformFee of the file is the number 250; it must be an object with its bps and recipient\./],
    [withTokens({ ...USDC, decimals: true }, ETH), /The decimals of token USDC are true; they must be a whole number\./],
    [withTokens(USDC, { ...ETH, address: addr('e') }), /Token ETH is native and has an address/],
    [withTokens(USDC, { ...ETH, native: 'yes' }), /The native of token ETH is "yes"; it must be true or false\./],
    [withEscrow({ releaseMode: 'instant' }), /The releaseMode of the escrow is "instant"; it must be one of buyer-confirm, timeout, both\./],
    [withEscrow({ releaseMode: 'buyer-confirm' }), /The escrow releases only when the buyer confirms, so its releaseTimeout is not read/],
    [withEscrow({ releaseTimeout: -5 }), /The releaseTimeout of the escrow is the number -5/],
    [withEscrow({ refundPath: ['seller', 'court'] }), /The refundPath of the escrow names "court"/],
    [withEscrow({ refundPath: 'refund' }), /The refundPath of the escrow names "refund"/],
    [withEscrow({ refundPath: ['seller', 3] }), /An item of the refundPath of the escrow is the number 3/],
    [withEscrow({ refundPath: 3 }), /The refundPath of the escrow is the number 3; it must be a list of seller, arbiter, timeout, or "none"\./],
    [withEscrow({ milestones: 'all' }), /The milestones of the escrow are text; they must be a list of objects\./],
    [withEscrow({ milestones: [{ name: 'A', shareBps: '50%' }, { name: 'B', shareBps: 5000 }] }), /The shareBps of milestone A is "50%"; it must be a whole number of basis points from 0 to 10000/],
    [withEscrow({ termsHash: 'x' }), /The termsHash of the escrow is not a hash of 32 bytes/],
    [withDispute({ arbiters: addr('a') }), /The arbiters of the dispute setup is text; it must be a list of texts\./],
    [withDispute({ arbiters: [addr('a'), addr('b'), addr('c'), 7] }), /An item of the arbiters of the dispute setup is the number 7; it must be text\./],
    [withDispute({ arbiters: [addr('a'), addr('b'), addr('c'), ''] }), /An item of the arbiters of the dispute setup is empty; it must be text\./],
    [withDispute({ quorum: 0 }), /The quorum of the dispute setup is the number 0; it must be a whole number of votes from 1 to 1000\./],
    [withStake({ token: 'DOGE' }), /The token of the stake is "DOGE", which is not the symbol of a token of the file\./],
    [withStake({ amount: '-1' }), /The amount of the stake is "-1"; it must be a plain decimal number of 0 or more/],
    [withStake({ amount: '1.0000001' }), /The amount of the stake has 7 decimal places, but USDC keeps 6\./],
    [withStake({ amount: true }), /The amount of the stake is true; it must be a decimal number/],
    [withPart('limits', { maxOrderValue: '0' }), /The maxOrderValue of the limits is "0"; it must be a plain decimal number above 0/],
    [withRoles({ owner: 5 }), /The owner of the roles is the number 5; it must be text\./],
    [withRoles({ multisig: multisig({ threshold: 0 }) }), /The threshold of the multisig is the number 0; it must be a whole number of signatures from 1 to 100\./],
    [withRoles({ multisig: 'safe' }), /The multisig of the roles is text; it must be an object with its address, threshold and signers\./],
    [withDomain({ chainId: 'one' }), /The chainId of the EIP-712 domain is "one"/],
    [withDomain({ name: 7 }), /The name of the EIP-712 domain is the number 7; it must be text\./]
  ];
  for (const [p, pattern] of cases) assert.ok(messages(p, 'field-invalid').some((m) => pattern.test(m)), `${pattern}: ${JSON.stringify(findingsOf(p).map((f) => f.message))}`);
  assert.ok(ofCheck(withEscrow({ partialRefunds: 'yes' }), 'field-invalid').length === 1);
});

test('field-invalid leaves the value out without a second finding: a mode, a release timeout and a refund path that could not be read', () => {
  assert.deepEqual(idsOf(withEscrow({ releaseMode: 'instant' })), ['field-invalid']);
  assert.deepEqual(idsOf(withEscrow({ refundPath: ['court'] })), ['field-invalid'], 'no no-refund-path when the path could not be read');
  assert.deepEqual(idsOf(withEscrow({ releaseMode: 'buyer-confirm' })).sort(), ['field-invalid', 'release-timeout-missing']);
  assert.deepEqual(idsOf(withDispute({ appealWindow: 'soon' })), ['field-invalid'], 'no appeal-window-missing when it could not be read');
  assert.deepEqual(idsOf(withEscrow({ refundPath: 'Timeout' })), [], 'one path as text, in any case');
  assert.deepEqual(idsOf(withEscrow({ refundPath: ['seller', 'seller', 'arbiter'] })), [], 'a path named twice is one path');
});

test('fee-invalid: a fee that is not a whole number of basis points from 0 to 10000, with near misses', () => {
  for (const bad of ['2.5', '10001', '-1', 'ten', '1e3']) {
    assert.deepEqual(idsOf(withFee({ bps: bad })), ['fee-invalid'], bad);
    assert.deepEqual(idsOf(withDispute({ arbiterFeeBps: bad })), ['fee-invalid'], bad);
  }
  assert.match(messages(withFee({ bps: 2.5 }), 'fee-invalid')[0], /^The bps of the platform fee is "2\.5"; it must be a whole number of basis points from 0 to 10000, where 100 is 1%\.$/);
  for (const ok of [0, 10000, '250', '250.0']) assert.deepEqual(idsOf(withFee({ bps: ok })).filter((id) => id === 'fee-invalid'), [], String(ok));
  assert.deepEqual(idsOf(withFee({ bps: [] })), ['field-invalid'], 'a list is a value of the wrong type');
  assert.deepEqual(idsOf(withFee({ bps: '' })), ['field-missing']);
  assert.deepEqual(idsOf(withDispute({ arbiterFeeBps: undefined })), [], 'an arbiter fee may be left out');
});

test('token-decimals-invalid from the reader: decimals outside 0 to 36 or not whole', () => {
  for (const bad of ['37', 255, '6.5', '-1', '06']) assert.deepEqual(idsOf(withTokens(USDC, ETH, { ...USDC, symbol: 'ABC', address: addr('7'), decimals: bad })), ['token-decimals-invalid'], String(bad));
  for (const ok of [0, 36, '6']) assert.deepEqual(idsOf(withTokens(USDC, ETH, { ...USDC, symbol: 'ABC', address: addr('7'), decimals: ok })), [], String(ok));
  const f = ofCheck(withTokens({ ...USDC, decimals: 40 }, ETH), 'token-decimals-invalid')[0];
  assert.match(f.message, /^The decimals of token USDC are "40"; they must be a whole number from 0 to 36/);
  assert.equal(f.subject, 'USDC');
});

test('the lists are cut at their limits, with a note', () => {
  const tokens = Array.from({ length: 101 }, (_, i) => ({ symbol: `T${i}`, native: true, decimals: 18, chainId: 1 }));
  const r = checkText(text(file({ tokens: [USDC, ...tokens] })));
  assert.ok(r.notes.includes('the file holds 102 tokens; the tool read the first 100 and left the rest out'));
  const arbiters = Array.from({ length: 1001 }, (_, i) => `0x${i.toString(16).padStart(40, '1')}`);
  const d = checkText(text(withDispute({ arbiters })));
  assert.ok(d.notes.includes('the dispute setup lists 1001 arbiters; the tool read the first 1000'));
  assert.equal(d.read.dispute.arbiters.length, 1000);
});

test('readConfig: a top level that is not an object is file-unreadable, and nothing else is read', () => {
  const r = readConfig(readJson('[1]'));
  assert.equal(r.config, null);
  assert.deepEqual(r.findings.map((f) => f.id), ['file-unreadable']);
  assert.match(r.findings[0].message, /The top level of the file is a list, not an object/);
  assert.deepEqual(r.notes, ['the file was not checked, because it holds no object at its top level']);
  assert.deepEqual(idsOf('"x"'), ['file-unreadable']);
});

test('the field readers: amounts, basis points, describe, cut, and a whole number written as text', () => {
  assert.deepEqual(readAmount('-1').state, 'negative');
  assert.deepEqual(readAmount('x').state, 'nan');
  assert.deepEqual(readAmount('0.00').state, 'zero');
  assert.deepEqual(readAmount('1.5').state, 'ok');
  assert.deepEqual(readBps('-0').state, 'ok');
  assert.deepEqual(readBps('-5').state, 'negative');
  assert.deepEqual(readBps('2.5').state, 'fraction');
  assert.deepEqual(readBps('10001').state, 'above');
  assert.deepEqual(readBps('x').state, 'nan');
  assert.equal(readBps('2500.00').value, 2500);
  assert.equal(describe({ kind: 'null' }), 'null');
  assert.equal(describe({ kind: 'number', raw: '1'.repeat(50) }), `the number ${'1'.repeat(37)}...`);
  assert.equal(describe({ kind: 'string', secret: true }), 'a value that is not shown');
  assert.equal(cut('x'.repeat(200)).length, 120);
  assert.equal(new Reader().file, 'config');
  assert.deepEqual(idsOf(file({ chainId: '1' })), [], 'a chain id written as text');
  assert.deepEqual(idsOf(withEscrow({ disputeWindow: String(BASE.escrow.disputeWindow) })), []);
});
