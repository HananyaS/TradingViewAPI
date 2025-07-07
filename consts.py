from dataclasses import dataclass

@dataclass
class Consts:
    COLUMNS_TO_RETRIEVE = [
        'name', 'ATR', 'ADR', 'close', 'volume', 'exchange', 'SMA20', 'relative_volume', 'change', 'market_cap_basic',
        'Candle.Hammer', 'Candle.Engulfing.Bullish', 'Candle.Doji', 'Candle.Marubozu.White',
    ]

    US_EXCHANGES = [
        "NYSE",
        "NASDAQ",
        "NYSE AMERICAN",
        "NYSE ARCA",
        "CBOE",
        "CBOE BZX",
        "CBOE BYX",
        "CBOE EDGX",
        "CBOE EDGA",
        "IEX",
        "OTC",
        "OTC MARKETS",
        "PHILADELPHIA STOCK EXCHANGE",
        "NYSE CHICAGO",
        "NATIONAL STOCK EXCHANGE",
        "NASDAQ BX",
        "BATS",
        "INSTINET"
    ]