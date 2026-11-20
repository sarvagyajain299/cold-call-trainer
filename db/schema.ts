import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const presets = sqliteTable("presets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  offer: text("offer").notNull(),
  price: text("price").notNull().default(""),
  idealCustomer: text("ideal_customer").notNull().default(""),
  callGoal: text("call_goal").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  presetId: text("preset_id").notNull(),
  profile: text("profile").notNull(),
  difficulty: text("difficulty").notNull(), // easy | realistic | brutal
  persona: text("persona"), // JSON, hidden until the report
  conversationId: text("conversation_id"),
  status: text("status").notNull().default("setup"), // setup | live | scoring | done
  report: text("report"), // JSON
  selfReview: text("self_review"),
  // Was the cheat sheet panel visible during the call? null = no sheet existed or not recorded.
  sheetShown: integer("sheet_shown"),
  // JSON copy of the script and cheat sheet as they stood when this call started. null = older call.
  scriptUsed: text("script_used"),
  // JSON {label, line, lessonId}: a line from a lesson, pinned on the call script. null = none.
  cueCard: text("cue_card"),
  createdAt: integer("created_at").notNull(),
});

export const cheatSheets = sqliteTable("cheat_sheets", {
  presetId: text("preset_id").primaryKey(),
  sections: text("sections").notNull(), // JSON: [{ id, title, lines: string[] }]
  generatedAt: integer("generated_at"),
  updatedAt: integer("updated_at").notNull(),
});

// Saved "who are you calling?" profiles for a project, picked from a dropdown on the new call form.
export const prospectTypes = sqliteTable("prospect_types", {
  id: text("id").primaryKey(),
  presetId: text("preset_id").notNull(),
  label: text("label").notNull(),
  profile: text("profile").notNull(),
  createdAt: integer("created_at").notNull(),
});

// Post-call lessons: one per "Fix these first" item of a scorecard.
export const lessons = sqliteTable("lessons", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  ord: integer("ord").notNull(),
  title: text("title").notNull(),
  rule: text("rule").notNull(),
  data: text("data").notNull(), // JSON LessonData
  status: text("status").notNull().default("not_started"), // not_started | in_progress | done | skipped
  screen: integer("screen").notNull().default(0),
  gutPick: text("gut_pick"),
  bestScore: real("best_score"),
  reviewStep: integer("review_step").notNull().default(0),
  nextReviewAt: integer("next_review_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const practiceAttempts = sqliteTable("practice_attempts", {
  id: text("id").primaryKey(),
  lessonId: text("lesson_id").notNull(),
  attemptNumber: integer("attempt_number").notNull(),
  mode: text("mode").notNull(), // voice | typed
  isReview: integer("is_review").notNull().default(0),
  transcript: text("transcript").notNull(),
  audioPath: text("audio_path"),
  durationSec: real("duration_sec"),
  speakingSec: real("speaking_sec"),
  wpm: integer("wpm"),
  result: text("result"), // JSON AttemptResult
  score: real("score"),
  error: text("error"),
  createdAt: integer("created_at").notNull(),
});

export type LessonRow = typeof lessons.$inferSelect;
export type AttemptRow = typeof practiceAttempts.$inferSelect;
export type Preset = typeof presets.$inferSelect;
export type ProspectType = typeof prospectTypes.$inferSelect;
export type Session = typeof sessions.$inferSelect;
