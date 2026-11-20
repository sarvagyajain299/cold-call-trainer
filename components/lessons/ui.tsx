"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const primary =
  "inline-flex min-h-[50px] w-full items-center justify-center rounded-full bg-ios-blue-fill px-6 text-[17px] font-semibold text-ios-on-blue transition-opacity duration-150 disabled:opacity-40 sm:w-auto sm:min-w-[240px]";
const secondary = "inline-flex min-h-[44px] items-center justify-center px-3 text-[17px] text-ios-blue disabled:opacity-40";

export function PrimaryButton({ className = "", ...props }: ComponentProps<"button">) {
  return <button type="button" {...props} className={`${primary} ${className}`} />;
}

export function PrimaryLink({ className = "", ...props }: ComponentProps<typeof Link>) {
  return <Link {...props} className={`${primary} ${className}`} />;
}

export function TextButton({ className = "", ...props }: ComponentProps<"button">) {
  return <button type="button" {...props} className={`${secondary} ${className}`} />;
}

export function TextLink({ className = "", ...props }: ComponentProps<typeof Link>) {
  return <Link {...props} className={`${secondary} ${className}`} />;
}

/** Inset grouped section, like iOS Settings. */
export function Group({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[14px] bg-ios-surface p-4 ${className}`}>{children}</div>;
}

/** Words someone really said on the call: always serif italic, so they never look like coaching. */
export function Quote({ children, who, className = "" }: { children: ReactNode; who?: string; className?: string }) {
  return (
    <figure className={className}>
      {who && <figcaption className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-ios-label-2">{who}</figcaption>}
      <blockquote className="call-quote text-[19px] leading-snug">“{children}”</blockquote>
    </figure>
  );
}

/** Wins: blue circle. Fixes: orange diamond. Shape and colour together, never colour alone. */
export function WinMark({ size = 10 }: { size?: number }) {
  return <span aria-hidden className="inline-block shrink-0 rounded-full bg-ios-blue" style={{ width: size, height: size }} />;
}

export function FixMark({ size = 10 }: { size?: number }) {
  return <span aria-hidden className="inline-block shrink-0 rotate-45 bg-ios-orange" style={{ width: size * 0.8, height: size * 0.8 }} />;
}

export function SecondaryText({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-[15px] text-ios-label-2 ${className}`}>{children}</p>;
}
