from dataclasses import dataclass


@dataclass
class AppError(Exception):
    message: str
    code: str
    status_code: int
