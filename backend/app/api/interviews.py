"""Interview API endpoints."""

import logging
import time
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.core.database import get_db
from app.models.interview import (
    Interview,
    InterviewTopic,
    Question,
    InterviewStatus,
    Review,
    TranscriptEntry,
    QuestionResult,
)
from app.schemas.interview import (
    InterviewCreate,
    InterviewOut,
    InterviewBrief,
    ReviewOut,
    TopicBreakdown,
)
from app.agents.question_generator import generate_questions
from app.agents.review_generator import generate_review

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/interviews", tags=["interviews"])


# ---- Additional Request Schemas ----

class ChatMessage(BaseModel):
    message: str
    interview_id: str


class EndInterviewRequest(BaseModel):
    interview_id: str
    duration_seconds: int


# ---- Endpoints ----

@router.post("", response_model=InterviewOut)
async def create_interview(data: InterviewCreate, db: AsyncSession = Depends(get_db)):
    """Create a new interview and generate questions."""
    if data.role not in ("sde", "intern", "learning"):
        raise HTTPException(status_code=400, detail="Invalid role. Must be: sde, intern, or learning")

    if not data.topics or len(data.topics) == 0:
        raise HTTPException(status_code=400, detail="At least one topic is required")

    interview = Interview(role=data.role, status=InterviewStatus.CREATED)
    db.add(interview)
    await db.flush()

    topic_records = {}
    for i, topic_name in enumerate(data.topics):
        topic = InterviewTopic(
            interview_id=interview.id,
            topic_name=topic_name,
            order_index=i,
        )
        db.add(topic)
        await db.flush()
        topic_records[topic_name] = topic

    try:
        generated = await generate_questions(data.role, data.topics)

        for i, q in enumerate(generated):
            topic_name = q.get("topic", data.topics[0])
            topic_record = topic_records.get(topic_name)

            if not topic_record:
                for name, record in topic_records.items():
                    if name.lower() in topic_name.lower() or topic_name.lower() in name.lower():
                        topic_record = record
                        break
                if not topic_record:
                    topic_record = list(topic_records.values())[0]

            question = Question(
                interview_id=interview.id,
                topic_id=topic_record.id,
                question_text=q.get("question_text", ""),
                expected_points=q.get("expected_points", []),
                follow_ups=q.get("follow_ups", []),
                hints=q.get("hints", []),
                order_index=i,
                time_estimate_seconds=q.get("time_estimate_seconds", 180),
            )
            db.add(question)

        interview.status = InterviewStatus.QUESTIONS_READY
        await db.flush()

    except Exception as e:
        logger.error(f"Question generation failed: {e}")
        interview.status = InterviewStatus.CREATED

    await db.commit()

    result = await db.execute(
        select(Interview)
        .options(selectinload(Interview.topics))
        .where(Interview.id == interview.id)
    )
    interview = result.scalar_one()
    return interview


@router.get("/{interview_id}", response_model=InterviewOut)
async def get_interview(interview_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get interview details."""
    result = await db.execute(
        select(Interview)
        .options(selectinload(Interview.topics))
        .where(Interview.id == interview_id)
    )
    interview = result.scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return interview


@router.get("/{interview_id}/brief", response_model=InterviewBrief)
async def get_interview_brief(interview_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get the pre-interview brief with focus areas."""
    result = await db.execute(
        select(Interview)
        .options(
            selectinload(Interview.topics),
            selectinload(Interview.questions),
        )
        .where(Interview.id == interview_id)
    )
    interview = result.scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    topics = [t.topic_name for t in sorted(interview.topics, key=lambda t: t.order_index)]
    total_questions = len(interview.questions)

    total_seconds = sum(q.time_estimate_seconds or 180 for q in interview.questions)
    est_minutes = total_seconds // 60
    estimated_duration = f"{est_minutes - 5}-{est_minutes + 5} minutes"

    focus_areas = []
    topic_questions: dict[str, list[str]] = {}
    for q in interview.questions:
        topic = next((t for t in interview.topics if t.id == q.topic_id), None)
        if topic:
            name = topic.topic_name
            if name not in topic_questions:
                topic_questions[name] = []
            topic_questions[name].append(q.question_text)

    for topic_name, questions in topic_questions.items():
        focus_areas.append(f"{topic_name}: {len(questions)} questions covering fundamentals to advanced concepts")

    return InterviewBrief(
        id=interview.id,
        role=interview.role,
        topics=topics,
        total_questions=total_questions,
        estimated_duration=estimated_duration,
        focus_areas=focus_areas,
    )


@router.get("/{interview_id}/questions")
async def get_interview_questions(interview_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get all questions for an interview (used by the interview page)."""
    result = await db.execute(
        select(Interview)
        .options(
            selectinload(Interview.topics),
            selectinload(Interview.questions),
        )
        .where(Interview.id == interview_id)
    )
    interview = result.scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Build questions list with topic names
    questions = []
    for q in sorted(interview.questions, key=lambda x: x.order_index):
        topic = next((t for t in interview.topics if t.id == q.topic_id), None)
        questions.append({
            "id": str(q.id),
            "question_text": q.question_text,
            "topic": topic.topic_name if topic else "General",
            "expected_points": q.expected_points or [],
            "follow_ups": q.follow_ups or [],
            "hints": q.hints or [],
            "order_index": q.order_index,
            "time_estimate_seconds": q.time_estimate_seconds or 180,
        })

    return {
        "interview_id": str(interview.id),
        "role": interview.role,
        "topics": [t.topic_name for t in sorted(interview.topics, key=lambda t: t.order_index)],
        "questions": questions,
    }


@router.post("/{interview_id}/start")
async def start_interview(interview_id: UUID, db: AsyncSession = Depends(get_db)):
    """Mark interview as started."""
    result = await db.execute(
        select(Interview).where(Interview.id == interview_id)
    )
    interview = result.scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    interview.status = InterviewStatus.IN_PROGRESS
    interview.started_at = datetime.utcnow()
    await db.commit()
    return {"status": "started", "interview_id": str(interview_id)}


@router.post("/{interview_id}/chat")
async def chat_with_interviewer(
    interview_id: UUID,
    data: ChatMessage,
    db: AsyncSession = Depends(get_db),
):
    """Send a message to the AI interviewer and get a response.
    This is the text-based interview interaction endpoint.
    The frontend handles STT (speech-to-text) and TTS (text-to-speech).
    """
    from groq import AsyncGroq
    from app.core.config import settings

    # Get interview with questions and transcript
    result = await db.execute(
        select(Interview)
        .options(
            selectinload(Interview.topics),
            selectinload(Interview.questions),
            selectinload(Interview.transcript_entries),
        )
        .where(Interview.id == interview_id)
    )
    interview = result.scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Build conversation history from existing transcript FIRST (before saving current msg)
    existing_entries = sorted(interview.transcript_entries, key=lambda e: e.timestamp)
    messages = []

    # Build system prompt with question context
    topics = [t.topic_name for t in sorted(interview.topics, key=lambda t: t.order_index)]
    questions = sorted(interview.questions, key=lambda q: q.order_index)

    # Figure out which question we're on based on how many AI turns have happened
    agent_turns = [e for e in existing_entries if e.speaker == "agent"]
    question_index = min(len(agent_turns), len(questions) - 1) if questions else 0

    current_q = questions[question_index] if question_index < len(questions) else None
    current_topic_obj = next((t for t in interview.topics if current_q and t.id == current_q.topic_id), None)

    # Build question bank context (current + next few)
    remaining_qs = questions[question_index:question_index + 5]
    q_context = []
    for q in remaining_qs:
        t = next((t for t in interview.topics if t.id == q.topic_id), None)
        q_context.append({
            "question": q.question_text,
            "topic": t.topic_name if t else "General",
            "expected_points": q.expected_points or [],
            "hints": q.hints or [],
            "follow_ups": q.follow_ups or [],
        })

    elapsed = 0
    if interview.started_at:
        elapsed = (datetime.utcnow() - interview.started_at).total_seconds() / 60

    system_prompt = f"""You are a professional AI technical interviewer conducting an IntervueAI session.

CONTEXT:
- Role: {interview.role}
- Topics: {', '.join(topics)}
- Interview Duration: ~1 hour (max 1hr 15min)
- Time Elapsed: {elapsed:.0f} minutes
- Questions Remaining: {len(questions) - question_index}

CURRENT QUESTION TO ASK:
{current_q.question_text if current_q else 'All questions covered'}

CURRENT TOPIC: {current_topic_obj.topic_name if current_topic_obj else 'General'}

EXPECTED ANSWER POINTS: {current_q.expected_points if current_q else []}

HINTS (use only if candidate is stuck): {current_q.hints if current_q else []}

FOLLOW-UP QUESTIONS: {current_q.follow_ups if current_q else []}

UPCOMING QUESTIONS:
{q_context}

BEHAVIOR RULES:
1. If this is the first message, greet the candidate and ask the FIRST question.
2. After the candidate answers:
   - If they answered well (covered key points): acknowledge briefly, then ask the NEXT question or a follow-up.
   - If they partially answered: acknowledge what's correct, probe for more detail.
   - If they can't answer: give ONE hint. If still stuck, say "No worries, let's move on" and ask the next question.
3. Keep responses concise (2-3 sentences + the next question). Don't lecture.
4. Transition between topics naturally.
5. ALWAYS end your response by asking a question (either follow-up or the next one).
6. If all questions are covered, wrap up: "That wraps up our interview! Your detailed review will be ready shortly."

TONE: Professional but friendly. Encouraging. Like a senior engineer giving a supportive interview."""

    messages.append({"role": "system", "content": system_prompt})

    # Add existing conversation history (doesn't include current user message)
    for entry in existing_entries:
        role = "assistant" if entry.speaker == "agent" else "user"
        messages.append({"role": role, "content": entry.text})

    # Add current user message (only once — not yet saved to DB)
    messages.append({"role": "user", "content": data.message})

    # Call Groq LLM
    try:
        client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        response = await client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=500,
        )

        ai_response = response.choices[0].message.content or "I'm sorry, could you repeat that?"

    except Exception as e:
        logger.error(f"LLM chat failed: {e}")
        ai_response = "I'm experiencing a brief technical issue. Could you repeat your answer?"

    # Now save BOTH the user message and AI response to transcript
    user_entry = TranscriptEntry(
        interview_id=interview.id,
        speaker="candidate",
        text=data.message,
    )
    db.add(user_entry)

    ai_entry = TranscriptEntry(
        interview_id=interview.id,
        speaker="agent",
        text=ai_response,
    )
    db.add(ai_entry)
    await db.commit()

    return {
        "response": ai_response,
        "question_index": question_index,
        "topic": current_topic_obj.topic_name if current_topic_obj else "General",
    }


@router.post("/{interview_id}/end")
async def end_interview(
    interview_id: UUID,
    data: EndInterviewRequest,
    db: AsyncSession = Depends(get_db),
):
    """End interview and trigger review generation."""
    result = await db.execute(
        select(Interview)
        .options(
            selectinload(Interview.topics),
            selectinload(Interview.questions),
            selectinload(Interview.transcript_entries),
            selectinload(Interview.question_results),
        )
        .where(Interview.id == interview_id)
    )
    interview = result.scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Update interview status
    interview.status = InterviewStatus.COMPLETED
    interview.ended_at = datetime.utcnow()
    interview.duration_seconds = data.duration_seconds
    await db.flush()

    # Generate review using Agent 3
    try:
        topics = [t.topic_name for t in sorted(interview.topics, key=lambda t: t.order_index)]
        transcript = [
            {"speaker": e.speaker, "text": e.text, "timestamp": e.timestamp.isoformat()}
            for e in sorted(interview.transcript_entries, key=lambda e: e.timestamp)
        ]
        questions = [
            {
                "id": str(q.id),
                "question_text": q.question_text,
                "topic": next((t.topic_name for t in interview.topics if t.id == q.topic_id), "General"),
                "expected_points": q.expected_points or [],
            }
            for q in sorted(interview.questions, key=lambda q: q.order_index)
        ]
        question_results = [
            {
                "question_id": str(qr.question_id),
                "candidate_answer_summary": qr.candidate_answer_summary,
                "score": qr.score,
                "hint_used": qr.hint_used,
            }
            for qr in interview.question_results
        ]

        review_data = await generate_review(
            role=interview.role,
            topics=topics,
            transcript=transcript,
            questions=questions,
            question_results=question_results,
        )

        # Save review
        review = Review(
            interview_id=interview.id,
            overall_score=review_data.get("overall_score", 0),
            topic_breakdown=review_data.get("topic_breakdown", []),
            strengths=review_data.get("strengths", []),
            weaknesses=review_data.get("weaknesses", []),
            suggestions=review_data.get("suggestions", []),
            full_review_text=review_data.get("verdict", ""),
        )
        db.add(review)
        interview.status = InterviewStatus.REVIEW_READY
        await db.commit()

        logger.info(f"Review generated for interview {interview_id}: score={review_data.get('overall_score')}")
        return {"status": "review_ready", "interview_id": str(interview_id)}

    except Exception as e:
        logger.error(f"Review generation failed: {e}")
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Review generation failed: {str(e)}")


@router.get("/{interview_id}/review", response_model=ReviewOut)
async def get_review(interview_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get the interview review."""
    result = await db.execute(
        select(Review).where(Review.interview_id == interview_id)
    )
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found. It may still be generating.")

    interview_result = await db.execute(
        select(Interview).where(Interview.id == interview_id)
    )
    interview = interview_result.scalar_one_or_none()

    duration_str = None
    if interview and interview.duration_seconds:
        mins = interview.duration_seconds // 60
        duration_str = f"{mins} minutes"

    topic_breakdown = []
    for tb in (review.topic_breakdown or []):
        topic_breakdown.append(TopicBreakdown(
            name=tb.get("name", ""),
            score=tb.get("score", 0),
            max_score=tb.get("max_score", 10),
            strengths=tb.get("strengths", []),
            improvements=tb.get("improvements", []),
        ))

    return ReviewOut(
        id=review.id,
        interview_id=review.interview_id,
        overall_score=review.overall_score,
        duration=duration_str,
        role=interview.role if interview else None,
        topic_breakdown=topic_breakdown,
        strengths=review.strengths or [],
        weaknesses=review.weaknesses or [],
        suggestions=review.suggestions or [],
        verdict=review.full_review_text or "",
        created_at=review.created_at,
    )
