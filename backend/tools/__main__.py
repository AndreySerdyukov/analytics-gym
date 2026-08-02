"""Единая точка входа контент-тулинга: `python -m tools <команда>`.

    uv run python -m tools new-task sql "Retention D7 по когортам"
    uv run python -m tools validate
    uv run python -m tools sync
"""

import sys
from collections.abc import Callable

from tools import export_static, scaffold, sync, validate

COMMANDS: dict[str, Callable[[list[str]], int]] = {
    "new-task": scaffold.main_task,
    "new-note": scaffold.main_note,
    "new-dataset": scaffold.main_dataset,
    "validate": validate.main,
    "sync": sync.main,
    "export-static": export_static.main,
}


def main(argv: list[str]) -> int:
    """Разбирает имя команды и передаёт остальные аргументы её обработчику."""
    if not argv or argv[0] in {"-h", "--help", "help"}:
        print(__doc__)
        print("Доступные команды:")
        for name in COMMANDS:
            print(f"  {name}")
        return 0

    command, *rest = argv
    handler = COMMANDS.get(command)
    if handler is None:
        print(f"✗ Неизвестная команда: {command}")
        print(f"  Доступны: {', '.join(COMMANDS)}")
        return 1
    return handler(rest)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
