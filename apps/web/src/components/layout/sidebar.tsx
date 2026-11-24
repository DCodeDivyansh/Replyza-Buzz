"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { ReplyzaLogo } from "@/components/brand/replyza-logo";
import {
  LayoutDashboard,
  Bot,
  Images,
  LayoutTemplate,
  Activity,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { InstagramIcon } from "@/components/ui/icons";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Automations", href: "/automations", icon: Bot },
  { name: "Media Library", href: "/media", icon: Images },
  { name: "Templates", href: "/templates", icon: LayoutTemplate },
  { name: "Activity", href: "/activity", icon: Activity },
  { name: "Instagram Accounts", href: "/instagram", icon: InstagramIcon },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-[#17131D]/8 bg-[#FFFDFB] select-none transition-all duration-200",
        collapsed ? "w-[74px]" : "w-64",
        className
      )}
    >
      {/* Brand Header */}
      <div
        className={cn(
          "h-16 flex items-center border-b border-[#17131D]/6",
          collapsed ? "justify-center px-2" : "justify-between px-5"
        )}
      >
        <Link href="/dashboard" className="min-w-0">
          <ReplyzaLogo size="sm" showWordmark={!collapsed} />
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="p-1.5 rounded-lg text-[#827D87] hover:text-[#17131D] hover:bg-[#F8F5F8] transition-colors cursor-pointer"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <div className="flex justify-center pt-3">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="p-1.5 rounded-lg text-[#827D87] hover:text-[#17131D] hover:bg-[#F8F5F8] transition-colors cursor-pointer"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Navigation */}
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
              title={collapsed ? item.name : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all",
                collapsed && "justify-center px-2",
                isActive
                  ? "bg-[#17131D] text-[#FFFDFB] font-semibold shadow-2xs"
                  : "text-[#827D87] hover:text-[#17131D] hover:bg-[#F8F5F8]"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive ? "text-[#FCAF45]" : "text-[#827D87]"
                )}
              />
              {!collapsed && <span className="truncate">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User profile & logout footer */}
      <div className="p-3 border-t border-[#17131D]/6">
        <div
          className={cn(
            "flex items-center p-2.5 rounded-2xl bg-[#F8F5F8] border border-[#17131D]/6",
            collapsed ? "justify-center flex-col gap-2" : "justify-between gap-2"
          )}
        >
          {!collapsed && (
            <Link href="/settings" className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#17131D] truncate">
                {user?.email || "User"}
              </p>
              <p className="text-[10px] text-[#827D87] truncate">
                Workspace Settings
              </p>
            </Link>
          )}
          <button
            type="button"
            onClick={() => logout()}
            className="p-1.5 text-[#827D87] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
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
