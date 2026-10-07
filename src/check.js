// A run: read the escrow configuration as JSON, look for keys and seeds in it, read the fields, run the checks and build
// the report object that the formats write.

import { DEFAULT_MAX_FEE_BPS, analyze } from './analyze.js';
import { readConfig } from './config.js';
import { LEVELS, NOTICE, POINTS, pointPage } from './data.js';
import { HASH_FORM } from './fields.js';
import { FILE_LIMITS, InputError, displayPath, locateInput, readInputText } from './files.js';
import { JsonError, isArray, isObject, isString, readJson } from './json.js';
import { RULES, decide, ruleById } from './rules.js';
import { findSecrets } from './secrets.js';
import { safeText } from './text.js';

export const LIMITS = { ...FILE_LIMITS };

export { InputError, DEFAULT_MAX_FEE_BPS };

const clean = (t, max = 900) => safeText(t, max);

const ORDER = { error: 0, warning: 1, info: 2 };

// The keys whose value is a hash of 32 bytes: the salt of the EIP-712 domain and the hash of the terms of the escrow. A
// hash is 64 hex digits, the shape the search for secrets reads as a private key in hex, so a value of that form under
// one of these keys is taken as the hash it is meant to be and not reported as a key. The tool never shows the value of
// these keys, so a key pasted there is not shown either (docs/limits.md).
export const HASH_KEYS = ['salt', 'termsHash'];

// The basis of a rule: the points with their pages.
function basisOf(rule) {
  return rule.basis.map((id) => {
    const page = pointPage(id);
    return { text: POINTS[id].text, source: page.title, url: page.url };
  });
}

// The value nodes of the file under a key of HASH_KEYS that have the form of a hash, found without recursion.
export function hashNodes(root) {
  const out = [];
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (isObject(node)) {
      for (const e of node.entries) {
        if (HASH_KEYS.includes(e.key) && isString(e.value) && HASH_FORM.test(e.value.value.trim())) out.push(e.value);
        else stack.push(e.value);
      }
    } else if (isArray(node)) for (const item of node.items) stack.push(item);
  }
  return out;
}

// The search for keys and seeds of the sibling tools, kept unchanged in src/secrets.js, with two changes made here: its
// finding is named for the configuration file, and a hash under a key of HASH_KEYS is not a finding and is read as a
// hash.
export function fileSecrets(root) {
  const hashes = new Map(hashNodes(root).map((n) => [`${n.line}:${n.column}`, n]));
  const findings = [];
  for (const f of findSecrets(root)) {
    const node = hashes.get(`${f.line}:${f.column}`);
    if (node && f.message.endsWith('is shaped like a private key in hex. The tool never reads a seed or a key, and the value is not shown.')) {
      node.secret = false;
      continue;
    }
    findings.push({ ...f, id: 'secret-in-file', file: 'config', subject: null, message: f.message.replace(/^The configuration holds/, 'The file holds') });
  }
  return findings;
}

// The findings of the text of an escrow configuration, with no file system. Returns { read, analysis, findings, notes }.
export function checkText(text, { maxFeeBps = DEFAULT_MAX_FEE_BPS } = {}) {
  let root;
  try {
    root = readJson(text);
  } catch (error) {
    if (!(error instanceof JsonError)) throw error;
    const findings = [{ id: 'file-unreadable', file: 'config', line: error.line, column: error.column, message: `The configuration is not JSON the reader can follow: ${error.message}. Nothing in the file was checked.`, subject: null }];
    return { read: null, analysis: analyze(null), findings, notes: ['the file was not checked, because it is not JSON the reader can follow'] };
  }
  const secrets = fileSecrets(root);
  const r = readConfig(root);
  const analysis = analyze(r.config, { maxFeeBps });
  return { read: r.config, analysis, findings: [...secrets, ...r.findings, ...analysis.findings], notes: [...r.notes, ...analysis.notes] };
}

const lineCount = (text) => {
  const parts = text === '' ? [] : text.split(/\r\n|\r|\n/);
  return parts.length > 0 && parts.at(-1) === '' ? parts.length - 1 : parts.length;
};

const textOf = (v, max = 60) => (v === null || v === undefined ? null : clean(v, max));

// What the file says, as the report shows it. The value of a salt or a hash of the terms is never shown.
function configOf(s) {
  return {
    chainId: s.chainId,
    tokens: s.tokens.map((t) => ({ symbol: clean(t.symbol, 20), address: textOf(t.address), decimals: t.decimals, chainId: t.chainId })),
    fee: s.fee ? { ...s.fee, recipient: textOf(s.fee.recipient) } : null,
    escrow: s.escrow ? { ...s.escrow, milestones: s.escrow.milestones ? s.escrow.milestones.map((x) => ({ name: clean(x.name, 40), shareBps: x.shareBps })) : null } : null,
    dispute: s.dispute,
    stake: s.stake ? { ...s.stake, amount: textOf(s.stake.amount), token: textOf(s.stake.token, 20) } : null,
    eip712: s.eip712 ? { name: textOf(s.eip712.name), version: textOf(s.eip712.version, 20), chainId: s.eip712.chainId, verifyingContract: textOf(s.eip712.verifyingContract) } : null,
    maxOrder: s.maxOrder ? { value: textOf(s.maxOrder.value), token: textOf(s.maxOrder.token, 20) } : null
  };
}

// The report object for the findings of the file. file is { file, bytes, lines }.
export function buildReport({ file, checked, version, minSeverity = 'info', failOn = 'error', maxFeeBps = DEFAULT_MAX_FEE_BPS }) {
  const all = checked.findings.map((f) => {
    const rule = ruleById(f.id);
    return {
      id: f.id,
      severity: rule.severity,
      message: clean(f.message),
      file: file.file,
      line: f.line,
      column: f.column,
      at: `${file.file}:${f.line}`,
      subject: f.subject == null ? null : clean(f.subject, 120),
      fix: rule.fix,
      kind: rule.kind,
      basis: basisOf(rule),
      own: rule.own ?? null
    };
  });
  all.sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.line - b.line || a.column - b.column || a.id.localeCompare(b.id, 'en'));
  const shown = all.filter((f) => LEVELS.indexOf(f.severity) >= LEVELS.indexOf(minSeverity));
  const byLevel = { error: 0, warning: 0, info: 0 };
  for (const f of shown) byLevel[f.severity] += 1;
  const allByLevel = { error: 0, warning: 0, info: 0 };
  for (const f of all) allByLevel[f.severity] += 1;
  const summary = checked.analysis.summary;
  return {
    tool: 'marketplace-escrow-check',
    version,
    input: { file: file.file, format: 'json', bytes: file.bytes, lines: file.lines },
    config: summary ? configOf(summary) : null,
    totals: { findings: shown.length, byLevel, hidden: all.length - shown.length },
    rules: RULES.map((r) => ({ id: r.id, level: r.severity, kind: r.kind, findings: shown.filter((f) => f.id === r.id).length })),
    options: { minSeverity, failOn, maxFeeBps },
    findings: shown,
    roles: summary ? summary.roles.map((x) => ({ role: x.role, address: textOf(x.address), heldBy: x.heldBy })) : null,
    notes: checked.notes.map((n) => clean(n)),
    notice: NOTICE,
    result: decide(allByLevel, failOn)
  };
}

// Reads the escrow configuration and builds the report.
export async function checkFile({ path, minSeverity = 'info', failOn = 'error', maxFeeBps = DEFAULT_MAX_FEE_BPS, version, limits = LIMITS, base = process.cwd() }) {
  const absolute = await locateInput(path, base);
  const { text, bytes } = await readInputText(absolute, base, limits);
  const checked = checkText(text, { maxFeeBps });
  return buildReport({ file: { file: displayPath(absolute, base), bytes, lines: lineCount(text) }, checked, version, minSeverity, failOn, maxFeeBps });
}
