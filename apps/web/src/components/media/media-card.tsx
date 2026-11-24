"use client";

import React from "react";
import Link from "next/link";
import { InstagramMedia } from "@/types/automation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Film, Image as ImageIcon, Layers, Plus } from "lucide-react";

interface MediaCardProps {
  media: InstagramMedia;
  onSelectForAutomation?: (media: InstagramMedia) => void;
  isSelected?: boolean;
}

export function MediaCard({
  media,
  onSelectForAutomation,
  isSelected,
}: MediaCardProps) {
  const isReel = media.media_product_type === "REELS" || media.media_type === "VIDEO";
  const isCarousel = media.media_type === "CAROUSEL_ALBUM";
  const displayImage = media.thumbnail_url || media.media_url;

  const typeBadge = isReel ? (
    <Badge variant="purple" className="flex items-center gap-1 text-[10px]">
      <Film className="h-3 w-3" /> Reel
    </Badge>
  ) : isCarousel ? (
    <Badge variant="blue" className="flex items-center gap-1 text-[10px]">
      <Layers className="h-3 w-3" /> Carousel
    </Badge>
  ) : (
    <Badge variant="gray" className="flex items-center gap-1 text-[10px]">
      <ImageIcon className="h-3 w-3" /> Photo
    </Badge>
  );

  const formattedDate = new Date(media.timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const automationUrl = `/automations/new?mediaId=${encodeURIComponent(
    media.id
  )}&permalink=${encodeURIComponent(media.permalink || "")}&mediaType=${
    isReel ? "REELS" : media.media_type
  }`;

  return (
    <div
      className={`group relative flex flex-col rounded-xl border bg-white overflow-hidden transition-all duration-200 hover:shadow-md ${
        isSelected
          ? "border-indigo-600 ring-2 ring-indigo-500/20"
          : "border-zinc-200/80 hover:border-zinc-300"
      }`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-square w-full bg-zinc-100 overflow-hidden">
        {displayImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={displayImage}
            alt={media.caption || "Instagram media"}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-400">
            {isReel ? <Film className="h-8 w-8" /> : <ImageIcon className="h-8 w-8" />}
          </div>
        )}

        {/* Type Badge */}
        <div className="absolute top-2.5 left-2.5 z-10">{typeBadge}</div>

        {/* External Link */}
        {media.permalink && (
          <a
            href={media.permalink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View on Instagram"
            className="absolute top-2.5 right-2.5 z-10 rounded-md bg-black/60 p-1.5 text-white backdrop-blur-xs opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-3.5">
        <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5">
          <span>{formattedDate}</span>
          <span className="font-mono text-[10px]">ID: {media.id.slice(-6)}</span>
        </div>

        <p className="line-clamp-2 text-xs text-zinc-700 font-normal leading-relaxed mb-3 flex-1">
          {media.caption || <span className="italic text-zinc-400">No caption</span>}
        </p>

        {/* Action Button */}
        {onSelectForAutomation ? (
          <Button
            type="button"
            size="sm"
            variant={isSelected ? "primary" : "secondary"}
            className="w-full text-xs font-medium justify-center"
            onClick={() => onSelectForAutomation(media)}
          >
            {isSelected ? "Selected" : "Select Post"}
          </Button>
        ) : (
          <Link href={automationUrl} className="w-full">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-full text-xs font-medium justify-center gap-1.5 group-hover:border-indigo-200 group-hover:bg-indigo-50/50 group-hover:text-indigo-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Automate Post
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
