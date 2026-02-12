import base64
import logging
import httpx
from typing import Literal
import edge_tts

from app.core.config import settings

logger = logging.getLogger(__name__)

TTSProvider = Literal["auto", "elevenlabs", "openai", "edge"]


class TTSService:
    @staticmethod
    async def generate_audio(text: str, provider: TTSProvider = "auto") -> str:
        """
        Generate audio from text using the specified or default provider.
        Returns base64 encoded audio string (MP3 format).
        """
        if provider == "auto":
            if settings.TTS_PROVIDER != "auto":
                provider = settings.TTS_PROVIDER  # type: ignore
            elif settings.ELEVENLABS_API_KEY:
                provider = "elevenlabs"
            elif settings.OPENAI_API_KEY:
                provider = "openai"
            else:
                provider = "edge"

        logger.info(f"Generating TTS using provider: {provider}")

        try:
            if provider == "elevenlabs":
                return await TTSService._generate_elevenlabs(text)
            elif provider == "openai":
                return await TTSService._generate_openai(text)
            else:
                return await TTSService._generate_edge(text)
        except Exception as e:
            logger.error(f"TTS generation failed with {provider}: {e}")
            if provider != "edge":
                logger.info("Falling back to EdgeTTS")
                return await TTSService._generate_edge(text)
            # If edge fails, just return empty string (client will fallback to browser TTS or silence)
            return ""

    @staticmethod
    async def _generate_elevenlabs(text: str) -> str:
        """Generate audio using ElevenLabs API."""
        if not settings.ELEVENLABS_API_KEY:
            raise ValueError("ElevenLabs API key not configured")

        # Normalize voice ID
        voice_id = settings.ELEVENLABS_VOICE_ID or "21m00Tcm4TlvDq8ikWAM"
        
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": settings.ELEVENLABS_API_KEY,
        }
        data = {
            "text": text,
            "model_id": "eleven_monolingual_v1",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
            },
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=data, headers=headers, timeout=10.0)
            response.raise_for_status()
            return base64.b64encode(response.content).decode("utf-8")

    @staticmethod
    async def _generate_openai(text: str) -> str:
        """Generate audio using OpenAI API."""
        if not settings.OPENAI_API_KEY:
            raise ValueError("OpenAI API key not configured")

        url = "https://api.openai.com/v1/audio/speech"
        headers = {
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json",
        }
        data = {
            "model": "tts-1",
            "input": text,
            "voice": settings.OPENAI_TTS_VOICE or "alloy",
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=data, headers=headers, timeout=10.0)
            response.raise_for_status()
            return base64.b64encode(response.content).decode("utf-8")

    @staticmethod
    async def _generate_edge(text: str) -> str:
        """Generate audio using EdgeTTS (free)."""
        # Use a high quality English voice
        VOICE = "en-US-ChristopherNeural"
        communicate = edge_tts.Communicate(text, VOICE)

        audio_data = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]

        return base64.b64encode(audio_data).decode("utf-8")
