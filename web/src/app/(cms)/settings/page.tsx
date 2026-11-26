"use client";

import { EmptyState } from "@loom-web/src/components/ui/EmptyState";
import {
  isNavItemVisible,
  SETTINGS_NAVIGATION,
} from "@loom-web/src/constants/navigation";
import { useCurrentUser } from "@loom-web/src/hooks/user/useCurrentUser";
import { GearSix } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** The sidebar's one Settings entry lands here, on the first page the user's role can open. */
export default function SettingsPage() {
  const router = useRouter();
  const { data: user } = useCurrentUser();
  const first = SETTINGS_NAVIGATION.find((item) =>
    isNavItemVisible(item, user?.role),
  );

  useEffect(() => {
    if (first) router.replace(first.href);
  }, [first, router]);

  if (!user || first) return null;

  return (
    <div className="rounded-xl border border-border bg-surface">
      <EmptyState icon={GearSix} title="No settings for your role">
        An admin manages this site's settings.
      </EmptyState>
    </div>
  );
}
