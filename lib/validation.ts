import { z } from "zod";

export const presetInput = z.object({
  name: z.string().trim().min(1, "Give the project a name").max(80),
  offer: z.string().trim().min(10, "Describe what you sell in a sentence or two").max(2000),
  price: z.string().trim().max(200).default(""),
  idealCustomer: z.string().trim().max(1000).default(""),
  callGoal: z.string().trim().min(3, "What should the call achieve?").max(300),
});

export const difficulties = ["easy", "realistic", "brutal"] as const;

export const sessionInput = z.object({
  presetId: z.string().min(1, "Pick a project"),
  profile: z.string().trim().min(20, "Add a bit more about the person (business, location, role)").max(4000),
  difficulty: z.enum(difficulties),
});
