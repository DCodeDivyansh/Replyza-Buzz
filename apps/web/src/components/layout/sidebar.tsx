"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Bot,
  Images,
  LayoutTemplate,
  Activity,
  Settings,
  LogOut,
  Sparkles,
} from "lucide-react";
import { InstagramIcon } from "@/components/ui/icons";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Automations", href: "/automations", icon: Bot },
  { name: "Media Library", href: "/media", icon: Images },
  { name: "Templates", href: "/templates", icon: LayoutTemplate },
  { name: "Instagram", href: "/instagram", icon: InstagramIcon },
  { name: "Activity", href: "/activity", icon: Activity },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside
      className={cn(
        "flex flex-col w-64 border-r border-zinc-200/80 bg-white select-none",
        className
      )}
    >
      {/* Brand */}
      <div className="h-16 flex items-center px-6 border-b border-zinc-100 gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <span className="text-base font-bold tracking-tight text-zinc-900">
            Replyza
          </span>
          <span className="ml-2 text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
            SaaS
          </span>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                isActive
                  ? "bg-indigo-50/80 text-indigo-700 font-semibold"
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

      {/* User profile & logout footer */}
      <div className="p-3 border-t border-zinc-100">
        <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50/70 border border-zinc-100">
          <div className="min-w-0 flex-1 mr-2">
            <p className="text-xs font-semibold text-zinc-800 truncate">
              {user?.email || "User"}
            </p>
            <p className="text-[10px] text-zinc-400 truncate">Account Active</p>
          </div>
          <button
            onClick={() => logout()}
            className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
