# Search All Fields AT || https://shner-elmo.github.io/TradingView-Screener/fields/stocks.html

def clean_candle_columns(df):
    candle_columns = list(filter(lambda x: x.startswith('Candle.'), df.columns))

    df['candlestick_pattern'] = df[candle_columns].apply(
        lambda row: ', '.join([col for col in candle_columns if row[col]]), axis=1
    )

    return df