"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  acceptHouseholdInvite,
  createHousehold as createHouseholdInDb,
  createHouseholdInvite,
  deleteHousehold as deleteHouseholdInDb,
  listMyHouseholds,
  UserHousehold,
} from "@/lib/db/households";
import { useSession } from "./use-session";

const ACTIVE_HOUSEHOLD_STORAGE_KEY = "futurecart.activeHouseholdId";

type UseCurrentHouseholdOptions = {
  onError?: (message: string) => void;
};

export function useCurrentHousehold(options: UseCurrentHouseholdOptions = {}) {
  const { onError } = options;
  const { session } = useSession();
  const [households, setHouseholds] = useState<UserHousehold[]>([]);
  const [currentHouseholdId, setCurrentHouseholdIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const setCurrentHouseholdId = useCallback((householdId: string) => {
    setCurrentHouseholdIdState(householdId);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACTIVE_HOUSEHOLD_STORAGE_KEY, householdId);
    }
  }, []);

  const clearCurrentHouseholdId = useCallback(() => {
    setCurrentHouseholdIdState(null);

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ACTIVE_HOUSEHOLD_STORAGE_KEY);
    }
  }, []);

  const refreshHouseholds = useCallback(async () => {
    if (!session?.user?.id) {
      setHouseholds([]);
      setCurrentHouseholdIdState(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { households: userHouseholds, error: listError } = await listMyHouseholds();

    if (listError) {
      console.error("Failed to load households:", listError);
      onError?.("טעינת רשימת הבתים נכשלה.");
      setLoading(false);
      return;
    }

    setHouseholds(userHouseholds);

    if (!userHouseholds.length) {
      clearCurrentHouseholdId();
      setLoading(false);
      return;
    }

    const storedHouseholdId =
      typeof window !== "undefined"
        ? window.localStorage.getItem(ACTIVE_HOUSEHOLD_STORAGE_KEY)
        : null;
    const nextCurrentHouseholdId =
      storedHouseholdId && userHouseholds.some((item) => item.id === storedHouseholdId)
        ? storedHouseholdId
        : userHouseholds[0].id;

    setCurrentHouseholdId(nextCurrentHouseholdId);
    setLoading(false);
  }, [clearCurrentHouseholdId, onError, session?.user?.id, setCurrentHouseholdId]);

  useEffect(() => {
    void refreshHouseholds();
  }, [refreshHouseholds]);

  const createHousehold = useCallback(
    async (name = "My household") => {
      const { household, error } = await createHouseholdInDb(name);

      if (error || !household) {
        console.error("Failed to create household:", error);
        onError?.("יצירת בית חדש נכשלה.");
        return null;
      }

      setHouseholds((prev) => [...prev, household]);
      setCurrentHouseholdId(household.id);
      return household;
    },
    [onError, setCurrentHouseholdId]
  );

  const deleteHousehold = useCallback(
    async (householdId: string) => {
      const { error } = await deleteHouseholdInDb(householdId);

      if (error) {
        console.error("Failed to delete household:", error);
        onError?.("מחיקת הבית נכשלה. רק בעל הבית יכול למחוק אותו.");
        return false;
      }

      let nextHouseholdId: string | null = null;

      setHouseholds((prev) => {
        const nextHouseholds = prev.filter((household) => household.id !== householdId);
        nextHouseholdId = nextHouseholds[0]?.id ?? null;
        return nextHouseholds;
      });

      if (nextHouseholdId) {
        setCurrentHouseholdId(nextHouseholdId);
      } else {
        clearCurrentHouseholdId();
      }

      await refreshHouseholds();
      return true;
    },
    [clearCurrentHouseholdId, onError, refreshHouseholds, setCurrentHouseholdId]
  );

  const createInviteLink = useCallback(
    async (householdId: string) => {
      const { invite, error } = await createHouseholdInvite(householdId);

      if (error || !invite) {
        console.error("Failed to create household invite:", error);
        onError?.("יצירת קישור ההזמנה נכשלה.");
        return null;
      }

      const origin = typeof window !== "undefined" ? window.location.origin : "";
      return `${origin}/?invite=${invite.token}`;
    },
    [onError]
  );

  const acceptInvite = useCallback(
    async (token: string) => {
      const { household, error } = await acceptHouseholdInvite(token);

      if (error || !household) {
        console.error("Failed to accept household invite:", error);
        onError?.("קישור ההזמנה לא תקין או שפג תוקפו.");
        return null;
      }

      setHouseholds((prev) => {
        const withoutDuplicate = prev.filter((item) => item.id !== household.id);
        return [...withoutDuplicate, household];
      });
      setCurrentHouseholdId(household.id);
      await refreshHouseholds();
      return household;
    },
    [onError, refreshHouseholds, setCurrentHouseholdId]
  );

  const currentHousehold = useMemo(
    () => households.find((household) => household.id === currentHouseholdId) ?? null,
    [currentHouseholdId, households]
  );

  return {
    acceptInvite,
    createHousehold,
    createInviteLink,
    currentHousehold,
    currentHouseholdId,
    deleteHousehold,
    householdId: currentHouseholdId,
    households,
    loading,
    refreshHouseholds,
    setCurrentHouseholdId,
  };
}
