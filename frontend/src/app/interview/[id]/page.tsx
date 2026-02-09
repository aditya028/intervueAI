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

// ---- Debug logger (check browser console for [IntervueAI] messages) ----
function log(...args: any[]) {
  console.log("[IntervueAI]", ...args);
}

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

  // ---- Refs (updated DIRECTLY, not through useEffect) ----
  const recognitionRef = useRef<any>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const isMutedRef = useRef(false);
  const statusRef = useRef<InterviewStatus>("connecting");
  const elapsedRef = useRef(0);
  const interviewEndedRef = useRef(false);
  const loopActiveRef = useRef(false); // Prevents double-starting the loop

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

  // Initialize speech synthesis & preload voices
  useEffect(() => {
    if (typeof window === "undefined") return;
    synthRef.current = window.speechSynthesis;
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }, []);

  // ---- Helper: format time ----
  function formatTime(seconds: number) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  // ---- Speech Synthesis with Chrome bug workarounds ----
  function speakText(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!synthRef.current) {
        log("No speechSynthesis available, skipping TTS");
        resolve();
        return;
      }

      // Cancel any ongoing speech
      synthRef.current.cancel();
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
        setAiSpeaking(false);
        log("TTS finished");
        resolve();
      };

      utterance.onend = done;
      utterance.onerror = (e) => {
        log("TTS error:", e);
        done();
      };

      // CHROME BUG WORKAROUND #1: Chrome pauses SpeechSynthesis after ~15s.
      // Periodically calling resume() prevents it from getting stuck.
      const chromeResumeHack = setInterval(() => {
        if (synthRef.current && synthRef.current.speaking) {
          synthRef.current.resume();
        }
      }, 5000);

      // CHROME BUG WORKAROUND #2: Safety timeout in case onend never fires.
      // Estimate ~80ms per character + 5s buffer, minimum 10s.
      const estimatedMs = Math.max(text.length * 80 + 5000, 10000);
      const safetyTimeout = setTimeout(() => {
        log("TTS safety timeout fired after", estimatedMs, "ms — forcing resolve");
        if (synthRef.current) synthRef.current.cancel();
        done();
      }, estimatedMs);

      log("TTS speaking:", text.substring(0, 60) + "...");
      synthRef.current.speak(utterance);
    });
  }

  // ---- Speech Recognition ----
  function createRecognition(): any {
    const w = window as any;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return null;

    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;
    return recognition;
  }

  function stopListening() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {
        /* ignore */
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }

  // ---- The core loop: listen → sendToAI → speakText → listen ----
  // All functions read state from refs (updated synchronously), never from
  // React state captured in closures.

  function startListening() {
    // Guards
    if (isMutedRef.current) {
      log("startListening: skipped — muted");
      return;
    }
    if (statusRef.current !== "active") {
      log("startListening: skipped — status is", statusRef.current);
      return;
    }

    log("startListening: starting speech recognition");

    try {
      const recognition = createRecognition();
      if (!recognition) {
        setError("Speech recognition not supported. Please use Chrome or Edge.");
        return;
      }

      // Stop any existing recognition first
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {
          /* ignore */
        }
      }
      recognitionRef.current = recognition;

      let gotResult = false;

      recognition.onstart = () => {
        log("STT: listening started");
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        gotResult = true;
        const result = event.results[event.resultIndex];
        if (result.isFinal) {
          const text = result[0].transcript;
          log("STT: got final result:", text);
          setIsListening(false);
          if (text.trim()) {
            sendToAI(text);
          } else {
            log("STT: empty result, restarting");
            setTimeout(() => startListening(), 300);
          }
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        const errCode = event.error;
        log("STT error:", errCode);

        if (errCode === "no-speech") {
          // No speech detected — just restart
          setTimeout(() => startListening(), 300);
        } else if (errCode === "aborted") {
          // Intentionally stopped (e.g., by mute or end interview)
        } else if (errCode === "not-allowed") {
          setError(
            "Microphone access denied. Click the lock icon in the address bar, allow microphone, then reload."
          );
        } else if (errCode === "audio-capture") {
          setError(
            "No microphone found. Please connect a microphone and reload."
          );
        } else if (errCode === "network") {
          setTimeout(() => startListening(), 1000);
        } else {
          console.error("Speech recognition error:", errCode);
          setTimeout(() => startListening(), 1000);
        }
      };

      recognition.onend = () => {
        log("STT: recognition ended, gotResult:", gotResult);
        setIsListening(false);
        // If onend fires without a result or error, restart listening.
        // This handles the case where Chrome silently stops recognition.
        if (!gotResult && statusRef.current === "active" && !isMutedRef.current) {
          log("STT: no result on end, restarting");
          setTimeout(() => startListening(), 300);
        }
      };

      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setTimeout(() => startListening(), 1000);
    }
  }

  async function sendToAI(userMessage: string) {
    if (!userMessage.trim()) return;

    log("sendToAI:", userMessage.substring(0, 60));
    setTranscript((prev) => [...prev, { speaker: "user", text: userMessage }]);
    setIsProcessing(true);

    try {
      const data = await apiPost<ChatResponse>(
        `/api/interviews/${interviewId}/chat`,
        { message: userMessage, interview_id: interviewId }
      );

      log("AI response received:", data.response.substring(0, 60));
      if (data.topic) setCurrentTopic(data.topic);

      setTranscript((prev) => [
        ...prev,
        { speaker: "ai", text: data.response },
      ]);
      setIsProcessing(false);

      // Speak the AI response (awaits until speech finishes or safety timeout)
      await speakText(data.response);

      // Check if interview is wrapping up
      const lower = data.response.toLowerCase();
      if (
        lower.includes("wraps up our interview") ||
        lower.includes("that concludes") ||
        lower.includes("end of our interview") ||
        lower.includes("that's all the questions")
      ) {
        log("Interview wrap-up detected, ending...");
        setTimeout(() => endInterview(), 2000);
        return;
      }

      // Continue the loop: start listening again
      log("sendToAI: AI done speaking, restarting listener");
      startListening();
    } catch (err) {
      console.error("Chat error:", err);
      setIsProcessing(false);
      setTranscript((prev) => [
        ...prev,
        {
          speaker: "ai",
          text: "Sorry, I had a brief technical issue. Could you repeat that?",
        },
      ]);
      await speakText(
        "Sorry, I had a brief technical issue. Could you repeat that?"
      );
      startListening();
    }
  }

  async function endInterview() {
    if (interviewEndedRef.current) return;
    interviewEndedRef.current = true;

    log("Ending interview...");
    stopListening();
    if (synthRef.current) synthRef.current.cancel();
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

  // ---- Initialize the interview ----
  useEffect(() => {
    let cancelled = false;

    async function initInterview() {
      try {
        log("Initializing interview", interviewId);
        await apiPost(`/api/interviews/${interviewId}/start`, {});
        if (cancelled) return;

        // Update BOTH state and ref synchronously
        statusRef.current = "active";
        setStatus("active");
        log("Interview status set to active");

        const data = await apiPost<ChatResponse>(
          `/api/interviews/${interviewId}/chat`,
          {
            message: "Hello, I'm ready to start the interview.",
            interview_id: interviewId,
          }
        );
        if (cancelled) return;

        log("Got initial AI response:", data.response.substring(0, 60));
        if (data.topic) setCurrentTopic(data.topic);
        setTranscript([{ speaker: "ai", text: data.response }]);

        // Speak the greeting
        await speakText(data.response);
        if (cancelled) return;

        // Begin the listen loop
        log("Init complete, starting listen loop");
        startListening();
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to start interview:", err);
        setError(
          err instanceof Error ? err.message : "Failed to connect to interview"
        );
        statusRef.current = "error";
        setStatus("error");
      }
    }

    initInterview();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId]);

  // ---- Toggle mute ----
  function toggleMute() {
    if (isMutedRef.current) {
      // Unmuting
      isMutedRef.current = false;
      setIsMuted(false);
      log("Unmuted");
      if (statusRef.current === "active") {
        setTimeout(() => startListening(), 300);
      }
    } else {
      // Muting
      isMutedRef.current = true;
      setIsMuted(true);
      log("Muted");
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
            <Badge
              variant="outline"
              className="bg-violet-500/10 text-violet-400"
            >
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
            className={`relative mb-6 flex h-32 w-32 items-center justify-center rounded-full border-2 transition-all duration-500 ${
              aiSpeaking
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
              <span className="text-violet-400">AI is speaking...</span>
            ) : isProcessing ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Thinking...
              </span>
            ) : isListening ? (
              <span className="text-blue-400">Listening to you...</span>
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
                      className={`font-medium ${
                        entry.speaker === "ai"
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
            className={`h-14 w-14 rounded-full p-0 ${
              isMuted
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
