import logo from "@loom-web/src/app/apple-icon.png";
import Image from "next/image";
import type { ReactNode } from "react";

/** What someone signed out sees: one card in the middle of the page, and none of the CMS. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center gap-2.5 px-1">
          <Image alt="" className="size-8 rounded-lg" priority src={logo} />
          <span className="font-semibold text-lg tracking-tight">Loom</span>
        </div>
        {children}
      </div>
    </main>
  );
}
