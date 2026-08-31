"use client";

import { Suspense } from "react";
import CustomerMenuApp from "@/components/rms/CustomerMenuApp";

export default function CustomerMenuPage() {
  return (
    <Suspense
      fallback={
        <div className="tm-root min-h-screen flex items-center justify-center text-sm font-bold text-[#a98c5f]">
          <span className="tm-seal mx-auto h-12 w-12 animate-pulse" />
        </div>
      }
    >
      <CustomerMenuApp />
    </Suspense>
  );
}
