// The checks on what was read: the addresses of every token, role, arbiter and signer, the tokens against the chain, the
// fees, the release and the refund of the escrow, its milestones, the dispute setup, the stake, the roles against the
// multisig, the EIP-712 domain and the limits. Each finding names the line of the field it is about. Times are seconds
// of the file; the tool reads no clock.

import { addressKey, addressProblem, isZeroAddress, knownDecimals } from './addresses.js';
import { ROLES } from './config.js';
import { formatDecimal } from './decimal.js';
import { BEST } from './rules.js';
import { grouped, listText, plural } from './size.js';

export const DEFAULT_MAX_FEE_BPS = 1000;
export const DAY = 86400;

const BP = `This is ${BEST}.`;
const at = (e) => ({ line: e.line, column: e.column });
const shown = (text, max = 60) => (text.length > max ? `${text.slice(0, max - 3)}...` : text);

// A share in basis points as a percent: 250 is 2.5%, 1000 is 10%, 75 is 0.75%.
export function bpsPercent(bps) {
  const whole = Math.floor(bps / 100);
  const rest = String(bps % 100).padStart(2, '0').replace(/0+$/, '');
  return `${whole}${rest ? `.${rest}` : ''}%`;
}

// A share in basis points as a report shows it.
export const bpsText = (bps) => `${grouped(bps)} basis points (${bpsPercent(bps)})`;

// A length in seconds as a report shows it, with the days it makes.
export function secondsText(seconds) {
  const days = Math.floor(seconds / DAY);
  const rest = seconds % DAY;
  const span = days === 0 ? (rest === 0 ? '' : ' (less than a day)') : ` (${rest ? 'more than ' : ''}${plural(days, 'day')})`;
  return `${plural(seconds, 'second')}${span}`;
}

// The checks: { findings, notes, summary }. config may be null when the file could not be read.
export function analyze(config = null, { maxFeeBps = DEFAULT_MAX_FEE_BPS } = {}) {
  const findings = [];
  const notes = [];
  const add = (id, where, message, subject = null) => findings.push({ id, file: 'config', line: where.line, column: where.column, message, subject });
  if (!config) return { findings, notes, summary: null };
  const { chainId, tokens, fee, escrow, dispute, stake, roles, eip712, limits } = config;

  // The form of every address, and the zero address where it loses a role, a token or a fee. valid holds the key of each
  // address that is well formed and not zero, by the object it belongs to.
  const valid = new Map();
  const check = (owner, value, raw, entry, label, zero) => {
    if (value === null) return;
    const problem = addressProblem(raw);
    if (problem) add('address-malformed', at(entry), `${label}, "${shown(value)}", ${problem}; an address is 0x followed by 40 hex digits. ${BP}`);
    else if (isZeroAddress(value)) zero();
    else valid.set(owner, addressKey(value));
  };
  const zeroAt = (entry, label, what) => () => add('zero-address', at(entry), `${label} is the zero address, which no one holds, so ${what}. ${BP}`);
  for (const t of tokens) check(t, t.address, t.addressRaw, t.addressEntry, `The address of token ${t.title}`, zeroAt(t.addressEntry, `The address of token ${t.title}`, 'the token cannot be paid; write "native": true for the currency of the chain'));
  if (fee) check(fee, fee.recipient, fee.recipientRaw, fee.recipientEntry, 'The recipient of the platform fee', () => {
    if (fee.bps !== 0) add('fee-recipient-zero', at(fee.recipientEntry), `The platform fee${fee.bps === null ? '' : ` of ${bpsText(fee.bps)}`} goes to the zero address, which no one holds, so every fee is lost. ${BP}`);
  });
  if (roles) {
    for (const r of ROLES.map(([key]) => roles[key])) check(r, r.value, r.raw, r.entry, `The ${r.name.slice(4)} of the roles`, zeroAt(r.entry, `The ${r.name.slice(4)} of the roles`, 'the role can never act'));
    const ms = roles.multisig;
    if (ms) {
      check(ms, ms.address, ms.addressRaw, ms.addressEntry, 'The address of the multisig', zeroAt(ms.addressEntry, 'The address of the multisig', 'no role it holds can ever act'));
      for (const [i, s] of (ms.signers ?? []).entries()) check(s, s.value, s.raw, s.node, `Signer ${i + 1} of the multisig`, zeroAt(s.node, `Signer ${i + 1} of the multisig`, 'it can never sign'));
    }
  }
  for (const [i, a] of (dispute?.arbiters ?? []).entries()) check(a, a.value, a.raw, a.node, `Arbiter ${i + 1} of the dispute setup`, zeroAt(a.node, `Arbiter ${i + 1} of the dispute setup`, 'it can never rule'));
  if (eip712) check(eip712, eip712.verifyingContract, eip712.verifyingRaw, eip712.verifyingEntry, 'The verifyingContract of the EIP-712 domain', () => add('verifying-contract-zero', at(eip712.verifyingEntry), 'The verifyingContract of the EIP-712 domain is the zero address, though EIP-712 has the field name the contract that checks the signature; no contract is at the zero address, so a signed listing names none.'));

  // The tokens: written twice, of another chain, with decimals of another token.
  const symbols = new Map();
  const addresses = new Map();
  const unknown = [];
  for (const t of tokens) {
    if (t.symbol !== null) {
      const k = t.symbol.toUpperCase();
      if (symbols.has(k)) add('field-duplicate', at(t.symbolEntry), `The symbol ${shown(t.symbol, 20)} is also the symbol of the token at line ${symbols.get(k).symbolEntry.line}; list each token once.`, t.title);
      else symbols.set(k, t);
    }
    const ak = valid.get(t);
    if (ak) {
      if (addresses.has(ak)) add('field-duplicate', at(t.addressEntry), `The address ${shown(t.address, 50)} of token ${t.title} is also the address of token ${addresses.get(ak).title}; list each token once.`, t.title);
      else addresses.set(ak, t);
    }
    if (t.chainId !== null && chainId !== null && t.chainId !== chainId) add('token-chain-mismatch', at(t.chainEntry), `Token ${t.title} is declared on chain id ${t.chainId}, but the escrow is deployed on chain id ${chainId}; the address of a token on one chain is another contract, or none, on the next. ${BP}`, t.title);
    if (t.symbol !== null && t.decimals !== null) {
      const known = knownDecimals(t.symbol);
      if (known === null) unknown.push(shown(t.symbol, 20));
      else if (known !== t.decimals) add('token-decimals-invalid', at(t.decimalsEntry), `Token ${t.title} has ${plural(t.decimals, 'decimal place')}, but ${t.symbol.toUpperCase()} keeps ${known}, so every amount in it would be off by a factor of 10^${Math.abs(known - t.decimals)}. ${BP}`, t.title);
    }
  }
  if (unknown.length) notes.push(`the ${unknown.length === 1 ? 'token' : 'tokens'} ${listText(unknown, 8)} ${unknown.length === 1 ? 'is' : 'are'} not one the tool knows, so ${unknown.length === 1 ? 'its' : 'their'} decimals were checked only against the range of 0 to 36`);

  // The fees.
  const tooHigh = (bps, entry, label) => {
    if (bps !== null && bps > maxFeeBps) add('fee-too-high', at(entry), `${label} is ${bpsText(bps)}, above the ${bpsText(maxFeeBps)} of --max-fee-bps. ${BP}`);
  };
  if (fee) tooHigh(fee.bps, fee.bpsEntry, 'The platform fee');
  if (dispute) tooHigh(dispute.fee.bps, dispute.fee.bpsEntry, 'The arbiter fee');

  // The release and the refund.
  if (escrow) {
    const { mode, releaseTimeout, disputeWindow } = escrow;
    if ((mode === 'timeout' || mode === 'both') && releaseTimeout !== null && disputeWindow !== null && releaseTimeout <= disputeWindow) {
      add('release-before-dispute-window', at(escrow.releaseEntry), `The escrow releases funds after ${secondsText(releaseTimeout)}, ${releaseTimeout === disputeWindow ? 'the moment' : 'before'} its dispute window of ${secondsText(disputeWindow)} closes, so the seller can be paid before the buyer had the whole window to open a dispute. ${BP}`);
    }
    if (mode === 'buyer-confirm') add('release-timeout-missing', at(escrow.modeEntry), `The escrow releases funds only when the buyer confirms, with no release by time, so a buyer who never confirms and never disputes keeps the funds locked for good. ${BP}`);
    const r = escrow.refund;
    if (!r.invalid && r.paths.length === 0) {
      const why = r.missing ? 'names no refundPath' : r.none ? 'names "none" as its refundPath' : 'lists no refund path';
      add('no-refund-path', at(r.entry ?? escrow.entry), `The escrow ${why}, so funds of an order that fails can only go to the seller or stay locked. ${BP}`);
    }

    // The milestones.
    const ms = escrow.milestones;
    if (ms) {
      const names = new Map();
      for (const x of ms) {
        if (x.name === null) continue;
        const k = x.name.toLowerCase();
        if (names.has(k)) add('field-duplicate', at(x.nameEntry), `The milestone name ${shown(x.name, 40)} is also the name of the milestone at line ${names.get(k).nameEntry.line}; give every milestone a name of its own.`, x.title);
        else names.set(k, x);
      }
      if (escrow.milestonesEmpty) add('milestone-empty', at(escrow.milestonesEntry), `The milestones of the escrow are an empty list, so no step releases anything; leave milestones out for an order paid in one release. ${BP}`);
      for (const x of ms) if (x.share === 0) add('milestone-empty', at(x.shareEntry), `Milestone ${x.title} has a share of 0, so it releases nothing. ${BP}`, x.title);
      if (ms.length > 0 && ms.every((x) => !x.shareInvalid)) {
        const total = ms.reduce((n, x) => n + x.share, 0);
        if (total !== 10000) add('milestone-shares-not-100', at(escrow.milestonesEntry), `The shares of the ${plural(ms.length, 'milestone')} of the escrow add up to ${bpsText(total)}, not 10,000 basis points (100%), so ${total < 10000 ? `${bpsText(10000 - total)} of every order is never released` : `${bpsText(total - 10000)} more than the order is released`}. ${BP}`);
      }
    }
  }

  // The dispute setup.
  const roleList = roles ? ROLES.map(([key]) => roles[key]) : [];
  if (dispute) {
    const seen = new Map();
    const arbiters = [];
    for (const [i, a] of (dispute.arbiters ?? []).entries()) {
      const k = valid.get(a) ?? addressKey(a.value);
      if (seen.has(k)) add('field-duplicate', at(a.node), `Arbiter ${i + 1} of the dispute setup, ${shown(a.value, 50)}, is also arbiter ${seen.get(k)}; it was counted once.`);
      else {
        seen.set(k, i + 1);
        arbiters.push(a);
      }
    }
    const count = arbiters.length;
    const { panel, quorum } = dispute;
    if (quorum !== null && panel !== null && quorum > panel) add('quorum-unreachable', at(dispute.quorumEntry), `The quorum of a dispute is ${plural(quorum, 'vote')}, but a panel holds ${plural(panel, 'arbiter')}, so no dispute can ever be decided and its funds stay locked. ${BP}`);
    else if (panel !== null && dispute.arbiters !== null && count > 0 && panel > count) add('quorum-unreachable', at(dispute.panelEntry), `A panel of a dispute holds ${plural(panel, 'arbiter')}, but the dispute setup lists ${plural(count, 'arbiter')}, so no panel can ever be filled and the funds of a dispute stay locked. ${BP}`);
    if (count === 1 || panel === 1) add('single-arbiter', at(count === 1 ? dispute.arbitersEntry : dispute.panelEntry), `${count === 1 ? 'The dispute setup lists one arbiter' : 'A panel of a dispute holds one arbiter'}, so one person decides every dispute alone. ${BP}`);
    if (dispute.appeal === null && !dispute.appealInvalid) add('appeal-window-missing', at(dispute.entry), `The dispute setup gives no appealWindow, so a ruling is final at once. ${BP}`);
    else if (dispute.appeal === 0) add('appeal-window-missing', at(dispute.appealEntry), `The appeal window of the dispute setup is 0 seconds, so a ruling is final at once. ${BP}`);

    // An arbiter who is paid from the marketplace or holds a role of its contracts.
    const parties = [[fee, 'the recipient of the platform fee'], [roles?.treasury, 'the treasury']].filter(([o]) => o && valid.has(o));
    const admins = [...roleList.filter((r) => r.key !== 'treasury'), ...(roles?.multisig ? [roles.multisig] : [])].filter((o) => valid.has(o));
    for (const [i, a] of (dispute.arbiters ?? []).entries()) {
      const k = valid.get(a);
      if (!k || seen.get(k) !== i + 1) continue;
      const party = parties.filter(([o]) => valid.get(o) === k).map(([, name]) => name);
      if (party.length) add('arbiter-is-party', at(a.node), `Arbiter ${i + 1} of the dispute setup, ${shown(a.value, 50)}, is also ${listText(party)}, so it rules on disputes over money it is paid from. ${BP}`);
      const admin = admins.filter((o) => valid.get(o) === k).map((o) => (o.key ? o.name : 'the multisig'));
      if (admin.length) add('arbiter-is-admin', at(a.node), `Arbiter ${i + 1} of the dispute setup, ${shown(a.value, 50)}, is also ${listText(admin, 8)} of the escrow, so one party can both rule on a dispute and change the rules. ${BP}`);
    }
  }

  // The stake.
  if (stake) {
    if (stake.slashText !== null && stake.slash === null) add('stake-slash-invalid', at(stake.slashEntry), `The slashBps of the stake is "${shown(stake.slashText, 40)}"; it must be a whole number of basis points from 0 to 10000 of the stake. ${BP}`);
    else if (stake.slash !== null && stake.slash > 0 && stake.value !== null && stake.value.int === 0n) add('stake-slash-invalid', at(stake.slashEntry), `The stake slashes ${bpsText(stake.slash)} of a stake of 0, so a seller who breaks the rules loses nothing. ${BP}`);
  }

  // The roles against the multisig and the timelock.
  if (roles) {
    const ms = roles.multisig;
    const msKey = ms ? (valid.get(ms) ?? null) : null;
    const tlKey = valid.get(roles.timelock) ?? null;
    for (const key of ['owner', 'upgrader', 'feeSetter', 'treasury']) {
      const r = roles[key];
      const k = valid.get(r);
      if (!k || k === msKey || (key === 'upgrader' && k === tlKey)) continue;
      const what = { owner: 'can change every rule of the escrow', upgrader: 'can replace the code of the escrow', feeSetter: 'can raise the fee on every order', treasury: 'holds the fees of the marketplace' }[key];
      add('admin-single-key', at(r.entry), `${r.name[0].toUpperCase()}${r.name.slice(1)} of the escrow, ${shown(r.value, 50)}, is not the multisig of the file${ms ? '' : ', which names none'}${key === 'upgrader' ? ' or its timelock' : ''}, so one key ${what}. The ethereum.org page on smart contract security calls one owner key a single point of failure and suggests a multi-signature account.`);
    }
    if (ms) {
      const seen = new Set();
      let count = 0;
      for (const s of ms.signers ?? []) {
        const k = valid.get(s) ?? addressKey(s.value);
        if (seen.has(k)) add('field-duplicate', at(s.node), `The signer ${shown(s.value, 50)} of the multisig is listed twice; it was counted once.`);
        else {
          seen.add(k);
          count += 1;
        }
      }
      if (ms.threshold === 1) add('multisig-threshold-low', at(ms.thresholdEntry), `The multisig needs only 1 signature${count ? ` of its ${plural(count, 'signer')}` : ''}, so any one signer acts alone, though a multi-signature account is meant to need the consent of more than one party.`);
      if (ms.threshold !== null && ms.signers && count > 0 && ms.threshold > count) add('multisig-threshold-unreachable', at(ms.thresholdEntry), `The multisig needs ${plural(ms.threshold, 'signature')} but lists ${plural(count, 'signer')}, so it can never act. ${BP}`);
    }
    const up = roles.upgrader;
    if (valid.has(up) && valid.get(up) !== tlKey) add('upgrader-without-timelock', at(up.entry), `The upgrader of the escrow, ${shown(up.value, 50)}, is not ${tlKey ? 'the timelock of the roles' : 'a timelock, and the roles name none'}, so an upgrade takes effect at once and users cannot leave first. ${BP}`);
  }

  // The EIP-712 domain.
  if (eip712) {
    if (eip712.chainId !== null && chainId !== null && eip712.chainId !== chainId) add('eip712-domain-chain-mismatch', at(eip712.chainEntry), `The chainId of the EIP-712 domain is ${eip712.chainId}, but the escrow is deployed on chain id ${chainId}. EIP-712 has a wallet decline to sign when the chainId of the domain is not the one of the active chain, so listings would be refused or signed for another chain.`);
    if (eip712.absent.length) add('eip712-domain-missing-field', at(eip712.entry), `The EIP-712 domain has no ${listText(eip712.absent, 8)}, so a listing signed in it is not bound to ${listText(eip712.absent.map((k) => ({ name: 'this marketplace', version: 'this version', chainId: 'this chain', verifyingContract: 'this contract' })[k]), 8)}. ${BP}`);
  }

  // The limits.
  if (!limits || !limits.maxOrder) add('max-order-missing', at(limits ? limits.entry : config.root), `The file sets no limits.maxOrderValue, so one order can lock any amount in the escrow. ${BP}`);

  if (!stake) notes.push('the file declares no stake of a seller, so stake-slash-invalid did not run');

  // What the file says, for the report.
  const roleRows = [];
  if (roles) {
    const msKey = roles.multisig ? (valid.get(roles.multisig) ?? null) : null;
    const tlKey = valid.get(roles.timelock) ?? null;
    for (const r of roleList) {
      const k = valid.get(r);
      const held = r.value === null ? null : !k ? (addressProblem(r.raw) ? 'malformed address' : 'zero address') : r.key === 'timelock' ? 'timelock' : k === msKey ? 'multisig' : k === tlKey ? 'timelock' : 'one key';
      roleRows.push({ role: r.name.slice(4), address: r.value, heldBy: held });
    }
    const ms = roles.multisig;
    if (ms) roleRows.push({ role: 'multisig', address: ms.address, heldBy: ms.threshold === null || !ms.signers ? 'not read' : `${ms.threshold} of ${plural(ms.signers.length, 'signer')}` });
  }
  const summary = {
    chainId,
    tokens: tokens.map((t) => ({ symbol: t.title, address: t.native ? 'native' : t.address, decimals: t.decimals, chainId: t.chainId })),
    fee: fee ? { bps: fee.bps, percent: fee.bps === null ? null : bpsPercent(fee.bps), recipient: fee.recipient } : null,
    escrow: escrow ? { releaseMode: escrow.mode, releaseTimeout: escrow.releaseTimeout, disputeWindow: escrow.disputeWindow, refundPath: escrow.refund.none ? 'none' : escrow.refund.paths, partialRefunds: escrow.partialRefunds, milestones: escrow.milestones ? escrow.milestones.map((x) => ({ name: x.name === null ? `milestone ${x.index}` : x.title, shareBps: x.share })) : null } : null,
    dispute: dispute ? { arbiters: dispute.arbiters === null ? null : dispute.arbiters.length, panelSize: dispute.panel, quorum: dispute.quorum, arbiterFeeBps: dispute.fee.bps, appealWindow: dispute.appeal } : null,
    stake: stake ? { amount: stake.value === null ? null : formatDecimal(stake.value), token: stake.token ? stake.token.title : null, slashBps: stake.slash } : null,
    eip712: eip712 ? { name: eip712.name, version: eip712.version, chainId: eip712.chainId, verifyingContract: eip712.verifyingContract } : null,
    maxOrder: limits && limits.maxOrder && limits.maxOrder.value !== null ? { value: formatDecimal(limits.maxOrder.value), token: limits.maxOrder.token ? limits.maxOrder.token.title : null } : null,
    roles: roleRows
  };
  return { findings, notes, summary };
}
