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

    # TTS
    TTS_PROVIDER: str = "auto"  # auto, elevenlabs, openai, edge
    ELEVENLABS_API_KEY: str = ""
    ELEVENLABS_VOICE_ID: str = "JBFqnCBsd6RMkjVDRZzb"  # George (British, warm)
    OPENAI_API_KEY: str = ""
    OPENAI_TTS_VOICE: str = "ash"

    # Interview settings
    INTERVIEW_DURATION_MINUTES: int = 60
    INTERVIEW_MAX_DURATION_MINUTES: int = 75  # 1hr 15min max

    # JWT Auth
    JWT_SECRET_KEY: str = "change-me-to-a-random-secret-key-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_MINUTES: int = 1440  # 24 hours

    # Email (Gmail SMTP)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_EMAIL: str = ""
    SMTP_PASSWORD: str = ""  # Gmail App Password

    # OTP Settings
    OTP_LENGTH: int = 6
    OTP_EXPIRY_SECONDS: int = 600  # 10 minutes

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
