from dataclasses import dataclass


@dataclass
class Command:
    RUN = "run"
    HELP = "help"
