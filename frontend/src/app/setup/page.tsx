"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Mic,
  ArrowLeft,
  ArrowRight,
  Code,
  GraduationCap,
  BookOpen,
  X,
  Plus,
  Loader2,
} from "lucide-react";

const ROLES = [
  {
    id: "sde",
    label: "SDE",
    description: "Software Development Engineer",
    icon: Code,
  },
  {
    id: "intern",
    label: "Intern",
    description: "Internship Position",
    icon: GraduationCap,
  },
  {
    id: "learning",
    label: "Learning",
    description: "Practice & Improve",
    icon: BookOpen,
  },
];

const SUGGESTED_TOPICS = [
  "JavaScript",
  "TypeScript",
  "React",
  "Node.js",
  "Python",
  "Data Structures",
  "Algorithms",
  "System Design",
  "SQL & Databases",
  "REST APIs",
  "Git & Version Control",
  "Operating Systems",
  "OOP Concepts",
  "HTML & CSS",
  "Docker",
  "AWS",
];

export default function SetupPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const addCustomTopic = () => {
    const trimmed = customTopic.trim();
    if (trimmed && !selectedTopics.includes(trimmed)) {
      setSelectedTopics((prev) => [...prev, trimmed]);
      setCustomTopic("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustomTopic();
    }
  };

  const handleStart = async () => {
    if (!selectedRole || selectedTopics.length === 0) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/interviews`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: selectedRole,
            topics: selectedTopics,
          }),
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to create interview");
      }

      const data = await response.json();
      router.push(`/brief/${data.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      console.error("Error creating interview:", message);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const canStart = selectedRole && selectedTopics.length > 0;

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
          {/* Back link */}
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          {/* Header */}
          <div className="mb-10">
            <h1 className="mb-2 text-3xl font-bold">Set Up Your Interview</h1>
            <p className="text-muted-foreground">
              Choose your role and topics. The AI will build a custom interview
              tailored to you.
            </p>
          </div>

          {/* Role Selection */}
          <div className="mb-10">
            <h2 className="mb-4 text-lg font-semibold">Select Your Role</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {ROLES.map((role) => {
                const Icon = role.icon;
                const isSelected = selectedRole === role.id;
                return (
                  <Card
                    key={role.id}
                    className={`cursor-pointer transition-all hover:border-violet-500/40 ${
                      isSelected
                        ? "border-violet-500 bg-violet-500/5"
                        : "border-border/60 bg-card/50"
                    }`}
                    onClick={() => setSelectedRole(role.id)}
                  >
                    <CardContent className="flex flex-col items-center p-6 text-center">
                      <div
                        className={`mb-3 flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${
                          isSelected
                            ? "bg-violet-500/20 text-violet-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="font-semibold">{role.label}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {role.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Topic Selection */}
          <div className="mb-10">
            <h2 className="mb-4 text-lg font-semibold">
              Select Topics{" "}
              {selectedTopics.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({selectedTopics.length} selected)
                </span>
              )}
            </h2>

            {/* Selected topics */}
            {selectedTopics.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {selectedTopics.map((topic) => (
                  <Badge
                    key={topic}
                    variant="secondary"
                    className="gap-1.5 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20"
                  >
                    {topic}
                    <button
                      onClick={() => toggleTopic(topic)}
                      className="ml-0.5 rounded-full transition-colors hover:text-violet-200"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Suggested topics */}
            <div className="mb-4 flex flex-wrap gap-2">
              {SUGGESTED_TOPICS.filter(
                (t) => !selectedTopics.includes(t)
              ).map((topic) => (
                <Badge
                  key={topic}
                  variant="outline"
                  className="cursor-pointer transition-colors hover:border-violet-500/40 hover:bg-violet-500/5"
                  onClick={() => toggleTopic(topic)}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  {topic}
                </Badge>
              ))}
            </div>

            {/* Custom topic input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add a custom topic..."
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 rounded-lg border border-border/60 bg-card/50 px-4 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-violet-500/60"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={addCustomTopic}
                disabled={!customTopic.trim()}
                className="px-4"
              >
                Add
              </Button>
            </div>
          </div>

          {/* Interview Info */}
          <Card className="mb-10 border-border/60 bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Interview Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Duration</div>
                <div className="font-medium">~1 hour (max 1hr 15min)</div>
              </div>
              <div>
                <div className="text-muted-foreground">Format</div>
                <div className="font-medium">Voice-to-Voice with AI</div>
              </div>
              <div>
                <div className="text-muted-foreground">Approach</div>
                <div className="font-medium">
                  Adaptive (basics to advanced)
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Review</div>
                <div className="font-medium">
                  Detailed scorecard after interview
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Error Message */}
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Start Button */}
          <div className="flex justify-end">
            <Button
              size="lg"
              disabled={!canStart || isLoading}
              onClick={handleStart}
              className="gap-2 bg-gradient-to-r from-violet-500 to-blue-500 text-white hover:from-violet-600 hover:to-blue-600 disabled:opacity-40"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating Questions...
                </>
              ) : (
                <>
                  Continue to Brief
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
