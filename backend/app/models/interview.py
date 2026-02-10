import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Text, DateTime, ForeignKey, JSON, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class InterviewStatus(str, enum.Enum):
    CREATED = "created"
    QUESTIONS_READY = "questions_ready"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    REVIEW_READY = "review_ready"


class Interview(Base):
    __tablename__ = "interviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    role = Column(String(50), nullable=False)  # sde, intern, learning
    status = Column(SAEnum(InterviewStatus), default=InterviewStatus.CREATED, nullable=False)
    livekit_room_id = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=True)

    # Relationships
    user = relationship("User", back_populates="interviews")
    topics = relationship("InterviewTopic", back_populates="interview", cascade="all, delete-orphan")
    questions = relationship("Question", back_populates="interview", cascade="all, delete-orphan")
    transcript_entries = relationship("TranscriptEntry", back_populates="interview", cascade="all, delete-orphan")
    question_results = relationship("QuestionResult", back_populates="interview", cascade="all, delete-orphan")
    review = relationship("Review", back_populates="interview", uselist=False, cascade="all, delete-orphan")


class InterviewTopic(Base):
    __tablename__ = "interview_topics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    interview_id = Column(UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False)
    topic_name = Column(String(255), nullable=False)
    order_index = Column(Integer, nullable=False, default=0)

    interview = relationship("Interview", back_populates="topics")


class Question(Base):
    __tablename__ = "questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    interview_id = Column(UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False)
    topic_id = Column(UUID(as_uuid=True), ForeignKey("interview_topics.id", ondelete="CASCADE"), nullable=False)
    question_text = Column(Text, nullable=False)
    expected_points = Column(JSON, nullable=True)  # List of key points expected in answer
    follow_ups = Column(JSON, nullable=True)  # List of follow-up questions
    hints = Column(JSON, nullable=True)  # List of hints
    order_index = Column(Integer, nullable=False, default=0)
    time_estimate_seconds = Column(Integer, nullable=True, default=180)  # ~3 min per question

    interview = relationship("Interview", back_populates="questions")
    topic = relationship("InterviewTopic")
    result = relationship("QuestionResult", back_populates="question", uselist=False)


class TranscriptEntry(Base):
    __tablename__ = "transcript_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    interview_id = Column(UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False)
    speaker = Column(String(20), nullable=False)  # "agent" or "candidate"
    text = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id", ondelete="SET NULL"), nullable=True)

    interview = relationship("Interview", back_populates="transcript_entries")


class QuestionResult(Base):
    __tablename__ = "question_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    interview_id = Column(UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    candidate_answer_summary = Column(Text, nullable=True)
    score = Column(Float, nullable=True)  # 0-5
    feedback = Column(Text, nullable=True)
    depth_reached = Column(String(20), nullable=True)  # basic, intermediate, advanced
    hint_used = Column(Integer, default=0)  # Number of hints used (0 or 1)

    interview = relationship("Interview", back_populates="question_results")
    question = relationship("Question", back_populates="result")


class Review(Base):
    __tablename__ = "reviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    interview_id = Column(UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False, unique=True)
    overall_score = Column(Float, nullable=False)
    topic_breakdown = Column(JSON, nullable=False)  # Per-topic scores and feedback
    strengths = Column(JSON, nullable=False)  # List of strengths
    weaknesses = Column(JSON, nullable=False)  # List of weaknesses
    suggestions = Column(JSON, nullable=False)  # List of improvement suggestions
    full_review_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    interview = relationship("Interview", back_populates="review")
