from dataclasses import dataclass

@dataclass
class Defaults:
    MIN_PRICE = 1
    US_EXCHANGES_ONLY = True
    MIN_RELATIVE_VOLUME = None
    MIN_CHANGE = None
    MIN_SMA20_ABOVE_PRICE_PCT = 1.5
    MIN_ATR_PCT = None
    MIN_ADR_PCT = None
    FILTER_OUT_OTC = True
    BULLISH_CANDLESTICK_PATTERNS_ONLY = False
