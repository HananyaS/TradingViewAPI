from dataclasses import dataclass

@dataclass
class Defaults:
    MIN_PRICE = 1
    US_EXCHANGES_ONLY = True
    MIN_RELATIVE_VOLUME = 1
    MIN_CHANGE = None
    MIN_SMA20_ABOVE_PCT = 1.5
    MAX_SMA20_ABOVE_PCT = None
    MIN_ATR_PCT = 5
    MIN_ADR_PCT = 3
    FILTER_OUT_OTC = True
    BULLISH_CANDLESTICK_PATTERNS_ONLY = True
