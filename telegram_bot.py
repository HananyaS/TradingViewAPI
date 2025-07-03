import datetime
import io
import os

from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, ConversationHandler, filters
from telegram.ext import ContextTypes


BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
if not BOT_TOKEN:
    raise ValueError("TELEGRAM_BOT_TOKEN environment variable is not set. Please set it with your bot token.")


def send_to_telegram(commands_dict: dict):
    app = ApplicationBuilder().token(BOT_TOKEN).build()

    for command, func in commands_dict.items():
        app.add_handler(CommandHandler(command, func))

    app.add_handler(CommandHandler('start', lambda update, context: update.message.reply_text(
        "Welcome! Use /run to start the screener.")))
    app.add_handler(CommandHandler('help', lambda update, context: update.message.reply_text(
        f"Available commands:\n{'\n'.join([f'/{cmd}' for cmd in commands_dict.keys()])}")))
    app.run_polling()


def create_csv_from_pd(results):
    """
    Generates a CSV file from a Pandas DataFrame and returns it as a BytesIO object.

    Args:
        results: A Pandas DataFrame containing the data to be written to the CSV.

    Returns:
        A BytesIO object containing the CSV data, or None if the DataFrame is empty.
    """
    if results.empty:
        return None

    s = io.StringIO()
    results.to_csv(s, index=False)
    s.seek(0)

    buf = io.BytesIO()
    buf.write(s.getvalue().encode('utf-8'))
    buf.seek(0)
    buf.name = f"screener_results_{datetime.datetime.today().strftime('%Y%m%d')}.csv"
    return buf


def build_screener_text_and_csv_func(get_query_results_func, use_user_args: bool = True):
    async def run_screener(update: Update, context: ContextTypes.DEFAULT_TYPE):
        # Notify user
        await update.message.reply_text("🔍 Running screener…")

        # Perform your scan
        if use_user_args:
            results = get_query_results_func(**context.user_data).to_string(index=False)

        else:
            results = get_query_results_func().to_string(index=False)

        await update.message.reply_text(f"📊 Results:\n{results}")

    async def run_csv(update: Update, context: ContextTypes.DEFAULT_TYPE):
        # Run your screener query

        if use_user_args:
            results = get_query_results_func(**context.user_data)

        else:
            results = get_query_results_func()

        if results.empty:
            await update.message.reply_text("❌ No results found.")
            return

        buf = create_csv_from_pd(results)

        await context.bot.send_document(chat_id=update.effective_chat.id,
                                        document=buf,
                                        caption="📊 Your screener CSV")

    return run_screener, run_csv
