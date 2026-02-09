"""
Agent 2: AI Interview Agent (LiveKit Voice Agent)
Conducts real-time voice interviews using LiveKit Agents SDK.
Pipeline: Deepgram STT -> Groq LLM -> Edge TTS
"""

import asyncio
import json
import logging
import time
from datetime import datetime

from app.core.config import settings

logger = logging.getLogger(__name__)

# Interview Agent system prompt template
INTERVIEW_SYSTEM_PROMPT = """You are a professional AI technical interviewer conducting an IntervueAI interview.

CONTEXT:
- Role: {role}
- Topics: {topics}
- Interview Duration: ~1 hour (max 1hr 15min)

CURRENT STATE:
- Current Question: {current_question}
- Current Topic: {current_topic}
- Questions Remaining: {questions_remaining}
- Time Elapsed: {time_elapsed} minutes
- Time Remaining: ~{time_remaining} minutes

QUESTION BANK (upcoming):
{question_context}

BEHAVIOR RULES:
1. Start by greeting the candidate and briefly explaining the format.
2. Ask questions one at a time and wait for the candidate's response.
3. After each answer:
   - If they answered well (covered key points): acknowledge, then ask a follow-up or go deeper.
   - If they partially answered: acknowledge what's correct, probe for more detail.
   - If they can't answer: give ONE hint from the hints list, wait for another attempt. If still stuck, say "No worries, let's move on" and proceed.
4. Keep responses concise (2-3 sentences max). Don't lecture.
5. Transition between topics naturally: "Great, let's shift to [next topic]."
6. At ~50 min, check pacing. Speed up if behind.
7. At 60 min, wrap up if topics are covered. Extend only if topics remain.
8. Hard stop at 75 min. Wrap up gracefully.
9. End with: "That wraps up our interview. Your detailed review will be ready shortly. Thanks for your time!"

TONE: Professional but friendly. Encouraging. Like a senior engineer giving a supportive interview.
"""


class InterviewAgentState:
    """Tracks the state of an active interview session."""

    def __init__(
        self,
        interview_id: str,
        role: str,
        topics: list[str],
        questions: list[dict],
    ):
        self.interview_id = interview_id
        self.role = role
        self.topics = topics
        self.questions = questions
        self.current_question_index = 0
        self.start_time = time.time()
        self.transcript: list[dict] = []
        self.question_results: list[dict] = []
        self.hint_given_for_current = False
        self.is_active = True

    @property
    def elapsed_minutes(self) -> float:
        return (time.time() - self.start_time) / 60

    @property
    def remaining_minutes(self) -> float:
        return max(0, settings.INTERVIEW_MAX_DURATION_MINUTES - self.elapsed_minutes)

    @property
    def current_question(self) -> dict | None:
        if self.current_question_index < len(self.questions):
            return self.questions[self.current_question_index]
        return None

    @property
    def questions_remaining(self) -> int:
        return max(0, len(self.questions) - self.current_question_index)

    @property
    def should_wrap_up(self) -> bool:
        """Check if we should start wrapping up."""
        # Hard stop at max duration
        if self.elapsed_minutes >= settings.INTERVIEW_MAX_DURATION_MINUTES:
            return True
        # Normal end if all questions done
        if self.current_question_index >= len(self.questions):
            return True
        return False

    @property
    def should_extend(self) -> bool:
        """Check if we're past target duration but have topics remaining."""
        return (
            self.elapsed_minutes >= settings.INTERVIEW_DURATION_MINUTES
            and self.questions_remaining > 0
            and self.elapsed_minutes < settings.INTERVIEW_MAX_DURATION_MINUTES
        )

    def advance_question(self):
        """Move to the next question."""
        self.current_question_index += 1
        self.hint_given_for_current = False

    def add_transcript(self, speaker: str, text: str):
        """Add an entry to the transcript."""
        self.transcript.append({
            "speaker": speaker,
            "text": text,
            "timestamp": datetime.utcnow().isoformat(),
            "question_id": str(self.current_question.get("id", "")) if self.current_question else None,
        })

    def record_result(self, score: float, summary: str, feedback: str, depth: str):
        """Record the result for the current question."""
        if self.current_question:
            self.question_results.append({
                "question_id": str(self.current_question.get("id", "")),
                "candidate_answer_summary": summary,
                "score": score,
                "feedback": feedback,
                "depth_reached": depth,
                "hint_used": 1 if self.hint_given_for_current else 0,
            })

    def build_system_prompt(self) -> str:
        """Build the system prompt with current state."""
        # Get upcoming questions for context
        upcoming = self.questions[self.current_question_index:self.current_question_index + 3]
        question_context = json.dumps(
            [
                {
                    "question": q.get("question_text", ""),
                    "topic": q.get("topic", ""),
                    "expected_points": q.get("expected_points", []),
                    "hints": q.get("hints", []),
                    "follow_ups": q.get("follow_ups", []),
                }
                for q in upcoming
            ],
            indent=2,
        )

        current_q = self.current_question
        return INTERVIEW_SYSTEM_PROMPT.format(
            role=self.role,
            topics=", ".join(self.topics),
            current_question=current_q.get("question_text", "N/A") if current_q else "Interview complete",
            current_topic=current_q.get("topic", "N/A") if current_q else "N/A",
            questions_remaining=self.questions_remaining,
            time_elapsed=f"{self.elapsed_minutes:.0f}",
            time_remaining=f"{self.remaining_minutes:.0f}",
            question_context=question_context,
        )


# ---- LiveKit Agent Entry Point ----
# This will be the actual LiveKit agent worker when LiveKit is set up.
# For now, this is the structure that plugs into the LiveKit Agents SDK.

async def create_interview_agent(
    interview_id: str,
    role: str,
    topics: list[str],
    questions: list[dict],
) -> InterviewAgentState:
    """Create and return an interview agent state for a session."""
    state = InterviewAgentState(
        interview_id=interview_id,
        role=role,
        topics=topics,
        questions=questions,
    )
    logger.info(
        f"Interview agent created for interview={interview_id}, "
        f"role={role}, topics={topics}, questions={len(questions)}"
    )
    return state
