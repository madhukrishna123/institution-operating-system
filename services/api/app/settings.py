from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./services/api/local.db"
    web_origin: str = "http://localhost:3000"
    environment: str = "development"
    secret_key: str = "dev-only-change-me"
    bootstrap_admin_email: str = "admin@example.com"
    bootstrap_admin_password: str = "ChangeMe123!"
    bootstrap_admin_name: str = "Institution Admin"
    bootstrap_institution_name: str = "Nova Learning Institution"
    access_token_minutes: int = 720

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
