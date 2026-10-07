# Inputs

The tool takes the path of the configuration of a marketplace escrow, a JSON file. There is no configuration file of the
tool itself, no environment variable and no standard input; the options are on the command line. The tool never asks
for a private key, a seed, an API key or the address of a node, and needs none. Its result is an input to a review of a
marketplace escrow configuration before its contracts are deployed: not legal or financial advice, not an audit of the
escrow contracts and not a guarantee that funds will be released or refunded as intended.

```
marketplace-escrow-check <escrow.json> [--format text|markdown|json|sarif] [--json] [--min-severity <level>]
                         [--fail-on <level>] [--max-fee-bps <n>] [--explain] [--list-checks]
```

| Option | Meaning |
| --- | --- |
| `--format <name>` | `text` (default), `markdown`, `json` or `sarif` |
| `--json` | the same as `--format json` |
| `--min-severity <level>` | the lowest level shown: `info` (default), `warning` or `error` |
| `--fail-on <level>` | the lowest level that fails the run: `info`, `warning` or `error` (default) |
| `--max-fee-bps <n>` | the fee above which `fee-too-high` warns, a whole number of basis points from 0 to 10000 (default 1000, 10%) |
| `--explain` | add the points of the pages behind each finding to the text, markdown and JSON reports |
| `--list-checks` | list the checks with their level and kind, in text, markdown or JSON, and exit |
| `--help`, `--version` | the usage, the version |

Every option that takes a value takes it once. A value may not start with `--`. `-` (standard input) and an address such
as `https://...` are refused. A folder is refused: name the file. Two files are a usage error.

## The file

The file is always read as JSON, whatever its name. It is UTF-8, with or without a byte order mark, or UTF-16 with a
byte order mark, with LF, CRLF or CR line ends. It is strict JSON (RFC 8259): no comments, no trailing commas, no single
quotes, and no key written twice in one object. Every object may hold a key `notes` with any value, which the tool does
not read; every other key it does not read is `field-unknown`.

The file is the tool's own format: the values a team is about to deploy its escrow contracts with, written by hand or
by a script from its deployment settings. Units:

- **Addresses** are text of 0x and 40 hex digits. Two addresses are the same when they differ only in case.
- **Basis points** are whole numbers from 0 to 10000, where 100 is 1% and 10000 is the whole order. A number with a
  fraction, a sign or an exponent is refused.
- **Seconds** are whole numbers from 0 to 999,999,999,999; the tool shows them with the whole days they make.
- **Amounts** are plain decimal numbers in the unit of their token, such as `"100"` or `"0.5"`, written as text or as a
  number, with no sign, exponent or separator and no more places than the token keeps.
- **Chain ids** are whole numbers from 1, the EIP-155 id of a chain, such as 1 for Ethereum.

### Top level

| Key | Required | Meaning |
| --- | --- | --- |
| `chainId` | yes | the chain id the escrow is deployed on |
| `tokens` | yes | the payment tokens, a list of objects (below) |
| `platformFee` | yes | `bps`, the fee of the marketplace on every order, and `recipient`, its address (not needed for a fee of 0) |
| `escrow` | yes | the release and refund rules (below) |
| `dispute` | yes | the dispute setup (below) |
| `stake` | no | the stake a seller locks (below); without it `stake-slash-invalid` does not run, and a note says so |
| `roles` | yes | the roles of the contracts and the multisig (below) |
| `eip712` | yes | the EIP-712 domain of signed listings (below) |
| `limits` | no | `maxOrderValue`, the largest order the escrow holds, and `token`, the symbol it is counted in; without it `max-order-missing` is a note |

### A token

| Key | Required | Meaning |
| --- | --- | --- |
| `symbol` | yes | the symbol, such as `USDC`; compared without case |
| `address` | yes, unless native | the address of the token contract |
| `native` | no | `true` for the currency of the chain, such as ETH, which has no address |
| `decimals` | yes | the places the token keeps, a whole number from 0 to 36 |
| `chainId` | yes | the chain id the address is on |

### The escrow

| Key | Required | Meaning |
| --- | --- | --- |
| `releaseMode` | yes | `buyer-confirm` (the buyer releases), `timeout` (the funds are released after the timeout) or `both` (whichever comes first) |
| `releaseTimeout` | with `timeout` or `both` | seconds from the start of the order to the release by time; refused with `buyer-confirm` |
| `disputeWindow` | yes | seconds the buyer has to open a dispute |
| `refundPath` | yes | a list of the ways back to the buyer: `seller` (a cancel by the seller), `arbiter` (a ruling) and `timeout` (a refund when the seller does not deliver in time); or one of them as text; or `"none"` |
| `partialRefunds` | no | `true` or `false` |
| `milestones` | no | a list of `{ "name", "shareBps" }`, the steps an order is released in; the shares add up to 10000 |
| `termsHash` | no | the hash of the terms of the escrow, 64 hex digits; never shown |

### The dispute setup

| Key | Required | Meaning |
| --- | --- | --- |
| `arbiters` | yes | the addresses of the arbiters |
| `panelSize` | yes | the arbiters on one dispute, from 1 to 1000 |
| `quorum` | yes | the votes that decide a dispute, from 1 to 1000 |
| `arbiterFeeBps` | no | the fee of the arbiters on a disputed order, in basis points |
| `appealWindow` | no | seconds in which a ruling may be appealed; 0 or none is a note |

### The stake

| Key | Required | Meaning |
| --- | --- | --- |
| `amount` | yes | the stake of a seller, in its token |
| `token` | yes | the symbol of one of the tokens of the file |
| `slashBps` | yes | the share of the stake taken from a seller who breaks the rules; 0 for a stake never slashed |

### The roles

| Key | Required | Meaning |
| --- | --- | --- |
| `owner` | yes | the owner or admin of the contracts |
| `pauser` | no | the role that pauses the escrow; a single key is not reported, so that a pause can be fast |
| `upgrader` | no | the role that upgrades the contracts; leave it out for contracts that cannot be upgraded |
| `feeSetter` | no | the role that changes the platform fee |
| `treasury` | no | the address that holds the fees of the marketplace |
| `timelock` | no | the address of the timelock in front of upgrades |
| `multisig` | no | `address`, `threshold` (from 1 to 100) and `signers` (a list of addresses) of the multisig that holds the roles |

The tool takes the file's word for which address is the multisig and which is the timelock; it cannot see the code at
an address.

### The EIP-712 domain

| Key | Required | Meaning |
| --- | --- | --- |
| `name` | asked for | the name of the signing domain |
| `version` | asked for | its version |
| `chainId` | asked for | the chain id of the domain |
| `verifyingContract` | asked for | the contract that checks signed listings |
| `salt` | no | 64 hex digits; never shown |

EIP-712 lets a protocol leave fields out; a missing one is the warning `eip712-domain-missing-field`, not
`field-missing`.

### A short file

```json
{
  "chainId": 1,
  "tokens": [{ "symbol": "USDC", "address": "0x8888888888888888888888888888888888888888", "decimals": 6, "chainId": 1 }],
  "platformFee": { "bps": 250, "recipient": "0x2222222222222222222222222222222222222222" },
  "escrow": { "releaseMode": "both", "releaseTimeout": 1209600, "disputeWindow": 604800, "refundPath": ["seller", "arbiter"] },
  "dispute": { "arbiters": ["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "0xcccccccccccccccccccccccccccccccccccccccc"], "panelSize": 3, "quorum": 2, "appealWindow": 259200 },
  "roles": { "owner": "0x2222222222222222222222222222222222222222", "multisig": { "address": "0x2222222222222222222222222222222222222222", "threshold": 2, "signers": ["0x3333333333333333333333333333333333333333", "0x4444444444444444444444444444444444444444", "0x6666666666666666666666666666666666666666"] } },
  "eip712": { "name": "Example Escrow", "version": "1", "chainId": 1, "verifyingContract": "0x1111111111111111111111111111111111111111" },
  "limits": { "maxOrderValue": "50000", "token": "USDC" }
}
```
