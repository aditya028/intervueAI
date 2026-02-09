"""
Agent 1: Question Generator
Generates a structured question bank based on role and topics using Groq (Llama 3.3).
"""

import json
import logging
from groq import AsyncGroq

from app.core.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert technical interviewer who creates interview question banks.
Given a role and list of topics, generate a comprehensive set of interview questions.

RULES:
- Start each topic with 1-2 basic questions, then progress to intermediate and advanced.
- Each question should have expected answer key points, 1-2 follow-up questions, and 1 hint.
- Calibrate difficulty to the role:
  - "sde": Full SDE-level questions (system design, algorithms, architecture)
  - "intern": Entry-level, focus on fundamentals and basics
  - "learning": Educational, supportive tone, focus on understanding concepts
- Aim for 4-5 questions per topic to fill a ~1 hour interview.
- Estimate time for each question (in seconds). Total should be around 3000-3600 seconds.

Return a JSON array with this structure (no markdown, just raw JSON):
[
  {
    "topic": "topic_name",
    "question_text": "the question",
    "expected_points": ["key point 1", "key point 2"],
    "follow_ups": ["follow-up question 1"],
    "hints": ["a helpful hint"],
    "time_estimate_seconds": 180
  }
]
"""


async def generate_questions(role: str, topics: list[str]) -> list[dict]:
    """Generate a question bank using Groq LLM."""
    client = AsyncGroq(api_key=settings.GROQ_API_KEY)

    user_prompt = f"""Generate interview questions for the following:

Role: {role}
Topics: {', '.join(topics)}

Generate 4-5 questions per topic, ordered from basic to advanced within each topic.
Total questions should cover approximately 1 hour of interview time.
Return ONLY a valid JSON array, no markdown formatting."""

    try:
        response = await client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
            max_tokens=4096,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content
        if not content:
            raise ValueError("Empty response from LLM")

        result = json.loads(content)

        # Handle both {"questions": [...]} and [...] formats
        if isinstance(result, dict) and "questions" in result:
            questions = result["questions"]
        elif isinstance(result, list):
            questions = result
        else:
            # Try to find any list in the response
            for value in result.values():
                if isinstance(value, list):
                    questions = value
                    break
            else:
                raise ValueError(f"Unexpected response format: {type(result)}")

        logger.info(f"Generated {len(questions)} questions for role={role}, topics={topics}")
        return questions

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM response as JSON: {e}")
        raise ValueError(f"LLM returned invalid JSON: {e}")
    except Exception as e:
        logger.error(f"Question generation failed: {e}")
        raise
