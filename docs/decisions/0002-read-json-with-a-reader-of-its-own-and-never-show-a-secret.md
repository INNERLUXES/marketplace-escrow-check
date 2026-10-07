# 2. Read JSON with a reader of its own, and never show a secret

## Status

Accepted

## Context

An escrow configuration is a JSON file. `JSON.parse` would read it, but it keeps no line and column of a value, so a
finding could not point at the role or the milestone to change; it takes the last of two values written under one key
without a word, so two readers of the same file could see two owners; it builds objects whose keys come from the file;
and it turns every number into a floating point number, so that a stake of 0.1 and one of 0.2 do not add up to 0.3 and
an amount with more places than its token keeps can slip through.

A deployment configuration sits next to the keys that deploy it, and a careless file can hold a secret: the private key
of the deployer pasted next to the owner, a seed phrase in a note. A tool that reads such a file and echoes its values in
a report would copy the secret into a pipeline log, a pull request comment or a SARIF upload, where many more people can
read it.

A configuration also holds values of 32 bytes that are not secrets: the salt of the EIP-712 domain and the hash of the
terms of the escrow. Written as 64 hex digits, they have exactly the shape the search for secrets of the sibling tools
reads as a private key in hex.

A configuration that is not complete (a multisig with no threshold, a misspelt appeal window) would also be read as if it
were, and a check could take a value it never saw for one that is fine.

## Decision

1. The file is read by src/json.js, the reader of the sibling tools for strict JSON, kept unchanged, with the line and
   column of every value, a key written twice as an error, and limits of nesting, values and string length. It does not
   recurse. Every number keeps the characters it was written with.
2. Amounts are read from the characters of the file by src/decimal.js, kept unchanged from the sibling tools, into a
   whole number and a scale, and shares in basis points are read as whole numbers with BigInt. A number with an exponent,
   a sign where none belongs or a separator is a finding, never rounded.
3. The tool never asks for a private key, a seed or an API key: it checks the configuration as written. Before the file
   is read, src/secrets.js, kept unchanged from the sibling tools, walks every key and value of it. A key named for a key
   or a seed, and a value shaped like a mnemonic, an extended private key, a private key in hex or a key in WIF, is a
   `secret-in-file` error at its line. The value is marked, the reader leaves it out as if it were not there, and no
   report and no error message shows it, in any format. An address of 40 hex digits is never taken for a key.
4. A value of 64 hex digits, with or without 0x, under the key `salt` or `termsHash` is read as the hash it is meant to
   be: src/check.js drops the finding of the search for that one value and reads it as a hash. The tool never shows the
   value of either key in any report, so a key pasted there by mistake is not echoed either. Under any other key the
   same value is still a `secret-in-file` error, and a mnemonic or a key in WIF under these keys is still one too.
5. Every field the checks need and the file does not give, every key the tool does not read and every value of the wrong
   type is returned with its line and shown as a finding. A check never takes a value it did not read for one that is
   fine.
6. The checks are a heuristic over the configuration as written, and every report says so; docs/method.md says what each
   check reads and docs/limits.md what it cannot see. The result is an input to a review of a marketplace escrow
   configuration before its contracts are deployed: not legal or financial advice, not an audit of the escrow contracts
   and not a guarantee that funds will be released or refunded as intended.

## Consequences

- The tool needs no install and no network, and the same file gives the same report on Linux, Windows and macOS.
- A finding points at the line of the field, the token, the milestone or the role it is about.
- A secret in the file fails the run and is never copied into the output. The shapes are loose, so a value that only
  looks like a secret, such as a note of twelve short lowercase words, is reported too; that is the safe side.
- A private key pasted under `salt` or `termsHash` cannot be told apart from a hash and is not reported; it is not shown
  either, and docs/limits.md says so. A 64-hex value under another key, such as a domain separator worked out by hand, is
  reported as a key; the configuration leaves such fields out.
- YAML, TOML, Solidity constants and deployment scripts are not read (docs/limits.md).
