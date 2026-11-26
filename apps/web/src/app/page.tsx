"use client";

import React from "react";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingHero } from "@/components/landing/hero";
import { LandingManifesto } from "@/components/landing/manifesto";
import { FeatureShowcase } from "@/components/landing/feature-showcase";
import { WorkflowPath } from "@/components/landing/workflow-path";
import { LandingTestimonials } from "@/components/landing/testimonials";
import { LandingFaq } from "@/components/landing/faq";
import { LandingFooter } from "@/components/landing/footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F7F1EC] text-[#161413] overflow-x-hidden">
      <div className="bg-[#FCE8EC]">
        <LandingNavbar />
        <LandingHero />
      </div>
      <main className="flex-1">
        <LandingManifesto />
        <FeatureShowcase />
        <WorkflowPath />
        <LandingTestimonials />
        <LandingFaq />
      </main>
      <LandingFooter />
    </div>
  );
}
