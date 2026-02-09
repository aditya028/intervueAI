from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    APP_NAME: str = "IntervueAI"
    DEBUG: bool = True
    API_PREFIX: str = "/api"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/intervue_ai"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Groq (LLM)
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # Deepgram (STT)
    DEEPGRAM_API_KEY: str = ""

    # LiveKit
    LIVEKIT_URL: str = "ws://localhost:7880"
    LIVEKIT_API_KEY: str = ""
    LIVEKIT_API_SECRET: str = ""

    # Interview settings
    INTERVIEW_DURATION_MINUTES: int = 60
    INTERVIEW_MAX_DURATION_MINUTES: int = 75  # 1hr 15min max

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
