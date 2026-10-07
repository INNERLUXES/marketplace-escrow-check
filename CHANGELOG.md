# Changes

## 1.0.0

First release.

- Reads the JSON configuration of the escrow of a peer to peer marketplace before its contracts are deployed and lists
  with its line every mistake the checks know, as an input to a review: not legal or financial advice, not an audit of
  the escrow contracts and not a guarantee that funds will be released or refunded as intended. It reads the file,
  contacts no chain, node or API, fetches nothing, signs nothing, deploys nothing, opens no link, runs nothing, needs no
  key, follows no symbolic link and reads no clock.
- Reads the chain id; the payment tokens with their symbol, address or native flag, decimals and chain id; the platform
  fee in basis points with its recipient; the escrow with its release mode, release timeout, dispute window, refund
  path, partial refunds, milestones and hash of the terms; the dispute setup with its arbiters, panel size, quorum,
  arbiter fee and appeal window; the stake of a seller with its amount, token and slash share; the roles (owner, pauser,
  upgrader, fee setter, treasury, timelock) with the multisig, its threshold and signers; the EIP-712 domain of signed
  listings; and the largest order value.
- Every length is a whole number of seconds of the file, shown with the days it makes; the tool never reads the clock or
  turns a number into a date.
- The strict JSON reader of the sibling tools, kept unchanged, with no dependency and no recursion, with the line and
  column of every value, a key written twice as a finding, and limits of size, nesting, values and string length; the
  bounded reading of a file and the decimal reader of the sibling tools. Amounts are read from the characters of the
  file with BigInt, never through a floating point number.
- A search for keys and seeds in the file before anything else is read, kept unchanged from the sibling tools: each one
  found is an error whose value is left out of every check and never shown. A hash of 64 hex digits under `salt` or
  `termsHash` is read as the hash it is, and the value of either is never shown.
- Thirty-two checks in three levels, each documented or a best practice of the tool and saying which: a release by
  time at or before the end of the dispute window (`release-before-dispute-window`); no refund path (`no-refund-path`);
  a release by the buyer alone (`release-timeout-missing`); a fee above `--max-fee-bps`, 1000 by default
  (`fee-too-high`); a fee that is not a whole number of basis points (`fee-invalid`); a fee sent to the zero address
  (`fee-recipient-zero`); milestones that are not the whole order (`milestone-shares-not-100`) or release nothing
  (`milestone-empty`); a quorum that can never be met (`quorum-unreachable`); one arbiter (`single-arbiter`); an arbiter
  paid by the marketplace (`arbiter-is-party`) or holding a role (`arbiter-is-admin`); no appeal window, as a note
  (`appeal-window-missing`); a slash share that cannot be applied (`stake-slash-invalid`); a role held by one key, per
  the security page of ethereum.org (`admin-single-key`); a multisig of one signature, per the same page
  (`multisig-threshold-low`); a multisig that can never act (`multisig-threshold-unreachable`); an upgrade with no
  timelock, as a note (`upgrader-without-timelock`); an EIP-712 domain of another chain, per EIP-712
  (`eip712-domain-chain-mismatch`), with missing fields (`eip712-domain-missing-field`) or a zero verifying contract,
  per EIP-712 (`verifying-contract-zero`); a token of another chain (`token-chain-mismatch`) or with the wrong decimals
  (`token-decimals-invalid`); a malformed address (`address-malformed`); the zero address in a role or a token
  (`zero-address`); no largest order, as a note (`max-order-missing`); and six checks about the file
  (`file-unreadable`, `field-missing`, `field-unknown`, `field-invalid`, `field-duplicate`, `secret-in-file`).
- A table of the roles with who holds each (the multisig, the timelock, one key), in every format but SARIF.
- Reports as text, markdown, JSON and SARIF 2.1.0; every finding has its id, severity, message, file, line, column and
  subject; `--min-severity`, `--fail-on`, `--max-fee-bps`, `--explain` with the points of the pages behind each finding,
  and `--list-checks`. Exit code `0` when no finding is at or above the fail-on level, `1` when one is, `2` for a usage
  or input error, with no result.
- Plain text copies of the public pages the documented checks rest on, under research/sources, with a note on each:
  EIP-712 and the smart contract security page of ethereum.org.
- Release packages come with a CycloneDX SBOM, SHA-256 checksums and a build provenance attestation, after the SSDF gate
  of the repository.
