# Import all models so SQLAlchemy registers them with Base.metadata
from app.models.interview import (  # noqa: F401
    Interview,
    InterviewTopic,
    Question,
    TranscriptEntry,
    QuestionResult,
    Review,
)
