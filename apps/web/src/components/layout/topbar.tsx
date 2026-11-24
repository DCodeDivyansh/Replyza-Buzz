"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Plus,
  Menu,
  X,
  LayoutDashboard,
  Bot,
  Images,
  LayoutTemplate,
  Activity,
  Settings,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReplyzaLogo } from "@/components/brand/replyza-logo";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { InstagramIcon } from "@/components/ui/icons";

const NAV_ITEMS = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Automations", href: "/automations", icon: Bot },
  { name: "Media Library", href: "/media", icon: Images },
  { name: "Templates", href: "/templates", icon: LayoutTemplate },
  { name: "Activity", href: "/activity", icon: Activity },
  { name: "Instagram Accounts", href: "/instagram", icon: InstagramIcon },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Topbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const getSectionTitle = () => {
    if (pathname.startsWith("/automations/new")) return "Create Automation";
    if (pathname.startsWith("/automations/") && pathname.endsWith("/edit"))
      return "Edit Automation";
    if (pathname.startsWith("/automations/")) return "Automation Details";
    if (pathname.startsWith("/automations")) return "Automations";
    if (pathname.startsWith("/media")) return "Media Library";
    if (pathname.startsWith("/templates")) return "Templates";
    if (pathname.startsWith("/instagram")) return "Instagram Accounts";
    if (pathname.startsWith("/activity")) return "Activity Center";
    if (pathname.startsWith("/settings")) return "Settings";
    return "Overview";
  };

  return (
    <>
      <header className="h-16 border-b border-[#17131D]/8 bg-[#FFFDFB]/90 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 text-[#17131D] rounded-xl hover:bg-[#F8F5F8] cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2 text-xs text-[#827D87] min-w-0">
            <Link
              href="/dashboard"
              className="hidden sm:inline hover:text-[#17131D] transition-colors"
            >
              Replyza
            </Link>
            <ChevronRight className="hidden sm:inline h-3.5 w-3.5 shrink-0" />
            <h1 className="font-display text-sm sm:text-base font-semibold text-[#17131D] truncate">
              {getSectionTitle()}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/automations/new">
            <Button size="sm" variant="gradient" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New Automation</span>
            </Button>
          </Link>
        </div>
      </header>

      {/* Mobile navigation drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-[#17131D]/40 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-72 max-w-[82%] bg-[#FFFDFB] flex flex-col h-full shadow-2xl z-10">
            <div className="h-16 flex items-center justify-between px-5 border-b border-[#17131D]/6">
              <ReplyzaLogo size="sm" />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-1.5 text-[#827D87] hover:text-[#17131D] rounded-lg"
                aria-label="Close navigation menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors",
                      isActive
                        ? "bg-[#17131D] text-[#FFFDFB] font-semibold"
                        : "text-[#827D87] hover:text-[#17131D] hover:bg-[#F8F5F8]"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isActive ? "text-[#FCAF45]" : "text-[#827D87]"
                      )}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            <div className="p-3 border-t border-[#17131D]/6">
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#F8F5F8]">
                <span className="text-xs font-medium text-[#17131D] truncate mr-2">
                  {user?.email || "User"}
                </span>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="p-1.5 text-[#827D87] hover:text-red-600 rounded-lg"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
