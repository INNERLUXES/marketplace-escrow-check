# Threat model

The tool is an input to a review of a marketplace escrow configuration before its contracts are deployed: not legal or
financial advice, not an audit of the escrow contracts and not a guarantee that funds will be released or refunded as
intended. This document is about the tool itself: what it touches, what a hostile or careless configuration can try,
and what stops it.

## What the tool touches

- It reads the one file named on the command line. Nothing else is opened, and no address, URL or path written in the
  file is looked up, opened or followed.
- It writes the report to standard output and its errors to standard error. It writes nothing to disk.
- It opens no network connection, fetches no URL, contacts no chain, node or API, signs nothing, deploys nothing, follows
  no symbolic link, runs nothing it reads, evaluates nothing and reads no clock and no locale.

## What the input may hold

A configuration comes from a deployment script or a person who edits it, and in a pipeline that checks every pull
request it may be written by whoever opened the pull request. Through it, a person can try to, or a careless change can:

- put a private key, a seed or a mnemonic in the file, as a key next to the owner or as a note, so that the tool copies
  it into a pipeline log, a pull request comment or a code scanning upload;
- hide a private key under `salt` or `termsHash`, where a hash of the same shape belongs;
- make the tool read outside the file: a link named on the command line, a folder, an address given as the path;
- make the tool reach a chain or a server: an address of a contract or a token written in the file;
- exhaust the memory, the stack or the time: a file of many megabytes, a hundred thousand arbiters or signers of one
  address, a hundred thousand milestones, arrays and objects nested very deep, very long names and addresses, numbers
  with thousands of digits;
- move the result: a key written twice so that two readers see two owners, a misspelt key that hides an appeal window, a
  field of the wrong type that might be taken as fine, amounts that a floating point number would read wrongly;
- slip in something that is not text: a binary file named `.json`, bytes that are not valid UTF-8 or UTF-16;
- rewrite the terminal or break the output: control characters, escape sequences, direction controls and line separators
  in a domain name, a milestone name, a symbol or an address;
- hide markup in the markdown report: a link, a table separator or a tag in a name;
- change how objects behave: a key, a symbol or a release mode named `__proto__`, `constructor` or `toString`.

## What could go wrong, and what stops it

| Risk | Control |
| --- | --- |
| A secret in the file is copied into the output | Before the file is read, every key and value is looked at for a key or a seed; each one found is a `secret-in-file` error, the value is marked, the reader leaves it out as if it were not there, and no message names it. Tests put each shape under several fields and check every format for the value |
| A key under `salt` or `termsHash` is copied into the output | A value of 64 hex digits there is read as a hash and is not reported, and the tool never shows the value of either key; any other shape there is still a secret. A test checks every format for the hashes of a file |
| A link makes the tool read a file it was not given | The path is checked with `lstat` and a link is refused by name; the file is opened with `O_NOFOLLOW` where the system has it, and its type and size are taken from the open handle. A test puts a link in the folder |
| The tool reaches a chain or a server, fetches, connects, signs or runs something | No module of the network or of child processes is imported, nothing is evaluated, an address is only text that is checked for its form, and a path that looks like an address is refused. A test checks the imports of src |
| The memory, the stack or the time is exhausted | The file has a size limit checked on the open handle before it is read; the reader keeps limits of nesting, values and string length; the JSON reader, the search for secrets and the walk for hashes keep stacks of their own; at most 100 tokens, 100 milestones, 1,000 arbiters and 100 signers are read, and duplicates are found with one map, never by comparing every pair. Tests check the time, with limits that widen under coverage only |
| A key written twice hides a value | A key written twice in one JSON object is a `file-unreadable` finding |
| A misspelt or missing field passes for one that is fine | A key the tool does not read is a `field-unknown` finding with the key it is probably meant to be; a missing field is `field-missing`; a value of the wrong type is `field-invalid`; each with its line |
| Amounts or shares are read wrongly | Amounts are read from the characters of the file with BigInt, shares are whole numbers of basis points; an exponent or a separator is refused, and a number past its limit is a finding, never rounded |
| A binary file or bytes in another encoding are read as text | A null byte in UTF-8, an odd number of bytes in UTF-16 and bytes that are not valid make the file an input error with exit code `2` and no report |
| Text from the file rewrites the terminal | Every text from the input goes through `safeText`, which replaces control, line separator and direction characters and caps the length. A test puts escapes and direction controls in a domain name and in milestone names, in every format |
| Markup in a name changes the markdown report | The markdown report escapes the characters markdown gives a meaning to. A test writes a link into the name of the domain |
| `__proto__` changes how objects behave | Objects of the file are lists of entries compared with the names the tool reads, and no object is built with a key from the file; known tokens are looked up with `Object.hasOwn`. A test uses `__proto__`, `constructor`, `hasOwnProperty` and `toString` as keys, symbols and release modes |
| The time of the run changes the result | No clock is read; every length is a number of the file, so the same file and options give the same report on every day |
| A device or a pipe hangs the tool | A path that is not a regular file is refused before it is read |
| The tool leaves files behind | Nothing is written to disk; there is no cache, no temporary file and no log. A test checks that a run leaves the folder as it was |

## Out of scope

Whether the configuration matches the contracts that are deployed, whether an address is the multisig or the timelock
the file says it is, whether a token contract answers the decimals of the file, whether the escrow is lawful where it is
offered, the forms and secrets docs/limits.md says the tool does not see, who may change or upload the file, and where
your pipeline keeps the output.
