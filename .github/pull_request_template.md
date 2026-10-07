## What changes

<!-- One or two sentences. -->

## Checks

- [ ] `npm test`, `npm run test:coverage`, `npm run check` and `npm run example` pass, and the files under `examples/output` are the ones `npm run example` wrote
- [ ] A change to a check is described in docs/method.md, says what it can and cannot see, and has a test with the configuration written inline and a near miss on each side
- [ ] A change to what the tool cannot see is in docs/limits.md and docs/rules-and-sources.md
- [ ] A change to a field that is read is in docs/inputs.md and docs/method.md, and in the README
- [ ] A change to a point of a public page is in src/data.js, research/sources.md and docs/rules-and-sources.md, in this project's own words, with no long quotation, and the page is saved as text under research/sources
- [ ] A check that is a best practice and not a rule of the pages it cites says so in its message and in its `own` text
- [ ] Nothing in the change, the README or the output reads as legal or financial advice, an audit of the escrow contracts or a guarantee that funds will be released or refunded as intended, and the tool reads the file and signs, deploys and runs nothing
- [ ] The tool still never reads or asks for a private key, a seed or an API key, a value that looks like one is still a `secret-in-file` finding, and no report or error message shows such a value, a salt or a hash of the terms
- [ ] A field the file does not give, or gives in the wrong form, is still a finding with its line, and a check never takes a value it did not read for one that is fine
- [ ] Amounts and shares are still read from the characters of the file, never through a floating point number
- [ ] Lengths are still whole numbers of seconds read from the file; the tool reads no clock and never turns one into a date
- [ ] The JSON reader still stops at its limits with the place and does not recurse, and the reader of the configuration and the decimal reader keep their limits
- [ ] No pattern is built from the file or from an argument
- [ ] Text from the input goes through `safeText` before it reaches the output or an error message, and the markdown format escapes what markdown gives a meaning to
- [ ] The tool still reads no clock and no locale, contacts no chain, node or API, opens no link and no network connection, signs nothing, runs nothing it reads, evaluates nothing and writes nothing to disk
- [ ] Work stays bounded: the limits of docs/limits.md hold, and a hostile test has a time check that widens under coverage through `NODE_V8_COVERAGE`
- [ ] A test that depends on the operating system (a link, a device) is guarded with `process.platform`, asserts no line of its own, and builds its paths with `resolve()` from forward-slash names
- [ ] The examples stay made up and minimal: no real person, marketplace or wallet, addresses and hashes of one character written many times, no key, no seed and no number that reads like a year
- [ ] The commit messages of this pull request follow Conventional Commits
