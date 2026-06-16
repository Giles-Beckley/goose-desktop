/**
 * Store currency formatting.
 *
 * The store's currency is a single store-wide setting (orders do not carry a
 * per-order currency). It is read once from the plugin's `get_store_settings`
 * MCP tool and cached in the connection store. All money rendering in the UI
 * should go through `formatCurrency` so the symbol, symbol position, and
 * thousand/decimal separators match the store's configuration instead of a
 * hardcoded `$`.
 */

export interface Currency {
  /** ISO 4217 code, e.g. 'EUR', 'USD', 'GBP'. */
  code: string;
  /** Display symbol, e.g. '€', '$', '£'. */
  symbol: string;
  /** Where the symbol sits relative to the amount. */
  position: 'before' | 'before_space' | 'after' | 'after_space';
  thousand_sep: string;
  decimal_sep: string;
  /** Number of decimal places (0 or 2). */
  decimals: number;
}

/**
 * Fallback used before the store's settings are fetched, or when talking to a
 * plugin too old to expose `get_store_settings`. Matches the app's historical
 * hardcoded behaviour ($, 2 decimals) so nothing regresses.
 */
export const DEFAULT_CURRENCY: Currency = {
  code: 'USD',
  symbol: '$',
  position: 'before',
  thousand_sep: ',',
  decimal_sep: '.',
  decimals: 2,
};

/** Coerce an unknown payload (e.g. from get_store_settings) into a Currency. */
export function toCurrency(raw: unknown): Currency {
  if (!raw || typeof raw !== 'object') return DEFAULT_CURRENCY;
  const c = raw as Record<string, unknown>;
  const position = c.position as Currency['position'];
  return {
    code: typeof c.code === 'string' && c.code ? c.code : DEFAULT_CURRENCY.code,
    symbol: typeof c.symbol === 'string' && c.symbol ? c.symbol : DEFAULT_CURRENCY.symbol,
    position: ['before', 'before_space', 'after', 'after_space'].includes(position)
      ? position
      : DEFAULT_CURRENCY.position,
    thousand_sep: typeof c.thousand_sep === 'string' ? c.thousand_sep : DEFAULT_CURRENCY.thousand_sep,
    decimal_sep: typeof c.decimal_sep === 'string' ? c.decimal_sep : DEFAULT_CURRENCY.decimal_sep,
    decimals: c.decimals === 0 || c.decimals === '0' ? 0 : 2,
  };
}

/** Format the numeric part with the store's separators and decimal count. */
function formatNumber(amount: number, currency: Currency): string {
  const fixed = Math.abs(amount).toFixed(currency.decimals);
  const [intPart, decPart] = fixed.split('.');
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, currency.thousand_sep);
  return decPart ? `${withThousands}${currency.decimal_sep}${decPart}` : withThousands;
}

/**
 * Format a monetary amount using the store's currency settings.
 * Pass the currency from the connection store; omit it to use the default.
 *
 * @example formatCurrency(1234.5, eur) => "1.234,50 €"
 * @example formatCurrency(1234.5)      => "$1,234.50"
 */
export function formatCurrency(amount: number | null | undefined, currency: Currency = DEFAULT_CURRENCY): string {
  const value = typeof amount === 'number' && isFinite(amount) ? amount : 0;
  const sign = value < 0 ? '-' : '';
  const num = formatNumber(value, currency);
  const sym = currency.symbol;
  switch (currency.position) {
    case 'after':
      return `${sign}${num}${sym}`;
    case 'after_space':
      return `${sign}${num} ${sym}`;
    case 'before_space':
      return `${sign}${sym} ${num}`;
    case 'before':
    default:
      return `${sign}${sym}${num}`;
  }
}
