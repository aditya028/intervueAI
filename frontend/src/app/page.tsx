"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Mic,
  Brain,
  FileText,
  Clock,
  ArrowRight,
  Zap,
  Target,
  MessageSquare,
  History,
  LogOut,
  User,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";

export default function Home() {
  const { user, logout, isLoading } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-500">
              <Mic className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold">IntervueAI</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="#how-it-works"
              className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              How it Works
            </Link>
            <Link
              href="#features"
              className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              Features
            </Link>

            {!isLoading && user ? (
              <>
                <Link
                  href="/history"
                  className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:flex sm:items-center sm:gap-1.5"
                >
                  <History className="h-3.5 w-3.5" />
                  History
                </Link>
                <Link href="/setup">
                  <Button size="sm">Start Interview</Button>
                </Link>
                <div className="flex items-center gap-2 border-l border-border/40 pl-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/10">
                    <User className="h-3.5 w-3.5 text-violet-400" />
                  </div>
                  <span className="hidden text-sm sm:block">{user.name}</span>
                  <button
                    onClick={logout}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    title="Logout"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : !isLoading ? (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-24 sm:py-32">
        {/* Background gradient blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="absolute -right-40 top-20 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute -bottom-20 left-1/2 h-60 w-60 -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-violet-400" />
            <span>Powered by Voice AI</span>
          </div>

          {/* Headline */}
          <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Ace Your Next Interview{" "}
            <span className="bg-gradient-to-r from-violet-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
              with AI
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mb-8 text-lg text-muted-foreground sm:text-xl">
            Practice real voice interviews with an AI that adapts to your level.
            Get instant feedback and a detailed review to level up your skills.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href={user ? "/setup" : "/register"}>
              <Button
                size="lg"
                className="gap-2 bg-gradient-to-r from-violet-500 to-blue-500 text-white hover:from-violet-600 hover:to-blue-600"
              >
                {user ? "Start Interview" : "Get Started Free"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="#how-it-works">
              <Button variant="outline" size="lg" className="gap-2">
                See How it Works
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-3 gap-8">
            <div>
              <div className="text-2xl font-bold sm:text-3xl">1hr</div>
              <div className="text-sm text-muted-foreground">
                Interview Session
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold sm:text-3xl">Voice</div>
              <div className="text-sm text-muted-foreground">
                Real-time AI Conversation
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold sm:text-3xl">Instant</div>
              <div className="text-sm text-muted-foreground">
                Detailed Review
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="border-t border-border/40 px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground">
              Three simple steps to your perfect AI interview
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            <div className="group relative rounded-2xl border border-border/60 bg-card/50 p-8 transition-all hover:border-violet-500/40 hover:bg-card">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 transition-colors group-hover:bg-violet-500/20">
                <Target className="h-6 w-6" />
              </div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-violet-400">
                Step 1
              </div>
              <h3 className="mb-2 text-xl font-semibold">Choose Your Focus</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Select your role (SDE, Intern, or Learning) and pick the topics
                you want to practice. The AI builds a custom question bank just
                for you.
              </p>
            </div>

            <div className="group relative rounded-2xl border border-border/60 bg-card/50 p-8 transition-all hover:border-blue-500/40 hover:bg-card">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 transition-colors group-hover:bg-blue-500/20">
                <Mic className="h-6 w-6" />
              </div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-blue-400">
                Step 2
              </div>
              <h3 className="mb-2 text-xl font-semibold">
                Talk to the AI Interviewer
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Join a voice interview right in your browser. The AI asks
                questions, listens to your answers, and adapts in real time --
                just like a real interview.
              </p>
            </div>

            <div className="group relative rounded-2xl border border-border/60 bg-card/50 p-8 transition-all hover:border-indigo-500/40 hover:bg-card">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 transition-colors group-hover:bg-indigo-500/20">
                <FileText className="h-6 w-6" />
              </div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-indigo-400">
                Step 3
              </div>
              <h3 className="mb-2 text-xl font-semibold">
                Get Your Review
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Receive a detailed scorecard with per-topic breakdowns,
                strengths, areas for improvement, and actionable suggestions to
                level up.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border/40 px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
              Built for Real Practice
            </h2>
            <p className="text-lg text-muted-foreground">
              Everything you need to prepare like a pro
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-card/50 p-8">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
                <Mic className="h-5 w-5 text-violet-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">
                Voice-to-Voice Interview
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Speak naturally and hear the AI respond in real time. No typing,
                no scripts -- just a natural conversation that mirrors a real
                interview.
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/50 p-8">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Brain className="h-5 w-5 text-blue-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">
                Adaptive Questioning
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                The AI starts with basics and goes deeper when you answer well.
                Stuck? It gives you a hint and moves on -- just like a supportive
                interviewer.
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/50 p-8">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
                <Clock className="h-5 w-5 text-indigo-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">
                Realistic Timing
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                One-hour sessions that mirror real interview duration. Covers all
                your selected topics with smart pacing and time management.
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/50 p-8">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <MessageSquare className="h-5 w-5 text-emerald-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">
                Detailed Feedback
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Get a comprehensive review with scores per topic, what you did
                well, what needs work, and specific suggestions to improve.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border/40 px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
            Ready to Practice?
          </h2>
          <p className="mb-8 text-lg text-muted-foreground">
            Set up your interview in under a minute. Free to get started.
          </p>
          <Link href={user ? "/setup" : "/register"}>
            <Button
              size="lg"
              className="gap-2 bg-gradient-to-r from-violet-500 to-blue-500 text-white hover:from-violet-600 hover:to-blue-600"
            >
              {user ? "Start Your Interview" : "Create Free Account"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
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
