// The form of an address and the tokens the tool knows. An escrow of a marketplace on an EVM chain names its contracts,
// roles, arbiters and tokens by addresses of 0x and 40 hex digits. The checksum of mixed case (EIP-55) is not checked,
// and nothing is looked up on a chain. Two addresses are the same wallet when they differ only in case. The form and
// the short table of tokens are a best practice of the tool (src/rules.js, address-malformed, zero-address,
// token-decimals-invalid): no page is saved for them, and the table is short on purpose.

const EVM = /^0x[0-9a-fA-F]{40}$/;
const EVM_ZERO = /^0x0{40}$/;

export const ADDRESS_FORM = '0x followed by 40 hex digits';

// What is wrong with the form of an address, or null when its form is right. The zero address has the right form; the
// checks that care about it ask isZeroAddress.
export function addressProblem(text) {
  const v = text.trim();
  if (v !== text) return 'has spaces around it';
  if (!v.startsWith('0x')) return 'does not start with 0x';
  if (v.length !== 42) return `has ${v.length - 2} characters after 0x, not 40`;
  if (!EVM.test(v)) return 'holds a character that is not a hex digit';
  return null;
}

// Whether an address is the zero address.
export const isZeroAddress = (text) => EVM_ZERO.test(text.trim());

// The key two addresses are compared by: in small letters.
export const addressKey = (text) => text.trim().toLowerCase();

// The decimal places a token keeps, as an ERC-20 contract answers from decimals(), and the largest number of places the
// tool takes for any token. A token of the table with other places is reported; a token outside it is checked only
// against the largest number.
export const MAX_DECIMALS = 36;
export const KNOWN_TOKENS = { USDC: 6, USDT: 6, DAI: 18, WETH: 18, WBTC: 8, ETH: 18 };

// The places of a token the tool knows, by its symbol in any case, or null.
export const knownDecimals = (symbol) => (Object.hasOwn(KNOWN_TOKENS, symbol.toUpperCase()) ? KNOWN_TOKENS[symbol.toUpperCase()] : null);
