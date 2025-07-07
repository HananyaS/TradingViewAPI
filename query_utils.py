from typing import Optional, Callable

from telegram import Update
from telegram.ext import (
    ContextTypes
)


def parse_optional_float(text: str) -> Optional[float]:
    text = text.strip()
    if text == '-': return text
    try: return float(text)
    except ValueError: return None

def parse_optional_bool(text: str) -> Optional[bool]:
    text = text.strip().lower()
    if text in ('1', 'yes', 'y', 'true', 't'):
        return True

    if text in ('0', 'no', 'n', 'false', 'f', '-'):
        return False

    return None


async def set_param(text: str, parser: Callable, param_name: str, update: Update, ctx: ContextTypes.DEFAULT_TYPE,
                    param_var):
    param_value = parser(text)

    if param_value is not None:
        ctx.user_data[param_name] = param_value

    if param_value is None:
        await update.message.reply_text(
            "Please only reply with:\n"
            "\t`1` / `yes` / 'true' / 't' for True\n"
            "\t`0` / `no` / 'false' / 'f' / '-' for False",
            parse_mode="Markdown"
        )
        return param_var


