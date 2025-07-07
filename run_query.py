from telegram import Update
from telegram.ext import (
    ContextTypes, MessageHandler, filters, ConversationHandler, ApplicationBuilder, CommandHandler
)
from tradingview_screener import Query, Column

from commands import Command
from consts import Consts
from default_params import Defaults
from query_params import APPLY_DEFAULTS, PARAMS
from telegram_bot import create_csv_from_pd, BOT_TOKEN, add_help_command
from utils import clean_candle_columns


# Search All Fields AT || https://shner-elmo.github.io/TradingView-Screener/fields/stocks.html

async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    ctx.user_data.clear()
    start_msg = "Apply Default Params?  yes/no or '-':\n\n"

    for param in PARAMS:
        start_msg += f"\t{param.name}: {param.default}\n"

    await update.message.reply_text(start_msg)
    return APPLY_DEFAULTS


async def get_apply_defaults(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    txt = update.message.text.strip().lower()
    if txt in ('1', 'yes', 'y', 'true', 't'):
        ctx.user_data['apply_defaults'] = True
    elif txt in ('0', 'no', 'n', 'false', 'f'):
        ctx.user_data['apply_defaults'] = False
    else:
        await update.message.reply_text(
            "Please reply with:\n"
            "`1` or `yes` ⇒ apply default values\n"
            "`0` or `no` ⇒ don't apply default values\n",
            parse_mode="Markdown"
        )
        return APPLY_DEFAULTS

    if ctx.user_data['apply_defaults']:
        for param in PARAMS:
            ctx.user_data[param.name] = param.default
        await update.message.reply_text("Settings Defaults... Fetching results...")
        return await get_result(update, ctx)
    else:
        ctx.user_data['param_idx'] = 0
        await update.message.reply_text(PARAMS[0].prompt)
        return PARAMS[0].var


async def param_handler(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    idx = ctx.user_data.get('param_idx', 0)
    param = PARAMS[idx]
    value = param.parser(update.message.text)
    if value is None:
        await update.message.reply_text(param.prompt)
        return param.var
    if param.postprocess:
        value = param.postprocess(value)

    if value == '-': value = None

    ctx.user_data[param.name] = value
    idx += 1
    if idx >= len(PARAMS):
        return await get_result(update, ctx)
    ctx.user_data['param_idx'] = idx
    await update.message.reply_text(PARAMS[idx].prompt)
    return PARAMS[idx].var


async def get_result(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    params = {p.name: ctx.user_data.get(p.name, p.default) for p in PARAMS}
    # Map to query_by_params signature
    query_params = {
        'us_exchanges_only': params['us_exchanges_only'],
        'min_price': params['min_price'],
        'min_relative_volume': params['min_relative_volume'],
        'min_change': params['min_change'],
        'min_sma20_above_pct': params['min_sma20_above_pct'],
        'max_sma20_above_pct': params['max_sma20_above_pct'],
        'min_atr_pct': params['min_atr_pct'],
        'max_atr_pct': params['max_atr_pct'],
        'min_adr_pct': params['min_adr_pct'],
        'bullish_candlestick_patterns_only': params['bullish_candlestick_patterns_only'],
    }
    df = query_by_params(**query_params)
    if df.empty:
        await update.message.reply_text("No symbols found.")
    else:
        await update.message.reply_text(f"Found {len(df)} symbols! Full results are available in CSV.")
        buf = create_csv_from_pd(df)
        if buf:
            await ctx.bot.send_document(
                chat_id=update.effective_chat.id,
                document=buf,
                caption=f"Found {len(df)} symbols"
            )
    ctx.user_data.clear()
    return ConversationHandler.END


def query_by_params(
        us_exchanges_only=Defaults.US_EXCHANGES_ONLY,
        min_price=Defaults.MIN_PRICE,
        min_relative_volume=Defaults.MIN_RELATIVE_VOLUME,
        min_change=Defaults.MIN_CHANGE,
        min_sma20_above_pct=Defaults.MIN_SMA20_ABOVE_PCT,
        max_sma20_above_pct=Defaults.MAX_SMA20_ABOVE_PCT,
        min_atr_pct=Defaults.MIN_ATR_PCT,
        max_atr_pct=Defaults.MAX_ATR_PCT,
        min_adr_pct=Defaults.MIN_ADR_PCT,
        bullish_candlestick_patterns_only=Defaults.BULLISH_CANDLESTICK_PATTERNS_ONLY,
        **kwargs
):
    # Use kwargs for flexibility, but explicit defaults for all main params
    params = {
        'us_exchanges_only': kwargs.get('us_exchanges_only', us_exchanges_only),
        'min_price': kwargs.get('min_price', min_price),
        'min_relative_volume': kwargs.get('min_relative_volume', min_relative_volume),
        'min_change': kwargs.get('min_change', min_change),
        'min_sma20_above_pct': kwargs.get('min_sma20_above_pct', min_sma20_above_pct),
        'max_sma20_above_pct': kwargs.get('max_sma20_above_pct', max_sma20_above_pct),
        'min_atr_pct': kwargs.get('min_atr_pct', min_atr_pct),
        'max_atr_pct': kwargs.get('max_atr_pct', max_atr_pct),
        'min_adr_pct': kwargs.get('min_adr_pct', min_adr_pct),
        'bullish_candlestick_patterns_only': kwargs.get('bullish_candlestick_patterns_only',
                                                        bullish_candlestick_patterns_only),
    }
    print(f"""
    APPLYING QUERY BY PARAMS:
    {params}
    """)

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
    if params['min_sma20_above_pct'] is not None:
        query_filters.append(Column('SMA20').above_pct('close', params['min_sma20_above_pct']))
    if params['max_sma20_above_pct'] is not None:
        query_filters.append(Column('SMA20').below_pct('close', params['max_sma20_above_pct']))
    _, query_results_pd = trv_query.where(*query_filters).order_by(
        'market_cap_basic',
        ascending=False
    ).limit(int(1e6)).get_scanner_data()
    query_results_pd['ATR%'] = query_results_pd['ATR'] / query_results_pd['close'] * 100
    if params['min_atr_pct'] is not None:
        query_results_pd = query_results_pd[query_results_pd['ATR%'] >= params['min_atr_pct']]
    if params['max_atr_pct'] is not None:
        query_results_pd = query_results_pd[query_results_pd['ATR%'] <= params['max_atr_pct']]

    query_results_pd['ADR%'] = query_results_pd['ADR'] / query_results_pd['close'] * 100
    if params['min_adr_pct'] is not None:
        query_results_pd = query_results_pd[query_results_pd['ADR%'] >= params['min_adr_pct']]

    if params['bullish_candlestick_patterns_only']:
        query_results_pd = query_results_pd[
            (
                    query_results_pd['Candle.Hammer'] +
                    query_results_pd['Candle.Engulfing.Bullish'] +
                    query_results_pd['Candle.Marubozu.White']
            ) >= 1
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


def main_telegram():
    print("BUILDING TELEGRAM BOT...")
    app = ApplicationBuilder().token(BOT_TOKEN).build()
    states = {p.var: [MessageHandler(filters.TEXT & ~filters.COMMAND, param_handler)] for p in PARAMS}
    states[APPLY_DEFAULTS] = [MessageHandler(filters.TEXT & ~filters.COMMAND, get_apply_defaults)]
    conv = ConversationHandler(
        entry_points=[CommandHandler(Command.RUN, start)],
        states=states,
        fallbacks=[]
    )

    add_help_command(app)
    app.add_handler(conv)
    app.run_polling()


if __name__ == "__main__":
    main_telegram()
    # res_df = query_by_params()
    # print(res_df)
