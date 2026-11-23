"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Menu, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Bot,
  Activity,
  Settings,
  LogOut,
} from "lucide-react";
import { InstagramIcon } from "@/components/ui/icons";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Automations", href: "/automations", icon: Bot },
  { name: "Instagram", href: "/instagram", icon: InstagramIcon },
  { name: "Activity", href: "/activity", icon: Activity },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Topbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const getSectionTitle = () => {
    if (pathname.startsWith("/automations/new")) return "Create Automation";
    if (pathname.startsWith("/automations/") && pathname.endsWith("/edit")) return "Edit Automation";
    if (pathname.startsWith("/automations/")) return "Automation Details";
    if (pathname.startsWith("/automations")) return "Automations";
    if (pathname.startsWith("/instagram")) return "Instagram Connection";
    if (pathname.startsWith("/activity")) return "Activity Logs";
    if (pathname.startsWith("/settings")) return "Settings";
    return "Dashboard";
  };

  return (
    <>
      <header className="h-16 border-b border-zinc-200/80 bg-white/95 backdrop-blur-xs px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 text-zinc-600 hover:text-zinc-900 rounded-lg hover:bg-zinc-100"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-sm sm:text-base font-semibold text-zinc-900">
            {getSectionTitle()}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/automations/new">
            <Button size="sm" className="gap-1.5 shadow-xs">
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New Automation</span>
            </Button>
          </Link>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-72 max-w-[80%] bg-white flex flex-col h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            <div className="h-16 flex items-center justify-between px-6 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <span className="font-bold text-sm text-zinc-900">Replyza</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded-lg"
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
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors",
                      isActive
                        ? "bg-indigo-50 text-indigo-700 font-semibold"
                        : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isActive ? "text-indigo-600" : "text-zinc-400"
                      )}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-zinc-100">
              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 border border-zinc-100">
                <div className="min-w-0 flex-1 mr-2">
                  <p className="text-xs font-semibold text-zinc-800 truncate">
                    {user?.email || "User"}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    logout();
                  }}
                  className="p-1.5 text-zinc-400 hover:text-red-600 rounded-md"
                  title="Sign out"
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
