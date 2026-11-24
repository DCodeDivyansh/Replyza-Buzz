"use client";

import React from "react";
import { MediaGrid } from "@/components/media/media-grid";
import { Images } from "lucide-react";

export default function MediaLibraryPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Images className="h-4 w-4" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">
            Instagram Media Library
          </h1>
        </div>
        <p className="text-xs text-zinc-500">
          Browse your connected Instagram feed and reels. Select any post to launch a comment-to-DM automation with one click.
        </p>
      </div>

      {/* Media Grid */}
      <MediaGrid />
    </div>
  );
}
