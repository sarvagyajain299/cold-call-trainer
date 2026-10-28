import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

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
  createdAt: integer("created_at").notNull(),
});

export type Preset = typeof presets.$inferSelect;
export type Session = typeof sessions.$inferSelect;
