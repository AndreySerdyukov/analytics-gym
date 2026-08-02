"""Доменные исключения. Слой services не знает про HTTP — роутеры сами мапят их в коды ответов."""


class NotFoundError(Exception):
    """Запрошенный объект не найден."""


class ValidationError(Exception):
    """Данные не проходят доменную проверку."""
