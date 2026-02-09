"""
Agent 3: Review Generator
Takes the full interview transcript and question results to generate a comprehensive review.
"""

import json
import logging
from groq import AsyncGroq

from app.core.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert technical interview reviewer. Given an interview transcript,
questions asked, and the candidate's responses, generate a comprehensive review.

Your review must include:
1. Overall score (0-10, with one decimal place)
2. Per-topic breakdown with:
   - Score (0-10)
   - Specific strengths (what they did well)
   - Specific improvements (what they need to work on)
3. Overall strengths (3-4 bullet points)
4. Overall weaknesses (3-4 bullet points)
5. Specific suggestions for improvement (3-4 actionable items)
6. A final verdict (2-3 sentence summary)

Be specific and reference actual answers when possible. Be constructive and encouraging.

Return ONLY valid JSON with this structure:
{
  "overall_score": 7.5,
  "topic_breakdown": [
    {
      "name": "JavaScript",
      "score": 8.0,
      "max_score": 10,
      "strengths": ["specific strength 1"],
      "improvements": ["specific improvement 1"]
    }
  ],
  "strengths": ["overall strength 1", "overall strength 2"],
  "weaknesses": ["overall weakness 1", "overall weakness 2"],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "verdict": "Summary statement about the candidate's performance."
}
"""


async def generate_review(
    role: str,
    topics: list[str],
    transcript: list[dict],
    questions: list[dict],
    question_results: list[dict],
) -> dict:
    """Generate a comprehensive interview review."""
    client = AsyncGroq(api_key=settings.GROQ_API_KEY)

    # Format transcript for context
    transcript_text = "\n".join(
        f"{'AI Interviewer' if entry['speaker'] == 'agent' else 'Candidate'}: {entry['text']}"
        for entry in transcript
    )

    # Format questions and results
    qa_summary = []
    for q in questions:
        result = next(
            (r for r in question_results if r.get("question_id") == q.get("id")),
            None,
        )
        qa_summary.append({
            "question": q.get("question_text", ""),
            "topic": q.get("topic", ""),
            "answer_summary": result.get("candidate_answer_summary", "No answer recorded") if result else "No answer recorded",
            "score": result.get("score", 0) if result else 0,
            "hint_used": result.get("hint_used", 0) if result else 0,
        })

    user_prompt = f"""Review this IntervueAI interview:

Role: {role}
Topics: {', '.join(topics)}

TRANSCRIPT:
{transcript_text}

QUESTION-ANSWER SUMMARY:
{json.dumps(qa_summary, indent=2)}

Generate a detailed, constructive review. Return ONLY valid JSON."""

    try:
        response = await client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.6,
            max_tokens=4096,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content
        if not content:
            raise ValueError("Empty response from LLM")

        review = json.loads(content)
        logger.info(f"Generated review with score {review.get('overall_score')}")
        return review

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse review JSON: {e}")
        raise ValueError(f"LLM returned invalid JSON: {e}")
    except Exception as e:
        logger.error(f"Review generation failed: {e}")
        raise
