// Reading the escrow configuration of a peer to peer marketplace from the nodes of the JSON reader: the chain id, the
// payment tokens, the platform fee, the escrow rules with their milestones, the dispute setup, the stake of a seller,
// the roles with their multisig, the EIP-712 domain of signed listings and the limits. Every field is read with the line
// and column of its key. A field that is missing, of the wrong type or unknown is a finding of its own, and the value is
// left out of the checks that need it; nothing that was not read is taken for a value that is fine. Times are whole
// numbers of seconds of the file; the tool reads no clock.

import { MAX_DECIMALS } from './addresses.js';
import { placesOf } from './decimal.js';
import { Reader, cut, describe, readAmount, readBps, where } from './fields.js';
import { isArray, isNumber, isObject, isString } from './json.js';

export const CONFIG_LIMITS = { maxWhole: 999999999999, maxTokens: 100, maxMilestones: 100, maxArbiters: 1000, maxSigners: 100, maxMembers: 1000 };

export const TOP_KEYS = ['chainId', 'tokens', 'platformFee', 'escrow', 'dispute', 'stake', 'roles', 'eip712', 'limits', 'notes'];
export const TOKEN_KEYS = ['symbol', 'address', 'decimals', 'chainId', 'native', 'notes'];
export const FEE_KEYS = ['bps', 'recipient', 'notes'];
export const ESCROW_KEYS = ['releaseMode', 'releaseTimeout', 'disputeWindow', 'refundPath', 'partialRefunds', 'milestones', 'termsHash', 'notes'];
export const MILESTONE_KEYS = ['name', 'shareBps', 'notes'];
export const DISPUTE_KEYS = ['arbiters', 'panelSize', 'quorum', 'arbiterFeeBps', 'appealWindow', 'notes'];
export const STAKE_KEYS = ['amount', 'token', 'slashBps', 'notes'];
export const ROLE_KEYS = ['owner', 'pauser', 'upgrader', 'feeSetter', 'treasury', 'timelock', 'multisig', 'notes'];
export const MULTISIG_KEYS = ['address', 'threshold', 'signers', 'notes'];
export const DOMAIN_KEYS = ['name', 'version', 'chainId', 'verifyingContract', 'salt', 'notes'];
export const LIMIT_KEYS = ['maxOrderValue', 'token', 'notes'];

export const RELEASE_MODES = ['buyer-confirm', 'timeout', 'both'];
export const REFUND_PATHS = ['seller', 'arbiter', 'timeout'];
// The roles of the escrow contracts, by their key, with the name a report gives them.
export const ROLES = [['owner', 'the owner'], ['pauser', 'the pauser'], ['upgrader', 'the upgrader'], ['feeSetter', 'the fee setter'], ['treasury', 'the treasury'], ['timelock', 'the timelock']];

const DECIMALS = /^(?:0|[1-9][0-9]{0,2})$/;

// Reads the file from the root node: { config, findings, notes }. config is null when the top level is not an object.
export function readConfig(root, limits = CONFIG_LIMITS) {
  const reader = new Reader('config');
  const notes = [];
  if (!isObject(root)) {
    reader.add('file-unreadable', where(root), `The top level of the file is ${describe(root)}, not an object with the chain id, the tokens, the fee, the escrow, the dispute setup, the roles and the EIP-712 domain, so nothing was checked.`);
    return { config: null, findings: reader.findings, notes: ['the file was not checked, because it holds no object at its top level'] };
  }
  const top = reader.fields(root, TOP_KEYS, 'the file');
  const missing = (at, what) => reader.add('field-missing', at, `${what}.`);
  const whole = (map, key, of, what, min = 0, max = limits.maxWhole) => reader.whole(map, key, of, { min, max, what });

  const chain = whole(top, 'chainId', 'the file', 'a chain id', 1);
  if (chain.value === null && !chain.invalid) missing(where(chain.entry ?? root), 'The file has no chainId, the id of the chain the escrow is deployed on');

  // A part of the file: the object, or null with a finding when it is missing and required.
  const part = (key, what, required) => {
    const r = reader.object(top, key, 'the file', what);
    if (!r.entry && required) missing(where(root), `The file has no ${key}`);
    return r;
  };

  // A list of objects of a part, cut at max, with a finding for each item that is not an object.
  const objects = (entry, key, of, max, read) => {
    const out = [];
    if (entry.value.secret) return out;
    if (!isArray(entry.value)) {
      reader.add('field-invalid', where(entry), `The ${key} of ${of} are ${describe(entry.value)}; they must be a list of objects.`);
      return null;
    }
    if (entry.value.items.length > max) notes.push(`${of} holds ${entry.value.items.length} ${key}; the tool read the first ${max} and left the rest out`);
    for (const [index, node] of entry.value.items.slice(0, max).entries()) {
      if (node.secret) continue;
      if (!isObject(node)) reader.add('field-invalid', where(node), `Item ${index + 1} of the ${key} of ${of} is ${describe(node)}; it must be an object.`);
      else out.push(read(node, index + 1));
    }
    return out;
  };

  // The tokens.
  const tokensEntry = top.get('tokens');
  let tokens = [];
  if (!tokensEntry) missing(where(root), 'The file has no tokens, the list of payment tokens');
  else {
    tokens = objects(tokensEntry, 'tokens', 'the file', limits.maxTokens, (node, n) => readToken(reader, node, n, limits)) ?? [];
    if (isArray(tokensEntry.value) && tokensEntry.value.items.length === 0) missing(where(tokensEntry), 'The tokens of the file are an empty list; name at least one payment token');
  }
  // A symbol is looked up only when the list of tokens could be read; otherwise the token of an amount stays unknown.
  const tokensRead = Boolean(tokensEntry) && isArray(tokensEntry.value);
  const tokenOf = (symbol) => tokens.find((t) => t.symbol !== null && t.symbol.toUpperCase() === symbol.toUpperCase()) ?? null;

  // An amount in a token of the file: { value, token }, with a finding when it cannot be read.
  const amountIn = (map, key, tokenKey, of, node, { above = false } = {}) => {
    const Of = `${of[0].toUpperCase()}${of.slice(1)}`;
    const a = reader.amount(map, key, of);
    const t = reader.text(map, tokenKey, of);
    const out = { value: null, entry: a.entry, token: null, tokenEntry: t.entry, text: a.value };
    if (t.value !== null) {
      out.token = tokenOf(t.value);
      if (!out.token && tokensRead) reader.add('field-invalid', where(t.entry), `The ${tokenKey} of ${of} is "${cut(t.value, 40)}", which is not the symbol of a token of the file.`);
    } else if (!t.invalid) missing(where(t.entry ?? node), `${Of} has no ${tokenKey}`);
    if (a.value !== null) {
      const r = readAmount(a.value);
      if (r.state === 'nan' || r.state === 'negative' || (above && r.state === 'zero')) reader.add('field-invalid', where(a.entry), `The ${key} of ${of} is "${cut(a.value, 40)}"; it must be a plain decimal number${above ? ' above 0' : ' of 0 or more'}, with no sign, exponent or separator.`);
      else if (out.token && out.token.decimals !== null && placesOf(r.value) > out.token.decimals) reader.add('field-invalid', where(a.entry), `The ${key} of ${of} has ${placesOf(r.value)} decimal places, but ${cut(out.token.symbol, 20)} keeps ${out.token.decimals}.`);
      else out.value = r.value;
    } else if (!a.invalid) missing(where(a.entry ?? node), `${Of} has no ${key}`);
    return out;
  };

  // The platform fee.
  const fe = part('platformFee', 'its bps and recipient', true);
  let fee = null;
  if (fe.value) {
    const m = reader.fields(fe.value, FEE_KEYS, 'the platform fee');
    fee = { entry: fe.entry, ...readFeeBps(reader, m, 'bps', 'the platform fee') };
    const r = reader.text(m, 'recipient', 'the platform fee');
    Object.assign(fee, { recipient: r.value, recipientRaw: r.raw ?? null, recipientEntry: r.entry });
    if (fee.bpsEntry === null) missing(where(fe.entry), 'The platform fee has no bps; write 0 for a marketplace that takes no fee');
    if (r.value === null && !r.invalid && fee.bps !== 0) missing(where(r.entry ?? fe.entry), 'The platform fee has no recipient');
  }

  // The escrow rules.
  const es = part('escrow', 'its release mode, timeout, dispute window and refund path', true);
  let escrow = null;
  if (es.value) {
    const m = reader.fields(es.value, ESCROW_KEYS, 'the escrow');
    const mode = reader.choice(m, 'releaseMode', 'the escrow', RELEASE_MODES);
    if (mode.value === null && !mode.invalid) missing(where(mode.entry ?? es.entry), `The escrow has no releaseMode; write one of ${RELEASE_MODES.join(', ')}`);
    const release = whole(m, 'releaseTimeout', 'the escrow', 'seconds');
    const window = whole(m, 'disputeWindow', 'the escrow', 'seconds');
    if (window.value === null && !window.invalid) missing(where(window.entry ?? es.entry), 'The escrow has no disputeWindow, the seconds a buyer has to open a dispute');
    if (mode.value === 'buyer-confirm' && release.entry) reader.add('field-invalid', where(release.entry), 'The escrow releases only when the buyer confirms, so its releaseTimeout is not read; write releaseMode both to release after it.');
    else if ((mode.value === 'timeout' || mode.value === 'both') && release.value === null && !release.invalid) missing(where(release.entry ?? es.entry), `The escrow releases by time (releaseMode ${mode.value}) and has no releaseTimeout`);
    escrow = {
      entry: es.entry,
      mode: mode.value,
      modeEntry: mode.entry,
      releaseTimeout: mode.value === 'buyer-confirm' ? null : release.value,
      releaseEntry: release.entry,
      disputeWindow: window.value,
      windowEntry: window.entry,
      refund: readRefund(reader, m),
      partialRefunds: reader.flag(m, 'partialRefunds', 'the escrow').value,
      termsHash: reader.hash(m, 'termsHash', 'the escrow').value !== null,
      milestones: null,
      milestonesEntry: m.get('milestones') ?? null
    };
    if (escrow.milestonesEntry) escrow.milestones = objects(escrow.milestonesEntry, 'milestones', 'the escrow', limits.maxMilestones, (node, n) => readMilestone(reader, node, n));
    escrow.milestonesEmpty = Boolean(escrow.milestonesEntry) && isArray(escrow.milestonesEntry.value) && escrow.milestonesEntry.value.items.length === 0;
  }

  // The dispute setup.
  const di = part('dispute', 'its arbiters, panel size, quorum, arbiter fee and appeal window', true);
  let dispute = null;
  if (di.value) {
    const m = reader.fields(di.value, DISPUTE_KEYS, 'the dispute setup');
    const arbiters = reader.list(m, 'arbiters', 'the dispute setup');
    if (!arbiters.entry) missing(where(di.entry), 'The dispute setup has no arbiters');
    else if (arbiters.value && arbiters.value.length === 0) missing(where(arbiters.entry), 'The dispute setup lists no arbiter');
    if (arbiters.value && arbiters.value.length > limits.maxArbiters) notes.push(`the dispute setup lists ${arbiters.value.length} arbiters; the tool read the first ${limits.maxArbiters}`);
    const panel = whole(m, 'panelSize', 'the dispute setup', 'arbiters', 1, limits.maxMembers);
    if (panel.value === null && !panel.invalid) missing(where(panel.entry ?? di.entry), 'The dispute setup has no panelSize, the number of arbiters on a dispute');
    const quorum = whole(m, 'quorum', 'the dispute setup', 'votes', 1, limits.maxMembers);
    if (quorum.value === null && !quorum.invalid) missing(where(quorum.entry ?? di.entry), 'The dispute setup has no quorum, the votes that decide a dispute');
    const appeal = whole(m, 'appealWindow', 'the dispute setup', 'seconds');
    dispute = {
      entry: di.entry,
      arbiters: arbiters.value === null ? null : arbiters.value.slice(0, limits.maxArbiters),
      arbitersEntry: arbiters.entry,
      panel: panel.value,
      panelEntry: panel.entry,
      quorum: quorum.value,
      quorumEntry: quorum.entry,
      appeal: appeal.value,
      appealEntry: appeal.entry,
      appealInvalid: Boolean(appeal.invalid),
      fee: readFeeBps(reader, m, 'arbiterFeeBps', 'the dispute setup')
    };
  }

  // The stake of a seller, which the file may leave out.
  const st = part('stake', 'its amount, token and slash share', false);
  let stake = null;
  if (st.value) {
    const m = reader.fields(st.value, STAKE_KEYS, 'the stake');
    stake = { entry: st.entry, ...amountIn(m, 'amount', 'token', 'the stake', st.entry), slash: null, slashEntry: null, slashText: null };
    const sl = reader.amount(m, 'slashBps', 'the stake');
    if (sl.value !== null) {
      const b = readBps(sl.value);
      Object.assign(stake, { slashEntry: sl.entry, slashText: sl.value, slash: b.state === 'ok' ? b.value : null });
    } else if (!sl.invalid) missing(where(sl.entry ?? st.entry), 'The stake has no slashBps; write 0 for a stake that is never slashed');
  }

  // The roles and the multisig.
  const ro = part('roles', 'the owner, the other roles and the multisig', true);
  let roles = null;
  if (ro.value) {
    const m = reader.fields(ro.value, ROLE_KEYS, 'the roles');
    roles = { entry: ro.entry, multisig: null };
    for (const [key, name] of ROLES) {
      const r = reader.text(m, key, 'the roles');
      roles[key] = { key, name, value: r.value, raw: r.raw ?? null, entry: r.entry, invalid: Boolean(r.invalid) };
    }
    if (roles.owner.value === null && !roles.owner.invalid) missing(where(roles.owner.entry ?? ro.entry), 'The roles have no owner');
    const ms = reader.object(m, 'multisig', 'the roles', 'its address, threshold and signers');
    if (ms.value) {
      const mm = reader.fields(ms.value, MULTISIG_KEYS, 'the multisig');
      const address = reader.text(mm, 'address', 'the multisig');
      if (address.value === null && !address.invalid) missing(where(address.entry ?? ms.entry), 'The multisig has no address');
      const threshold = whole(mm, 'threshold', 'the multisig', 'signatures', 1, limits.maxSigners);
      if (!threshold.entry) missing(where(ms.entry), 'The multisig has no threshold');
      const signers = reader.list(mm, 'signers', 'the multisig');
      if (!signers.entry) missing(where(ms.entry), 'The multisig has no signers');
      else if (signers.value && signers.value.length === 0) missing(where(signers.entry), 'The multisig lists no signer');
      roles.multisig = { entry: ms.entry, address: address.value, addressRaw: address.raw ?? null, addressEntry: address.entry, threshold: threshold.value, thresholdEntry: threshold.entry, signers: signers.value === null ? null : signers.value.slice(0, limits.maxSigners), signersEntry: signers.entry };
    }
  }

  // The EIP-712 domain of signed listings.
  const ed = part('eip712', 'the name, version, chainId and verifyingContract of the domain', true);
  let eip712 = null;
  if (ed.value) {
    const m = reader.fields(ed.value, DOMAIN_KEYS, 'the EIP-712 domain');
    const name = reader.text(m, 'name', 'the EIP-712 domain');
    const version = reader.text(m, 'version', 'the EIP-712 domain');
    const id = whole(m, 'chainId', 'the EIP-712 domain', 'a chain id', 1);
    const vc = reader.text(m, 'verifyingContract', 'the EIP-712 domain');
    reader.hash(m, 'salt', 'the EIP-712 domain');
    eip712 = {
      entry: ed.entry,
      name: name.value,
      version: version.value,
      chainId: id.value,
      chainEntry: id.entry,
      verifyingContract: vc.value,
      verifyingRaw: vc.raw ?? null,
      verifyingEntry: vc.entry,
      absent: [['name', name], ['version', version], ['chainId', id], ['verifyingContract', vc]].filter(([, r]) => r.value === null && !r.invalid).map(([k]) => k)
    };
  }

  // The limits, which the file may leave out.
  const li = part('limits', 'the largest order value and its token', false);
  let maxOrder = null;
  if (li.value) {
    const m = reader.fields(li.value, LIMIT_KEYS, 'the limits');
    if (m.has('maxOrderValue') || m.has('token')) maxOrder = amountIn(m, 'maxOrderValue', 'token', 'the limits', li.entry, { above: true });
  }

  return { config: { root, chainId: chain.value, chainEntry: chain.entry, tokens, fee, escrow, dispute, stake, roles, eip712, limits: li.entry ? { entry: li.entry, maxOrder } : null }, findings: reader.findings, notes };
}

// A fee in basis points: { bps, bpsEntry, bpsText }, with a fee-invalid finding when it is not a whole number from 0 to
// 10000.
function readFeeBps(reader, m, key, of) {
  const b = reader.amount(m, key, of);
  if (b.value === null) return { bps: null, bpsEntry: b.invalid ? b.entry : null, bpsText: null };
  const r = readBps(b.value);
  if (r.state !== 'ok') reader.add('fee-invalid', where(b.entry), `The ${key} of ${of} is "${cut(b.value, 40)}"; it must be a whole number of basis points from 0 to 10000, where 100 is 1%.`);
  return { bps: r.state === 'ok' ? r.value : null, bpsEntry: b.entry, bpsText: b.value };
}

// The refund path: a list of the ways back to the buyer, or the text "none". { paths, none, missing, invalid, entry }.
function readRefund(reader, m) {
  const e = m.get('refundPath');
  const out = { paths: [], none: false, missing: !e, invalid: false, entry: e ?? null };
  if (!e) return out;
  if (e.value.secret) return { ...out, invalid: true };
  const one = (node) => {
    const v = node.value.trim().toLowerCase();
    if (REFUND_PATHS.includes(v)) {
      if (!out.paths.includes(v)) out.paths.push(v);
      return;
    }
    reader.add('field-invalid', where(node), `The refundPath of the escrow names "${cut(node.value, 40)}"; a refund path is one of ${REFUND_PATHS.join(', ')}, or the whole field is "none".`);
    out.invalid = true;
  };
  if (isString(e.value)) {
    if (e.value.value.trim().toLowerCase() === 'none') out.none = true;
    else one(e.value);
  } else if (isArray(e.value)) {
    for (const item of e.value.items) {
      if (item.secret) out.invalid = true;
      else if (isString(item)) one(item);
      else {
        reader.add('field-invalid', where(item), `An item of the refundPath of the escrow is ${describe(item)}; it must be one of ${REFUND_PATHS.join(', ')}.`);
        out.invalid = true;
      }
    }
  } else {
    reader.add('field-invalid', where(e), `The refundPath of the escrow is ${describe(e.value)}; it must be a list of ${REFUND_PATHS.join(', ')}, or "none".`);
    out.invalid = true;
  }
  return out;
}

// One payment token: its symbol, address (or native), decimals and chain id.
function readToken(reader, node, n, limits) {
  const m = reader.fields(node, TOKEN_KEYS, `token ${n}`);
  const sym = reader.text(m, 'symbol', `token ${n}`);
  const title = sym.value === null ? `${n}` : cut(sym.value, 20);
  const of = `token ${title}`;
  const Of = `Token ${title}`;
  const t = { index: n, node, title, symbol: sym.value, symbolEntry: sym.entry, native: false, address: null, addressRaw: null, addressEntry: null, decimals: null, decimalsEntry: null, chainId: null, chainEntry: null };
  if (sym.value === null && !sym.invalid) reader.add('field-missing', where(sym.entry ?? node), `Token ${n} has no symbol.`);
  t.native = reader.flag(m, 'native', of).value === true;
  const ad = reader.text(m, 'address', of);
  Object.assign(t, { addressEntry: ad.entry });
  if (t.native && ad.entry) reader.add('field-invalid', where(ad.entry), `${Of} is native and has an address; a native token is paid as the currency of the chain and has none.`);
  else if (!t.native) {
    Object.assign(t, { address: ad.value, addressRaw: ad.raw ?? null });
    if (ad.value === null && !ad.invalid) reader.add('field-missing', where(ad.entry ?? node), `${Of} has no address; write "native": true for the currency of the chain.`);
  }
  // The decimals, read as the digits of the file.
  const de = m.get('decimals');
  t.decimalsEntry = de ?? null;
  if (!de) reader.add('field-missing', where(node), `${Of} has no decimals.`);
  else if (!de.value.secret) {
    const raw = isNumber(de.value) ? de.value.raw : isString(de.value) ? de.value.value.trim() : null;
    if (raw === null) reader.add('field-invalid', where(de), `The decimals of ${of} are ${describe(de.value)}; they must be a whole number.`);
    else if (!DECIMALS.test(raw) || Number(raw) > MAX_DECIMALS) reader.add('token-decimals-invalid', where(de), `The decimals of ${of} are "${cut(raw, 40)}"; they must be a whole number from 0 to ${MAX_DECIMALS}, as the token contract answers from decimals(). This is a best practice of this tool, not a rule in the pages it cites.`, title);
    else t.decimals = Number(raw);
  }
  const ch = reader.whole(m, 'chainId', of, { min: 1, max: limits.maxWhole, what: 'a chain id' });
  Object.assign(t, { chainId: ch.value, chainEntry: ch.entry });
  if (ch.value === null && !ch.invalid) reader.add('field-missing', where(node), `${Of} has no chainId.`);
  return t;
}

// One milestone of the escrow: its name and its share of the order in basis points.
function readMilestone(reader, node, n) {
  const m = reader.fields(node, MILESTONE_KEYS, `milestone ${n}`);
  const name = reader.text(m, 'name', `milestone ${n}`);
  const title = name.value === null ? `${n}` : cut(name.value, 40);
  if (name.value === null && !name.invalid) reader.add('field-missing', where(name.entry ?? node), `Milestone ${n} has no name.`);
  const s = reader.amount(m, 'shareBps', `milestone ${title}`);
  const out = { index: n, node, title, name: name.value, nameEntry: name.entry, share: null, shareEntry: s.entry, shareInvalid: Boolean(s.invalid) };
  if (s.value !== null) {
    const b = readBps(s.value);
    if (b.state === 'ok') out.share = b.value;
    else {
      reader.add('field-invalid', where(s.entry), `The shareBps of milestone ${title} is "${cut(s.value, 40)}"; it must be a whole number of basis points from 0 to 10000, where 10000 is the whole order.`);
      out.shareInvalid = true;
    }
  } else if (!s.invalid) {
    reader.add('field-missing', where(s.entry ?? node), `Milestone ${title} has no shareBps.`);
    out.shareInvalid = true;
  }
  return out;
}
