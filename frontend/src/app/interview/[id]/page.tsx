"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Mic,
  MicOff,
  PhoneOff,
  Clock,
  Volume2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { apiPost, type ChatResponse } from "@/lib/api";

/* eslint-disable @typescript-eslint/no-explicit-any */

type InterviewStatus =
  | "connecting"
  | "active"
  | "ended"
  | "generating_review"
  | "error";

function log(...args: any[]) {
  console.log("[IntervueAI]", ...args);
}

// ---- Silence debounce duration (ms) ----
const SILENCE_WAIT_MS = 5000;

export default function InterviewPage() {
  const params = useParams();
  const interviewId = params.id as string;

  const [status, setStatus] = useState<InterviewStatus>("connecting");
  const [isMuted, setIsMuted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentTopic, setCurrentTopic] = useState("...");
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<
    { speaker: "ai" | "user"; text: string }[]
  >([]);

  // ---- Refs ----
  const recognitionRef = useRef<any>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const statusRef = useRef<InterviewStatus>("connecting");
  const isMutedRef = useRef(false);
  const elapsedRef = useRef(0);
  const interviewEndedRef = useRef(false);

  // ---- Speech buffer + silence timer for debounce ----
  const speechBufferRef = useRef<string>("");
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessingRef = useRef(false);
  const aiSpeakingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Timer
  useEffect(() => {
    if (status !== "active") return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => {
        elapsedRef.current = prev + 1;
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  // Initialize speech synthesis
  useEffect(() => {
    if (typeof window === "undefined") return;
    synthRef.current = window.speechSynthesis;
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }, []);

  // ---- Helpers ----

  function formatTime(seconds: number) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  function createRecognition(): any {
    const w = window as any;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return null;

    const recognition = new Ctor();
    recognition.continuous = true;        // Keep listening continuously
    recognition.interimResults = true;    // Get partial results for interruption detection
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;
    return recognition;
  }

  // ---- TTS with Chrome workarounds ----

  function playAudio(base64Audio: string): Promise<void> {
    return new Promise((resolve) => {
      // Decode base64
      const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
      audioRef.current = audio;
      aiSpeakingRef.current = true;
      setAiSpeaking(true);

      audio.onended = () => {
        aiSpeakingRef.current = false;
        setAiSpeaking(false);
        audioRef.current = null;
        resolve();
      };

      audio.onerror = (e) => {
        console.error("Audio playback error:", e);
        aiSpeakingRef.current = false;
        setAiSpeaking(false);
        audioRef.current = null;
        resolve();
      };

      audio.play().catch((e) => {
        console.error("Audio play failed:", e);
        aiSpeakingRef.current = false;
        setAiSpeaking(false);
        resolve();
      });
    });
  }

  function speakText(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!synthRef.current) {
        resolve();
        return;
      }

      synthRef.current.cancel();
      aiSpeakingRef.current = true;
      setAiSpeaking(true);

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voices = synthRef.current.getVoices();
      const preferred = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Google") ||
            v.name.includes("Samantha") ||
            v.name.includes("Daniel") ||
            v.name.includes("Karen"))
      );
      if (preferred) utterance.voice = preferred;

      let resolved = false;
      const done = () => {
        if (resolved) return;
        resolved = true;
        clearInterval(chromeResumeHack);
        clearTimeout(safetyTimeout);
        aiSpeakingRef.current = false;
        setAiSpeaking(false);
        log("TTS finished");
        resolve();
      };

      utterance.onend = done;
      utterance.onerror = () => done();

      // Chrome bug workaround: prevent TTS from pausing after ~15s
      const chromeResumeHack = setInterval(() => {
        if (synthRef.current && synthRef.current.speaking) {
          synthRef.current.resume();
        }
      }, 5000);

      // Safety timeout in case onend never fires
      const estimatedMs = Math.max(text.length * 80 + 5000, 10000);
      const safetyTimeout = setTimeout(() => {
        log("TTS safety timeout — forcing resolve");
        if (synthRef.current) synthRef.current.cancel();
        done();
      }, estimatedMs);

      log("TTS speaking:", text.substring(0, 60) + "...");
      synthRef.current.speak(utterance);
    });
  }

  /** Stop AI speech immediately (for user interruption). */
  function cancelSpeech() {
    // Cancel browser TTS
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    // Cancel audio playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    aiSpeakingRef.current = false;
    setAiSpeaking(false);
  }

  // ---- Recognition lifecycle ----

  function stopListening() {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) { /* ignore */ }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }

  /**
   * Start continuous recognition.
   * - Accumulates speech into a buffer.
   * - On silence (no new results for SILENCE_WAIT_MS), sends buffer to AI.
   * - If user speaks while AI is talking, cancels TTS immediately.
   */
  function startListening() {
    if (isMutedRef.current) {
      log("startListening: skipped (muted)");
      return;
    }
    if (statusRef.current !== "active") {
      log("startListening: skipped (status:", statusRef.current, ")");
      return;
    }

    // Stop any existing recognition
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) { /* ignore */ }
    }

    const recognition = createRecognition();
    if (!recognition) {
      setError("Speech recognition not supported. Please use Chrome or Edge.");
      return;
    }
    recognitionRef.current = recognition;

    log("startListening: starting continuous recognition");

    recognition.onstart = () => {
      log("STT: started");
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      // Process all new results
      let interimText = "";
      let finalText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript + " ";
        } else {
          interimText += result[0].transcript;
        }
      }

      // ---- Interruption detection ----
      // If AI is speaking and user starts talking, cancel TTS immediately
      if (aiSpeakingRef.current && (finalText.trim() || interimText.trim())) {
        log("User interrupted AI speech — cancelling TTS");
        cancelSpeech();
      }

      // Don't accumulate while AI is still speaking or processing
      if (isProcessingRef.current) return;

      // Accumulate final text into buffer
      if (finalText.trim()) {
        speechBufferRef.current += finalText;
        log("Buffer:", speechBufferRef.current.trim().substring(0, 80));
      }

      // Reset silence timer — wait SILENCE_WAIT_MS after last speech
      if (finalText.trim() || interimText.trim()) {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }

        // Only start the silence timer on final results (actual words)
        if (finalText.trim()) {
          silenceTimerRef.current = setTimeout(() => {
            const buffered = speechBufferRef.current.trim();
            if (buffered && !isProcessingRef.current) {
              log("Silence timer fired — sending buffered speech:", buffered.substring(0, 80));
              speechBufferRef.current = "";
              sendToAI(buffered);
            }
          }, SILENCE_WAIT_MS);
        }
      }
    };

    recognition.onerror = (event: any) => {
      const errCode = event.error;
      log("STT error:", errCode);

      if (errCode === "no-speech" || errCode === "aborted") {
        // These are benign — recognition will restart via onend
      } else if (errCode === "not-allowed") {
        setIsListening(false);
        setError(
          "Microphone access denied. Click the lock icon in the address bar, allow microphone, then reload."
        );
      } else if (errCode === "audio-capture") {
        setIsListening(false);
        setError("No microphone found. Please connect a microphone and reload.");
      } else {
        // Transient error — will restart via onend
        console.error("Speech recognition error:", errCode);
      }
    };

    recognition.onend = () => {
      log("STT: ended");
      setIsListening(false);

      // Auto-restart if interview is still active and not muted
      if (
        statusRef.current === "active" &&
        !isMutedRef.current &&
        !interviewEndedRef.current
      ) {
        log("STT: auto-restarting recognition");
        setTimeout(() => startListening(), 300);
      }
    };

    try {
      recognition.start();
    } catch (err) {
      console.error("Failed to start recognition:", err);
      setTimeout(() => startListening(), 1000);
    }
  }

  // ---- Send to AI ----

  async function sendToAI(userMessage: string) {
    if (!userMessage.trim() || isProcessingRef.current) return;

    isProcessingRef.current = true;
    setIsProcessing(true);
    log("sendToAI:", userMessage.substring(0, 80));

    setTranscript((prev) => [...prev, { speaker: "user", text: userMessage }]);

    try {
      const data = await apiPost<ChatResponse>(
        `/api/interviews/${interviewId}/chat`,
        { message: userMessage, interview_id: interviewId }
      );

      log("AI response received:", data.response.substring(0, 60));
      if (data.topic) setCurrentTopic(data.topic);
      setTranscript((prev) => [...prev, { speaker: "ai", text: data.response }]);

      isProcessingRef.current = false;
      setIsProcessing(false);

      // Speak AI response (user can interrupt this)
      if (data.audio) {
        await playAudio(data.audio);
      } else {
        await speakText(data.response);
      }

      // Check if interview wrapping up
      const lower = data.response.toLowerCase();
      if (
        lower.includes("wraps up our interview") ||
        lower.includes("that concludes") ||
        lower.includes("end of our interview") ||
        lower.includes("that's all the questions")
      ) {
        log("Interview wrap-up detected");
        setTimeout(() => endInterview(), 2000);
      }
      // Note: recognition is already running continuously, no need to restart
    } catch (err) {
      console.error("Chat error:", err);
      isProcessingRef.current = false;
      setIsProcessing(false);
      setTranscript((prev) => [
        ...prev,
        { speaker: "ai", text: "Sorry, I had a brief technical issue. Could you repeat that?" },
      ]);
      await speakText("Sorry, I had a brief technical issue. Could you repeat that?");
    }
  }

  // ---- End interview ----

  async function endInterview() {
    if (interviewEndedRef.current) return;
    interviewEndedRef.current = true;

    log("Ending interview...");
    // Clear any pending silence timer
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    speechBufferRef.current = "";

    stopListening();
    cancelSpeech();
    statusRef.current = "generating_review";
    setStatus("generating_review");

    try {
      await apiPost(`/api/interviews/${interviewId}/end`, {
        interview_id: interviewId,
        duration_seconds: elapsedRef.current,
      });
      statusRef.current = "ended";
      setStatus("ended");
    } catch (err) {
      console.error("End interview error:", err);
      statusRef.current = "ended";
      setStatus("ended");
    }
  }

  // ---- Initialize interview ----

  useEffect(() => {
    let cancelled = false;

    async function initInterview() {
      try {
        log("Initializing interview", interviewId);
        await apiPost(`/api/interviews/${interviewId}/start`, {});
        if (cancelled) return;

        statusRef.current = "active";
        setStatus("active");

        const data = await apiPost<ChatResponse>(
          `/api/interviews/${interviewId}/chat`,
          { message: "Hello, I'm ready to start the interview.", interview_id: interviewId }
        );
        if (cancelled) return;

        log("Got greeting:", data.response.substring(0, 60));
        if (data.topic) setCurrentTopic(data.topic);
        setTranscript([{ speaker: "ai", text: data.response }]);

        // Speak the greeting
        if (data.audio) {
          await playAudio(data.audio);
        } else {
          await speakText(data.response);
        }
        if (cancelled) return;

        // Start continuous listening
        log("Init complete — starting continuous listening");
        startListening();
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to start interview:", err);
        setError(err instanceof Error ? err.message : "Failed to connect to interview");
        statusRef.current = "error";
        setStatus("error");
      }
    }

    initInterview();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId]);

  // ---- Toggle mute ----

  function toggleMute() {
    if (isMutedRef.current) {
      isMutedRef.current = false;
      setIsMuted(false);
      log("Unmuted");
      if (statusRef.current === "active") {
        setTimeout(() => startListening(), 300);
      }
    } else {
      isMutedRef.current = true;
      setIsMuted(true);
      log("Muted");
      // Clear buffer and timer
      speechBufferRef.current = "";
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      stopListening();
    }
  }

  // ---- Render ----

  if (status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-10 w-10 text-red-400" />
          <h1 className="mb-2 text-xl font-bold">Connection Failed</h1>
          <p className="mb-4 text-sm text-muted-foreground">
            {error || "Failed to start the interview."}
          </p>
          <Link href="/setup">
            <Button variant="outline">Back to Setup</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (status === "generating_review") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-violet-400" />
          <h1 className="mb-2 text-xl font-bold">Generating Your Review...</h1>
          <p className="text-sm text-muted-foreground">
            The AI is analyzing your interview. This may take a moment.
          </p>
        </div>
      </div>
    );
  }

  if (status === "ended") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <Volume2 className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="mb-2 text-2xl font-bold">Interview Complete!</h1>
          <p className="mb-6 text-muted-foreground">
            Your review is ready. See how you did.
          </p>
          <div className="mb-4 text-sm text-muted-foreground">
            Duration: {formatTime(elapsedSeconds)}
          </div>
          <Link href={`/review/${interviewId}`}>
            <Button className="gap-2 bg-gradient-to-r from-violet-500 to-blue-500 text-white hover:from-violet-600 hover:to-blue-600">
              View Review
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Bar */}
      <div className="border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-blue-500">
              <Mic className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-medium">IntervueAI</span>
          </div>

          <div className="flex items-center gap-4">
            <Badge variant="outline" className="gap-1.5">
              <Clock className="h-3 w-3" />
              {formatTime(elapsedSeconds)}
            </Badge>
            <Badge variant="outline" className="bg-violet-500/10 text-violet-400">
              {currentTopic}
            </Badge>
            {status === "connecting" && (
              <Badge variant="outline" className="gap-1.5 text-amber-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Connecting...
              </Badge>
            )}
            {status === "active" && (
              <Badge
                variant="outline"
                className="gap-1.5 border-emerald-500/30 text-emerald-400"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Main Interview Area */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* AI Visualizer */}
        <div className="mb-8 flex flex-col items-center">
          <div
            className={`relative mb-6 flex h-32 w-32 items-center justify-center rounded-full border-2 transition-all duration-500 ${aiSpeaking
              ? "border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/20"
              : isListening
                ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20"
                : "border-border/60 bg-card/50"
              }`}
          >
            {aiSpeaking && (
              <>
                <span className="absolute inset-0 animate-ping rounded-full border border-violet-500/20" />
                <span className="absolute -inset-3 animate-pulse rounded-full border border-violet-500/10" />
              </>
            )}
            {isListening && !aiSpeaking && (
              <>
                <span className="absolute inset-0 animate-ping rounded-full border border-blue-500/20" />
                <span className="absolute -inset-3 animate-pulse rounded-full border border-blue-500/10" />
              </>
            )}
            {aiSpeaking ? (
              <Volume2 className="h-10 w-10 text-violet-400" />
            ) : isListening ? (
              <Mic className="h-10 w-10 text-blue-400" />
            ) : (
              <Volume2 className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          <div className="text-sm font-medium">
            {aiSpeaking ? (
              <span className="text-violet-400">AI is speaking... (speak to interrupt)</span>
            ) : isProcessing ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Thinking...
              </span>
            ) : isListening ? (
              <span className="text-blue-400">Listening... (waiting 5s for you to finish)</span>
            ) : status === "connecting" ? (
              <span className="text-muted-foreground">Connecting...</span>
            ) : (
              <span className="text-muted-foreground">Ready</span>
            )}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="w-full max-w-2xl mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Live Transcript */}
        <div className="w-full max-w-2xl mb-8">
          <div className="rounded-xl border border-border/40 bg-card/30 p-6 max-h-72 overflow-y-auto">
            {transcript.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                {status === "connecting"
                  ? "Connecting to AI interviewer..."
                  : "Transcript will appear here..."}
              </p>
            ) : (
              <div className="space-y-4">
                {transcript.map((entry, i) => (
                  <div key={i} className="text-sm">
                    <span
                      className={`font-medium ${entry.speaker === "ai"
                        ? "text-violet-400"
                        : "text-blue-400"
                        }`}
                    >
                      {entry.speaker === "ai" ? "AI Interviewer" : "You"}:
                    </span>{" "}
                    <span className="text-muted-foreground">{entry.text}</span>
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="border-t border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-4xl items-center justify-center gap-6 px-6">
          <Button
            variant="outline"
            size="lg"
            className={`h-14 w-14 rounded-full p-0 ${isMuted
              ? "border-red-500/40 bg-red-500/10 text-red-400"
              : isListening
                ? "border-blue-500/40 bg-blue-500/10 text-blue-400"
                : "border-border/60"
              }`}
            onClick={toggleMute}
          >
            {isMuted ? (
              <MicOff className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </Button>

          <Button
            variant="destructive"
            size="lg"
            className="h-14 w-14 rounded-full p-0"
            onClick={endInterview}
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
