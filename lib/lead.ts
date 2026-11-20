// The lead card: what a caller would know before dialling (lead list, Google Maps).
// Pure and safe to send to the browser: it never contains mood, situation, objections or pain points.
import type { Persona } from "@/lib/persona";

export type LeadCard = {
  name: string;
  role: string;
  businessName: string;
  location: string;
  rating: number | null;
  reviews: number | null;
  website: string | null;
  note: string | null;
};

/** Older personas were made before the lead card existed; they still show name, role, business and city. */
export function leadCard(p: Persona): LeadCard {
  const lead = (p as Partial<Persona>).lead;
  const location = [lead?.area, p.city].filter((x) => x && x.trim()).join(", ");
  return {
    name: p.name,
    role: p.role,
    businessName: p.businessName,
    location,
    rating: typeof lead?.googleRating === "number" ? Math.round(lead.googleRating * 10) / 10 : null,
    reviews: typeof lead?.reviewCount === "number" ? Math.round(lead.reviewCount) : null,
    website: lead?.website?.trim() ? lead.website.trim() : null,
    note: lead?.publicNote?.trim() ? lead.publicNote.trim() : null,
  };
}
