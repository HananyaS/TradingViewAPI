from default_params import Defaults
from query_utils import parse_optional_float, parse_optional_bool


# List of QueryParam objects in order
class QueryParam:
    def __init__(self, name, prompt, parser, default, var=None, postprocess=None, ignore_in_query=False):
        self.name = name
        self.prompt = prompt
        self.parser = parser
        self.default = default
        self.var = var
        self.postprocess = postprocess
        self.ignore_in_query = ignore_in_query

    def set_var(self, var):
        self.var = var


PARAMS = [
    QueryParam(
        name='us_exchanges_only',
        prompt="US exchanges only? yes/no or '-':",
        parser=parse_optional_bool,
        default=Defaults.US_EXCHANGES_ONLY,
    ),
    QueryParam(
        name='min_price',
        prompt="Min price (e.g. 1 or '-'):",
        parser=parse_optional_float,
        default=Defaults.MIN_PRICE,
    ),
    QueryParam(
        name='min_relative_volume',
        prompt="Min relative volume (e.g. 1.5 or '-'):",
        parser=parse_optional_float,
        default=Defaults.MIN_RELATIVE_VOLUME,
    ),
    QueryParam(
        name='min_change',
        prompt="Min % change (e.g. 5 or '-'):",
        parser=parse_optional_float,
        default=Defaults.MIN_CHANGE,
        postprocess=lambda v: None if v is None else v / 100,
    ),
    QueryParam(
        name='min_sma20_above_pct',
        prompt="Min SMA20/close ratio (e.g. 1.1 or '-'):",
        parser=parse_optional_float,
        default=Defaults.MIN_SMA20_ABOVE_PCT,
    ),
    QueryParam(
        name='max_sma20_above_pct',
        prompt="Max SMA20/close ratio (or '-'):",
        parser=parse_optional_float,
        default=Defaults.MAX_SMA20_ABOVE_PCT,
    ),
    QueryParam(
        name='min_atr_pct',
        prompt="Min ATR % (e.g. 5 or '-'):",
        parser=parse_optional_float,
        default=Defaults.MIN_ATR_PCT,
    ),
    QueryParam(
        name='max_atr_pct',
        prompt="Max ATR % (e.g. 10 or '-'):",
        parser=parse_optional_float,
        default=Defaults.MAX_ATR_PCT,
    ),
    QueryParam(
        name='min_adr_pct',
        prompt="Min ADR % (e.g. 3 or '-'):",
        parser=parse_optional_float,
        default=Defaults.MIN_ADR_PCT,
    ),
    QueryParam(
        name='bullish_candlestick_patterns_only',
        prompt="Only bullish candlestick patterns? yes/no or '-':",
        parser=parse_optional_bool,
        default=Defaults.BULLISH_CANDLESTICK_PATTERNS_ONLY,
    ),
]

# add param vars
(APPLY_DEFAULTS, *PARAM_STATES) = list(range(1 + len(PARAMS)))

for i, param in enumerate(PARAMS):
    param.set_var(PARAM_STATES[i])
