# Secure defaults

The default run is the safe run. Nothing in the first section needs a flag, and none of it can be switched off. The rest
of the document is about what the tool cannot do for you: which file you give it, where the output goes, and who may
change the file it reads. A clean result is not legal or financial advice, not an audit of the escrow contracts and not
a guarantee that funds will be released or refunded as intended; it is a file with none of the problems the checks look
for, not a finding that the escrow is sound.

## How the tool behaves by default

- **Never a secret.** The tool needs no private key, no seed, no API key and no address of a node, and has no option to
  take one. A key named for a key or a seed, and a value shaped like one, anywhere in the file, is a `secret-in-file`
  error that fails the run; the value is left out of every check and never written to a report or an error message, in
  any format. The value of a salt or a hash of the terms is never shown either.
- **Reads, never deploys or sends.** The tool reads the one file it is given. It follows no symbolic link, fetches no
  URL, refuses an argument that looks like an address, contacts no chain, node or API, evaluates nothing and writes
  nothing to disk. It cannot deploy, sign or call a contract.
- **Every check on from the first run.** A release that can fire before the dispute window closes, no refund path, a fee
  that cannot be read or goes to the zero address, milestones that are not the whole order or release nothing, a quorum
  that can never be met, a slash share that cannot be applied, a multisig that can never act, an EIP-712 domain of
  another chain or with a zero verifying contract, a token of another chain or with the wrong decimals, and malformed or
  zero addresses are errors; a release that waits on the buyer alone, a fee above the threshold, a single arbiter, an
  arbiter paid by the marketplace or holding a role, a role held by one key, a multisig of one signature and a domain
  with missing fields are warnings; no appeal window, an upgrade with no timelock and no largest order are notes. There
  is no configuration file of the tool that could set a check off.
- **No clock.** Every length is a number of seconds of the file; the tool never reads the time.
- **Fail closed on what it cannot read.** A file that is not strict JSON is an error finding that fails the run at the
  default `--fail-on` of `error`. A missing field and a value of the wrong type are findings of their own, so a part of
  the file that was not read is never taken for one that is fine. A misspelt key is a warning that names the key it is
  probably meant to be. A file that is not text, is too large or is a link stops the run with exit code `2` and no
  report.
- **Numbers as written.** An amount is read from the characters of the file into a whole number and a scale, never
  through a floating point number, and a share in basis points is read as a whole number; a number with an exponent or
  a separator is refused, and an amount with more places than its token keeps is an error.
- **Unknown arguments are errors.** An option the tool does not know, a value that looks like an option and an option
  given twice stop the run, so a typo such as `--fail-no` cannot leave a default in place. A `--max-fee-bps` that is not
  a whole number of basis points from 0 to 10000 is refused.
- **No pattern from the input.** No regular expression is built from the file or from an argument.
- **Bounded work.** The reader has limits of size, nesting, values and string length, the JSON reader, the search for
  secrets and the walk for hashes work with stacks of their own, and at most 100 tokens, 100 milestones, 1,000 arbiters
  and 100 signers are read (docs/limits.md), so a large or deep file cannot exhaust the stack, the memory or the time.
- **No prototype tricks.** Keys from the file are kept in lists and compared with the names the tool reads, never set
  as properties of an object, so `__proto__` is only a name.
- **Clean output.** Text from the input, file names, domain names, milestone names, symbols and addresses included, has
  control characters, line separators and direction controls replaced and its length capped before it reaches a report
  or an error message; the markdown report also escapes what markdown gives a meaning to.
- **The same input gives the same output.** No clock, no zone, no locale and no random number
  ([decision 1](decisions/0001-read-no-clock-and-keep-dates-out-of-the-repository.md)).
- **No dependencies.** Node 22 or newer and nothing else.

## Settings that make the check stricter

- **`--fail-on warning`.** A release that waits on the buyer alone, a fee above the threshold, a single arbiter, an
  arbiter paid by the marketplace or holding a role, a role held by one key, a multisig of one signature, a domain with
  missing fields and misspelt keys fail the run too. Use it on the configuration that is about to be deployed, and
  record each warning the team keeps on purpose.
- **`--fail-on info`.** No appeal window, an upgrade with no timelock and no largest order fail the run too.
- **A lower `--max-fee-bps`.** Set it to the highest fee the marketplace means to charge, so that a fee raised by
  mistake is a warning.
- **A complete file.** Give the stake, the limits, the timelock and the multisig with its signers; a part the file does
  not give is a check that does not run, and a note or a finding says so.

## Running it in a pipeline

```yaml
permissions:
  contents: read
steps:
  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
    with:
      node-version: 22
  - name: Marketplace escrow check
    run: npx --yes github:INNERLUXES/marketplace-escrow-check deploy/escrow.json --format markdown >> "$GITHUB_STEP_SUMMARY"
```

- Give the job read access to the contents and nothing more. The tool needs no secret, no API key and no access to a
  node; never give it one.
- Pin every action to a full commit, as above, and pin the tool to a release commit or a tag you have read, because
  `npx` runs what it downloads.
- Check the exact file the contracts are deployed from, and have the deployment script read the same file. A file edited
  after the check is not what was checked.
- Keep the configuration of a marketplace that is not yet public out of public repositories: it holds the addresses of
  its roles, its fees and its arbiters. Keep the reports with the same care, because a finding quotes addresses of the
  file.
- Do not hide the exit code with a trailing `|| true`. To keep the report without failing, keep `--fail-on` at `error`
  and keep the SARIF or JSON report as an artifact of the job.
- Treat a report built from a file you do not trust as untrusted data.
- If the tool ever reports `secret-in-file`, treat the key or seed as exposed: remove it from the file and from every
  place the file was copied to, and move what it controls to a new key. The tool does not show the value, but the file
  itself was readable to everyone with access to it.

## Protecting the escrow

An escrow holds the money of other people, and its rules are hard to change once deployed. Keep the deployment values
under review, hold every role that can change the rules or move funds in a multisig of more than one signer, put a
timelock in front of upgrades, keep arbiters apart from the money and the roles of the marketplace, make the release
timer longer than the dispute window, and check every change with this tool before it is deployed: it reads the values
as the file writes them, not whether the contracts follow them.

## SSDF

The repository is checked against NIST SP 800-218 (SSDF) in its own pipeline and before every release, with
`ssdf-repo-check` pinned to its release commit. The evidence it looks for is in these files:

| Practice | Evidence in this repository |
| --- | --- |
| PO.1 Define security requirements | CONTRIBUTING.md, docs/secure-defaults.md |
| PO.2 Roles and responsibilities | .github/CODEOWNERS |
| PO.3 Toolchain | .github/workflows/ci.yml, codeql.yml, release.yml |
| PO.4 Criteria for security checks | CodeQL with the security-extended queries, the SSDF gate in ci.yml and release.yml |
| PO.5 Secure environments | a `permissions:` block in every workflow, actions pinned to commits |
| PS.1 Protect the code | .gitignore for keys and `.env`, `npm run check` for committed secrets |
| PS.2 Integrity of releases | SHA-256 checksums and a build provenance attestation in release.yml |
| PS.3 Archive and provenance | a CycloneDX SBOM and the CHANGELOG with every release |
| PW.1 Design for security | docs/threat-model.md |
| PW.2 Review the design | docs/decisions |
| PW.4 Reuse secure components | no runtime dependencies, a lock file, Dependabot |
| PW.5 Secure coding | CONTRIBUTING.md, `npm run check` |
| PW.6 Build settings | `npm ci` from the lock file |
| PW.7 Code review | the pull request template and CODEOWNERS |
| PW.8 Testing | `npm test` on Linux, Windows and macOS with Node 22 and 24, `npm run test:coverage`, hostile input tests |
| PW.9 Secure defaults | this document |
| RV.1 Find vulnerabilities | SECURITY.md, Dependabot |
| RV.2 Respond to vulnerabilities | SECURITY.md |
