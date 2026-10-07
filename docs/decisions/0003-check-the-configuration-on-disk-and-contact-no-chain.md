# 3. Check the configuration on disk, and contact no chain

## Status

Accepted

## Context

Many facts about an escrow live elsewhere: the code of the contracts, the owners and threshold of a multisig, the delay
of a timelock, the decimals a token contract answers, whether an address holds code at all. A check could call a node on
every run, read the contracts and the multisig, ask a block explorer for the token. That would need the network, a node
and often an API key, would make the result depend on the state of a chain and of other people's services at the moment
of the run, would send the addresses of a marketplace that is not yet public to a third party, and would let a file in a
pull request make the pipeline reach any address it names.

What a team needs first, before the contracts are deployed, is a list of what is wrong in the values it is about to
deploy with and where: a release that beats the dispute window, a quorum that can never be met, an owner held by one
key, an EIP-712 domain of another chain. The configuration can be written as a file, reviewed like code and checked the
same way on every run.

## Decision

1. The tool reads the file it is given, and nothing else. It contacts no chain, node or API, fetches nothing, opens no
   link, needs no key, runs no program and sends no data anywhere. It cannot deploy, sign or call a contract.
2. The file stands for the values the escrow contracts will be deployed with. The tool works out its checks from the
   file alone, and never asks a chain.
3. The file is the tool's own format, not the constructor arguments of one escrow contract. A script turns the
   deployment values of a project into the file; the checks stay the same whatever contracts the project deploys.
4. The form of an address and the decimals of a few known tokens are tables in the code, kept short and named in
   docs/limits.md. They are updated in a release, never fetched while the tool runs.
5. The rules the checks apply are listed in docs/method.md, and the public pages each documented check rests on are
   named in src/data.js and research/sources.md, each fetched and read before it was listed, with a copy of its text
   under research/sources. A check that no page says is a best practice of this tool and says so.
6. The tool lists what to look at and what to change; it changes nothing and sends nothing.

## Consequences

- The result depends only on the file, and a run needs no network access, no secret and no node.
- A configuration that does not match the deployed contracts gives a report about the configuration, not about the
  contracts; docs/limits.md says so.
- A multisig, a timelock and a token are the file's word: the tool cannot tell whether the address named as the
  multisig is one.
