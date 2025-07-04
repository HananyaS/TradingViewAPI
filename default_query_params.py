from dataclasses import dataclass

@dataclass
class Defaults:
    EXCHANGE = 'NASDAQ'
    MIN_RELATIVE_VOLUME = 1.5
    MIN_CHANGE = 0
    MIN_SMA20_ABOVE_PCT = 1.1
    MAX_SMA20_ABOVE_PCT = None
    MIN_ATR_PCT = 5.0
    MAX_ATR_PCT = None
    BULLISH_CANDLESTICK_PATTERNS_ONLY = False
