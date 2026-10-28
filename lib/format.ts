export function ratingColour(n: number) {
  if (n >= 7) return "text-green-600 dark:text-green-400";
  if (n >= 4) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export const OUTCOMES: Record<string, string> = {
  meeting_booked: "Meeting booked",
  callback_agreed: "Callback agreed",
  info_requested: "Asked for info",
  brushed_off: "Brushed off",
  hung_up: "Hung up on you",
  ended_neutral: "Ended neutrally",
};

export const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
export const dateTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
