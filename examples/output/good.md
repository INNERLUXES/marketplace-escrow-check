# marketplace-escrow-check: examples/good/escrow.json

- File: examples/good/escrow.json \(JSON, 41 lines, 2,337 bytes\)
- Chain id: 1
- Tokens: 2: USDC, at 0x8888888888888888888888888888888888888888, 6 decimals, chain id 1; ETH, native, 18 decimals, chain id 1
- Platform fee: 250 basis points \(2.5%\) to 0x2222222222222222222222222222222222222222
- Escrow: release on buyer confirmation or after a timeout; release timeout 1,209,600 seconds \(14 days\); dispute window 604,800 seconds \(7 days\); refund by seller and arbiter; partial refunds allowed; 3 milestones \(Design 30%, Build 30%, Handover 40%\)
- Dispute: 5 arbiters, panel of 3, quorum of 2, arbiter fee 100 basis points \(1%\), appeal window 259,200 seconds \(3 days\)
- Stake: 100 USDC, slash 5,000 basis points \(50%\)
- Eip712 domain: name Example Escrow, version 1, chain id 1, verifying contract 0x1111111111111111111111111111111111111111
- Max order: 50000 USDC
- Max fee: 1,000 basis points \(10%\), from --max-fee-bps
- Findings: 0
- Result: **PASS - no finding at or above error**

## Findings

None.

## Roles (7)

| Role | Address | Held by |
| --- | --- | --- |
| owner | 0x2222222222222222222222222222222222222222 | multisig |
| pauser | 0x5555555555555555555555555555555555555555 | one key |
| upgrader | 0x9999999999999999999999999999999999999999 | timelock |
| fee setter | 0x2222222222222222222222222222222222222222 | multisig |
| treasury | 0x2222222222222222222222222222222222222222 | multisig |
| timelock | 0x9999999999999999999999999999999999999999 | timelock |
| multisig | 0x2222222222222222222222222222222222222222 | 3 of 5 signers |

This report is an input to a review of a marketplace escrow configuration before its contracts are deployed: not legal or financial advice, not an audit of the escrow contracts and not a guarantee that funds will be released or refunded as intended.
