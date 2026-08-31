"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLang } from "@/lib/i18n";

// Backward-compatible redirect: /table/5 → /menu?table=5
export default function TableRedirect() {
  const params = useParams();
  const router = useRouter();
  const [lang] = useLang();

  useEffect(() => {
    router.replace(`/menu?table=${params.id}`);
  }, [params.id, router]);

  return (
    <div className="tm-root min-h-screen flex items-center justify-center text-sm font-bold text-[#a98c5f]">
      {lang === "am" ? "የጠረጴዛዎ ምናሌ በመከፈት ላይ…" : "Opening your table menu..."}
    </div>
  );
}
