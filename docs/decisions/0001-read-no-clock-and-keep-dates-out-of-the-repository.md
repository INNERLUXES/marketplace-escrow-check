# 1. Read no clock, and keep dates out of the repository

## Status

Accepted

## Context

An escrow is full of time: how long a buyer has to open a dispute, how long the funds wait before they are released,
how long a ruling can be appealed. None of these needs the clock. They are lengths, written in the configuration as
whole numbers of seconds, and the mistakes in them are mistakes between lengths: a release that comes before the
dispute window closes, an appeal window of 0. Reading the clock would add nothing to these checks and would make the
same file give a different report on a different day.

A date in a file also brings its own trouble: a time zone, a format, a calendar, and the difference between the time of
a server and the time of a block.

## Decision

1. The tool reads no clock, no time zone and no locale. It never prints the current time and never says when a page, a
   list or a release was published. The same file and the same options give the same output on every machine and on
   every day.
2. The release timeout, the dispute window and the appeal window are whole numbers of seconds of the file. The tool
   compares them and shows them with the whole days they make, and never turns one into a date.
3. No document, example or test of this repository holds a date or a number that reads like a year: not the licence,
   not the changelog, not the documents, not the comments of the code, not the examples. `npm run check` and a test fail
   on any word of four digits that starts with 19 or 20. The saved copies of the public pages under research/sources are
   the pages' own words and are the one place the check does not read for prose; even so, the lines that carry a date or
   a number that reads like a year (the day EIP-712 was created, and the lines of the security page of ethereum.org that
   name the years of past hacks or hold a date in an address) were left out of the copies, so the test that reads every
   file for a year passes over them too. research/sources.md lists every line that was left out.
4. A version, an amount, a number of seconds or the number of a standard is not a year and is not caught: 1.0.0, Node
   22, 604,800 seconds, a stake of 100 USDC, EIP-712, EIP-155, SARIF 2.1.0 and NIST SP 800-218 hold no year. A test of
   test/repo.test.js runs the pattern over such values and checks that none of them is caught, and that a year in the
   same place still is.
5. The sources are chosen with addresses that hold no year, and the notes on them name no publication date.

## Consequences

- The output of a run can be saved in the repository (`examples/output`) and compared on every change.
- A configuration can be checked long before its contracts are deployed, and gives the same report on the day of the
  deployment.
- The report holds no date and no deadline; every length is a number of the file.
