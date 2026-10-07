// The public pages the documented checks rest on, and the points of each that the reports show, written in this
// project's own words. A page is named by its address; a copy of its text, read before it was listed, is kept under
// research/sources. research/sources.md lists every page with a note, docs/rules-and-sources.md lists every rule with its
// points, and test/data.test.js checks the three against each other.

export const LEVELS = ['info', 'warning', 'error'];

export const NOT_A = 'not legal or financial advice, not an audit of the escrow contracts and not a guarantee that funds will be released or refunded as intended';

export const NOTICE = `This report is an input to a review of a marketplace escrow configuration before its contracts are deployed: ${NOT_A}.`;

export const SOURCES = [
  { id: 'eip-712', title: 'EIP-712: Typed structured data hashing and signing', url: 'https://eips.ethereum.org/EIPS/eip-712', file: 'research/sources/eip-712-typed-structured-data.txt' },
  { id: 'ethereum-security', title: 'Smart contract security, ethereum.org developer documentation', url: 'https://ethereum.org/en/developers/docs/smart-contracts/security/', file: 'research/sources/ethereum-org-smart-contract-security.txt' }
];

// Points: id -> { source, text }.
export const POINTS = {
  'eip712-chain-id': { source: 'eip-712', text: 'In the signing domain of EIP-712 the chainId field holds the EIP-155 id of the chain, and a wallet is expected to decline to sign when that id is not the one of the chain it is connected to.' },
  'eip712-verifying-contract': { source: 'eip-712', text: 'In the signing domain of EIP-712 the verifyingContract field names the contract that is to check the signature, and a wallet may use it to guard against phishing.' },
  'security-single-owner': { source: 'ethereum-security', text: 'The ethereum.org page on smart contract security calls one address as the owner of a contract a single point of failure: whoever gets the keys of that address can attack the contract.' },
  'security-multisig': { source: 'ethereum-security', text: 'The same page suggests managing a contract from a multi-signature account, which acts only with the signatures of a minimum number of its owners, so that a change needs the consent of more than one party.' }
};

export const source = (id) => SOURCES.find((s) => s.id === id);
export const pointPage = (id) => source(POINTS[id].source);
