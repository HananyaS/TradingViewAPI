from dataclasses import dataclass

@dataclass
class Defaults:
    US_EXCHANGES_ONLY = True
    MIN_RELATIVE_VOLUME = None # 1.5
    MIN_CHANGE = None # 0
    MIN_SMA20_ABOVE_PCT = 1.1
    MAX_SMA20_ABOVE_PCT = None
    MIN_ATR_PCT = 5.0
    MAX_ATR_PCT = None
    BULLISH_CANDLESTICK_PATTERNS_ONLY = True
