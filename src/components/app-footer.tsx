"use client";

import * as React from "react";
import { Github, BookOpen, Heart } from "lucide-react";

/**
 * Sticky footer pushed to the bottom via `mt-auto` on the parent flex column.
 */
export function AppFooter() {
  return (
    <footer className="mt-auto border-t bg-card">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
        <div className="flex flex-col items-center gap-0.5 text-center sm:items-start sm:text-left">
          <p>
            <span className="font-semibold text-foreground">AutoSocial</span>
            {" © "}
            {new Date().getFullYear()}
          </p>
          <p className="flex items-center gap-1">
            Built with Next.js + Prisma + AI
            <Heart className="size-3 fill-rose-500 text-rose-500" aria-hidden />
          </p>
        </div>
        <nav className="flex items-center gap-1" aria-label="Footer">
          <FooterLink
            href="https://github.com/shadow7019/autosocial-media-posting"
            label="GitHub repo"
            icon={<Github className="size-3.5" />}
          />
          <FooterLink
            href="https://github.com/shadow7019/autosocial-media-posting#readme"
            label="Documentation"
            icon={<BookOpen className="size-3.5" />}
          />
        </nav>
      </div>
    </footer>
  );
}

function FooterLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}
