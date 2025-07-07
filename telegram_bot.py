import datetime
import io
import os

from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, ConversationHandler, filters, \
    CallbackContext
from telegram.ext import ContextTypes

from commands import Command

BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
if not BOT_TOKEN:
    raise ValueError("TELEGRAM_BOT_TOKEN environment variable is not set. Please set it with your bot token.")


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


def add_help_command(app) -> None:
    async def help_command(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
        # Dynamically get all class attributes that are not dunder or private
        command_attrs = [attr for attr in dir(Command) if not attr.startswith('__') and not callable(getattr(Command, attr))]
        help_text = "Available commands:\n"
        for attr in command_attrs:
            value = getattr(Command, attr)
            help_text += f"/{value}\n"
        await update.message.reply_text(help_text)

    app.add_handler(CommandHandler(Command.HELP, help_command))