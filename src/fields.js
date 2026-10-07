// Reading fields from the nodes of the JSON reader. Every field is read with the line and column of its key, so a
// finding can point at it. A field that is of the wrong type or unknown is a finding of its own, and its value is left
// out of the checks that need it; nothing that was not read is taken for a value that is fine. Keys of the file are only
// compared with the names the tool reads; no object is built with a key from the file. A value that src/secrets.js
// marked as a seed or a key is left out as if it were not there, and never shown.

import { isArray, isNumber, isObject, isString } from './json.js';
import { parseDecimal } from './decimal.js';

export const where = (e) => ({ line: e.line, column: e.column });

// A text from the file as a message names it: cut at a length, so that a long value does not fill a report.
export const cut = (text, max = 120) => (text.length > max ? `${text.slice(0, max - 3)}...` : text);

// Whether two texts are one letter apart: one letter added, left out or changed.
export function oneEdit(a, b) {
  if (Math.abs(a.length - b.length) > 1 || a === b) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

// A known key that an unknown one is probably meant to be: the same letters in another case or with other separators,
// one a letter apart, or one that starts with the other.
export function suggestKey(key, known) {
  const k = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (k.length < 3) return null;
  const flat = (n) => n.toLowerCase();
  return known.find((n) => flat(n) === k) ?? known.find((n) => oneEdit(flat(n), k)) ?? known.find((n) => flat(n).startsWith(k) || k.startsWith(flat(n))) ?? null;
}

export const describe = (node) => (node.secret ? 'a value that is not shown' : node.kind === 'object' ? 'an object' : node.kind === 'array' ? 'a list' : node.kind === 'null' ? 'null' : node.kind === 'boolean' ? `${node.value}` : node.kind === 'number' ? `the number ${node.raw.length > 40 ? `${node.raw.slice(0, 37)}...` : node.raw}` : 'text');

// Reads an amount: { state, value, text } with state 'ok', 'zero', 'negative' or 'nan'; never through a floating point
// number.
export function readAmount(text) {
  if (text.startsWith('-') && parseDecimal(text.slice(1))) return { state: 'negative', value: null, text };
  const d = parseDecimal(text);
  if (!d) return { state: 'nan', value: null, text };
  if (d.int === 0n) return { state: 'zero', value: d, text };
  return { state: 'ok', value: d, text };
}

// Reads a share in basis points: { state, value, text } with state 'ok' (a whole number from 0 to 10000), 'negative',
// 'fraction', 'above' or 'nan' (not a plain decimal number at all). Never through a floating point number.
export function readBps(text) {
  const negative = text.startsWith('-');
  const d = parseDecimal(negative ? text.slice(1) : text);
  if (!d) return { state: 'nan', value: null, text };
  if (negative && d.int !== 0n) return { state: 'negative', value: null, text };
  const whole = d.int / 10n ** BigInt(d.scale);
  if (whole * 10n ** BigInt(d.scale) !== d.int) return { state: 'fraction', value: null, text };
  if (whole > 10000n) return { state: 'above', value: null, text };
  return { state: 'ok', value: Number(whole), text };
}

const WHOLE = /^(?:0|[1-9][0-9]{0,11})$/;

// The form of a hash of 32 bytes, such as a salt or the hash of a terms document: 64 hex digits, with or without 0x.
export const HASH_FORM = /^(?:0x)?[0-9a-fA-F]{64}$/;

// The fields of the file, with the findings of what could not be read.
export class Reader {
  constructor(file = 'config') {
    this.file = file;
    this.findings = [];
  }

  add(id, at, message, subject = null) {
    this.findings.push({ id, file: this.file, line: at.line, column: at.column, message, subject });
  }

  // The entries of an object, with a field-unknown finding for each key that is not in known, and the first entry of
  // each known key in a map. A key that names a seed or a key was reported by src/secrets.js and is passed over.
  fields(obj, known, label) {
    const map = new Map();
    for (const e of obj.entries) {
      if (e.secret) continue;
      if (known.includes(e.key)) map.set(e.key, e);
      else {
        const near = suggestKey(e.key, known);
        this.add('field-unknown', where(e), `The key "${cut(e.key)}" of ${label} is not one the tool reads, so its value was left out of every check.${near ? ` Did you mean "${near}"?` : ''} The keys of ${label} are ${known.join(', ')}.`);
      }
    }
    return map;
  }

  // An object field: the node, or null when it is missing, a secret or not an object (a finding).
  object(map, key, of, what) {
    const e = map.get(key);
    if (!e) return { value: null, entry: null };
    if (e.value.secret) return { value: null, entry: e, invalid: true };
    if (!isObject(e.value)) {
      this.add('field-invalid', where(e), `The ${key} of ${of} is ${describe(e.value)}; it must be an object with ${what}.`);
      return { value: null, entry: e, invalid: true };
    }
    return { value: e.value, entry: e };
  }

  // A text field: null when it is missing, empty, of another type or marked as a secret; invalid is true when it is there
  // but could not be read, so that it is not reported as missing too.
  text(map, key, of) {
    const e = map.get(key);
    if (!e) return { value: null, entry: null };
    if (e.value.secret) return { value: null, entry: e, invalid: true };
    if (!isString(e.value)) {
      this.add('field-invalid', where(e), `The ${key} of ${of} is ${describe(e.value)}; it must be text.`);
      return { value: null, entry: e, invalid: true };
    }
    if (e.value.value.trim() === '') return { value: null, entry: e };
    return { value: e.value.value.trim(), entry: e, raw: e.value.value };
  }

  // One of a few words, compared in small letters: the word as the list writes it, or null with a finding.
  choice(map, key, of, options) {
    const r = this.text(map, key, of);
    if (r.value === null) return r;
    const v = r.value.toLowerCase();
    const found = options.find((o) => o === v);
    if (found) return { value: found, entry: r.entry };
    this.add('field-invalid', where(r.entry), `The ${key} of ${of} is "${cut(r.value, 40)}"; it must be one of ${options.join(', ')}.`);
    return { value: null, entry: r.entry, invalid: true };
  }

  // A decimal field: { value: the text, entry } with the text of the number or of the string, or null.
  amount(map, key, of) {
    const e = map.get(key);
    if (!e) return { value: null, entry: null };
    if (e.value.secret) return { value: null, entry: e, invalid: true };
    if (!isNumber(e.value) && !isString(e.value)) {
      this.add('field-invalid', where(e), `The ${key} of ${of} is ${describe(e.value)}; it must be a decimal number, written as a number or as text.`);
      return { value: null, entry: e, invalid: true };
    }
    const t = isNumber(e.value) ? e.value.raw : e.value.value.trim();
    return { value: t === '' ? null : t, entry: e };
  }

  // A whole number from min up to max: null when it is missing or invalid; a missing field is not a finding here. A JSON
  // string of digits is read too.
  whole(map, key, of, { min = 0, max, what }) {
    const e = map.get(key);
    if (!e || e.value.secret) return { value: null, entry: e ?? null, invalid: Boolean(e) };
    const raw = isNumber(e.value) ? e.value.raw : isString(e.value) ? e.value.value.trim() : null;
    if (raw === '' && isString(e.value)) return { value: null, entry: e };
    if (raw === null || !WHOLE.test(raw) || Number(raw) < min || Number(raw) > max) {
      this.add('field-invalid', where(e), `The ${key} of ${of} is ${isString(e.value) ? `"${cut(e.value.value, 40)}"` : describe(e.value)}; it must be a whole number of ${what} from ${min} to ${max}.`);
      return { value: null, entry: e, invalid: true };
    }
    return { value: Number(raw), entry: e };
  }

  // A yes or no field: true or false.
  flag(map, key, of) {
    const e = map.get(key);
    if (!e || e.value.secret) return { value: null, entry: e ?? null, invalid: Boolean(e) };
    if (e.value.kind === 'boolean') return { value: e.value.value, entry: e };
    this.add('field-invalid', where(e), `The ${key} of ${of} is ${isString(e.value) ? `"${cut(e.value.value, 40)}"` : describe(e.value)}; it must be true or false.`);
    return { value: null, entry: e, invalid: true };
  }

  // A hash of 32 bytes: { value, zero, entry }, with value the text and zero true when every digit is 0; a value of
  // another form is a finding. The value is never put in a message.
  hash(map, key, of) {
    const r = this.text(map, key, of);
    if (r.value === null) return r;
    if (!HASH_FORM.test(r.value)) {
      this.add('field-invalid', where(r.entry), `The ${key} of ${of} is not a hash of 32 bytes; it must be 64 hex digits, with or without 0x in front.`);
      return { value: null, entry: r.entry, invalid: true };
    }
    return { value: r.value, zero: /^(?:0x)?0{64}$/.test(r.value), entry: r.entry };
  }

  // A list of texts: each item is { value, raw, node }; an item that is not text is a finding and left out.
  list(map, key, of) {
    const e = map.get(key);
    if (!e || e.value.secret) return { value: null, entry: e ?? null, invalid: Boolean(e) };
    if (!isArray(e.value)) {
      this.add('field-invalid', where(e), `The ${key} of ${of} is ${describe(e.value)}; it must be a list of texts.`);
      return { value: null, entry: e, invalid: true };
    }
    const items = [];
    for (const node of e.value.items) {
      if (node.secret) continue;
      if (!isString(node) || node.value.trim() === '') {
        this.add('field-invalid', where(node), `An item of the ${key} of ${of} is ${isString(node) ? 'empty' : describe(node)}; it must be text.`);
        continue;
      }
      items.push({ value: node.value.trim(), raw: node.value, node });
    }
    return { value: items, entry: e };
  }
}
