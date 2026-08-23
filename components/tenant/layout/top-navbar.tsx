"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown, LogOut, User, PanelLeftClose, PanelLeft } from "lucide-react";
import { ConnectionStatus } from "@/components/shared/connection-status";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { NotificationBell } from "@/components/tenant/notifications/notification-bell";
import { signOut } from "@/lib/firebase/auth";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";

/** Renders the user's profile photo if available, otherwise the User icon. */
function UserAvatar({ photoURL, displayName }: { photoURL: string | null; displayName: string | null }) {
  if (photoURL) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoURL}
        alt={displayName ?? ""}
        className="h-8 w-8 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
      <User className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

interface TopNavbarProps {
  locale: "bn" | "en";
}

export function TopNavbar({ locale }: TopNavbarProps) {
  const t = useTranslations();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await signOut(user);
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleSidebar}
          title={t("nav.menu")}
          className="hidden h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-50 lg:flex"
        >
          {sidebarCollapsed ? (
            <PanelLeft className="h-4.5 w-4.5" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-4.5 w-4.5" aria-hidden="true" />
          )}
        </button>
        <ConnectionStatus />
      </div>

      <div className="flex items-center gap-3">
        <LanguageToggle currentLocale={locale} />

        <NotificationBell />

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-neutral-50"
          >
            <UserAvatar photoURL={user?.photoURL ?? null} displayName={user?.displayName ?? null} />
            <span className="hidden text-sm font-medium text-neutral-700 sm:block">
              {user?.displayName ?? user?.email}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-neutral-200 bg-white py-1 shadow-md">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  router.push("/dashboard/profile");
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
              >
                <User className="h-4 w-4" aria-hidden="true" />
                {t("nav.profile")}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                {t("nav.logout")}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
