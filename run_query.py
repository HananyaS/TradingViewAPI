from telegram import Update
from telegram.ext import (
    ContextTypes,
    MessageHandler,
    filters,
    ConversationHandler,
    ApplicationBuilder,
    CommandHandler,
)

from commands import Command
from query_params import APPLY_DEFAULTS, PARAMS
from screener_service import query_by_params
from telegram_bot import create_csv_from_pd, get_bot_token, add_help_command


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

    if value == '-':
        value = None

    ctx.user_data[param.name] = value
    idx += 1
    if idx >= len(PARAMS):
        return await get_result(update, ctx)
    ctx.user_data['param_idx'] = idx
    await update.message.reply_text(PARAMS[idx].prompt)
    return PARAMS[idx].var


async def get_result(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    params = {p.name: ctx.user_data.get(p.name, p.default) for p in PARAMS}
    query_params = {
        'us_exchanges_only': params['us_exchanges_only'],
        'min_price': params['min_price'],
        'min_relative_volume': params['min_relative_volume'],
        'min_change': params['min_change'],
        'max_change': params['max_change'],
        'min_sma20_above_pct': params['min_sma20_above_pct'],
        'min_atr_pct': params['min_atr_pct'],
        'min_adr_pct': params['min_adr_pct'],
        'min_rsi': params['min_rsi'],
        'max_rsi': params['max_rsi'],
        'min_bb_percent_b': params['min_bb_percent_b'],
        'max_bb_percent_b': params['max_bb_percent_b'],
        'filter_out_otc': params['filter_out_otc'],
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


def main_telegram():
    print("BUILDING TELEGRAM BOT...")
    app = ApplicationBuilder().token(get_bot_token()).build()
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
    # main_telegram()

    res_df = query_by_params()
    res_df['SMA20 / Close Ratio'] = res_df['SMA20'] / res_df['close']

    print(
        res_df[
            [
                'name',
                'close',
                'change',
                'ATR%',
                'SMA20',
                'SMA20 / Close Ratio'
            ]
        ].sort_values('SMA20 / Close Ratio', ascending=False).head(30)
    )

