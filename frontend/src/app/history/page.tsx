"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Mic,
  ArrowLeft,
  ArrowRight,
  Clock,
  Star,
  FileText,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
} from "lucide-react";
import { apiGet, type InterviewListResponse, type InterviewListItem } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "—";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hrs}h ${remainMins}m`;
}

function statusBadge(status: string) {
  switch (status) {
    case "review_ready":
      return (
        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
          Reviewed
        </Badge>
      );
    case "completed":
      return (
        <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30">
          Completed
        </Badge>
      );
    case "in_progress":
      return (
        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30">
          In Progress
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground">
          {status.replace("_", " ")}
        </Badge>
      );
  }
}

export default function HistoryPage() {
  const { user } = useAuth();
  const [data, setData] = useState<InterviewListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiGet<InterviewListResponse>(
          `/api/interviews?page=${page}&per_page=10`
        );
        setData(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load history");
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [page]);

  const totalPages = data ? Math.ceil(data.total / data.per_page) : 0;

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
          <div className="flex items-center gap-4">
            {user && (
              <span className="text-sm text-muted-foreground">
                {user.name}
              </span>
            )}
            <Link href="/setup">
              <Button size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                New Interview
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 px-6 py-12">
        <div className="mx-auto max-w-4xl">
          {/* Back + Header */}
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Interview History</h1>
              <p className="mt-1 text-muted-foreground">
                {data
                  ? `${data.total} interview${data.total !== 1 ? "s" : ""} total`
                  : "Loading..."}
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
            </div>
          )}

          {/* Empty state */}
          {!loading && data && data.interviews.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/10">
                <FileText className="h-8 w-8 text-violet-400" />
              </div>
              <h2 className="mb-2 text-xl font-semibold">No interviews yet</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Start your first AI interview to see your history here.
              </p>
              <Link href="/setup">
                <Button className="gap-2 bg-gradient-to-r from-violet-500 to-blue-500 text-white hover:from-violet-600 hover:to-blue-600">
                  Start Interview
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          )}

          {/* Interview list */}
          {!loading && data && data.interviews.length > 0 && (
            <div className="space-y-3">
              {data.interviews.map((iv: InterviewListItem) => (
                <Link
                  key={iv.id}
                  href={
                    iv.status === "review_ready"
                      ? `/review/${iv.id}`
                      : iv.status === "in_progress"
                        ? `/interview/${iv.id}`
                        : `/brief/${iv.id}`
                  }
                  className="block"
                >
                  <div className="group rounded-xl border border-border/60 bg-card/50 p-5 transition-all hover:border-violet-500/40 hover:bg-card">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-3">
                          <span className="text-sm font-semibold uppercase text-violet-400">
                            {iv.role}
                          </span>
                          {statusBadge(iv.status)}
                        </div>
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {iv.topics.map((t) => (
                            <Badge
                              key={t}
                              variant="outline"
                              className="text-xs"
                            >
                              {t}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(iv.created_at)}
                          </span>
                          {iv.duration_seconds && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDuration(iv.duration_seconds)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {iv.overall_score !== null && (
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-lg font-bold">
                              <Star className="h-4 w-4 text-amber-400" />
                              {iv.overall_score.toFixed(1)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              /10
                            </div>
                          </div>
                        )}
                        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && data && totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="px-4 text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
