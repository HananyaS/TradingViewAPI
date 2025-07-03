from typing import Optional

from telegram import Update
from telegram.ext import (
    ContextTypes, MessageHandler, filters, ConversationHandler, ApplicationBuilder, CommandHandler
)
from tradingview_screener import Query, Column

from telegram_bot import create_csv_from_pd, BOT_TOKEN
from utils import clean_candle_columns

# Search All Fields AT || https://shner-elmo.github.io/TradingView-Screener/fields/stocks.html

# Conversation states
(APPLY_DEFAULTS, EXC, RV, CHG, MINR, MAXR, MINATR, MAXATR, PATTERN, RESULT) = range(10)


def parse_optional_float(text: str) -> Optional[float]:
    text = text.strip()
    return None if text == '-' else float(text)


async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    ctx.user_data.clear()
    print('in start')

    await update.message.reply_text("""
        Apply Default Params? 
        
        - exchange = 'NASDAQ',
        - min_relative_volume = 1.5,
        - min_change = 0.05,
        - min_sma20_above_pct = 1.1,
        - max_sma20_above_pct = None,
        - min_atr_pct = 5.0,
        - max_atr_pct = 5.0,
        - bullish_candlestick_patterns_only = True
    """)

    return APPLY_DEFAULTS


async def get_apply_defaults(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    print('in get_apply_defaults')

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

    if ctx.user_data['apply_defaults']:
        ctx.user_data['exchange'] = 'NASDAQ'
        ctx.user_data['min_relative_volume'] = 1.5
        ctx.user_data['min_change'] = .05
        ctx.user_data['min_sma20_above_pct'] = 1.1
        ctx.user_data['max_sma20_above_pct'] = None
        ctx.user_data['min_atr_pct'] = 5
        ctx.user_data['max_atr_pct'] = None
        ctx.user_data['bullish_only'] = True

        await update.message.reply_text("Settings Defaults... Fetching results...")
        return await get_result(update, ctx)

    else:
        await update.message.reply_text("Enter exchange (e.g. NASDAQ) or '-' to ignore:")
        return EXC


async def get_exchange(update, ctx):
    txt = update.message.text.strip()
    ctx.user_data['exchange'] = None if txt == '-' else txt.upper()
    await update.message.reply_text("Min relative_volume (e.g. 1.5 or '-'):")
    return RV


async def get_rv(update, ctx):
    try:
        ctx.user_data['min_relative_volume'] = parse_optional_float(update.message.text)
    except:
        await update.message.reply_text("Please enter a number or '-':")
        return RV

    await update.message.reply_text("Min % change (e.g. 5 or '-'):")
    return CHG


async def get_chg(update, ctx):
    try:
        val = parse_optional_float(update.message.text)
        ctx.user_data['min_change'] = None if val is None else val / 100
    except:
        await update.message.reply_text("Enter % or '-':")
        return CHG
    await update.message.reply_text("Min SMA20/close ratio (e.g. 1.1 or '-'):")
    return MINR


async def get_minr(update, ctx):
    try:
        ctx.user_data['min_sma20_above_pct'] = parse_optional_float(update.message.text)
    except:
        await update.message.reply_text("Number or '-':")
        return MINR
    await update.message.reply_text("Max SMA20/close ratio (or '-'):")
    return MAXR


async def get_maxr(update, ctx):
    try:
        ctx.user_data['max_sma20_above_pct'] = parse_optional_float(update.message.text)
    except:
        await update.message.reply_text("Number or '-':")
        return MAXR
    await update.message.reply_text("Min ATR % (e.g. 5 or '-'):")
    return MINATR


async def get_minatr(update, ctx):
    try:
        ctx.user_data['min_atr_pct'] = parse_optional_float(update.message.text)
    except:
        await update.message.reply_text("Number or '-':")
        return MINATR
    await update.message.reply_text("Max ATR % (e.g. 10 or '-'):")
    return MAXATR


async def get_maxatr(update, ctx):
    try:
        ctx.user_data['max_atr_pct'] = parse_optional_float(update.message.text)
    except:
        await update.message.reply_text("Number or '-':")
        return MAXATR
    await update.message.reply_text("Only bullish patterns? yes/no or '-':")
    return PATTERN


async def get_pattern(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    txt = update.message.text.strip().lower()
    if txt == '-':
        ctx.user_data['bullish_only'] = False
    elif txt in ('1', 'yes', 'y', 'true', 't'):
        ctx.user_data['bullish_only'] = True
    elif txt in ('0', 'no', 'n', 'false', 'f'):
        ctx.user_data['bullish_only'] = False
    else:
        await update.message.reply_text(
            "Please reply with:\n"
            "`1` or `yes` ⇒ include only bullish candlestick patterns\n"
            "`0` or `no` ⇒ include all candlestick patterns\n"
            "`-` ⇒ ignore candlestick filter",
            parse_mode="Markdown"
        )
        return PATTERN

    return await get_result(update, ctx)


async def get_result(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    # Map None to defaults in function call
    params = {
        'exchange': ctx.user_data.get('exchange'),
        'min_relative_volume': ctx.user_data.get('min_relative_volume'),
        'min_change': ctx.user_data.get('min_change'),
        'min_sma20_above_pct': ctx.user_data.get('min_sma20_above_pct'),
        'max_sma20_above_pct': ctx.user_data.get('max_sma20_above_pct'),
        'min_atr_pct': ctx.user_data.get('min_atr_pct'),
        'max_atr_pct': ctx.user_data.get('max_atr_pct'),
        'bullish_candlestick_patterns_only': ctx.user_data.get('bullish_only')
    }

    df = query_by_params(**params)

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
        exchange='NASDAQ',
        min_relative_volume=1.5,
        min_change=0.05,
        min_sma20_above_pct=1.1,
        max_sma20_above_pct=None,
        min_atr_pct=5.0,
        max_atr_pct=5.0,
        bullish_candlestick_patterns_only=True
):
    print(f"""
    APPLYING QUERY BY PARAMS:
    
    - exchange = {exchange}
    - min_relative_volume = {min_relative_volume}
    - min_change = {min_change}
    - min_sma20_above_pct = {min_sma20_above_pct}
    - max_sma20_above_pct = {max_sma20_above_pct}
    - min_atr_pct = {min_atr_pct}
    - max_atr_pct = {max_atr_pct}
    - bullish_candlestick_patterns_only = {bullish_candlestick_patterns_only}
    """)
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
            (
                    query_results_pd['Candle.Hammer'] +
                    query_results_pd['Candle.Engulfing.Bullish'] +
                    query_results_pd['Candle.Doji'] +
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


def main():
    print("BUILDING TELEGRAM BOT...")
    app = ApplicationBuilder().token(BOT_TOKEN).build()
    conv = ConversationHandler(
        entry_points=[CommandHandler("run_filtered", start)],
        states={
            APPLY_DEFAULTS: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_apply_defaults)],
            EXC: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_exchange)],
            RV: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_rv)],
            CHG: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_chg)],
            MINR: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_minr)],
            MAXR: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_maxr)],
            MINATR: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_minatr)],
            MAXATR: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_maxatr)],
            PATTERN: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_pattern)],
            RESULT: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_result)],
        },
        fallbacks=[]
    )
    app.add_handler(conv)
    app.run_polling()


if __name__ == "__main__":
    main()
