import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BEST, DAY as SRC_DAY, RULES, analyze, atOrAbove, bpsPercent, bpsText, checkText, decide, ruleById, secondsText } from '../src/index.js';
import { BASE, DAY, ETH, MULTISIG, TIMELOCK, USDC, WEEK, addr, file, idsOf, lineOf, multisig, ofCheck, text, withDispute, withDomain, withEscrow, withFee, withPart, withRoles, withStake, withTokens } from './helpers.js';

const only = (p, id, options) => assert.deepEqual(idsOf(p, options), [id], `${id}: ${JSON.stringify(idsOf(p, options))}`);
const none = (p, options) => assert.deepEqual(idsOf(p, options), [], JSON.stringify(idsOf(p, options)));
const BP = `This is ${BEST}.`;

test('the rules: unique ids, three levels, three kinds, a fix for each, and an own choice for every best practice', () => {
  assert.equal(RULES.length, 32);
  assert.equal(new Set(RULES.map((r) => r.id)).size, RULES.length);
  for (const r of RULES) {
    assert.ok(['error', 'warning', 'info'].includes(r.severity), r.id);
    assert.ok(['documented', 'best practice', 'input'].includes(r.kind), r.id);
    assert.ok(r.fix.length > 20 && r.summary.length > 20, r.id);
  }
  assert.deepEqual(RULES.filter((r) => r.kind === 'documented').map((r) => r.id), ['admin-single-key', 'multisig-threshold-low', 'eip712-domain-chain-mismatch', 'verifying-contract-zero']);
  assert.equal(ruleById('nothing'), undefined);
  assert.ok(atOrAbove('error', 'warning') && !atOrAbove('info', 'warning'));
  assert.equal(decide({ error: 0, warning: 1, info: 0 }, 'error').text, 'PASS - no finding at or above error (1 warning)');
  assert.equal(decide({ error: 2, warning: 0, info: 1 }, 'warning').text, 'FAIL - 2 findings at or above warning (2 error, 1 info)');
  assert.equal(decide({ error: 0, warning: 0, info: 1 }, 'info').text, 'FAIL - 1 finding at or above info (1 info)');
  assert.equal(decide({}, 'error').text, 'PASS - no finding at or above error');
});

test('the helpers of the messages: basis points, percents and seconds', () => {
  assert.equal(bpsPercent(250), '2.5%');
  assert.equal(bpsPercent(75), '0.75%');
  assert.equal(bpsPercent(1000), '10%');
  assert.equal(bpsText(10000), '10,000 basis points (100%)');
  assert.equal(secondsText(WEEK), '604,800 seconds (7 days)');
  assert.equal(secondsText(DAY + 1), '86,401 seconds (more than 1 day)');
  assert.equal(secondsText(60), '60 seconds (less than a day)');
  assert.equal(secondsText(0), '0 seconds');
  assert.equal(SRC_DAY, DAY);
  assert.deepEqual(analyze(null), { findings: [], notes: [], summary: null });
});

test('release-before-dispute-window: a release by time at or before the end of the dispute window, with near misses', () => {
  only(withEscrow({ releaseTimeout: 3 * DAY }), 'release-before-dispute-window');
  only(withEscrow({ releaseMode: 'timeout', releaseTimeout: WEEK }), 'release-before-dispute-window');
  none(withEscrow({ releaseTimeout: WEEK + 1 }));
  const p = withEscrow({ releaseTimeout: WEEK });
  const f = ofCheck(p, 'release-before-dispute-window')[0];
  assert.equal(f.line, lineOf(text(p), '"releaseTimeout"'));
  assert.equal(f.message, `The escrow releases funds after 604,800 seconds (7 days), the moment its dispute window of 604,800 seconds (7 days) closes, so the seller can be paid before the buyer had the whole window to open a dispute. ${BP}`);
  assert.match(ofCheck(withEscrow({ releaseTimeout: DAY }), 'release-before-dispute-window')[0].message, /86,400 seconds \(1 day\), before its dispute window/);
});

test('release-timeout-missing: a release by the buyer alone, and not with a timeout', () => {
  const p = withEscrow({ releaseMode: 'buyer-confirm', releaseTimeout: undefined });
  only(p, 'release-timeout-missing');
  assert.equal(ofCheck(p, 'release-timeout-missing')[0].line, lineOf(text(p), '"releaseMode"'));
  none(withEscrow({ releaseMode: 'timeout' }));
});

test('no-refund-path: no refund path, "none" or an empty list, with near misses', () => {
  for (const [over, why] of [[{ refundPath: undefined }, 'names no refundPath'], [{ refundPath: 'none' }, 'names "none" as its refundPath'], [{ refundPath: ' None ' }, 'names "none" as its refundPath'], [{ refundPath: [] }, 'lists no refund path']]) {
    const f = ofCheck(withEscrow(over), 'no-refund-path');
    assert.equal(f.length, 1, why);
    assert.equal(f[0].message, `The escrow ${why}, so funds of an order that fails can only go to the seller or stay locked. ${BP}`);
  }
  none(withEscrow({ refundPath: ['timeout'] }));
  none(withEscrow({ refundPath: 'arbiter' }));
});

test('fee-too-high: a platform or arbiter fee above --max-fee-bps, with near misses on each side', () => {
  only(withFee({ bps: 1001 }), 'fee-too-high');
  none(withFee({ bps: 1000 }));
  only(withDispute({ arbiterFeeBps: 1500 }), 'fee-too-high');
  none(withFee({ bps: 1500 }), { maxFeeBps: 1500 });
  only(file(), 'fee-too-high', { maxFeeBps: 200 });
  assert.equal(ofCheck(withFee({ bps: 1001 }), 'fee-too-high')[0].message, `The platform fee is 1,001 basis points (10.01%), above the 1,000 basis points (10%) of --max-fee-bps. ${BP}`);
  assert.match(ofCheck(withDispute({ arbiterFeeBps: 1500 }), 'fee-too-high')[0].message, /^The arbiter fee is 1,500 basis points/);
});

test('fee-recipient-zero: a fee above 0 to the zero address, and not for a fee of 0 or one not read', () => {
  const p = withFee({ recipient: addr('0') });
  only(p, 'fee-recipient-zero');
  assert.equal(ofCheck(p, 'fee-recipient-zero')[0].line, lineOf(text(p), '"recipient"'));
  none(withFee({ bps: 0, recipient: addr('0') }));
  assert.match(ofCheck(withFee({ bps: 'x', recipient: addr('0') }), 'fee-recipient-zero')[0].message, /^The platform fee goes to the zero address/);
  only(withFee({ recipient: '0x0' }), 'address-malformed');
});

test('milestones: shares that are not the whole order, an empty list, a share of 0, and names written twice', () => {
  const ms = (...shares) => withEscrow({ milestones: shares.map((s, i) => ({ name: `M${i + 1}`, shareBps: s })) });
  only(ms(5000, 4999), 'milestone-shares-not-100');
  only(ms(5000, 5001), 'milestone-shares-not-100');
  none(ms(5000, 5000));
  none(ms(10000));
  assert.match(ofCheck(ms(5000, 4999), 'milestone-shares-not-100')[0].message, /add up to 9,999 basis points \(99\.99%\), not 10,000 basis points \(100%\), so 1 basis points \(0\.01%\) of every order is never released/);
  assert.match(ofCheck(ms(6000, 6000), 'milestone-shares-not-100')[0].message, /so 2,000 basis points \(20%\) more than the order is released/);
  assert.deepEqual(idsOf(ms(10000, 0)), ['milestone-empty']);
  assert.deepEqual(idsOf(ms(5000, 0)).sort(), ['milestone-empty', 'milestone-shares-not-100']);
  const empty = withEscrow({ milestones: [] });
  only(empty, 'milestone-empty');
  assert.match(ofCheck(empty, 'milestone-empty')[0].message, /^The milestones of the escrow are an empty list/);
  none(withEscrow({ milestones: undefined }));
  const twice = withEscrow({ milestones: [{ name: 'Build', shareBps: 5000 }, { name: 'build', shareBps: 5000 }] });
  only(twice, 'field-duplicate');
  assert.match(ofCheck(twice, 'field-duplicate')[0].message, /^The milestone name build is also the name of the milestone at line \d+/);
});

test('quorum-unreachable: a quorum above the panel, or a panel above the arbiters, with near misses', () => {
  only(withDispute({ quorum: 4 }), 'quorum-unreachable');
  none(withDispute({ quorum: 3 }));
  only(withDispute({ panelSize: 6, quorum: 4 }), 'quorum-unreachable');
  none(withDispute({ panelSize: 5, quorum: 3 }));
  assert.match(ofCheck(withDispute({ panelSize: 6, quorum: 4 }), 'quorum-unreachable')[0].message, /^A panel of a dispute holds 6 arbiters, but the dispute setup lists 5 arbiters/);
  const twice = withDispute({ arbiters: [addr('a'), addr('a'), addr('b')], panelSize: 3 });
  assert.deepEqual(idsOf(twice).sort(), ['field-duplicate', 'quorum-unreachable'], 'an arbiter listed twice is counted once');
  assert.deepEqual(idsOf(withDispute({ arbiters: [], panelSize: 3 })), ['field-missing'], 'no panel is compared with no arbiters');
});

test('single-arbiter: one arbiter, or a panel of one, with a near miss', () => {
  const one = withDispute({ arbiters: [addr('a')], panelSize: 1, quorum: 1 });
  only(one, 'single-arbiter');
  assert.match(ofCheck(one, 'single-arbiter')[0].message, /^The dispute setup lists one arbiter, so one person decides every dispute alone\./);
  only(withDispute({ panelSize: 1, quorum: 1 }), 'single-arbiter');
  assert.equal(ofCheck(withDispute({ panelSize: 1, quorum: 1 }), 'single-arbiter')[0].message.startsWith('A panel of a dispute holds one arbiter'), true);
  none(withDispute({ arbiters: [addr('a'), addr('b')], panelSize: 2, quorum: 2 }));
});

test('arbiter-is-party and arbiter-is-admin: an arbiter paid by the marketplace or holding a role', () => {
  const arbiters = (...a) => withDispute({ arbiters: [...a, addr('c'), addr('d'), addr('e')] });
  assert.deepEqual(idsOf(arbiters(MULTISIG, addr('b'))).sort(), ['arbiter-is-admin', 'arbiter-is-party']);
  const p = ofCheck(arbiters(MULTISIG, addr('b')), 'arbiter-is-party')[0];
  assert.match(p.message, /^Arbiter 1 of the dispute setup, 0x2{40}, is also the recipient of the platform fee and the treasury, so it rules on disputes over money it is paid from\./);
  assert.match(ofCheck(arbiters(MULTISIG, addr('b')), 'arbiter-is-admin')[0].message, /is also the owner, the fee setter and the multisig of the escrow/);
  const both = idsOf(file({ roles: { ...BASE.roles, treasury: addr('b') }, dispute: { ...BASE.dispute, arbiters: [addr('5'), addr('b'), TIMELOCK, addr('d'), addr('e')] } }));
  assert.deepEqual(both.sort(), ['admin-single-key', 'arbiter-is-admin', 'arbiter-is-admin', 'arbiter-is-party']);
  const named = ofCheck(file({ dispute: { ...BASE.dispute, arbiters: [TIMELOCK, addr('b'), addr('c'), addr('d'), addr('e')] } }), 'arbiter-is-admin')[0];
  assert.match(named.message, /^Arbiter 1 of the dispute setup, 0x9{40}, is also the upgrader and the timelock of the escrow, so one party can both rule on a dispute and change the rules\./);
  const ms = ofCheck(file({ roles: { ...BASE.roles, owner: addr('1'), feeSetter: addr('1'), treasury: addr('1') }, platformFee: { bps: 250, recipient: addr('1') }, dispute: { ...BASE.dispute, arbiters: [MULTISIG, addr('b'), addr('c')] } }), 'arbiter-is-admin')[0];
  assert.match(ms.message, /is also the multisig of the escrow/);
  only(withDispute({ arbiters: [addr('a'), addr('a'), addr('b'), addr('c')] }), 'field-duplicate');
  none(file());
});

test('appeal-window-missing: no appeal window or one of 0 seconds, with a near miss', () => {
  const p = withDispute({ appealWindow: undefined });
  only(p, 'appeal-window-missing');
  assert.equal(ofCheck(p, 'appeal-window-missing')[0].line, lineOf(text(p), '"dispute"'));
  only(withDispute({ appealWindow: 0 }), 'appeal-window-missing');
  assert.match(ofCheck(withDispute({ appealWindow: 0 }), 'appeal-window-missing')[0].message, /^The appeal window of the dispute setup is 0 seconds/);
  none(withDispute({ appealWindow: 1 }));
});

test('stake-slash-invalid: a slash share outside 0 to 10000 or on a stake of 0, with near misses', () => {
  for (const bad of [10001, '50.5', '-1', 'half']) only(withStake({ slashBps: bad }), 'stake-slash-invalid');
  for (const ok of [0, 10000]) none(withStake({ slashBps: ok }));
  only(withStake({ amount: '0' }), 'stake-slash-invalid');
  assert.match(ofCheck(withStake({ amount: '0' }), 'stake-slash-invalid')[0].message, /^The stake slashes 5,000 basis points \(50%\) of a stake of 0/);
  none(withStake({ amount: '0', slashBps: 0 }));
  none(withStake({ amount: '0.000001' }));
  assert.deepEqual(idsOf(withStake({ slashBps: [] })), ['field-invalid']);
});

test('admin-single-key: each of the owner, upgrader, fee setter and treasury that is not the multisig, and not the pauser', () => {
  for (const key of ['owner', 'feeSetter', 'treasury']) {
    const p = withRoles({ [key]: addr('1') });
    only(p, 'admin-single-key');
    assert.equal(ofCheck(p, 'admin-single-key')[0].line, lineOf(text(p), `"${key}"`));
  }
  assert.deepEqual(idsOf(withRoles({ upgrader: addr('1') })).sort(), ['admin-single-key', 'upgrader-without-timelock']);
  none(withRoles({ upgrader: MULTISIG, timelock: MULTISIG }));
  none(withRoles({ pauser: addr('1') }));
  const nomulti = withRoles({ multisig: undefined });
  assert.equal(ofCheck(nomulti, 'admin-single-key').length, 3, 'the owner, the fee setter and the treasury; the upgrader is the timelock');
  assert.match(ofCheck(nomulti, 'admin-single-key')[0].message, /^The owner of the escrow, 0x2{40}, is not the multisig of the file, which names none, so one key can change every rule of the escrow\. The ethereum\.org page on smart contract security calls one owner key a single point of failure/);
  assert.match(ofCheck(withRoles({ treasury: addr('1') }), 'admin-single-key')[0].message, /so one key holds the fees of the marketplace/);
  assert.match(ofCheck(withRoles({ feeSetter: addr('1') }), 'admin-single-key')[0].message, /so one key can raise the fee on every order/);
  assert.match(ofCheck(withRoles({ upgrader: addr('1') }), 'admin-single-key')[0].message, /is not the multisig of the file or its timelock, so one key can replace the code of the escrow/);
});

test('multisig-threshold-low and multisig-threshold-unreachable: a threshold of 1, and above the signers, with near misses', () => {
  const low = withRoles({ multisig: multisig({ threshold: 1 }) });
  only(low, 'multisig-threshold-low');
  assert.equal(ofCheck(low, 'multisig-threshold-low')[0].message, 'The multisig needs only 1 signature of its 5 signers, so any one signer acts alone, though a multi-signature account is meant to need the consent of more than one party.');
  none(withRoles({ multisig: multisig({ threshold: 2 }) }));
  only(withRoles({ multisig: multisig({ threshold: 6 }) }), 'multisig-threshold-unreachable');
  none(withRoles({ multisig: multisig({ threshold: 5 }) }));
  const twice = withRoles({ multisig: multisig({ threshold: 5, signers: [addr('3'), addr('3'), addr('4'), addr('6'), addr('7')] }) });
  assert.deepEqual(idsOf(twice).sort(), ['field-duplicate', 'multisig-threshold-unreachable'], 'a signer listed twice is counted once');
  assert.match(ofCheck(withRoles({ multisig: multisig({ threshold: 1, signers: [] }) }), 'multisig-threshold-low')[0].message, /^The multisig needs only 1 signature, so/);
});

test('upgrader-without-timelock: an upgrader that is not the timelock, with or without one', () => {
  const p = withRoles({ upgrader: MULTISIG });
  only(p, 'upgrader-without-timelock');
  assert.match(ofCheck(p, 'upgrader-without-timelock')[0].message, /is not the timelock of the roles, so an upgrade takes effect at once/);
  assert.match(ofCheck(withRoles({ upgrader: MULTISIG, timelock: undefined }), 'upgrader-without-timelock')[0].message, /is not a timelock, and the roles name none/);
  none(withRoles({ upgrader: undefined }));
});

test('the EIP-712 domain: another chain id, missing fields and a zero verifying contract', () => {
  const p = withDomain({ chainId: 10 });
  only(p, 'eip712-domain-chain-mismatch');
  assert.equal(ofCheck(p, 'eip712-domain-chain-mismatch')[0].line, lineOf(text(p), '"chainId": 10'));
  none(withDomain({ chainId: 1 }));
  none(file({ chainId: 10, eip712: { ...BASE.eip712, chainId: 10 }, tokens: [{ ...USDC, chainId: 10 }, { ...ETH, chainId: 10 }] }));
  const missing = withDomain({ name: undefined, version: '', chainId: undefined, verifyingContract: undefined });
  only(missing, 'eip712-domain-missing-field');
  assert.equal(ofCheck(missing, 'eip712-domain-missing-field')[0].message, `The EIP-712 domain has no name, version, chainId and verifyingContract, so a listing signed in it is not bound to this marketplace, this version, this chain and this contract. ${BP}`);
  assert.deepEqual(idsOf(withDomain({ name: 7 })), ['field-invalid'], 'a name of the wrong type is not also missing');
  const zero = withDomain({ verifyingContract: addr('0') });
  only(zero, 'verifying-contract-zero');
  assert.match(ofCheck(zero, 'verifying-contract-zero')[0].message, /^The verifyingContract of the EIP-712 domain is the zero address, though EIP-712 has the field name the contract that checks the signature/);
  only(withDomain({ verifyingContract: 'contract' }), 'address-malformed');
});

test('token-chain-mismatch and token-decimals-invalid: a token of another chain, and decimals of another token', () => {
  const p = withTokens({ ...USDC, chainId: 137 }, ETH);
  only(p, 'token-chain-mismatch');
  assert.match(ofCheck(p, 'token-chain-mismatch')[0].message, /^Token USDC is declared on chain id 137, but the escrow is deployed on chain id 1/);
  only(withTokens({ ...USDC, decimals: 18 }, ETH), 'token-decimals-invalid');
  assert.match(ofCheck(withTokens(USDC, { ...ETH, decimals: 9 }), 'token-decimals-invalid')[0].message, /^Token ETH has 9 decimal places, but ETH keeps 18, so every amount in it would be off by a factor of 10\^9\./);
  const unknown = checkText(text(withTokens(USDC, ETH, { symbol: 'EXAMPLE', address: addr('7'), decimals: 4, chainId: 1 })));
  assert.deepEqual(unknown.findings, []);
  assert.ok(unknown.notes.includes('the token EXAMPLE is not one the tool knows, so its decimals were checked only against the range of 0 to 36'));
  const two = checkText(text(withTokens(USDC, ETH, { symbol: 'AAA', native: true, decimals: 4, chainId: 1 }, { symbol: 'BBB', native: true, decimals: 4, chainId: 1 })));
  assert.ok(two.notes.some((n) => n.startsWith('the tokens AAA and BBB are not one the tool knows, so their decimals')));
});

test('field-duplicate of tokens: one symbol or one address listed twice', () => {
  const sym = withTokens(USDC, ETH, { ...USDC, symbol: 'usdc', address: addr('7') });
  only(sym, 'field-duplicate');
  assert.match(ofCheck(sym, 'field-duplicate')[0].message, /^The symbol usdc is also the symbol of the token at line \d+; list each token once\./);
  const ad = withTokens(USDC, ETH, { ...USDC, symbol: 'USDT' });
  only(ad, 'field-duplicate');
  assert.match(ofCheck(ad, 'field-duplicate')[0].message, /^The address 0x8{40} of token USDT is also the address of token USDC/);
});

test('address-malformed and zero-address: every kind of address, each at its line', () => {
  const cases = [
    [withTokens({ ...USDC, address: addr('0') }, ETH), 'zero-address', /^The address of token USDC is the zero address/],
    [withRoles({ pauser: addr('0') }), 'zero-address', /^The pauser of the roles is the zero address, which no one holds, so the role can never act\./],
    [withRoles({ timelock: addr('0'), upgrader: MULTISIG }), 'zero-address', /^The timelock of the roles is the zero address/],
    [withRoles({ multisig: multisig({ signers: [addr('3'), addr('4'), addr('0')] }) }), 'zero-address', /^Signer 3 of the multisig is the zero address, which no one holds, so it can never sign\./],
    [withDispute({ arbiters: [addr('a'), addr('b'), addr('0')] }), 'zero-address', /^Arbiter 3 of the dispute setup is the zero address/],
    [withRoles({ pauser: '0x55' }), 'address-malformed', /^The pauser of the roles, "0x55", has 2 characters after 0x, not 40/],
    [withRoles({ multisig: multisig({ signers: [addr('3'), addr('4'), 'x'] }) }), 'address-malformed', /^Signer 3 of the multisig, "x", does not start with 0x/],
    [withDispute({ arbiters: [addr('a'), addr('b'), `0x${'g'.repeat(40)}`] }), 'address-malformed', /^Arbiter 3 of the dispute setup, "0xg+", holds a character that is not a hex digit/],
    [withTokens({ ...USDC, address: ` ${addr('8')}` }, ETH), 'address-malformed', /^The address of token USDC, "0x8{40}", has spaces around it/]
  ];
  for (const [p, id, pattern] of cases) {
    const f = ofCheck(p, id);
    assert.equal(f.length, 1, `${id} ${pattern}`);
    assert.match(f[0].message, pattern);
  }
  const ms = withRoles({ multisig: multisig({ address: addr('0') }) });
  assert.ok(idsOf(ms).includes('zero-address'));
  assert.equal(ofCheck(ms, 'admin-single-key').length, 3, 'with a zero multisig every role is held by one key');
  assert.deepEqual(idsOf(withRoles({ owner: addr('0') })), ['zero-address'], 'a zero owner is not also a single key');
});

test('max-order-missing: no limits, or limits with no largest order, with a near miss', () => {
  const p = file({ limits: undefined });
  only(p, 'max-order-missing');
  assert.equal(ofCheck(p, 'max-order-missing')[0].line, 1);
  const q = withPart('limits', { maxOrderValue: undefined, token: undefined, notes: 'x' });
  only(q, 'max-order-missing');
  assert.equal(ofCheck(q, 'max-order-missing')[0].line, lineOf(text(q), '"limits"'));
  none(withPart('limits', { maxOrderValue: '0.5' }));
});

test('every best practice message says so, and every documented message names its page', () => {
  const p = file({ chainId: 10, roles: { ...BASE.roles, owner: addr('1'), multisig: multisig({ threshold: 1 }) }, eip712: { ...BASE.eip712, verifyingContract: addr('0') } });
  for (const f of checkText(text(p)).findings) {
    const rule = ruleById(f.id);
    if (rule.kind === 'best practice') assert.ok(f.message.includes(BP), f.id);
    if (rule.kind === 'documented') assert.match(f.message, /EIP-712|ethereum\.org|multi-signature/, f.id);
  }
});
