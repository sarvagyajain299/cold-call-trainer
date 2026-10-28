import Anthropic from "@anthropic-ai/sdk";

// Reads ANTHROPIC_API_KEY from the environment.
export const anthropic = new Anthropic();

export const PERSONA_MODEL = "claude-opus-5-5";
