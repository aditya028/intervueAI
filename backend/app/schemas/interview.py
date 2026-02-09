from pydantic import BaseModel
from datetime import datetime
from uuid import UUID


# ---- Request Schemas ----

class InterviewCreate(BaseModel):
    role: str  # sde, intern, learning
    topics: list[str]


# ---- Response Schemas ----

class TopicOut(BaseModel):
    id: UUID
    topic_name: str
    order_index: int

    class Config:
        from_attributes = True


class QuestionOut(BaseModel):
    id: UUID
    question_text: str
    topic_id: UUID
    expected_points: list[str] | None = None
    follow_ups: list[str] | None = None
    hints: list[str] | None = None
    order_index: int
    time_estimate_seconds: int | None = None

    class Config:
        from_attributes = True


class InterviewOut(BaseModel):
    id: UUID
    role: str
    status: str
    livekit_room_id: str | None = None
    created_at: datetime
    started_at: datetime | None = None
    ended_at: datetime | None = None
    duration_seconds: int | None = None
    topics: list[TopicOut] = []

    class Config:
        from_attributes = True


class InterviewBrief(BaseModel):
    id: UUID
    role: str
    topics: list[str]
    total_questions: int
    estimated_duration: str
    focus_areas: list[str]


class TopicBreakdown(BaseModel):
    name: str
    score: float
    max_score: float = 10.0
    strengths: list[str]
    improvements: list[str]


class ReviewOut(BaseModel):
    id: UUID
    interview_id: UUID
    overall_score: float
    duration: str | None = None
    role: str | None = None
    topic_breakdown: list[TopicBreakdown]
    strengths: list[str]
    weaknesses: list[str]
    suggestions: list[str]
    verdict: str
    created_at: datetime

    class Config:
        from_attributes = True


class LiveKitTokenOut(BaseModel):
    token: str
    room_id: str
    url: str
