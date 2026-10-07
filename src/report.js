// The reports: text for a terminal, markdown for a job summary or a pull request, JSON for other tools and SARIF for code
// scanning. Every text that comes from the input (a file name, a token symbol, an address, a milestone name) was cleaned
// by safeText before it reached the report object. The markdown format also escapes what markdown gives a meaning to,
// and the SARIF format is built as an object and written by JSON.stringify.

import { bpsPercent, bpsText, secondsText } from './analyze.js';
import { SOURCES } from './data.js';
import { RULES } from './rules.js';
import { grouped, listText, plural } from './size.js';

const URI = 'https://github.com/INNERLUXES/marketplace-escrow-check';

function findingsLine(r) {
  const b = r.totals.byLevel;
  const parts = ['error', 'warning', 'info'].filter((l) => b[l]).map((l) => `${grouped(b[l])} ${l}`);
  return `${grouped(r.totals.findings)}${parts.length ? ` (${parts.join(', ')})` : ''}${r.totals.hidden ? `; ${grouped(r.totals.hidden)} below ${r.options.minSeverity} not shown` : ''}`;
}

const fileLine = (r) => `${r.input.file} (JSON, ${plural(r.input.lines, 'line')}, ${plural(r.input.bytes, 'byte')})`;
const or = (v, text = 'not read') => (v === null || v === undefined ? text : v);
const MODES = { 'buyer-confirm': 'on buyer confirmation only', timeout: 'after a timeout only', both: 'on buyer confirmation or after a timeout' };

// A token in one phrase: its symbol, address, decimals and chain.
const tokenText = (t) => `${t.symbol}, ${t.address === 'native' ? 'native' : `at ${or(t.address)}`}, ${t.decimals === null ? 'decimals not read' : plural(t.decimals, 'decimal')}, chain id ${or(t.chainId)}`;

function escrowText(e) {
  const parts = [`release ${e.releaseMode ? MODES[e.releaseMode] : 'mode not read'}`];
  if (e.releaseTimeout !== null) parts.push(`release timeout ${secondsText(e.releaseTimeout)}`);
  parts.push(`dispute window ${e.disputeWindow === null ? 'not read' : secondsText(e.disputeWindow)}`);
  parts.push(e.refundPath === 'none' ? 'refund path none' : e.refundPath.length ? `refund by ${listText(e.refundPath, 8)}` : 'no refund path read');
  if (e.partialRefunds !== null) parts.push(`partial refunds ${e.partialRefunds ? 'allowed' : 'not allowed'}`);
  if (e.milestones) parts.push(`${plural(e.milestones.length, 'milestone')}${e.milestones.length ? ` (${e.milestones.map((m) => `${m.name} ${m.shareBps === null ? 'share not read' : bpsPercent(m.shareBps)}`).join(', ')})` : ''}`);
  return parts.join('; ');
}

function disputeText(d) {
  const parts = [d.arbiters === null ? 'arbiters not read' : plural(d.arbiters, 'arbiter'), `panel of ${or(d.panelSize)}`, `quorum of ${or(d.quorum)}`];
  if (d.arbiterFeeBps !== null) parts.push(`arbiter fee ${bpsText(d.arbiterFeeBps)}`);
  parts.push(`appeal window ${d.appealWindow === null ? 'none' : secondsText(d.appealWindow)}`);
  return parts.join(', ');
}

const stakeText = (s) => `${or(s.amount, 'amount not read')}${s.token ? ` ${s.token}` : ''}, slash ${s.slashBps === null ? 'not read' : bpsText(s.slashBps)}`;

// What the file says, a line for each part.
function configLines(r) {
  const c = r.config;
  if (!c) return [['config', 'not read']];
  const domain = c.eip712;
  return [
    ['chain id', or(c.chainId)],
    ['tokens', c.tokens.length ? `${grouped(c.tokens.length)}: ${c.tokens.map(tokenText).join('; ')}` : 'none read'],
    ['platform fee', c.fee ? `${c.fee.bps === null ? 'bps not read' : bpsText(c.fee.bps)}${c.fee.recipient ? ` to ${c.fee.recipient}` : ''}` : 'not read'],
    ['escrow', c.escrow ? escrowText(c.escrow) : 'not read'],
    ['dispute', c.dispute ? disputeText(c.dispute) : 'not read'],
    ['stake', c.stake ? stakeText(c.stake) : 'none declared'],
    ['eip712 domain', domain ? `name ${or(domain.name, 'none')}, version ${or(domain.version, 'none')}, chain id ${or(domain.chainId, 'none')}, verifying contract ${or(domain.verifyingContract, 'none')}` : 'not read'],
    ['max order', c.maxOrder ? `${c.maxOrder.value}${c.maxOrder.token ? ` ${c.maxOrder.token}` : ''}` : 'not set'],
    ['max fee', `${bpsText(r.options.maxFeeBps)}, from --max-fee-bps`]
  ];
}

function table(head, rows, indent = '  ') {
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i].length)));
  const line = (cells) => `${indent}${cells.map((c, i) => (i === cells.length - 1 ? c : c.padEnd(widths[i]))).join('  ')}`.trimEnd();
  return [line(head), ...rows.map(line)];
}

const ROLE_HEAD = ['role', 'address', 'held by'];
const dash = (v) => (v === null || v === undefined ? '-' : v);
const roleRows = (r) => r.roles.map((x) => [x.role, dash(x.address), dash(x.heldBy)]);

const PAD = ' '.repeat(11);

export function toText(r, { explain = false } = {}) {
  const out = [];
  out.push(`marketplace-escrow-check: ${r.input.file}`);
  out.push(`file: ${fileLine(r)}`);
  for (const [k, v] of configLines(r)) out.push(`${k}: ${v}`);
  out.push(`findings: ${findingsLine(r)}`);
  out.push('', `Checks (${grouped(r.rules.length)})`, '');
  out.push(...table(['check', 'level', 'kind', 'findings'], r.rules.map((x) => [x.id, x.level, x.kind, grouped(x.findings)])), '');
  out.push(`Findings (${grouped(r.findings.length)})`, '');
  if (!r.findings.length) out.push('  none', '');
  const width = Math.max(...RULES.map((x) => x.id.length));
  for (const f of r.findings) {
    out.push(`  ${f.severity.toUpperCase().padEnd(8)} ${f.id.padEnd(width)}  ${f.at}`);
    out.push(`${PAD}${f.message}`);
    out.push(`${PAD}fix: ${f.fix}`);
    if (explain) {
      for (const b of f.basis) out.push(`${PAD}basis: ${b.text} (${b.source}, ${b.url})`);
      if (f.own) out.push(`${PAD}the tool's own choice: ${f.own}`);
    }
    out.push('');
  }
  if (r.roles && r.roles.length) out.push(`Roles (${grouped(r.roles.length)})`, '', ...table(ROLE_HEAD, roleRows(r)), '');
  for (const n of r.notes) out.push(`note: ${n}`);
  if (r.notes.length) out.push('');
  out.push(r.notice, '');
  out.push(`RESULT: ${r.result.text}`);
  return `${out.join('\n')}\n`;
}

// Text for a markdown table cell or line: the characters markdown gives a meaning to are escaped.
const md = (t) => String(t).replace(/[\\`*_{}[\]<>()#+!|~]/g, (c) => `\\${c}`).replace(/\r?\n/g, ' ');

export function toMarkdown(r, { explain = false } = {}) {
  const out = [];
  out.push(`# marketplace-escrow-check: ${md(r.input.file)}`, '');
  out.push(`- File: ${md(fileLine(r))}`);
  for (const [k, v] of configLines(r)) out.push(`- ${k[0].toUpperCase()}${k.slice(1)}: ${md(v)}`);
  out.push(`- Findings: ${md(findingsLine(r))}`);
  out.push(`- Result: **${md(r.result.text)}**`, '');
  out.push('## Findings', '');
  if (!r.findings.length) out.push('None.', '');
  else {
    out.push('| Level | Check | Where | Message |', '| --- | --- | --- | --- |');
    for (const f of r.findings) out.push(`| ${f.severity} | ${f.id} | ${md(f.at)} | ${md(f.message)} Fix: ${md(f.fix)} |`);
    out.push('');
  }
  if (explain) {
    out.push('## Basis', '');
    const seen = new Set();
    for (const f of r.findings) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      out.push(`### ${f.id}`, '');
      for (const b of f.basis) out.push(`- ${md(b.text)} (${md(b.source)}, <${b.url}>)`);
      if (f.own) out.push(`- The tool's own choice: ${md(f.own)}`);
      if (!f.basis.length && !f.own) out.push('- A problem with the file itself; it rests on no page.');
      out.push('');
    }
  }
  if (r.roles && r.roles.length) {
    out.push(`## Roles (${grouped(r.roles.length)})`, '');
    out.push('| Role | Address | Held by |', '| --- | --- | --- |');
    for (const row of roleRows(r)) out.push(`| ${row.map(md).join(' | ')} |`);
    out.push('');
  }
  for (const n of r.notes) out.push(`Note: ${md(n)}`, '');
  out.push(`${md(r.notice)}`, '');
  return `${out.join('\n')}`;
}

export function toJson(r, { explain = false } = {}) {
  const out = { ...r, findings: r.findings.map((f) => (explain ? f : { ...f, basis: undefined, own: undefined })) };
  return `${JSON.stringify(out, null, 2)}\n`;
}

const SARIF_LEVEL = { error: 'error', warning: 'warning', info: 'note' };

// SARIF 2.1.0: the checks as rules of the driver, the configuration as the artifact, and one result for each finding
// with its line and column. The table of roles has no place in SARIF and is left out.
export function toSarif(r) {
  const sarif = {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'marketplace-escrow-check',
            version: r.version,
            informationUri: URI,
            rules: RULES.map((x) => ({
              id: x.id,
              name: x.id,
              shortDescription: { text: x.summary },
              help: { text: `${x.fix} (${x.kind})` },
              defaultConfiguration: { level: SARIF_LEVEL[x.severity] },
              properties: { kind: x.kind }
            }))
          }
        },
        artifacts: [{ location: { uri: r.input.file } }],
        results: r.findings.map((f) => ({
          ruleId: f.id,
          ruleIndex: RULES.findIndex((x) => x.id === f.id),
          level: SARIF_LEVEL[f.severity],
          message: { text: `${f.message} Fix: ${f.fix}` },
          locations: [{ physicalLocation: { artifactLocation: { uri: f.file, index: 0 }, region: { startLine: f.line, startColumn: f.column } } }],
          properties: { kind: f.kind, subject: f.subject }
        })),
        properties: { notice: r.notice, result: r.result.text, sources: SOURCES.map((s) => s.url) }
      }
    ]
  };
  return `${JSON.stringify(sarif, null, 2)}\n`;
}

// The list of checks, for --list-checks.
export function listChecksText() {
  const width = Math.max(...RULES.map((x) => x.id.length));
  const out = ['marketplace-escrow-check checks', ''];
  for (const x of RULES) out.push(`  ${x.id.padEnd(width)}  ${x.severity.padEnd(7)}  ${x.kind.padEnd(13)}  ${x.summary}`);
  out.push('', `A documented check rests on ${listText(['EIP-712', 'the smart contract security page of ethereum.org'], 8)}; a best practice check is this tool's own choice and says so in its message. An input check is about the file itself. None of it is legal or financial advice.`, '');
  return out.join('\n');
}

export function listChecksMarkdown() {
  const out = ['# marketplace-escrow-check checks', '', '| Check | Level | Kind | What it looks at |', '| --- | --- | --- | --- |'];
  for (const x of RULES) out.push(`| ${x.id} | ${x.severity} | ${x.kind} | ${md(x.summary)} |`);
  out.push('');
  return out.join('\n');
}

export function listChecksJson() {
  return `${JSON.stringify(RULES.map((x) => ({ id: x.id, severity: x.severity, kind: x.kind, summary: x.summary, fix: x.fix, basis: x.basis, own: x.own ?? null })), null, 2)}\n`;
}
