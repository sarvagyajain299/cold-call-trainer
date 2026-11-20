import type { LeadCard as Lead } from "@/lib/lead";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-zinc-500">{label}</dt>
      <dd className="min-w-0">{value}</dd>
    </div>
  );
}

/** What you would know from a lead list before dialling. Mood, situation and objections stay hidden. */
export function LeadCard({ lead }: { lead: Lead }) {
  const rating =
    lead.rating !== null
      ? `${lead.rating.toFixed(1)} stars${lead.reviews !== null ? ` · ${lead.reviews} reviews` : ""}`
      : null;
  const website = lead.website && lead.website.toLowerCase() !== "none" ? lead.website : lead.website ? "None" : null;

  return (
    <dl className="flex flex-col gap-1.5 text-sm">
      <Row label="Name" value={lead.name} />
      <Row label="Role" value={lead.role} />
      <Row label="Business" value={lead.businessName} />
      {lead.location && <Row label="Location" value={lead.location} />}
      {rating && <Row label="Google" value={rating} />}
      {website && <Row label="Website" value={website} />}
      {lead.note && <Row label="Online" value={lead.note} />}
    </dl>
  );
}
