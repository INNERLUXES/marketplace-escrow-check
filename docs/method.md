# Method

This document says how the tool reads the configuration of a marketplace escrow and what each check looks at. The tool
is an input to a review of a marketplace escrow configuration before its contracts are deployed: not legal or financial
advice, not an audit of the escrow contracts and not a guarantee that funds will be released or refunded as intended. A
clean run means only that none of the problems below were found in the file.

## Why the configuration

A peer to peer marketplace holds the money of a buyer until the seller delivers, and the rules of that holding are set
once, when the escrow contracts are deployed: when funds are released, how long a buyer has to dispute, how a refund
works, who decides a dispute and with how many votes, what the marketplace takes, who may change any of it. Most of the
mistakes that lock or lose funds are in those values, long before a line of the contract runs: a release timer shorter
than the dispute window, a quorum larger than the panel, a fee sent to the zero address, an owner held by one key, a
signing domain of another chain. Once deployed, many of them cannot be changed, or can be changed only by the key that
should not have held the role.

A team can write the values it is about to deploy with to one file in the format of [inputs.md](inputs.md). The tool
reads that file as it is, so the same check runs on every change, in a pipeline or by hand, and every finding points at
a line. The file is the tool's own format on purpose: the constructor arguments of escrow contracts differ from project
to project, and a script can write any of them into this file.

## Reading the file

1. The path is resolved against the folder the command runs in. A link, a folder, a device or a pipe is refused; a file
   over 16 MB is refused before it is read; a file with a null byte, or bytes that are not UTF-8 (or UTF-16 with a byte
   order mark), is refused with exit code `2` and no report.
2. The file goes to the JSON reader of the sibling tools (`src/json.js`, kept unchanged), which keeps the line and column
   of every value and the characters every number was written with: a comment, a trailing comma, a key written twice in
   one object or text after the value is `file-unreadable`, and so is a top level that is not an object.
3. Every key and value of the file is looked at for a key or a seed (`src/secrets.js`, kept unchanged from the sibling
   tools). A key named for a private key, a seed or a mnemonic, and a value shaped like a mnemonic, an extended private
   key, a private key in hex or a key in WIF, is `secret-in-file`. The value is marked and left out of everything that
   follows, and no report shows it. A value of 64 hex digits under `salt` or `termsHash` is the hash it is meant to be,
   not a key (decision 2), and is never shown either.
4. The fields are read (`src/config.js`) as [inputs.md](inputs.md) lists them. A missing field is `field-missing`, a key
   the tool does not read is `field-unknown`, and a value of the wrong type or form is `field-invalid`; a fee that is not
   a whole number of basis points from 0 to 10000 is `fee-invalid`. The value is then left out of every check that needs
   it. Amounts are read by `src/decimal.js` into a whole number and a scale, from the characters of the file.

## The checks of the file

- A file that is not strict JSON, or holds no object (`file-unreadable`).
- A field the checks need that is not there (`field-missing`): the chain id, the tokens, the platform fee, the escrow,
  the dispute setup, the roles and the EIP-712 domain; the symbol, address (unless native), decimals and chain id of a
  token; the bps of the fee and its recipient when the fee is above 0; the release mode, the release timeout of a
  release by time and the dispute window; the name and share of a milestone; the arbiters, the panel size and the
  quorum; the amount, token and slash share of a stake; the owner; and the address, threshold and signers of a multisig.
- A key the tool does not read (`field-unknown`), with the known key it is probably meant to be.
- A value of the wrong type or form (`field-invalid`), among them a release timeout with a release by the buyer alone, a
  native token with an address, a token of a stake or a limit that is not a token of the file, and an amount with more
  places than its token keeps.
- One token symbol or address listed twice, one arbiter or signer listed twice, and two milestones of one name
  (`field-duplicate`).
- A private key, a seed or a mnemonic (`secret-in-file`).
- A platform fee or arbiter fee that is not a whole number of basis points from 0 to 10000 (`fee-invalid`).

## The checks of the release and the refund

- `release-before-dispute-window`: with a release mode of `timeout` or `both`, the release timeout is at or below the
  dispute window, so the funds can go to the seller before, or the moment, the buyer loses the right to dispute. Equal
  lengths are reported too: a dispute opened in the last second races the release.
- `no-refund-path`: the escrow names no refund path, `"none"`, or an empty list. A refund path that could not be read is
  `field-invalid` and not this check.
- `release-timeout-missing`: the release mode is `buyer-confirm`, so the funds wait on the buyer alone. A warning, since
  some marketplaces mean it.

## The checks of the fees

- `fee-too-high`: the platform fee or the arbiter fee is above `--max-fee-bps`, 1000 basis points by default.
- `fee-recipient-zero`: the platform fee is above 0, or could not be read, and its recipient is the zero address.
- `fee-invalid` is described with the checks of the file.

## The checks of the milestones

- `milestone-shares-not-100`: the shares of the milestones do not add up to 10000 basis points. It runs only when every
  share was read.
- `milestone-empty`: the milestones are an empty list, or a milestone has a share of 0.

## The checks of the dispute setup

- `quorum-unreachable`: the quorum is above the panel size, or the panel size is above the number of distinct arbiters.
- `single-arbiter`: the list holds one distinct arbiter, or the panel size is 1.
- `arbiter-is-party`: an arbiter is the recipient of the platform fee or the treasury.
- `arbiter-is-admin`: an arbiter is the owner, the pauser, the upgrader, the fee setter, the timelock or the multisig.
- `appeal-window-missing`: there is no appeal window, or it is 0 seconds. A note.

## The check of the stake

- `stake-slash-invalid`: the slash share is not a whole number of basis points from 0 to 10000, or it is above 0 on a
  stake of 0.

## The checks of the roles

- `admin-single-key`: the owner, the fee setter or the treasury is not the multisig of the file, or the upgrader is
  neither the multisig nor the timelock. The pauser is left out on purpose: a pause is meant to be fast. Documented by
  the security page of ethereum.org, which calls a single owner key a single point of failure and suggests a
  multi-signature account.
- `multisig-threshold-low`: the multisig needs one signature. Documented by the same page, which gives a multisig the
  consent of more than one party.
- `multisig-threshold-unreachable`: the threshold is above the number of distinct signers.
- `upgrader-without-timelock`: an upgrader is named and it is not the timelock of the file, or the file names none. A
  note.

## The checks of the EIP-712 domain

- `eip712-domain-chain-mismatch`: the chainId of the domain differs from the chain id of the file. Documented by
  EIP-712, which has a wallet refuse to sign for a chainId that is not the active chain. The tool does not claim that
  the chainId stops a replay on another chain; EIP-712 says its standard has no replay protection.
- `eip712-domain-missing-field`: the domain has no name, version, chainId or verifyingContract. A best practice, since
  EIP-712 lets a protocol leave fields out.
- `verifying-contract-zero`: the verifyingContract is the zero address. Documented by EIP-712, which has the field name
  the contract that verifies the signature.

## The checks of the tokens and the addresses

- `token-chain-mismatch`: a token is declared on another chain id than the file.
- `token-decimals-invalid`: the decimals of a token are not a whole number from 0 to 36, or differ from the places of a
  token the tool knows: USDC and USDT 6, WBTC 8, DAI, WETH and ETH 18. A token outside the table is named in a note.
- `address-malformed`: an address that is not 0x and 40 hex digits, wherever it is.
- `zero-address`: the zero address as a token, a role, the timelock, the multisig, a signer or an arbiter. The zero
  address as the recipient of the fee is `fee-recipient-zero`, and as the verifying contract `verifying-contract-zero`.

## The check of the limits

- `max-order-missing`: the file sets no `limits.maxOrderValue`. A note.

## What the report shows

Every report names the file with its lines and bytes, what was read (the chain id, the tokens, the fee, the escrow, the
dispute setup, the stake, the domain, the largest order and the threshold of `--max-fee-bps`), the number of findings by
level, the table of checks, the findings with their line and what to change, the table of roles with who holds each,
the notes, the notice and the result. The SARIF report holds the findings only.
