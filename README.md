# marketplace-escrow-check

Marketplace escrow check. Give it the configuration of the escrow of a peer to peer marketplace as JSON, before its
contracts are deployed: the chain id; the payment tokens with their address, decimals and chain; the platform fee and
its recipient; the escrow rules, with the release mode (by the buyer, by time or both), the release timeout, the
dispute window, the refund path, partial refunds and the milestones an order is released in; the dispute setup, with
the arbiters, the panel size, the quorum, the arbiter fee and the appeal window; the stake a seller locks and its slash
share; the roles (owner, pauser, upgrader, fee setter, treasury, timelock) with the multisig that should hold them; the
EIP-712 domain of signed listings; and the largest order. It reads the file and lists the mistakes a smart contract
developer would catch before deployment: a release that can fire before the dispute window closes, no way to refund the
buyer, funds that wait on the buyer alone, a fee that is too high, written wrong or sent to the zero address, milestones
that are not the whole order or release nothing, a dispute quorum that can never be met, a single arbiter or one who is
paid by the marketplace or holds a role, a slash share that cannot be applied, roles held by one key, a multisig of one
signature or one that can never act, an upgrade with no timelock, an EIP-712 domain of another chain, with missing
fields or a zero verifying contract, tokens of another chain or with the wrong decimals, malformed or zero addresses and
no largest order. Every finding has its id, level, message and line, and the run exits with a code a pipeline can act
on.

**It is an input to a review of a marketplace escrow configuration before its contracts are deployed:
not legal or financial advice, not an audit of the escrow contracts and not a guarantee that funds will be released or
refunded as intended.** It is not legal advice and not financial advice. It reads one file only: it contacts no chain, node or API,
fetches nothing, signs nothing, deploys nothing, runs nothing, needs no key and reads no clock, so it does not know
whether the contracts follow the file, whether the address named as the multisig is one, or what a token contract
answers; the checks are a heuristic. A clean run means only that none of the problems of its checks were found in the
file, and the team still has to review its contracts and decide its fees, lengths and arbiters itself.

An escrow holds the money of other people, and the values it is deployed with are hard to change afterwards. EIP-712
says what the domain of a signed message holds and that a wallet should refuse a domain of another chain; the security
page of ethereum.org calls a single owner key a single point of failure and suggests a multi-signature account.
Everything else a careful team checks on an escrow comes from practice rather than from a standard: a release that waits
for the dispute window, a way back to the buyer, milestones that add up to the order, a quorum a panel can reach,
arbiters who are neither paid by the marketplace nor hold its keys, a timelock in front of upgrades, and addresses that
someone holds. A timer one day too short or a fee recipient of zeros is easy to miss in a deployment script and costly
once the contracts hold funds. This tool reads the configuration on every change and points at the line.

- **One check per problem.** Thirty-two checks, each with what it looks at, what it cannot see, the public pages it
  rests on and what to change. Four are documented, by EIP-712 and by the security page of ethereum.org; the others are
  best practices of this tool, and each message says which. EIP-712 says its standard has no replay protection, so the
  tool never claims that the chainId of a domain stops a replay; it says only that a wallet should refuse a domain of
  another chain.
- **The file's own numbers.** Fees, shares, seconds, counts and amounts come from the file. The one threshold of the
  tool's own, the fee of `fee-too-high`, is a warning that `--max-fee-bps` moves.
- **No clock.** Every length is a number of seconds of the file, so the same file and options give the same report on
  any day.
- **Never a secret.** The tool needs no private key, no seed and no API key. A key named for a private key or a seed,
  and a value shaped like a mnemonic, an extended private key, a private key in hex or a key in WIF, is an error, and the
  value is never shown in any report. A salt of the domain or a hash of the terms is read as the hash it is, and its
  value is never shown either.
- **Numbers as written.** Amounts are read from the characters of the file and shares are whole numbers of basis
  points, never a floating point number, so a stake with one place too many for its token is caught.
- **A strict reader of its own.** The JSON reader keeps the line and column of every value, so a finding points at the
  role or the milestone; a key written twice stops the reader instead of letting two readers see two values. What the
  file does not say is listed as a finding, never taken for a value that is fine.
- Reports as text, markdown, JSON and SARIF, with an exit code for a pipeline: `0` no finding at or above the
  `--fail-on` level, `1` a finding at or above it, `2` usage or input error.
- Plain JavaScript, no dependencies, no clock and no network.

```
npm test
```

```
tests 135
pass 133
fail 0
skipped 2
```

These are the summary lines that `npm test` prints at the end on Windows. The skipped tests are the ones that need a
symbolic link or a device (a link to a configuration, and `/dev/null` named as a file); they are guarded with
`process.platform`, run on Linux and macOS, and none of them asserts a line. `npm run test:coverage` runs the same tests
with coverage; their time limits are four times wider when coverage is on.

## Quick start

Requires Node 22 or newer. There is nothing to install.

```
git clone https://github.com/INNERLUXES/marketplace-escrow-check.git
cd marketplace-escrow-check
node bin/marketplace-escrow-check.js examples/bad/escrow.json
```

Or without a clone, in your own project:

```
npx --yes github:INNERLUXES/marketplace-escrow-check escrow.json
```

`examples/` holds two made-up configurations on chain id 1. Every name in them is made up, every address and hash is
one character written many times, and none holds a real key or seed. The bad file, in `examples/bad`, holds a finding of
nearly every check: USDC with 18 decimals and WETH at a cut short address on another chain; a fee of 15% to the zero
address; a release after 3 days with a dispute window of 7; a refund path of "none"; partial refunds written as "yes";
milestones of 50% and 30% and one of 0% with no name; three arbiters of whom one is listed twice and is the treasury and
another is the pauser, a panel of 1 with a quorum of 2, an arbiter fee of 2.5 basis points and a misspelt appeal window;
a stake slashed by 120%; an owner, an upgrader and a treasury held by single keys, a fee setter of zeros, a seed phrase
next to the roles and a multisig of 3 signatures with 2 signers; an EIP-712 domain of chain id 10 with no version and a
zero verifying contract; and no largest order. Three checks do not fire on it: `file-unreadable`, because the file can
be read, and `release-timeout-missing` and `multisig-threshold-low`, which cannot fire in the same file as
`release-before-dispute-window` and `multisig-threshold-unreachable`; the tests cover all three. The good file, in
`examples/good`, passes at error, warning and info level: USDC and the native ETH, a fee of 2.5% to the multisig, a
release on confirmation or after 14 days with a dispute window of 7, a refund by the seller or the arbiters, three
milestones of 30%, 30% and 40% with the hash of the terms, five arbiters with a panel of 3, a quorum of 2 and an appeal
window of 3 days, a stake of 100 USDC slashed by half, every role but the pauser held by a multisig of 3 of 5 signers,
upgrades behind a timelock, a domain of chain id 1 with its salt, and a largest order of 50000 USDC.

## Usage

```
marketplace-escrow-check <escrow.json> [options]
```

```
--format <name>            text, markdown, json or sarif (default: text)
--json                     the same as --format json
--min-severity <level>     the lowest level of a finding that is shown: info, warning, error (default: info)
--fail-on <level>          the lowest level of a finding that fails the run: info, warning, error (default: error)
--max-fee-bps <n>          the fee above which fee-too-high warns, 0 to 10000 basis points (default: 1000)
--explain                  show the points of the pages behind each finding (text, markdown and JSON)
--list-checks              list the checks with their level and kind, and exit
--help                     show the usage
--version                  show the version
```

[docs/inputs.md](docs/inputs.md) lists every field, with a short file. The path in the report is relative to the folder
you run the command in, with forward slashes on every system, followed by the line.

The file is the tool's own format. A deployment script writes it from the values it passes to the escrow contracts,
whatever those contracts are; the checks stay the same.

The report of the bad example starts with what was read, the findings in one line, and the checks with the number of
findings of each; then the findings, errors first, each with what to change:

```
marketplace-escrow-check: examples/bad/escrow.json
file: examples/bad/escrow.json (JSON, 39 lines, 1,894 bytes)
chain id: 1
tokens: 2: USDC, at 0x8888888888888888888888888888888888888888, 18 decimals, chain id 1; WETH, at 0x12345, 18 decimals, chain id 10
platform fee: 1,500 basis points (15%) to 0x0000000000000000000000000000000000000000
escrow: release on buyer confirmation or after a timeout; release timeout 259,200 seconds (3 days); dispute window 604,800 seconds (7 days); refund path none; 3 milestones (Design 50%, Build 30%, milestone 3 0%)
dispute: 3 arbiters, panel of 1, quorum of 2, appeal window none
stake: 100 USDC, slash not read
eip712 domain: name Example Escrow, version none, chain id 10, verifying contract 0x0000000000000000000000000000000000000000
max order: not set
max fee: 1,000 basis points (10%), from --max-fee-bps
findings: 31 (19 error, 9 warning, 3 info)

Checks (32)

  check                           level    kind           findings
  file-unreadable                 error    input          0
  field-missing                   error    input          1
  field-unknown                   warning  input          1
  field-invalid                   error    input          1
  field-duplicate                 error    input          1
  secret-in-file                  error    input          1
  fee-invalid                     error    input          1
  release-before-dispute-window   error    best practice  1
  no-refund-path                  error    best practice  1
  release-timeout-missing         warning  best practice  0
  fee-too-high                    warning  best practice  1
  fee-recipient-zero              error    best practice  1
  milestone-shares-not-100        error    best practice  1
  milestone-empty                 error    best practice  1
  quorum-unreachable              error    best practice  1
  single-arbiter                  warning  best practice  1
  arbiter-is-party                warning  best practice  1
  arbiter-is-admin                warning  best practice  1
  appeal-window-missing           info     best practice  1
  stake-slash-invalid             error    best practice  1
  admin-single-key                warning  documented     3
  multisig-threshold-low          warning  documented     0
  multisig-threshold-unreachable  error    best practice  1
  upgrader-without-timelock       info     best practice  1
  eip712-domain-chain-mismatch    error    documented     1
  eip712-domain-missing-field     warning  best practice  1
  verifying-contract-zero         error    documented     1
  token-chain-mismatch            error    best practice  1
  token-decimals-invalid          error    best practice  1
  address-malformed               error    best practice  1
  zero-address                    error    best practice  1
  max-order-missing               info     best practice  1

```

A finding names its check, its level, the line of the field and what to change. With `--explain` it also gives the
points of the pages behind it and, for a best practice check, the tool's own choice:

```
  ERROR    eip712-domain-chain-mismatch    examples/bad/escrow.json:38
           The chainId of the EIP-712 domain is 10, but the escrow is deployed on chain id 1. EIP-712 has a wallet decline to sign when the chainId of the domain is not the one of the active chain, so listings would be refused or signed for another chain.
           fix: Set the chainId of the domain to the chain the escrow is deployed on, or correct the chain id of the file.
           basis: In the signing domain of EIP-712 the chainId field holds the EIP-155 id of the chain, and a wallet is expected to decline to sign when that id is not the one of the chain it is connected to. (EIP-712: Typed structured data hashing and signing, https://eips.ethereum.org/EIPS/eip-712)
```

After the findings comes the table of the roles, with who holds each: the multisig, the timelock or one key:

```
Roles (7)

  role        address                                     held by
  owner       0x1111111111111111111111111111111111111111  one key
  pauser      0x5555555555555555555555555555555555555555  one key
  upgrader    0x6666666666666666666666666666666666666666  one key
  fee setter  0x0000000000000000000000000000000000000000  zero address
  treasury    0x7777777777777777777777777777777777777777  one key
  timelock    -                                           -
  multisig    0x2222222222222222222222222222222222222222  3 of 2 signers
```

The end of the report holds the notes, if any, the notice and the result:

```
This report is an input to a review of a marketplace escrow configuration before its contracts are deployed: not legal or financial advice, not an audit of the escrow contracts and not a guarantee that funds will be released or refunded as intended.

RESULT: FAIL - 19 findings at or above error (19 error, 9 warning, 3 info)

```

The good example passes:

```
  none

Roles (7)

  role        address                                     held by
  owner       0x2222222222222222222222222222222222222222  multisig
  pauser      0x5555555555555555555555555555555555555555  one key
  upgrader    0x9999999999999999999999999999999999999999  timelock
  fee setter  0x2222222222222222222222222222222222222222  multisig
  treasury    0x2222222222222222222222222222222222222222  multisig
  timelock    0x9999999999999999999999999999999999999999  timelock
  multisig    0x2222222222222222222222222222222222222222  3 of 5 signers

This report is an input to a review of a marketplace escrow configuration before its contracts are deployed: not legal or financial advice, not an audit of the escrow contracts and not a guarantee that funds will be released or refunded as intended.

RESULT: PASS - no finding at or above error

```

## How the file is read

1. The path is resolved against the folder you run the command in. A link, a folder, a device or a file over 16 MB is
   refused, and so is a file that is not UTF-8 (or UTF-16 with a byte order mark) or holds a null byte, with exit code
   `2` and no report.
2. The file is read as strict JSON, whatever its name. The reader keeps the line and column of every value and refuses
   a key written twice in one object.
3. Every key and value of the file is looked at for a private key or a seed. One that is found is an error at its line,
   and its value is left out of everything that follows and never shown. A hash under `salt` or `termsHash` is read as a
   hash.
4. The fields are read with their lines. A key the tool does not read is a `field-unknown` finding; a missing field, a
   value of the wrong type and a fee that is not a whole number of basis points are findings of their own, and that
   value is left out of the checks that need it.
5. The release and the refund, the fees, the milestones, the dispute setup, the stake, the roles, the EIP-712 domain,
   the tokens, the addresses and the limits are checked.

[docs/method.md](docs/method.md) says what each check reads, and [docs/inputs.md](docs/inputs.md) lists the fields and
the units.

## What it checks

| Check | Level | Kind | What it reports |
| --- | --- | --- | --- |
| `release-before-dispute-window` | error | best practice | a release by time at or before the end of the dispute window |
| `no-refund-path` | error | best practice | no way back to the buyer: no refund path, "none" or an empty list |
| `release-timeout-missing` | warning | best practice | funds released by the buyer alone, with no release by time |
| `fee-too-high` | warning | best practice | a platform or arbiter fee above `--max-fee-bps`, 1000 by default |
| `fee-recipient-zero` | error | best practice | a platform fee above 0 sent to the zero address |
| `milestone-shares-not-100` | error | best practice | milestone shares that do not add up to 10000 basis points |
| `milestone-empty` | error | best practice | an empty list of milestones, or a milestone of 0 |
| `quorum-unreachable` | error | best practice | a quorum above the panel, or a panel above the arbiters |
| `single-arbiter` | warning | best practice | one arbiter, or a panel of one |
| `arbiter-is-party` | warning | best practice | an arbiter who is the fee recipient or the treasury |
| `arbiter-is-admin` | warning | best practice | an arbiter who holds a role of the contracts |
| `appeal-window-missing` | info | best practice | no appeal window, or one of 0 seconds |
| `stake-slash-invalid` | error | best practice | a slash share outside 0 to 10000, or on a stake of 0 |
| `admin-single-key` | warning | documented | the owner, upgrader, fee setter or treasury not held by the multisig |
| `multisig-threshold-low` | warning | documented | a multisig of one signature |
| `multisig-threshold-unreachable` | error | best practice | a threshold above the signers |
| `upgrader-without-timelock` | info | best practice | an upgrader that is not a timelock |
| `eip712-domain-chain-mismatch` | error | documented | an EIP-712 domain of another chain id than the file |
| `eip712-domain-missing-field` | warning | best practice | an EIP-712 domain with no name, version, chainId or verifyingContract |
| `verifying-contract-zero` | error | documented | an EIP-712 verifying contract of zeros |
| `token-chain-mismatch` | error | best practice | a token of another chain id than the file |
| `token-decimals-invalid` | error | best practice | decimals outside 0 to 36, or not those of a token the tool knows |
| `address-malformed` | error | best practice | an address that is not 0x and 40 hex digits |
| `zero-address` | error | best practice | the zero address as a token, a role, a signer or an arbiter |
| `max-order-missing` | info | best practice | no largest order value |
| `fee-invalid` | error | input | a fee that is not a whole number of basis points from 0 to 10000 |
| `secret-in-file` | error | input | a key or a seed; its value is never shown |
| `field-duplicate` | error | input | a token, an arbiter or a signer listed twice, or two milestones of one name |
| `field-invalid` | error | input | a value of the wrong type or form |
| `field-unknown` | warning | input | a key the tool does not read, often a misspelt one |
| `field-missing` | error | input | a field the checks need |
| `file-unreadable` | error | input | a file that is not strict JSON, or holds no object |

A documented check rests on EIP-712 or on the security page of ethereum.org. A best practice check is this tool's own
choice, and its message says "a best practice of this tool, not a rule in the pages it cites". `--list-checks` shows the
kind of each check. Some of the choices are worth a word:

- `eip712-domain-chain-mismatch` and `verifying-contract-zero` are documented: EIP-712 has a wallet refuse to sign for a
  chainId that is not the active chain, and names the verifying contract as the contract that checks the signature.
  `eip712-domain-missing-field` is a best practice, because EIP-712 lets a protocol leave fields out.
- `admin-single-key` and `multisig-threshold-low` are documented by the security page of ethereum.org, which calls one
  owner key a single point of failure and gives a multisig the consent of more than one party. The pauser is left out
  of `admin-single-key` on purpose: a pause is meant to be fast.
- `release-before-dispute-window` reports equal lengths too: a dispute opened in the last second races the release.
- `release-timeout-missing`, `single-arbiter`, `arbiter-is-party` and `arbiter-is-admin` are warnings: each can be a
  choice a small marketplace makes knowingly. `appeal-window-missing`, `upgrader-without-timelock` and
  `max-order-missing` are notes.
- A value of 64 hex digits under `salt` or `termsHash` has the shape of a private key in hex and is read as the hash it
  is; under any other key it is `secret-in-file`.

## What is not checked

[docs/limits.md](docs/limits.md) lists what the tool cannot see. Among them: the law, taxes and fees (ask counsel and
decide them yourself); the contracts, so whether they follow the file, start the release timer where the file means,
enforce the largest order or keep nonces against replay; the chain, so whether an address is the multisig or the
timelock the file says, what threshold a multisig really has and what decimals a token answers; the people behind the
addresses; time on chain; the checksum of an address; tokens outside a short list; and secrets in a shape the search
does not know.

## Formats

`--format text` (the default) is for a terminal. `--format markdown` is a report for a job summary or a pull request,
with a table of findings and the table of roles. `--format json` writes every finding with its `id`, `severity`,
`message`, `file`, `line`, `column`, `subject` and `fix`, what the file says, the table of roles, and with `--explain`
the points of the pages. `--format sarif` writes SARIF 2.1.0, with the checks as rules, the configuration as the
artifact and a result for each finding with its line and column, for code scanning; the table of roles has no place in
it. The saved output of the examples is in [examples/output](examples/output).

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | no finding at or above the `--fail-on` level (default `error`) |
| `1` | a finding at or above it |
| `2` | a usage error, such as an unknown option or a `--max-fee-bps` that is not a whole number from 0 to 10000, or an input error such as a path that does not exist, a link or a folder, or a file that is not text or is too large; there is no report |

Findings below `--min-severity` are not shown, and still count for the result.

## Limits

The tool reads the one file it is given; it contacts no chain or node and connects to nothing. A run reports the
problems of docs/method.md that the file holds. [docs/limits.md](docs/limits.md) lists what it cannot see, with the size
limits: 16 MB for the file, 100 tokens, 100 milestones, 1,000 arbiters, 100 signers, JSON nested up to 1,000 deep,
amounts of up to 40 digits on each side of the point, and whole numbers up to 999,999,999,999.
[docs/threat-model.md](docs/threat-model.md) lists the risks of reading a configuration from a pull request or an upload
and their controls, and [docs/secure-defaults.md](docs/secure-defaults.md) the defaults and how to run the tool in a
pipeline.

## Architecture

Plain ES modules in `src/`, with no dependencies.

| File | Job |
| --- | --- |
| `src/cli.js` | the command line, the usage and the exit codes |
| `src/check.js` | reads the file as JSON, looks for keys and seeds with the hashes set apart, reads the fields, runs the checks and builds the report of the run |
| `src/files.js` | the bounded reading of a file by its byte order mark, with no link followed, kept from the sibling tools |
| `src/json.js` | the JSON reader of the sibling tools: lines and columns, keys written twice, limits, a stack of its own |
| `src/secrets.js` | the search for keys and seeds by the name of a key and the shape of a value, kept from the sibling tools |
| `src/decimal.js` | amounts read from the characters of a file and worked out with BigInt, kept from the sibling tools |
| `src/fields.js` | reading text, choices, amounts, basis points, whole numbers, flags, hashes and lists with their lines |
| `src/config.js` | the fields of the file: the tokens, the fee, the escrow, the dispute setup, the stake, the roles, the domain and the limits |
| `src/addresses.js` | the form of an address and the decimals of the tokens the tool knows |
| `src/analyze.js` | the checks on what was read |
| `src/rules.js` | the checks, their levels and kinds, and the result |
| `src/report.js`, `src/text.js`, `src/size.js` | the text, markdown, JSON and SARIF output, the cleaning of text from the input and number formats |
| `src/data.js` | the public pages and the points the checks rest on, in this project's own words |
| `research/sources/` | text copies of the pages, as they were read |
| `tools/check.mjs`, `tools/example.mjs` | the repository checks, and the examples with their real output |

## Where the facts come from

The documented checks rest on two public pages, nothing else. Each was read before it was listed, a text copy of it is
kept in [research/sources](research/sources), and [research/sources.md](research/sources.md) has a note on each, says
what the pages do not say, and lists the lines the copies leave out. [docs/rules-and-sources.md](docs/rules-and-sources.md)
lists every check with the points of the pages it rests on, what it cannot see and what to change. Where a check is a
best practice and not a rule in the pages, it says so. No page of an escrow protocol is saved, and no check rests on
one.

- EIP-712, Typed structured data hashing and signing: https://eips.ethereum.org/EIPS/eip-712
- Smart contract security, ethereum.org developer documentation: https://ethereum.org/en/developers/docs/smart-contracts/security/

## Background

The escrow of a peer to peer marketplace is set up by the team that builds the marketplace, in a deployment script or
a settings file that few people read line by line. It is checked when the marketplace is first built, when its fees or
its dispute rules change, when it moves to another chain or adds a payment token, or when engineers are brought in to
build the escrow, the dispute flow and the signed listings. How such work is staffed and carried out is described on the
page [Decentralized Marketplace Development Services](https://innerluxes.dev/blockchain/decentralized-marketplace).

## License

MIT
