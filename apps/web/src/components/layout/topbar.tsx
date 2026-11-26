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
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { InstagramIcon } from "@/components/ui/icons";

const NAV_ITEMS = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Automations", href: "/automations", icon: Bot },
  { name: "Media", href: "/media", icon: Images },
  { name: "Products", href: "/products", icon: ShoppingBag },
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
    if (pathname.startsWith("/products")) return "Products";
    if (pathname.startsWith("/media")) return "Media";
    if (pathname.startsWith("/templates")) return "Templates";
    if (pathname.startsWith("/instagram")) return "Instagram";
    if (pathname.startsWith("/activity")) return "Activity";
    if (pathname.startsWith("/settings")) return "Settings";
    return "Overview";
  };

  return (
    <>
      <header className="h-16 border-b border-[#E6DFD8] bg-[#F7F1EC]/90 backdrop-blur-md px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="lg:hidden h-10 w-10 rounded-xl border border-[#E6DFD8] bg-[#FFFFFF] flex items-center justify-center text-[#161413] hover:bg-[#F2EBE4] cursor-pointer shrink-0"
            aria-label="Open navigation menu"
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2 text-xs text-[#6E655F] min-w-0">
            <Link
              href="/dashboard"
              className="hidden sm:inline font-medium hover:text-[#161413] transition-colors"
            >
              Dashboard
            </Link>
            <ChevronRight className="hidden sm:inline h-3.5 w-3.5 shrink-0 text-[#6E655F]" />
            <h1 className="font-display text-sm sm:text-base font-bold text-[#161413] truncate">
              {getSectionTitle()}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/automations/new"
            className="group inline-flex items-center gap-2 rounded-full bg-[#161413] pl-3.5 pr-1.5 py-1.5 text-xs font-semibold text-[#F7F1EC] hover:bg-[#2A2624] transition-colors whitespace-nowrap"
          >
            <span className="hidden sm:inline">New Automation</span>
            <span className="sm:hidden">New</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E1306C] text-white transition-transform duration-300 group-hover:rotate-90">
              <Plus className="h-3.5 w-3.5" />
            </span>
          </Link>

          <Link
            href="/settings"
            className="hidden md:flex h-8 w-8 rounded-full bg-[#FFFFFF] border border-[#E6DFD8] items-center justify-center text-xs font-bold text-[#161413] hover:border-[#E1306C] transition-colors"
            title={user?.email || "Account Settings"}
          >
            {(user?.email?.[0] || "R").toUpperCase()}
          </Link>
        </div>
      </header>

      {/* Mobile & Tablet Navigation Drawer (< 1024px) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#161413]/40 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-72 max-w-[82%] bg-[#F7F1EC] border-r border-[#E6DFD8] flex flex-col h-full z-10">
            <div className="h-16 flex items-center justify-between px-5 border-b border-[#E6DFD8]">
              <span className="font-editorial text-2xl text-[#E1306C] uppercase">
                Replyza Buzz
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-2 text-[#6E655F] hover:text-[#161413] rounded-xl bg-[#FFFFFF] border border-[#E6DFD8]"
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
                      "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors",
                      isActive
                        ? "bg-[#FFFFFF] text-[#161413] font-semibold border border-[#E6DFD8]"
                        : "text-[#6E655F] hover:text-[#161413] hover:bg-[#F2EBE4]"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isActive ? "text-[#E1306C]" : "text-[#6E655F]"
                      )}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            <div className="p-3.5 border-t border-[#E6DFD8]">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-[#FFFFFF] border border-[#E6DFD8]">
                <span className="text-xs font-semibold text-[#161413] truncate mr-2">
                  {user?.email || "Account"}
                </span>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="p-1.5 text-[#6E655F] hover:text-[#E1306C] rounded-lg"
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
