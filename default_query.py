from telegram_bot import send_to_telegram, build_screener_text_and_csv_func
from tradingview_screener import Query, Column

from commands import Command
from utils import clean_candle_columns

# Search All Fields AT || https://shner-elmo.github.io/TradingView-Screener/fields/stocks.html

def query():
    _, query_results_pd = Query().select(
        'name', 'ATR', 'close', 'volume', 'exchange', 'SMA20', 'relative_volume', 'change', 'market_cap_basic',
        'Candle.Hammer', 'Candle.Engulfing.Bullish', 'Candle.Doji', 'Candle.Marubozu.White',
        ).where(
            Column('exchange') == 'NASDAQ',
            Column('relative_volume') > 1.5,
            Column('change') > 0.05,
            Column('SMA20').above_pct('close', 1.1),
        ).order_by(
            'market_cap_basic',
            ascending=False
    ).get_scanner_data()

    query_results_pd['ATR%'] = query_results_pd['ATR'] / query_results_pd['close'] * 100
    query_results_pd = query_results_pd[
        (query_results_pd['ATR%'] > 5) &
        (
            query_results_pd['Candle.Hammer'] |
            query_results_pd['Candle.Engulfing.Bullish'] |
            query_results_pd['Candle.Doji'] |
            query_results_pd['Candle.Marubozu.White']
        )
    ]

    clean_candles_df = clean_candle_columns(query_results_pd)

    return clean_candles_df[
        [
            'name',
            'close',
            'change',
            'volume',
            'SMA20',
            'relative_volume',
            'market_cap_basic',
            'ATR%',
            'candlestick_pattern',
        ]
    ]


def query_by_params(
        exchange='NASDAQ',
        min_relative_volume=1.5,
        min_change=0.05,
        min_sma20_above_pct=1.1,
        max_sma20_above_pct=None,
        min_atr_pct=5.0,
        max_atr_pct=5.0,
        bullish_candlestick_patterns_only=True
):
    trv_query = Query().select(
        'name', 'ATR', 'close', 'volume', 'exchange', 'SMA20', 'relative_volume', 'change', 'market_cap_basic',
        'Candle.Hammer', 'Candle.Engulfing.Bullish', 'Candle.Doji', 'Candle.Marubozu.White',
    )

    if exchange is not None:
        trv_query = trv_query.where(Column('exchange') == exchange)

    if min_relative_volume is not None:
        trv_query = trv_query.where(Column('relative_volume') > min_relative_volume)
    
    if min_change is not None:
        trv_query = trv_query.where(Column('change') > min_change)

    if min_sma20_above_pct is not None:
        trv_query = trv_query.where(Column('SMA20').above_pct('close', min_sma20_above_pct))

    if max_sma20_above_pct is not None:
        trv_query = trv_query.where(Column('SMA20').below_pct('close', max_sma20_above_pct))

    _, query_results_pd = trv_query.order_by(
            'market_cap_basic',
            ascending=False
    ).get_scanner_data()

    query_results_pd['ATR%'] = query_results_pd['ATR'] / query_results_pd['close'] * 100
    
    if min_atr_pct is not None:
        query_results_pd = query_results_pd[query_results_pd['ATR%'] >= min_atr_pct]

    if max_atr_pct is not None:
        query_results_pd = query_results_pd[query_results_pd['ATR%'] <= max_atr_pct]

    if bullish_candlestick_patterns_only:
        query_results_pd = query_results_pd[
            (query_results_pd['Candle.Hammer']) |
            (query_results_pd['Candle.Engulfing.Bullish']) |
            (query_results_pd['Candle.Doji']) |
            (query_results_pd['Candle.Marubozu.White'])
        ]


    clean_candles_df = clean_candle_columns(query_results_pd)

    return clean_candles_df[
        [
            'name',
            'close',
            'change',
            'volume',
            'SMA20',
            'relative_volume',
            'market_cap_basic',
            'ATR%',
            'candlestick_pattern',
        ]
    ]



if __name__ == "__main__":
    df = get_tradingview_data()
    print(df)
    send_to_telegram(commands_dict={
        Command.RUN: run_screener,
        Command.CSV: run_csv
    })