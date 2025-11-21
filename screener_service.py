import numpy as np
from tradingview_screener import Query, Column

from consts import Consts
from default_params import Defaults
from utils import clean_candle_columns


def query_by_params(
        us_exchanges_only=Defaults.US_EXCHANGES_ONLY,
        min_price=Defaults.MIN_PRICE,
        min_relative_volume=Defaults.MIN_RELATIVE_VOLUME,
        min_change=Defaults.MIN_CHANGE,
        max_change=Defaults.MAX_CHANGE,
        min_sma20_above_pct=Defaults.MIN_SMA20_ABOVE_PRICE_PCT,
        min_atr_pct=Defaults.MIN_ATR_PCT,
        min_adr_pct=Defaults.MIN_ADR_PCT,
        min_rsi=Defaults.MIN_RSI,
        max_rsi=Defaults.MAX_RSI,
        min_bb_percent_b=Defaults.MIN_BB_PERCENT_B,
        max_bb_percent_b=Defaults.MAX_BB_PERCENT_B,
        filter_out_otc=Defaults.FILTER_OUT_OTC,
        bullish_candlestick_patterns_only=Defaults.BULLISH_CANDLESTICK_PATTERNS_ONLY,
        **kwargs
):
    params = {
        'us_exchanges_only': kwargs.get('us_exchanges_only', us_exchanges_only),
        'min_price': kwargs.get('min_price', min_price),
        'min_relative_volume': kwargs.get('min_relative_volume', min_relative_volume),
        'min_change': kwargs.get('min_change', min_change),
        'max_change': kwargs.get('max_change', max_change),
        'min_sma20_above_pct': kwargs.get('min_sma20_above_pct', min_sma20_above_pct),
        'min_atr_pct': kwargs.get('min_atr_pct', min_atr_pct),
        'min_adr_pct': kwargs.get('min_adr_pct', min_adr_pct),
        'min_rsi': kwargs.get('min_rsi', min_rsi),
        'max_rsi': kwargs.get('max_rsi', max_rsi),
        'min_bb_percent_b': kwargs.get('min_bb_percent_b', min_bb_percent_b),
        'max_bb_percent_b': kwargs.get('max_bb_percent_b', max_bb_percent_b),
        'filter_out_otc': kwargs.get('filter_out_otc', filter_out_otc),
        'bullish_candlestick_patterns_only': kwargs.get(
            'bullish_candlestick_patterns_only',
            bullish_candlestick_patterns_only
        ),
    }

    trv_query = Query().select(*Consts.COLUMNS_TO_RETRIEVE)
    query_filters = []
    if params['us_exchanges_only']:
        query_filters.append(Column('exchange').isin(Consts.US_EXCHANGES))
    if params['min_price'] is not None:
        query_filters.append(Column('close') >= params['min_price'])
    if params['min_relative_volume'] is not None:
        query_filters.append(Column('relative_volume') > params['min_relative_volume'])
    if params['min_change'] is not None:
        query_filters.append(Column('change') > params['min_change'])
    if params['max_change'] is not None:
        query_filters.append(Column('change') < params['max_change'])
    if params['min_sma20_above_pct'] is not None:
        query_filters.append(Column('SMA20').above_pct('close', params['min_sma20_above_pct']))

    _, query_results_pd = trv_query.where(*query_filters).order_by(
        'market_cap_basic',
        ascending=False
    ).limit(int(1e6)).get_scanner_data()

    query_results_pd['SMA20/Close'] = query_results_pd['SMA20'] / query_results_pd['close']

    if params['min_sma20_above_pct'] is not None:
        query_results_pd = query_results_pd[query_results_pd['SMA20/Close'] >= params['min_sma20_above_pct']]

    query_results_pd['ATR%'] = query_results_pd['ATR'] / query_results_pd['close'] * 100
    if params['min_atr_pct'] is not None:
        query_results_pd = query_results_pd[query_results_pd['ATR%'] >= params['min_atr_pct']]

    query_results_pd['ADR%'] = query_results_pd['ADR'] / query_results_pd['close'] * 100
    if params['min_adr_pct'] is not None:
        query_results_pd = query_results_pd[query_results_pd['ADR%'] >= params['min_adr_pct']]

    try:
        bb_denominator = query_results_pd['BB.upper'] - query_results_pd['BB.lower']
        query_results_pd['BB.percent_b'] = np.where(
            (bb_denominator != 0) & (bb_denominator.notna()),
            (query_results_pd['close'] - query_results_pd['BB.lower']) / bb_denominator,
            np.nan
        )
    except Exception:
        query_results_pd['BB.percent_b'] = np.nan

    if params['min_rsi'] is not None:
        query_results_pd = query_results_pd[
            (query_results_pd['RSI'] >= params['min_rsi']) &
            (query_results_pd['RSI'].notna())
        ]
    if params['max_rsi'] is not None:
        query_results_pd = query_results_pd[
            (query_results_pd['RSI'] <= params['max_rsi']) &
            (query_results_pd['RSI'].notna())
        ]

    if params['min_bb_percent_b'] is not None:
        query_results_pd = query_results_pd[
            (query_results_pd['BB.percent_b'] >= params['min_bb_percent_b']) &
            (query_results_pd['BB.percent_b'].notna())
        ]
    if params['max_bb_percent_b'] is not None:
        query_results_pd = query_results_pd[
            (query_results_pd['BB.percent_b'] <= params['max_bb_percent_b']) &
            (query_results_pd['BB.percent_b'].notna())
        ]

    if params['filter_out_otc']:
        otc_exchanges = ['OTC', 'OTC MARKETS']
        query_results_pd = query_results_pd[~query_results_pd['exchange'].isin(otc_exchanges)]

    if params['bullish_candlestick_patterns_only']:
        query_results_pd = query_results_pd[
            (
                query_results_pd['Candle.Hammer'] +
                query_results_pd['Candle.Engulfing.Bullish'] +
                query_results_pd['Candle.Marubozu.White']
            ) >= 1
        ]

    clean_candles_df = clean_candle_columns(query_results_pd)
    clean_candles_df = clean_candles_df.sort_values('SMA20/Close', ascending=False)

    return clean_candles_df[
        [
            'name',
            'exchange',
            'close',
            'change',
            'volume',
            'SMA20',
            'SMA20/Close',
            'relative_volume',
            'market_cap_basic',
            'ATR%',
            'RSI',
            'BB.lower',
            'BB.upper',
            'BB.percent_b',
            'candlestick_pattern',
        ]
    ]


def fetch_symbol_quotes(symbols):
    """Fetch latest quote data for a set of ticker symbols using TradingView screener.
    Only returns quotes for stocks listed on US exchanges."""
    if not symbols:
        return {}

    normalized_symbols = []
    seen = set()
    for symbol in symbols:
        if not symbol:
            continue
        normalized = symbol.upper()
        if normalized not in seen:
            seen.add(normalized)
            normalized_symbols.append(normalized)

    if not normalized_symbols:
        return {}

    trv_query = Query().select('name', 'close', 'change', 'change_abs', 'exchange')
    # Filter by symbol name AND US exchanges only
    filters = [
        Column('name').isin(normalized_symbols),
        Column('exchange').isin(Consts.US_EXCHANGES)
    ]

    _, df = trv_query.where(*filters).limit(len(normalized_symbols) * 3).get_scanner_data()
    if df.empty:
        return {symbol: None for symbol in normalized_symbols}

    quotes = {}
    for symbol in normalized_symbols:
        # Filter to only US exchanges
        symbol_rows = df[(df['name'] == symbol) & (df['exchange'].isin(Consts.US_EXCHANGES))]
        if symbol_rows.empty:
            quotes[symbol] = None
            continue

        # Prefer major exchanges (NYSE, NASDAQ) if available
        row = None
        for preferred_exchange in ['NYSE', 'NASDAQ', 'NYSE AMERICAN', 'NYSE ARCA']:
            preferred_rows = symbol_rows[symbol_rows['exchange'] == preferred_exchange]
            if not preferred_rows.empty:
                row = preferred_rows.iloc[0]
                break
        
        # If no preferred exchange found, use first available US exchange
        if row is None:
            row = symbol_rows.iloc[0]

        close = row.get('close')
        change_percent = row.get('change')
        absolute_change = row.get('change_abs')
        if absolute_change is None and close is not None and change_percent is not None:
            absolute_change = (change_percent / 100.0) * close

        quotes[symbol] = {
            'current': float(close) if close is not None else None,
            'change': float(absolute_change) if absolute_change is not None else None,
            'changePercent': float(change_percent) if change_percent is not None else None,
            'exchange': row.get('exchange')
        }

    return quotes

