"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Mic,
  ArrowLeft,
  Play,
  Clock,
  BookOpen,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { apiGet, type BriefData } from "@/lib/api";

export default function BriefPage() {
  const params = useParams();
  const router = useRouter();
  const interviewId = params.id as string;

  const [brief, setBrief] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBrief() {
      try {
        const data = await apiGet<BriefData>(
          `/api/interviews/${interviewId}/brief`
        );
        setBrief(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load interview brief"
        );
      } finally {
        setLoading(false);
      }
    }
    fetchBrief();
  }, [interviewId]);

  const handleJoinInterview = () => {
    router.push(`/interview/${interviewId}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
          <p className="text-sm text-muted-foreground">
            Loading interview brief...
          </p>
        </div>
      </div>
    );
  }

  if (error || !brief) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-10 w-10 text-red-400" />
          <h1 className="mb-2 text-xl font-bold">Failed to Load</h1>
          <p className="mb-4 text-sm text-muted-foreground">
            {error || "Interview not found"}
          </p>
          <Link href="/setup">
            <Button variant="outline">Back to Setup</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-500">
              <Mic className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold">IntervueAI</span>
          </Link>
        </div>
      </nav>

      <main className="flex-1 px-6 py-12">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/setup"
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Setup
          </Link>

          <div className="mb-8">
            <h1 className="mb-2 text-3xl font-bold">Interview Brief</h1>
            <p className="text-muted-foreground">
              Here&apos;s what your interview will cover. Take a moment to review
              before you begin.
            </p>
          </div>

          {/* Overview Card */}
          <Card className="mb-6 border-border/60 bg-card/50">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <Badge className="bg-violet-500/10 text-violet-400">
                  {brief.role.toUpperCase()}
                </Badge>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {brief.estimated_duration}
                </div>
              </div>

              <div className="mb-4">
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                  Topics
                </h3>
                <div className="flex flex-wrap gap-2">
                  {brief.topics.map((topic) => (
                    <Badge key={topic} variant="outline">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {brief.total_questions} questions
                </span>{" "}
                prepared across all topics
              </div>
            </CardContent>
          </Card>

          {/* Focus Areas */}
          <Card className="mb-6 border-border/60 bg-card/50">
            <CardContent className="p-6">
              <h3 className="mb-4 flex items-center gap-2 font-semibold">
                <BookOpen className="h-4 w-4 text-blue-400" />
                What to Expect
              </h3>
              <ul className="space-y-3">
                {brief.focus_areas.map((area, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {area}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Tips */}
          <Card className="mb-10 border-amber-500/20 bg-amber-500/5">
            <CardContent className="p-6">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-400">
                <AlertCircle className="h-4 w-4" />
                Tips Before You Start
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>-- Use headphones for the best experience</li>
                <li>-- Find a quiet space with minimal background noise</li>
                <li>-- Speak clearly and at a natural pace</li>
                <li>-- It&apos;s okay to ask for a moment to think</li>
                <li>
                  -- The interview will last about 1 hour (max 1hr 15min)
                </li>
              </ul>
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={handleJoinInterview}
              className="gap-2 bg-gradient-to-r from-violet-500 to-blue-500 text-white hover:from-violet-600 hover:to-blue-600"
            >
              <Play className="h-4 w-4" />
              Join Interview
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
