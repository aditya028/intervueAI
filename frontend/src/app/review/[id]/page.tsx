"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Mic,
  ArrowLeft,
  ArrowRight,
  Star,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertCircle,
  Target,
  Clock,
  Loader2,
} from "lucide-react";
import { apiGet, type ReviewData } from "@/lib/api";

function ScoreBar({ score, maxScore }: { score: number; maxScore: number }) {
  const percentage = (score / maxScore) * 100;
  const getColor = () => {
    if (percentage >= 80) return "bg-emerald-500";
    if (percentage >= 60) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${getColor()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm font-medium tabular-nums">
        {score}/{maxScore}
      </span>
    </div>
  );
}

export default function ReviewPage() {
  const params = useParams();
  const interviewId = params.id as string;

  const [review, setReview] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchReview() {
      try {
        const data = await apiGet<ReviewData>(
          `/api/interviews/${interviewId}/review`
        );
        if (!cancelled) {
          setReview(data);
          setLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load review";

        // If review is still generating, retry after a delay
        if (
          message.includes("still be generating") &&
          retryCount < 10
        ) {
          setTimeout(() => {
            setRetryCount((prev) => prev + 1);
          }, 3000);
        } else {
          setError(message);
          setLoading(false);
        }
      }
    }

    fetchReview();
    return () => {
      cancelled = true;
    };
  }, [interviewId, retryCount]);

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-emerald-400";
    if (score >= 6) return "text-amber-400";
    return "text-red-400";
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
          <p className="text-sm text-muted-foreground">
            {retryCount > 0
              ? "Review is being generated... hang tight"
              : "Loading your review..."}
          </p>
        </div>
      </div>
    );
  }

  if (error || !review) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-10 w-10 text-red-400" />
          <h1 className="mb-2 text-xl font-bold">Review Not Available</h1>
          <p className="mb-4 text-sm text-muted-foreground">
            {error || "Review not found"}
          </p>
          <Link href="/setup">
            <Button variant="outline">Start New Interview</Button>
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
        <div className="mx-auto max-w-3xl">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <div className="mb-8">
            <h1 className="mb-2 text-3xl font-bold">Interview Review</h1>
            <p className="text-muted-foreground">
              Here&apos;s your detailed performance breakdown.
            </p>
          </div>

          {/* Overall Score Card */}
          <Card className="mb-8 border-border/60 bg-card/50">
            <CardContent className="p-8">
              <div className="flex flex-col items-center text-center sm:flex-row sm:text-left sm:gap-8">
                <div className="mb-4 flex flex-col items-center sm:mb-0">
                  <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-4 border-violet-500/30 bg-violet-500/5">
                    <div>
                      <div
                        className={`text-3xl font-bold ${getScoreColor(review.overall_score)}`}
                      >
                        {review.overall_score}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        out of 10
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1">
                  <div className="mb-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    {review.role && (
                      <Badge className="bg-violet-500/10 text-violet-400">
                        {review.role.toUpperCase()}
                      </Badge>
                    )}
                    {review.duration && (
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {review.duration}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {review.verdict}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Topic Breakdown */}
          {review.topic_breakdown.length > 0 && (
            <>
              <h2 className="mb-4 text-xl font-semibold">Topic Breakdown</h2>
              <div className="mb-8 space-y-4">
                {review.topic_breakdown.map((topic) => (
                  <Card
                    key={topic.name}
                    className="border-border/60 bg-card/50"
                  >
                    <CardContent className="p-6">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="font-semibold">{topic.name}</h3>
                        <span
                          className={`text-lg font-bold ${getScoreColor(topic.score)}`}
                        >
                          {topic.score}/{topic.max_score}
                        </span>
                      </div>
                      <ScoreBar
                        score={topic.score}
                        maxScore={topic.max_score}
                      />

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-emerald-400">
                            <TrendingUp className="h-3 w-3" />
                            Strengths
                          </h4>
                          <ul className="space-y-1.5">
                            {topic.strengths.map((s, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-1.5 text-sm text-muted-foreground"
                              >
                                <CheckCircle className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400/60" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-amber-400">
                            <TrendingDown className="h-3 w-3" />
                            To Improve
                          </h4>
                          <ul className="space-y-1.5">
                            {topic.improvements.map((s, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-1.5 text-sm text-muted-foreground"
                              >
                                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400/60" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Separator className="mb-8" />
            </>
          )}

          {/* Overall Strengths & Improvements */}
          <div className="mb-8 grid gap-6 sm:grid-cols-2">
            {review.strengths.length > 0 && (
              <Card className="border-emerald-500/20 bg-emerald-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-emerald-400">
                    <Star className="h-4 w-4" />
                    Overall Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {review.strengths.map((s, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {review.weaknesses.length > 0 && (
              <Card className="border-amber-500/20 bg-amber-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-amber-400">
                    <Target className="h-4 w-4" />
                    Areas to Focus
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {review.weaknesses.map((s, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {/* CTA */}
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/setup">
              <Button
                size="lg"
                className="gap-2 bg-gradient-to-r from-violet-500 to-blue-500 text-white hover:from-violet-600 hover:to-blue-600"
              >
                Practice Again
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/40 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-blue-500">
              <Mic className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm font-medium">IntervueAI</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Built with AI. Practice without limits.
          </p>
        </div>
      </footer>
    </div>
  );
}
