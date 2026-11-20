import { and, asc, eq, inArray, isNotNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { lessons, practiceAttempts, sessions, type AttemptRow, type LessonRow } from "@/db/schema";
import { nextReview, type Attempt, type AttemptResult, type Lesson, type LessonData, type LessonStatus } from "@/lib/lessons/model";
import type { StoredReport } from "@/lib/scoring";

export function toLesson(row: LessonRow): Lesson {
  return {
    id: row.id,
    sessionId: row.sessionId,
    ord: row.ord,
    title: row.title,
    rule: row.rule,
    data: JSON.parse(row.data) as LessonData,
    status: row.status as LessonStatus,
    screen: row.screen,
    gutPick: row.gutPick,
    bestScore: row.bestScore,
    reviewStep: row.reviewStep,
    nextReviewAt: row.nextReviewAt,
  };
}

export function toAttempt(row: AttemptRow): Attempt {
  return {
    id: row.id,
    attemptNumber: row.attemptNumber,
    mode: row.mode as Attempt["mode"],
    transcript: row.transcript,
    wpm: row.wpm,
    score: row.score,
    result: row.result ? (JSON.parse(row.result) as AttemptResult) : null,
    error: row.error,
  };
}

export function lessonsForSession(sessionId: string): Lesson[] {
  return db.select().from(lessons).where(eq(lessons.sessionId, sessionId)).orderBy(asc(lessons.ord)).all().map(toLesson);
}

export function getLesson(id: string): Lesson | null {
  const row = db.select().from(lessons).where(eq(lessons.id, id)).get();
  return row ? toLesson(row) : null;
}

export function attemptsFor(lessonId: string): Attempt[] {
  return db
    .select()
    .from(practiceAttempts)
    .where(eq(practiceAttempts.lessonId, lessonId))
    .orderBy(asc(practiceAttempts.createdAt))
    .all()
    .map(toAttempt);
}

export function insertLessons(rows: (typeof lessons.$inferInsert)[]) {
  db.transaction((tx) => {
    for (const row of rows) tx.insert(lessons).values(row).run();
  });
}

export function updateLesson(id: string, patch: Partial<typeof lessons.$inferInsert>) {
  return db.update(lessons).set({ ...patch, updatedAt: Date.now() }).where(eq(lessons.id, id)).run();
}

/** Mark a lesson done and schedule its first review from the best practice score (none counts as 0). */
export function completeLesson(lesson: Lesson, now = Date.now()) {
  if (lesson.status === "done") return;
  const next = nextReview(lesson.bestScore ?? 0, 0, now);
  updateLesson(lesson.id, { status: "done", reviewStep: next.step, nextReviewAt: next.at });
}

/** After a review visit: move along the ladder using the best score from that visit's attempts. */
export function finishReview(lesson: Lesson, attemptIds: string[], now = Date.now()) {
  const scores = attemptIds.length
    ? db
        .select({ score: practiceAttempts.score })
        .from(practiceAttempts)
        .where(and(eq(practiceAttempts.lessonId, lesson.id), inArray(practiceAttempts.id, attemptIds)))
        .all()
        .map((r) => r.score ?? 0)
    : [];
  const best = scores.length ? Math.max(...scores) : 0;
  const next = nextReview(best, lesson.reviewStep, now);
  updateLesson(lesson.id, {
    reviewStep: next.step,
    nextReviewAt: next.at,
    bestScore: Math.max(best, lesson.bestScore ?? 0),
  });
}

export type DueReview = { lessonId: string; title: string; prospectName: string };

export function dueReviews(now = Date.now()): DueReview[] {
  return db
    .select()
    .from(lessons)
    .where(and(eq(lessons.status, "done"), isNotNull(lessons.nextReviewAt), lte(lessons.nextReviewAt, now)))
    .orderBy(asc(lessons.nextReviewAt))
    .all()
    .map((row) => ({ lessonId: row.id, title: row.title, prospectName: (JSON.parse(row.data) as LessonData).prospectName }));
}

export function getReport(sessionId: string): { report: StoredReport; presetId: string; selfReview: string | null } | null {
  const s = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
  if (!s?.report) return null;
  return { report: JSON.parse(s.report) as StoredReport, presetId: s.presetId, selfReview: s.selfReview };
}
