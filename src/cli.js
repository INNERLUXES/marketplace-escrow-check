// Command line: marketplace-escrow-check <escrow.json> [options]

import { readFileSync } from 'node:fs';
import { DEFAULT_MAX_FEE_BPS, InputError, LIMITS, checkFile } from './check.js';
import { LEVELS } from './data.js';
import { listChecksJson, listChecksMarkdown, listChecksText, toJson, toMarkdown, toSarif, toText } from './report.js';
import { RULES } from './rules.js';
import { safeText } from './text.js';

export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const FORMATS = { text: toText, markdown: toMarkdown, json: toJson, sarif: toSarif };
const LISTS = { text: listChecksText, markdown: listChecksMarkdown, json: listChecksJson };

// The form of --max-fee-bps: a whole number of basis points from 0 to 10000.
export const MAX_FEE_BPS = 10000;
const BPS = /^(?:0|[1-9][0-9]{0,4})$/;

export const USAGE = `Usage: marketplace-escrow-check <escrow.json> [options]

Reads the JSON configuration of the escrow of a peer to peer marketplace before its contracts are deployed (the chain
id, the payment tokens, the platform fee, the escrow rules with release mode, release timeout, dispute window, refund
path and milestones, the dispute setup with arbiters, panel, quorum, arbiter fee and appeal window, the stake of a
seller, the roles with their multisig, the EIP-712 domain of signed listings and the limits) and lists its mistakes: a
release that can fire before the dispute window closes, no way to refund the buyer, a release that waits on the buyer
alone, a fee that is too high, written wrong or sent to the zero address, milestones that are not the whole order or
release nothing, a dispute quorum that can never be met, a single arbiter or one who is paid by the marketplace or
holds a role, a stake that cannot be slashed as written, roles held by one key, a multisig of one signature or one
that can never act, an upgrade with no timelock, an EIP-712 domain of another chain, with missing fields or a zero
verifying contract, a token of another chain or with the wrong decimals, malformed or zero addresses and no largest
order. A private key or a seed in the file is an error whose value is never shown. It reads the file and is not legal
or financial advice: it contacts no chain, node or API, fetches nothing, signs nothing, deploys nothing, runs nothing,
reads no clock and writes nothing to disk.

Options:
  --format <name>            text, markdown, json or sarif (default: text)
  --json                     the same as --format json
  --min-severity <level>     the lowest level of a finding that is shown: ${LEVELS.join(', ')} (default: info)
  --fail-on <level>          the lowest level of a finding that fails the run: ${LEVELS.join(', ')} (default: error)
  --max-fee-bps <n>          the fee above which fee-too-high warns, 0 to ${MAX_FEE_BPS} basis points (default: ${DEFAULT_MAX_FEE_BPS})
  --explain                  show the points of the pages behind each finding (text, markdown and JSON)
  --list-checks              list the checks with their level and kind, and exit
  --help                     show this text
  --version                  show the version

Checks: ${RULES.map((r) => r.id).join(', ')}.

Exit codes: 0 no finding at or above the fail-on level, 1 a finding at or above it, 2 usage or input error.
`;

const isUrl = (f) => /^[a-z][a-z0-9+.-]*:\/\//i.test(f);

export function parseArgs(argv) {
  const o = { paths: [], format: null, json: false, minSeverity: null, failOn: null, maxFeeBps: null, explain: false, listChecks: false, help: false, version: false };
  const once = (name, current, value) => {
    if (current !== null) throw new Error(`${name} was given twice`);
    return value;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined || (v.startsWith('--') && v.length > 2)) throw new Error(`${a} needs a value`);
      if (v === '-') throw new Error('reading from standard input is not supported; give a file');
      i += 1;
      return v;
    };
    if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--version' || a === '-v') o.version = true;
    else if (a === '--explain') o.explain = true;
    else if (a === '--json') o.json = true;
    else if (a === '--list-checks') o.listChecks = true;
    else if (a === '--format') o.format = once(a, o.format, next());
    else if (a === '--min-severity') o.minSeverity = once(a, o.minSeverity, next());
    else if (a === '--fail-on') o.failOn = once(a, o.failOn, next());
    else if (a === '--max-fee-bps') o.maxFeeBps = once(a, o.maxFeeBps, next());
    else if (a === '-') throw new Error('reading from standard input is not supported; give a file');
    else if (a.startsWith('-')) throw new Error(`unknown argument ${a}`);
    else {
      if (o.paths.length === 1) throw new Error('give one configuration file');
      o.paths.push(a);
    }
  }
  if (o.json) {
    if (o.format !== null && o.format !== 'json') throw new Error(`--json and --format ${o.format} ask for two formats; give one`);
    o.format = 'json';
  }
  if (o.format === null) o.format = 'text';
  if (!Object.hasOwn(FORMATS, o.format)) throw new Error(`unknown format ${o.format} (text, markdown, json or sarif)`);
  for (const [flag, v] of [['--min-severity', o.minSeverity], ['--fail-on', o.failOn]]) if (v !== null && !LEVELS.includes(v)) throw new Error(`${flag}: unknown level ${v} (${LEVELS.join(', ')})`);
  if (o.maxFeeBps !== null) {
    if (!BPS.test(o.maxFeeBps) || Number(o.maxFeeBps) > MAX_FEE_BPS) throw new Error(`--max-fee-bps: ${o.maxFeeBps} is not a whole number of basis points from 0 to ${MAX_FEE_BPS}`);
    o.maxFeeBps = Number(o.maxFeeBps);
  }
  if (o.listChecks && o.format === 'sarif') throw new Error('--list-checks has no SARIF form; use text, markdown or json');
  if (!o.help && !o.version && !o.listChecks) {
    if (o.paths.length !== 1) throw new Error('give the configuration file, such as marketplace-escrow-check escrow.json');
    if (isUrl(o.paths[0])) throw new Error('give a local path; the tool never fetches a URL');
    if (o.explain && o.format === 'sarif') throw new Error('--explain adds the points of the pages to the text, markdown and JSON reports; the sarif format has no place for them');
  }
  return o;
}

const clean = (text) => safeText(text, 1500);

// Exit code: 0 no finding at or above the fail-on level, 1 a finding at or above it, 2 usage or input error.
export async function main(argv, io = { out: (t) => process.stdout.write(t), err: (t) => process.stderr.write(t) }, limits = undefined, base = process.cwd()) {
  let o;
  try {
    o = parseArgs(argv);
  } catch (error) {
    io.err(`marketplace-escrow-check: ${clean(error.message)}\n\n${USAGE}`);
    return 2;
  }
  if (o.help) {
    io.out(USAGE);
    return 0;
  }
  if (o.version) {
    io.out(`${VERSION}\n`);
    return 0;
  }
  if (o.listChecks) {
    io.out(LISTS[o.format]());
    return 0;
  }
  let report;
  try {
    report = await checkFile({ path: o.paths[0], minSeverity: o.minSeverity ?? 'info', failOn: o.failOn ?? 'error', maxFeeBps: o.maxFeeBps ?? DEFAULT_MAX_FEE_BPS, version: VERSION, limits: { ...LIMITS, ...(limits ?? {}) }, base });
  } catch (error) {
    if (error instanceof InputError) io.err(`marketplace-escrow-check: no result, the input has ${error.problems.length === 1 ? 'a problem' : 'problems'}:\n${error.problems.map((p) => `  ${clean(p)}`).join('\n')}\n`);
    else io.err(`marketplace-escrow-check: ${clean(error.message)}\n`);
    return 2;
  }
  io.out(FORMATS[o.format](report, { explain: o.explain }));
  return report.result.pass ? 0 : 1;
}
