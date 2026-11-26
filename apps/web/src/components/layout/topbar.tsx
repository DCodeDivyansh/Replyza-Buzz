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
  ShoppingBag,
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
  { name: "Product Library", href: "/products", icon: ShoppingBag },
  { name: "Media Library", href: "/media", icon: Images },
  { name: "Templates", href: "/templates", icon: LayoutTemplate },
  { name: "Activity", href: "/activity", icon: Activity },
  { name: "Instagram", href: "/instagram", icon: InstagramIcon },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Topbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const getSectionTitle = () => {
    if (pathname.startsWith("/automations/new")) return "New Automation";
    if (pathname.startsWith("/automations/") && pathname.endsWith("/edit"))
      return "Edit Automation";
    if (pathname.startsWith("/automations/")) return "Automation Details";
    if (pathname.startsWith("/automations")) return "Automations";
    if (pathname.startsWith("/products")) return "Product Library";
    if (pathname.startsWith("/media")) return "Media Library";
    if (pathname.startsWith("/templates")) return "Templates";
    if (pathname.startsWith("/instagram")) return "Instagram Accounts";
    if (pathname.startsWith("/activity")) return "Activity";
    if (pathname.startsWith("/settings")) return "Settings";
    return "Overview";
  };

  return (
    <>
      <header className="h-14 border-b border-[#E6E5E1] bg-[#FFFFFF] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-1.5 text-[#141413] rounded-lg hover:bg-[#F3F2EE] cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2 text-xs text-[#8C8A84] min-w-0">
            <Link
              href="/dashboard"
              className="hidden sm:inline hover:text-[#141413] transition-colors"
            >
              Workspace
            </Link>
            <ChevronRight className="hidden sm:inline h-3.5 w-3.5 shrink-0" />
            <h1 className="font-display text-sm font-semibold text-[#141413] truncate">
              {getSectionTitle()}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/automations/new">
            <Button size="sm" variant="accent">
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
            className="fixed inset-0 bg-[#141413]/35"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-64 max-w-[82%] bg-[#FAF9F6] border-r border-[#E6E5E1] flex flex-col h-full z-10">
            <div className="h-14 flex items-center justify-between px-4 border-b border-[#E6E5E1]">
              <ReplyzaLogo size="sm" />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-1.5 text-[#5C5B57] hover:text-[#141413] rounded-lg"
                aria-label="Close navigation menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

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
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      isActive
                        ? "bg-[#FFFFFF] text-[#141413] font-semibold border border-[#E6E5E1]"
                        : "text-[#5C5B57] hover:text-[#141413] hover:bg-[#F3F2EE]"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isActive ? "text-[#D94E28]" : "text-[#8C8A84]"
                      )}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            <div className="p-3 border-t border-[#E6E5E1]">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#FFFFFF] border border-[#E6E5E1]">
                <span className="text-xs font-medium text-[#141413] truncate mr-2">
                  {user?.email || "Account"}
                </span>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="p-1.5 text-[#8C8A84] hover:text-[#C81E1E] rounded-md"
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
