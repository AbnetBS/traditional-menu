"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

// Backward-compatible redirect: /table/5 → /menu?table=5
export default function TableRedirect() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/menu?table=${params.id}`);
  }, [params.id, router]);

  return (
    <div className="tm-root min-h-screen flex items-center justify-center text-sm font-bold text-[#a98c5f]">
      Opening your table menu...
    </div>
  );
}
