# Limits

The tool is not legal advice and not financial advice. It reads the configuration of a marketplace escrow, and its
result is an input to a review of a marketplace escrow configuration before its contracts are deployed: not legal or
financial advice, not an audit of the escrow contracts and not a guarantee that funds will be released or refunded as
intended. A clean run means only that none of the problems in [method.md](method.md) were found in the file.

## What it cannot see

- **The law and the money.** Whether an escrow may be offered where it is offered, whether it needs a licence, how a fee
  is taxed and whether a fee is fair are questions for counsel and for the people who run the marketplace. The tool
  says nothing on any of them.
- **The contracts.** It reads no Solidity and no bytecode. It cannot tell whether the contracts do what the file says:
  whether the release timer starts at payment or at delivery, whether it stops while a dispute is open, whether a refund
  function exists, whether the contract enforces the largest order, or whether it builds its EIP-712 domain separator
  from the values of the file. A configuration that does not match the deployed contracts gives a report about the
  configuration.
- **The chain.** It contacts no chain, so it cannot tell whether an address is a multisig, a timelock, a token or a key,
  what threshold and signers a multisig really has, what delay a timelock has, or what decimals a token contract
  answers. The file says which address is the multisig and the timelock, and the tool takes its word.
- **Who the people are.** Several addresses of one person look like several arbiters or signers. An arbiter who is also
  a buyer or a seller of an order is not seen: the configuration holds no orders.
- **Replay of signatures.** EIP-712 says its standard has no replay protection. The tool checks the chainId and the
  verifying contract of the domain; it cannot see whether the contract keeps nonces, expiries or a record of signed
  listings it has used.
- **Time on chain.** Lengths are seconds of the file. Block timestamps can drift, and a chain may measure time in
  blocks; the tool compares the numbers as written.
- **Addresses.** An address is checked for its form only, with no checksum of EIP-55 and no lookup, so a well formed
  address of the wrong wallet passes. Only the form of an EVM chain is known.
- **Tokens.** The places of USDC, USDT, WBTC, DAI, WETH and ETH are known; another token is checked only against the
  range of 0 to 36, and a note names it. A token of the same symbol at another address, such as a bridged version, is
  compared by its symbol.
- **What a misspelt key meant.** A key the tool does not read is reported and left out. A misspelt `appealWindow` makes
  the dispute setup look as if it had none; read the `field-unknown` findings first.
- **Every secret.** The search for keys and seeds knows them by the name of their key and by their shape: a mnemonic of
  12 to 24 lowercase English words, an extended private key, 64 hex digits or a key in WIF. A value of 64 hex digits
  under `salt` or `termsHash` is read as a hash and cannot be told apart from a private key pasted there; it is never
  shown. A secret split over fields, encoded another way or written under another name is not caught, and API keys and
  passwords are not looked for by their shape. A clean run does not say that the file holds no secret.

## What the reader does not read

[inputs.md](inputs.md) lists the fields. A file that is not strict JSON is one `file-unreadable` finding, and nothing
else in it is checked. A value that is missing, of the wrong type or a secret is a finding, and the checks that need it
leave it out: a clean run says nothing about that part. YAML, TOML, Solidity constants, deployment scripts, amounts with
a thousands separator or a decimal comma, numbers with an exponent and dates are not read.

## Size limits

| Limit | Value |
| --- | --- |
| file size | 16 MB |
| tokens | 100; the rest are not read, and a note says so |
| milestones | 100; the rest are not read, and a note says so |
| arbiters | 1,000; the rest are not read, and a note says so |
| signers of the multisig | 100; the rest are not read |
| JSON nesting of objects and arrays | 1,000 levels |
| JSON values (nodes) in a file | 2,000,000 |
| a JSON string | 1,000,000 characters |
| an amount | 40 digits on each side of the point |
| a chain id or a number of seconds | up to 999,999,999,999 |
| the decimals of a token | 0 to 36 |
| a panel size or a quorum | 1 to 1,000 |
| a threshold | 1 to 100 |
| a fee or a share | 0 to 10,000 basis points |
| `--max-fee-bps` | 0 to 10,000 |
| a text the search for keys looks at | 4,000 characters |

Input past a limit is a `file-unreadable`, `field-invalid` or `fee-invalid` finding, a note, or, for the file size, an
input error with exit code `2`. The tool never passes a run because something could not be read.

## What a run does not do

It never reads or asks for a private key, a seed or an API key, contacts no chain, node or API, fetches nothing and
connects to nothing, signs nothing, deploys nothing, opens no link, runs no program, evaluates nothing it reads, reads
no clock and no locale, follows no symbolic link and writes nothing to disk. [threat-model.md](threat-model.md) lists
the risks of reading a configuration from a pull request or an upload and their controls.
