"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "./use-session";

export function useCurrentHousehold() {
  const { session } = useSession();
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!session?.user?.id) {
        setHouseholdId(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("household_members")
        .select("household_id")
        .eq("user_id", session.user.id)
        .single();

      if (error) {
        console.error("Failed to load household:", error);
      }
      
      setHouseholdId(data?.household_id || null);
      setLoading(false);
    }

    load();
  }, [session]);

  return { householdId, loading };
}
