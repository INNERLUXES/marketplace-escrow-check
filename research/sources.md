# Sources

The public pages the documented checks of this tool are based on, each with a short note in this project's own words
on what the page says and which checks lean on it. Nothing here is a copy of a page: read the page itself for its exact
wording. A plain text copy of each page, taken when it was read, is kept in [research/sources](sources) so that a point
can be checked against the page it came from, and the copies are the pages' own words, not this project's. src/data.js
holds the pages and the points the reports show, and test/data.test.js checks that every page in src/data.js is listed
here and has its copy, that no point quotes its page at length, and that the pages say what the documented checks rest
on.

The tool reads the configuration of a marketplace escrow and runs nothing; its result is an input to a review of a
marketplace escrow configuration before its contracts are deployed: not legal or financial advice, not an audit of the
escrow contracts and not a guarantee that funds will be released or refunded as intended. These notes say what the
pages say so a reader can follow a finding back to its source. The pages were chosen with web addresses that hold no
number that reads like a year, and each was read with a plain HTTP client as the markdown source from which the site
builds the page: EIP-712 from the repository ethereum/EIPs (the same path in the repository ethereum/ERCs answered that
the page is not there), and the security page from the repository ethereum/ethereum-org-website. No browser was used.

## What the pages say, and what they do not

- EIP-712 is checked against its final text. It defines the domain of a signature as a struct named EIP712Domain with
  one or more of five fields: the name of the signing domain, its current major version, the EIP-155 chain id, the
  address of the contract that will verify the signature, and a salt. Of the chainId it says that the wallet (the
  user-agent) should refuse to sign when the id does not match the chain that is active; of verifyingContract, that it
  is the address of the contract that will verify the signature and that a wallet may use it against phishing. It also
  says that a protocol only needs to include the fields that make sense for its domain, and leaves the others out.
- So `eip712-domain-chain-mismatch` is documented: a domain whose chainId is not the chain the escrow runs on is one a
  wallet is told to refuse. `verifying-contract-zero` is documented: the field names the contract that checks the
  signature, and no contract is at the zero address. `eip712-domain-missing-field` is a best practice of this tool,
  because the page lets a protocol leave fields out; the tool asks for all four as its own choice.
- What EIP-712 does not say matters as much. The page says in plain words that the standard does not include replay
  protection, and its section on replay attacks leaves it to the application to reject a signed message seen twice. It
  does not say that the chainId of the domain prevents the replay of a signature on another chain; the tool does not
  say so either, and its messages say only what the page says: that a wallet should refuse a domain of another chain.
  The page says nothing of escrows, marketplaces, listings, fees or roles.
- The page on smart contract security of ethereum.org is developer documentation, not a standard, and has no status. It
  says that registering a single address as the owner of a contract brings a single point of failure: if the keys of
  that owner are compromised, attackers can attack the contract. It suggests role-based access control with several
  administrative accounts, and a multi-signature account that needs signatures from a minimum number of its owners, such
  as 3 of 5, so that actions on a contract need the consent of more than one party.
- So `admin-single-key` is documented: an owner, upgrader, fee setter or treasury held by one key is the single point of
  failure the page describes. `multisig-threshold-low` is documented: a multisig that needs one signature does not need
  the consent of more than one party, which is what the page gives a multisig for. `multisig-threshold-unreachable` is a
  best practice of this tool: the page speaks of a minimum number of signatures but not of a threshold above the
  signers.
- The same page names timelocks, but for onchain governance and for decentralizing control of an emergency stop, not for
  upgrades, and it describes upgrades through proxy patterns without asking for a delay. So `upgrader-without-timelock`
  is a best practice of this tool, and only a note.

Everything else the tool checks is a best practice of this tool, not a rule in these pages, and each check says so in
its message and in its own entry of [docs/rules-and-sources.md](../docs/rules-and-sources.md), with the reason. No page
saved here describes an escrow: how funds are released or refunded, how long a dispute window is, how milestones split
an order, how arbiters, panels, quorums and appeals work, how a stake is slashed, how high a platform fee may be, which
tokens and decimals belong to a chain, what form an address has, or that an order needs a largest value. These are the
checks a smart contract developer makes on an escrow configuration from practice.

The tool reads a configuration of its own format and was not tied to the page of one escrow protocol or one marketplace
on purpose: such pages describe one product and change often.

## What the copies leave out

Each copy is the text of the page as it was read, with a two-line header that names its address and how it was read,
and with these lines left out or changed, so that no copy holds a date, a number that reads like a year, personal
contact details or a word this project keeps out of every file, and every copy is plain ASCII (decision 1 in
docs/decisions):

- EIP-712: the line `author:` of the front matter, which names the authors with their handles, and the line `created:`,
  which holds the day the page was created. The note under the RPC method that says the address to sign with must be in
  a state the project does not name, and the same sentence at the end of the description of the web3 method; both are
  about the state of an account in a node, not about the domain. The page writes its sets and its concatenation with
  mathematical letters and symbols: they are written as ASCII, the double-struck T, B and S as T, B and S, the union as
  U, the double bar of concatenation as ||, a superscript as ^ (B^8n, B^256), a subscript as _ (member_1, value_n) and
  the ellipsis as three points.
- The security page of ethereum.org: the paragraph that opens the page with the losses of past hacks, which links to
  reports by the day and names the years; the line of a list of audit resources whose address holds a full date; and the
  sentence in the section on reentrancy that names the year of a hack. Its curly quotes and dashes are written as ASCII
  quotes and hyphens. No other line had to be left out or changed.

The checks of `npm run check` and of test/repo.test.js pass over the rest of the text of the copies as it was read.

## Signing

### EIP-712: Typed structured data hashing and signing

https://eips.ethereum.org/EIPS/eip-712

Copy: research/sources/eip-712-typed-structured-data.txt

The final standard for hashing and signing typed structured data, with a signing domain of a name, a version, a chain
id, a verifying contract and a salt, of which a protocol uses the fields that fit it. `eip712-domain-chain-mismatch`
and `verifying-contract-zero` lean on it.

## Access control

### Smart contract security, ethereum.org developer documentation

https://ethereum.org/en/developers/docs/smart-contracts/security/

Copy: research/sources/ethereum-org-smart-contract-security.txt

A guide to building secure smart contracts, which calls a single owner key a single point of failure and suggests
role-based access control and multi-signature accounts that need the consent of more than one party.
`admin-single-key` and `multisig-threshold-low` lean on it.
