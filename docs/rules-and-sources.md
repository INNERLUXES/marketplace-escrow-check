# Rules and sources

Every check of the tool, with what it looks at, the points of the public pages it rests on, what it cannot see, and what to change. The points are in this project's own words and are the ones the reports show with `--explain`; each page was fetched and read before it was listed, and a copy of its text is kept under [research/sources](../research/sources) so that a point can be checked against the page it came from. [../research/sources.md](../research/sources.md) has a note on each page.

The tool is an input to a review of a marketplace escrow configuration before its contracts are deployed: not legal or financial advice, not an audit of the escrow contracts and not a guarantee that funds will be released or refunded as intended. Four checks are documented by the pages: `eip712-domain-chain-mismatch` and `verifying-contract-zero` by EIP-712, and `admin-single-key` and `multisig-threshold-low` by the smart contract security page of ethereum.org. Every other check that is not about the file itself is a best practice of this tool, not a rule in the pages it cites, and says so in its message and in its own entry below with the reason. No saved page describes an escrow, a release timeout, a dispute window, a refund, milestones, arbiters, a quorum, a stake or a platform fee. EIP-712 says that its standard does not include replay protection and leaves replay to the application; the tool does not claim that the chainId of a domain prevents replay.

## The pages

- EIP-712: Typed structured data hashing and signing: https://eips.ethereum.org/EIPS/eip-712 (copy: `research/sources/eip-712-typed-structured-data.txt`)
- Smart contract security, ethereum.org developer documentation: https://ethereum.org/en/developers/docs/smart-contracts/security/ (copy: `research/sources/ethereum-org-smart-contract-security.txt`)

## file-unreadable

- Level: error
- Kind: a problem with the file itself; it has no setting to lower
- Looks at: the configuration is not JSON the reader can follow, or its top level is not an object, so nothing in it was read.
- Cannot see: It stops at the first place that is not strict JSON, or at a top level that is not an object, so nothing in the file is checked; a configuration written as YAML, TOML, a Solidity file of constants or a deployment script is not read.
- What to change: Write the configuration as one JSON object with the chain id, the tokens, the fee, the escrow rules, the dispute setup, the roles and the EIP-712 domain (docs/inputs.md); fix the line named.
- Points of the pages: none; this check is about the file itself.

## field-missing

- Level: error
- Kind: a problem with the file itself; it has no setting to lower
- Looks at: a field the checks need is not in the file: the chain id, the tokens, the platform fee, the escrow, the dispute setup, the roles or the EIP-712 domain, the symbol, address, decimals or chain id of a token, the bps of the fee or its recipient, the release mode, the release timeout of a timed release or the dispute window, the name or share of a milestone, the arbiters, panel size or quorum, the amount, token or slash share of a stake, the owner, or the address, threshold or signers of a multisig.
- Cannot see: It names the field and the part, the token, the milestone or the multisig that lacks it; it does not guess the value, and the checks that need the field do not run for that part.
- What to change: Add the field named; docs/inputs.md lists what the file needs.
- Points of the pages: none; this check is about the file itself.

## field-unknown

- Level: warning
- Kind: a problem with the file itself; it has no setting to lower
- Looks at: a key the tool does not read, often a misspelt one; its value was left out of every check.
- Cannot see: It cannot tell what a misspelt key was meant to say; it names a known key when one differs only in case or separators, is one letter apart or starts the same, and the value is left out of every check.
- What to change: Correct the spelling to a field of docs/inputs.md, or remove it.
- Points of the pages: none; this check is about the file itself.

## field-invalid

- Level: error
- Kind: a problem with the file itself; it has no setting to lower
- Looks at: a value of the wrong type or form: text where a whole number belongs, a release mode or refund path the tool does not know, a share of a milestone that is not a whole number of basis points, an amount with more places than its token, a token that is not one of the file, a hash that is not 64 hex digits, a release timeout with a release by the buyer alone, or a native token with an address.
- Cannot see: It reports the form of a value, not whether the value is right: a whole number of seconds that is far too short passes this check.
- What to change: Write the value as docs/inputs.md shows: text for addresses, symbols and choices, whole numbers for chain ids, decimals, seconds, counts and basis points, plain decimal numbers for amounts, true or false for flags.
- Points of the pages: none; this check is about the file itself.

## field-duplicate

- Level: error
- Kind: a problem with the file itself; it has no setting to lower
- Looks at: one token symbol or token address listed twice, one arbiter or one signer listed twice, or two milestones of one name, so a reader of the file cannot tell them apart.
- Cannot see: Tokens are compared by symbol without case and by address without case; arbiters and signers by address without case; milestones by name without case. Two addresses of one person are not seen.
- What to change: List each token, arbiter and signer once, and give every milestone a name of its own.
- Points of the pages: none; this check is about the file itself.

## secret-in-file

- Level: error
- Kind: a problem with the file itself; it has no setting to lower
- Looks at: the file holds a private key, a seed or a mnemonic, under a key named for one or as a value shaped like one; the tool never reads it and never shows it.
- Cannot see: It knows a secret by the name of its key and by its shape: a mnemonic of 12 to 24 lowercase English words, an extended private key, 64 hex digits or a key in WIF. A value of 64 hex digits under salt or termsHash is read as a hash; a key pasted there is not reported, and not shown either. A secret split over fields or encoded another way is not caught.
- What to change: Remove the value from the file and from wherever the file was copied, treat it as exposed and move what it controls to a new key. A deployment configuration names wallets by their public address only.
- Points of the pages: none; this check is about the file itself.

## fee-invalid

- Level: error
- Kind: a problem with the file itself; it has no setting to lower
- Looks at: the platform fee or the arbiter fee is not a whole number of basis points from 0 to 10000.
- Cannot see: It reads the number as written. It cannot tell whether the contract stores the fee in basis points, in percent or in another unit.
- What to change: Write the fee as a whole number of basis points, where 100 is 1% and 10000 is the whole order, such as 250 for 2.5%.
- Points of the pages: none; this check is about the file itself.

## release-before-dispute-window

- Level: error
- Kind: a best practice of this tool, not a rule in the pages it cites
- Looks at: the escrow releases funds on a timeout that ends at or before the dispute window closes, so the seller can be paid before the buyer had the whole window to open a dispute.
- Cannot see: It compares two numbers of seconds of the file. It cannot see how the contract measures time (block timestamps can drift by seconds), whether the dispute window starts at delivery or at payment, or whether the release timer stops while a dispute is open.
- What to change: Make the release timeout longer than the dispute window, so that no release by time can fire while a dispute may still be opened.
- Points of the pages: none. The tool's own choice: comparing the release timeout with the dispute window is a best practice of this tool, not a rule in the pages it cites; the cited pages say nothing of escrow, and a release that can beat a dispute leaves the dispute with nothing to decide.

## no-refund-path

- Level: error
- Kind: a best practice of this tool, not a rule in the pages it cites
- Looks at: the escrow names no way back to the buyer: no refund path, an empty one or "none", so funds of an order that fails can only go to the seller or stay locked.
- Cannot see: It reads the refund path the file declares. It cannot see whether the contract really has a refund function, or who may call it.
- What to change: Name at least one refund path: a cancel by the seller, a ruling of the arbiters, or a refund by time when the seller does not deliver.
- Points of the pages: none. The tool's own choice: asking for a refund path is a best practice of this tool, not a rule in the pages it cites; an escrow that can only release is a payment with a delay, not an escrow.

## release-timeout-missing

- Level: warning
- Kind: a best practice of this tool, not a rule in the pages it cites
- Looks at: funds are released only when the buyer confirms, with no release by time, so a buyer who never confirms and never disputes keeps the funds of the seller locked for good.
- Cannot see: It reads the release mode. A marketplace that releases on confirmation only, on purpose, with a refund by time when the seller does not deliver, gets this warning too.
- What to change: Set releaseMode to both and give a releaseTimeout longer than the dispute window, so funds are released when the buyer stays silent.
- Points of the pages: none. The tool's own choice: asking for a release by time is a best practice of this tool, not a rule in the pages it cites; some marketplaces release only on confirmation on purpose, so it is a warning.

## fee-too-high

- Level: warning
- Kind: a best practice of this tool, not a rule in the pages it cites
- Looks at: the platform fee or the arbiter fee is above --max-fee-bps (1000 basis points, 10%, by default).
- Cannot see: The threshold is the tool's own, 1000 basis points unless --max-fee-bps moves it. It cannot see what a fee pays for, or whether the platform fee and the arbiter fee are charged on the same order.
- What to change: Lower the fee, or raise --max-fee-bps for a marketplace whose fee is high on purpose.
- Points of the pages: none. The tool's own choice: warning above 1000 basis points is a best practice of this tool, not a rule in the pages it cites; the cited pages set no fee, and the threshold can be changed with --max-fee-bps.

## fee-recipient-zero

- Level: error
- Kind: a best practice of this tool, not a rule in the pages it cites
- Looks at: the platform fee is above 0 and goes to the zero address, which no one holds, so every fee is lost.
- Cannot see: It reads the recipient of the platform fee. It cannot see a fee splitter behind a well formed address, or a recipient that is a contract that cannot receive the token.
- What to change: Send the fee to the treasury of the marketplace, best a multisig, or set the fee to 0.
- Points of the pages: none. The tool's own choice: refusing the zero address as the recipient of a fee is a best practice of this tool, not a rule in the pages it cites; a fee sent there is burnt, and a constructor that takes a zero recipient seldom says so.

## milestone-shares-not-100

- Level: error
- Kind: a best practice of this tool, not a rule in the pages it cites
- Looks at: the shares of the milestones do not add up to 10000 basis points, the whole order, so part of the funds is never released or more is released than was paid.
- Cannot see: It adds up the shares of the milestones that were read. It runs only when every share was read, and cannot see how the contract rounds a share of an odd amount.
- What to change: Set the shares so that they add up to 10000 basis points.
- Points of the pages: none. The tool's own choice: adding up the shares of the milestones is a best practice of this tool, not a rule in the pages it cites; a split that is not the whole order leaves funds behind or over-pays.

## milestone-empty

- Level: error
- Kind: a best practice of this tool, not a rule in the pages it cites
- Looks at: the milestones are an empty list, or a milestone has a share of 0, so a step releases nothing.
- Cannot see: It reports an empty list and a share of 0. A milestone that releases a share too small to matter passes.
- What to change: Remove the empty milestone or give it a share, or leave milestones out for an order paid in one release.
- Points of the pages: none. The tool's own choice: refusing a milestone of nothing is a best practice of this tool, not a rule in the pages it cites; a step that releases 0 is almost always a share written in the wrong place.

## quorum-unreachable

- Level: error
- Kind: a best practice of this tool, not a rule in the pages it cites
- Looks at: the quorum of a dispute is above the size of the panel, or the panel is larger than the list of arbiters, so a dispute can never be decided.
- Cannot see: It compares the quorum, the panel and the number of distinct arbiters of the file. It cannot see arbiters who no longer answer, or a rule of the contract that draws a panel some other way.
- What to change: Set a quorum no larger than the panel and a panel no larger than the number of arbiters, or add arbiters.
- Points of the pages: none. The tool's own choice: comparing the quorum, the panel and the arbiters is a best practice of this tool, not a rule in the pages it cites; a dispute that can never be decided locks the funds of both sides.

## single-arbiter

- Level: warning
- Kind: a best practice of this tool, not a rule in the pages it cites
- Looks at: one arbiter decides every dispute: the list holds one arbiter, or the panel has a size of 1.
- Cannot see: It counts the distinct addresses of the list and reads the panel size. Several addresses held by one person look like several arbiters.
- What to change: Name more arbiters and a panel of three or more with a majority quorum, so that no one person decides alone.
- Points of the pages: none. The tool's own choice: asking for more than one arbiter is a best practice of this tool, not a rule in the pages it cites; a small marketplace may start with one on purpose, so it is a warning.

## arbiter-is-party

- Level: warning
- Kind: a best practice of this tool, not a rule in the pages it cites
- Looks at: an arbiter is also the recipient of the platform fee or the treasury, so it decides disputes on money it is paid from.
- Cannot see: It compares the address of each arbiter with the recipient of the platform fee and the treasury. An arbiter paid from another address, or one who is a buyer or a seller of the order, is not seen: the configuration holds no orders.
- What to change: Choose arbiters who are paid neither the platform fee nor from the treasury, or keep the overlap and say so to buyers and sellers.
- Points of the pages: none. The tool's own choice: keeping arbiters apart from the money of the marketplace is a best practice of this tool, not a rule in the pages it cites; the cited pages say nothing of disputes.

## arbiter-is-admin

- Level: warning
- Kind: a best practice of this tool, not a rule in the pages it cites
- Looks at: an arbiter is also the owner, the pauser, the upgrader, the fee setter, the timelock or the multisig of the escrow, so one party can both rule on a dispute and change the rules.
- Cannot see: It compares the address of each arbiter with the owner, the pauser, the upgrader, the fee setter, the timelock and the multisig. A signer of the multisig who is also an arbiter is not reported.
- What to change: Choose arbiters who hold no role of the contracts.
- Points of the pages: none. The tool's own choice: keeping arbiters apart from the roles that change the contracts is a best practice of this tool, not a rule in the pages it cites; an arbiter who can upgrade or pause the escrow can decide a dispute twice.

## appeal-window-missing

- Level: info
- Kind: a best practice of this tool, not a rule in the pages it cites
- Looks at: the dispute setup gives no appeal window, or one of 0 seconds, so a ruling is final at once; a note, since many marketplaces have no appeal.
- Cannot see: It reads the appeal window of the file. It cannot see an appeal handled off chain.
- What to change: Add an appeal window in seconds if a ruling may be appealed, or keep rulings final on purpose.
- Points of the pages: none. The tool's own choice: noting that a ruling cannot be appealed is a best practice of this tool, not a rule in the pages it cites; appeals are common but not universal, so it is a note.

## stake-slash-invalid

- Level: error
- Kind: a best practice of this tool, not a rule in the pages it cites
- Looks at: the slash share of the stake of a seller is not a whole number of basis points from 0 to 10000, or is above 0 on a stake of 0.
- Cannot see: It reads the slash share and the amount of the stake. It cannot see when the contract slashes, or to whom the slashed amount goes.
- What to change: Write the slash share as a whole number of basis points of the stake, from 0 to 10000, and set the stake above 0 if it can be slashed.
- Points of the pages: none. The tool's own choice: checking the slash share against the stake is a best practice of this tool, not a rule in the pages it cites; a share above the whole stake cannot be paid and a share of a stake of 0 slashes nothing.

## admin-single-key

- Level: warning
- Kind: documented by the pages below
- Looks at: the owner, the upgrader, the fee setter or the treasury is not the multisig of the file (or, for the upgrader, its timelock), so one key can change the escrow, take its fees or move its funds.
- Cannot see: It compares addresses. It cannot tell whether an address is a multisig, a timelock or a key: the file says which address is the multisig, and the tool takes its word. A multisig held by one person passes.
- What to change: Make the owner, the fee setter and the treasury the multisig, and the upgrader the multisig or a timelock it controls; set them in roles.
- Points of the pages:
  - The ethereum.org page on smart contract security calls one address as the owner of a contract a single point of failure: whoever gets the keys of that address can attack the contract. (Smart contract security, ethereum.org developer documentation, https://ethereum.org/en/developers/docs/smart-contracts/security/)
  - The same page suggests managing a contract from a multi-signature account, which acts only with the signatures of a minimum number of its owners, so that a change needs the consent of more than one party. (Smart contract security, ethereum.org developer documentation, https://ethereum.org/en/developers/docs/smart-contracts/security/)

## multisig-threshold-low

- Level: warning
- Kind: documented by the pages below
- Looks at: the multisig needs only one signature, so any one of its signers acts alone.
- Cannot see: It reads the threshold the file declares, not the one the multisig contract holds on chain.
- What to change: Set the threshold to at least 2, and to a majority of the signers for the roles of the escrow.
- Points of the pages:
  - The same page suggests managing a contract from a multi-signature account, which acts only with the signatures of a minimum number of its owners, so that a change needs the consent of more than one party. (Smart contract security, ethereum.org developer documentation, https://ethereum.org/en/developers/docs/smart-contracts/security/)

## multisig-threshold-unreachable

- Level: error
- Kind: a best practice of this tool, not a rule in the pages it cites
- Looks at: the threshold of the multisig is above the number of its signers, so it can never act.
- Cannot see: It counts the distinct signers the file lists. Signers added or removed on chain since the file was written are not seen.
- What to change: Lower the threshold to the number of signers or fewer, or add the missing signers.
- Points of the pages: none. The tool's own choice: comparing the threshold with the signers is a best practice of this tool, not a rule in the pages it cites; the cited page describes a minimum number of signatures but not this mistake.

## upgrader-without-timelock

- Level: info
- Kind: a best practice of this tool, not a rule in the pages it cites
- Looks at: the escrow can be upgraded by a role that is not a timelock, so an upgrade takes effect at once and users cannot leave first; a note.
- Cannot see: It compares the upgrader with the timelock of the file. It cannot see the delay of the timelock, or whether the contract is upgradeable at all; a contract that cannot be upgraded should leave the upgrader out.
- What to change: Name a timelock in roles.timelock and make it the upgrader, or keep upgrades immediate on purpose and say so.
- Points of the pages: none. The tool's own choice: asking for a timelock in front of upgrades is a best practice of this tool, not a rule in the pages it cites; the security page of ethereum.org names timelocks for governance and emergency stops, not for upgrades, so it is a note.

## eip712-domain-chain-mismatch

- Level: error
- Kind: documented by the pages below
- Looks at: the chainId of the EIP-712 domain differs from the chain id of the file, though a wallet is to decline to sign for a chain id that is not the active one.
- Cannot see: It compares the chainId of the domain with the chain id of the file. It cannot see the chain id the contract builds its domain separator from at run time.
- What to change: Set the chainId of the domain to the chain the escrow is deployed on, or correct the chain id of the file.
- Points of the pages:
  - In the signing domain of EIP-712 the chainId field holds the EIP-155 id of the chain, and a wallet is expected to decline to sign when that id is not the one of the chain it is connected to. (EIP-712: Typed structured data hashing and signing, https://eips.ethereum.org/EIPS/eip-712)

## eip712-domain-missing-field

- Level: warning
- Kind: a best practice of this tool, not a rule in the pages it cites
- Looks at: the EIP-712 domain of signed listings leaves out its name, version, chainId or verifyingContract.
- Cannot see: It reads the four fields. A salt is read but never asked for, and the tool does not build the domain separator or check it against the contract.
- What to change: Give the domain its name, version, chainId and verifyingContract, so that a signature is bound to this marketplace, this version, this chain and this contract.
- Points of the pages: none. The tool's own choice: asking for all four fields is a best practice of this tool, not a rule in the pages it cites; EIP-712 lets a protocol leave out the fields that do not fit it, but a listing signed without them can be used where it was not meant to be.

## verifying-contract-zero

- Level: error
- Kind: documented by the pages below
- Looks at: the verifyingContract of the EIP-712 domain is the zero address, though the field names the contract that checks the signature.
- Cannot see: It reads the verifyingContract of the file. A well formed address of the wrong contract passes.
- What to change: Set verifyingContract to the address of the escrow or marketplace contract that checks signed listings.
- Points of the pages:
  - In the signing domain of EIP-712 the verifyingContract field names the contract that is to check the signature, and a wallet may use it to guard against phishing. (EIP-712: Typed structured data hashing and signing, https://eips.ethereum.org/EIPS/eip-712)

## token-chain-mismatch

- Level: error
- Kind: a best practice of this tool, not a rule in the pages it cites
- Looks at: a payment token is declared on another chain id than the chain of the file.
- Cannot see: It compares the chain id of each token with the chain id of the file. It cannot see whether the address holds a token on that chain.
- What to change: Use the address of the token on the chain the escrow is deployed on, or correct the chain id.
- Points of the pages: none. The tool's own choice: matching each token with the chain of the file is a best practice of this tool, not a rule in the pages it cites; the address of a token on one chain is another contract, or none, on the next.

## token-decimals-invalid

- Level: error
- Kind: a best practice of this tool, not a rule in the pages it cites
- Looks at: the decimals of a payment token are not a whole number from 0 to 36, or differ from the places of a token the tool knows (USDC and USDT 6, WBTC 8, DAI, WETH and ETH 18).
- Cannot see: It knows the places of USDC, USDT, WBTC, DAI, WETH and ETH. A bridged token with other places under a known symbol is reported; a token outside the table is checked only against the range of 0 to 36.
- What to change: Write the decimals the token contract answers from decimals(); USDC on most chains has 6.
- Points of the pages: none. The tool's own choice: checking the decimals of a token is a best practice of this tool, not a rule in the pages it cites; a price worked out with the wrong decimals is off by powers of ten.

## address-malformed

- Level: error
- Kind: a best practice of this tool, not a rule in the pages it cites
- Looks at: an address of a token, a role, the multisig or a signer, an arbiter, the fee recipient or the verifying contract that is not 0x and 40 hex digits.
- Cannot see: It checks the form of an address only, with no checksum of EIP-55 and no lookup, so a well formed address of the wrong wallet passes.
- What to change: Copy the address again from the wallet or the deployment.
- Points of the pages: none. The tool's own choice: checking the form of an address is a best practice of this tool, not a rule in the pages it cites; the form is the one wallets write on an EVM chain, and no page is saved for it.

## zero-address

- Level: error
- Kind: a best practice of this tool, not a rule in the pages it cites
- Looks at: a token, a role, the timelock, the multisig, a signer or an arbiter is the zero address, which no one holds, so the role can never act or the token cannot be paid.
- Cannot see: It reports the zero address in a token, a role, the timelock, the multisig, a signer or an arbiter. An address that no one holds but is not zero is not seen.
- What to change: Set the real address; write a native token with "native": true and no address.
- Points of the pages: none. The tool's own choice: refusing the zero address in a role or a token is a best practice of this tool, not a rule in the pages it cites; a role held by no one is lost for good once the contract is deployed.

## max-order-missing

- Level: info
- Kind: a best practice of this tool, not a rule in the pages it cites
- Looks at: the file sets no largest order value, so one order can lock any amount in the escrow; a note.
- Cannot see: It reads whether a largest order value is set. It cannot see whether the contract enforces it.
- What to change: Set limits.maxOrderValue with its token, at the largest order the marketplace means to hold.
- Points of the pages: none. The tool's own choice: asking for a largest order is a best practice of this tool, not a rule in the pages it cites; a cap limits what one bug or one dispute can lock, but many escrows have none, so it is a note.
