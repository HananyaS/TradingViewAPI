from dataclasses import dataclass

@dataclass
class Command:
    RUN = "run"
    CSV = "csv"
    HELP = "help"