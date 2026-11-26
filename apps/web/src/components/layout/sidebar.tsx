"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/api-client";
import { InstagramAccountInfo } from "@/types/automation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Bot,
  Images,
  ShoppingBag,
  LayoutTemplate,
  Activity,
  Settings,
  LogOut,
  AlertCircle,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Automations", href: "/automations", icon: Bot },
  { name: "Media", href: "/media", icon: Images },
  { name: "Products", href: "/products", icon: ShoppingBag },
  { name: "Templates", href: "/templates", icon: LayoutTemplate },
  { name: "Activity", href: "/activity", icon: Activity },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [accounts, setAccounts] = useState<InstagramAccountInfo[]>([]);

  useEffect(() => {
    let ignore = false;
    apiRequest<InstagramAccountInfo[]>("/instagram/accounts")
      .then((res) => {
        if (!ignore && res.data) {
          setAccounts(res.data);
        }
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  const primaryAccount = accounts[0];
  const needsReconnect = primaryAccount?.status === "NEEDS_RECONNECT";

  return (
    <aside
      className={cn(
        "w-[250px] flex flex-col border-r border-[#E6DFD8] bg-[#F7F1EC] select-none shrink-0",
        className
      )}
    >
      {/* Brand Wordmark */}
      <div className="h-16 flex items-center px-5 border-b border-[#E6DFD8]">
        <Link
          href="/dashboard"
          className="font-editorial text-2xl tracking-tight text-[#E1306C] uppercase select-none"
        >
          Replyza Buzz
        </Link>
      </div>

      {/* Connected Account Card */}
      <div className="px-3.5 pt-4 pb-2">
        <Link
          href="/instagram"
          className="block rounded-2xl border border-[#E6DFD8] bg-[#FFFFFF] p-3 hover:border-[#D5CCC3] transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-[#161413] truncate">
              {primaryAccount
                ? `@${primaryAccount.username || primaryAccount.instagramUserId}`
                : "No Account Linked"}
            </span>
            {needsReconnect && (
              <AlertCircle className="h-3.5 w-3.5 text-[#F77737] shrink-0" />
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span
              className={cn(
                "h-2 w-2 rounded-full shrink-0",
                !primaryAccount
                  ? "bg-[#F77737]"
                  : needsReconnect
                  ? "bg-[#E1306C]"
                  : "bg-[#0D7A5F]"
              )}
            />
            <span className="font-mono-num text-[10px] font-medium text-[#6E655F] truncate">
              {!primaryAccount
                ? "Connect Instagram"
                : needsReconnect
                ? "Reconnect Required"
                : "Meta Graph API Connected"}
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation Links with layoutId spring pill */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
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
                "relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors",
                isActive
                  ? "text-[#161413] font-semibold"
                  : "text-[#6E655F] hover:text-[#161413] hover:bg-[#F2EBE4]"
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="sidebar-active-pill"
                  transition={{ type: "spring", stiffness: 360, damping: 30 }}
                  className="absolute inset-0 rounded-xl bg-[#FFFFFF] border border-[#E6DFD8]"
                />
              )}
              <Icon
                className={cn(
                  "relative z-10 h-4 w-4 shrink-0",
                  isActive ? "text-[#E1306C]" : "text-[#6E655F]"
                )}
              />
              <span className="relative z-10 truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="p-3.5 border-t border-[#E6DFD8]">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-2xl bg-[#FFFFFF] border border-[#E6DFD8]">
          <Link href="/settings" className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#161413] truncate">
              {user?.email || "Account"}
            </p>
            <p className="font-mono-num text-[10px] text-[#6E655F] truncate">
              Creator Workspace
            </p>
          </Link>
          <button
            type="button"
            onClick={() => logout()}
            className="p-1.5 text-[#6E655F] hover:text-[#E1306C] hover:bg-[#FCE8EC] rounded-lg transition-colors cursor-pointer"
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
