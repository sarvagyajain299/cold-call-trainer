"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { requestLeave } from "@/lib/leaveGuard";

/** Top-left shortcut to the home page, on every page except home itself. */
export default function HomeButton() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <Link
      href="/"
      // A live call takes over: it asks, hangs up, saves, then goes home itself.
      onClick={(e) => {
        if (!requestLeave()) e.preventDefault();
      }}
      aria-label="Go to home"
      className="fixed left-4 top-4 z-50 flex h-9 items-center gap-2 rounded-full border bg-background px-3 text-sm shadow-sm hover:bg-zinc-100 dark:hover:bg-zinc-900 print:hidden"
    >
      <span aria-hidden>←</span>
      <span>Home</span>
    </Link>
  );
}
