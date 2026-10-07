// Shared test helpers: escrow configurations built inline, checked in memory or written into a temporary folder that is
// removed after the test. Paths are built with resolve() from forward-slash names, so the same test runs on Linux, macOS
// and Windows. The line a test expects is found with lineOf(), which counts lines the way the reader does, so a test
// never holds a line number worked out by hand for one system only. No test reads the clock, the time zone or the
// locale. Every name is made up and every address and hash is one character written many times.

import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { checkText, main } from '../src/index.js';

export async function withFiles(files, fn) {
  const dir = await mkdtemp(resolve(tmpdir(), 'marketplace-escrow-check-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      await mkdir(dirname(resolve(dir, rel)), { recursive: true });
      await writeFile(resolve(dir, rel), content);
    }
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// The line (from 1) of the n-th place where needle starts in text.
export function lineOf(text, needle, n = 1) {
  let at = -1;
  for (let i = 0; i < n; i += 1) {
    at = text.indexOf(needle, at + 1);
    if (at < 0) throw new Error(`${needle} is not in the text ${n} times`);
  }
  return text.slice(0, at).split('\n').length;
}

// A made-up EVM address of one character, or of a short run of characters, written to 40 hex digits.
export const addr = (c = '1') => `0x${c.repeat(40 / c.length)}`;

// A made-up hash of 32 bytes: one hex digit written 64 times, with 0x in front.
export const hash = (c = '3') => `0x${c.repeat(64)}`;

export const DAY = 86400;
export const WEEK = 7 * DAY;

// The multisig and the timelock of a clean file.
export const MULTISIG = addr('2');
export const TIMELOCK = addr('9');

const drop = (out) => {
  for (const [k, v] of Object.entries(out)) if (v === undefined) delete out[k];
  return out;
};

// The parts of a file that passes every check: on chain id 1, USDC and the native ETH, a fee of 2.5% to the multisig, a
// release on confirmation or after 14 days with a dispute window of 7 days, a refund by the seller or the arbiters, three
// milestones of 30%, 30% and 40%, five arbiters with a panel of 3 and a quorum of 2, a stake of 100 USDC slashed by
// half, every role but the pauser held by the multisig of 3 of 5 signers, the upgrader behind the timelock, an EIP-712
// domain of the chain, and a largest order of 50000 USDC.
export const USDC = { symbol: 'USDC', address: addr('8'), decimals: 6, chainId: 1 };
export const ETH = { symbol: 'ETH', native: true, decimals: 18, chainId: 1 };
export const BASE = {
  chainId: 1,
  tokens: [USDC, ETH],
  platformFee: { bps: 250, recipient: MULTISIG },
  escrow: { releaseMode: 'both', releaseTimeout: 2 * WEEK, disputeWindow: WEEK, refundPath: ['seller', 'arbiter'], partialRefunds: true, milestones: [{ name: 'Design', shareBps: 3000 }, { name: 'Build', shareBps: 3000 }, { name: 'Handover', shareBps: 4000 }] },
  dispute: { arbiters: [addr('a'), addr('b'), addr('c'), addr('d'), addr('e')], panelSize: 3, quorum: 2, arbiterFeeBps: 100, appealWindow: 3 * DAY },
  stake: { amount: '100', token: 'USDC', slashBps: 5000 },
  roles: { owner: MULTISIG, pauser: addr('5'), upgrader: TIMELOCK, feeSetter: MULTISIG, treasury: MULTISIG, timelock: TIMELOCK, multisig: { address: MULTISIG, threshold: 3, signers: [addr('3'), addr('4'), addr('6'), addr('7'), addr('f')] } },
  eip712: { name: 'Example Escrow', version: '1', chainId: 1, verifyingContract: addr('1') },
  limits: { maxOrderValue: '50000', token: 'USDC' }
};

// A file that passes every check. over replaces parts of the file, and a part set to undefined is left out.
export function file(over = {}) {
  const out = structuredClone(BASE);
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) delete out[k];
    else out[k] = v;
  }
  return out;
}

// A file whose part name has the fields of over in place of its own; a field set to undefined is left out.
export const withPart = (name, over) => file({ [name]: drop({ ...structuredClone(BASE[name]), ...over }) });
export const withEscrow = (over) => withPart('escrow', over);
export const withDispute = (over) => withPart('dispute', over);
export const withRoles = (over) => withPart('roles', over);
export const withDomain = (over) => withPart('eip712', over);
export const withFee = (over) => withPart('platformFee', over);
export const withStake = (over) => withPart('stake', over);
export const withTokens = (...tokens) => file({ tokens });
export const multisig = (over) => drop({ ...structuredClone(BASE.roles.multisig), ...over });

export const text = (obj) => `${JSON.stringify(obj, null, 2)}\n`;

// The findings of a run in memory, for a file object or a text.
export const findingsOf = (p = file(), options = {}) => checkText(typeof p === 'string' ? p : text(p), options).findings;

// The ids of the findings of a run.
export const idsOf = (p, options) => findingsOf(p, options).map((f) => f.id);

// The findings of one check.
export const ofCheck = (p, id, options) => findingsOf(p, options).filter((f) => f.id === id);

// Runs the command line with exactly these arguments, in a folder.
export async function cli(argv, base) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, base);
  return { code, out, err };
}

// Writes the files and runs the command line in the folder.
export async function run(files, args) {
  return withFiles(files, (dir) => cli(args, dir));
}

// A clean file, and one with a refund path of "none", for the command line tests.
export const GOOD = { 'escrow.json': text(file()) };
export const BAD = { 'escrow.json': text(withEscrow({ refundPath: 'none' })) };
export const ARGS = ['escrow.json'];

// The time a hostile test may take: four times as long when the runner collects coverage, which sets NODE_V8_COVERAGE.
export const allowed = (ms) => (process.env.NODE_V8_COVERAGE ? ms * 4 : ms);
