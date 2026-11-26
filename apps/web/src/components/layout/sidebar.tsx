"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/api-client";
import { InstagramAccountInfo } from "@/types/automation";
import { cn } from "@/lib/utils";
import { ReplyzaLogo } from "@/components/brand/replyza-logo";
import {
  LayoutDashboard,
  Bot,
  Images,
  ShoppingBag,
  LayoutTemplate,
  Activity,
  Settings,
  LogOut,
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
  { name: "Product Library", href: "/products", icon: ShoppingBag },
  { name: "Media Library", href: "/media", icon: Images },
  { name: "Templates", href: "/templates", icon: LayoutTemplate },
  { name: "Activity", href: "/activity", icon: Activity },
  { name: "Instagram", href: "/instagram", icon: InstagramIcon },
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
        "w-60 flex flex-col border-r border-[#E6E5E1] bg-[#FAF9F6] select-none shrink-0",
        className
      )}
    >
      {/* Brand Header */}
      <div className="h-14 flex items-center px-5 border-b border-[#E6E5E1]">
        <Link href="/dashboard" className="min-w-0">
          <ReplyzaLogo size="sm" />
        </Link>
      </div>

      {/* Connected IG Account Status Pill */}
      <div className="px-3 pt-3">
        <Link
          href="/instagram"
          className="flex items-center justify-between gap-2 rounded-lg border border-[#E6E5E1] bg-[#FFFFFF] px-3 py-2 text-xs hover:border-[#D1CFC9] transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cn(
                "h-2 w-2 rounded-full shrink-0",
                !primaryAccount
                  ? "bg-[#8C8A84]"
                  : needsReconnect
                  ? "bg-[#D94E28]"
                  : "bg-[#0D7A5F]"
              )}
            />
            <span className="truncate font-medium text-[#141413]">
              {primaryAccount
                ? `@${primaryAccount.username || primaryAccount.instagramUserId}`
                : "Connect Instagram"}
            </span>
          </div>
          <span className="font-mono-num text-[10px] text-[#5C5B57] shrink-0">
            {!primaryAccount ? "Setup" : needsReconnect ? "Fix" : "Live"}
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
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
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                isActive
                  ? "bg-[#FFFFFF] text-[#141413] font-semibold border border-[#E6E5E1]"
                  : "text-[#5C5B57] hover:text-[#141413] hover:bg-[#F3F2EE] border border-transparent"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive ? "text-[#D94E28]" : "text-[#8C8A84]"
                )}
              />
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="p-3 border-t border-[#E6E5E1]">
        <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-[#FFFFFF] border border-[#E6E5E1]">
          <Link href="/settings" className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[#141413] truncate">
              {user?.email || "Account"}
            </p>
            <p className="text-[10px] text-[#8C8A84] truncate">Workspace</p>
          </Link>
          <button
            type="button"
            onClick={() => logout()}
            className="p-1.5 text-[#8C8A84] hover:text-[#C81E1E] hover:bg-red-50 rounded-md transition-colors cursor-pointer"
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
