import os

class Settings:
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/grc_exceptions"
    )
    API_TITLE: str = "Policy Exception Registry API"

settings = Settings()
