import { homeBackendEnabled } from "@/lib/backend/selection";
import { homeMutation } from "@/lib/backend/home";
import { supabase } from "@/lib/supabase";

export type UserHousehold = {
  id: string;
  name: string;
  role: string;
};

type HouseholdRow = {
  household_id: string;
  household_name: string;
  member_role: string;
};

type InviteRow = {
  invite_token: string;
  household_name: string;
  expires_at: string;
};

function mapHousehold(row: HouseholdRow): UserHousehold {
  return {
    id: row.household_id,
    name: row.household_name,
    role: row.member_role,
  };
}

export async function getOrCreateCurrentHousehold() {
  if (homeBackendEnabled()) {
    const { households, error } = await listMyHouseholds();
    return { household: households[0] ?? null, error };
  }
  const { data, error } = await supabase.rpc("get_or_create_current_household");

  if (error || !data?.length) {
    return {
      household: null,
      error: error ?? new Error("No household returned"),
    };
  }

  return {
    household: mapHousehold(data[0] as HouseholdRow),
    error: null,
  };
}

export async function listMyHouseholds() {
  if (homeBackendEnabled()) {
    const result = await homeMutation(undefined, "household.list", {});
    const data = result.data as { households?: UserHousehold[] } | null;
    return { households: data?.households ?? [], error: result.error };
  }
  const { data, error } = await supabase.rpc("list_my_households");

  if (error) {
    return { households: [], error };
  }

  return {
    households: ((data ?? []) as HouseholdRow[]).map(mapHousehold),
    error: null,
  };
}

export async function createHousehold(name: string) {
  if (homeBackendEnabled()) {
    const result = await homeMutation(crypto.randomUUID(), "household.create", { name });
    const data = result.data as { record?: UserHousehold } | null;
    return { household: data?.record ?? null, error: result.error };
  }
  const { data, error } = await supabase.rpc("create_household", {
    p_name: name,
  });

  if (error || !data?.length) {
    return {
      household: null,
      error: error ?? new Error("No household returned"),
    };
  }

  return {
    household: mapHousehold(data[0] as HouseholdRow),
    error: null,
  };
}

export async function deleteHousehold(householdId: string) {
  if (homeBackendEnabled()) {
    const result = await homeMutation(householdId, "household.delete", {});
    return { error: result.error };
  }
  const { error } = await supabase.rpc("delete_household", {
    p_household_id: householdId,
  });

  return { error };
}

export async function createHouseholdInvite(householdId: string) {
  if (homeBackendEnabled()) {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(24)), byte => byte.toString(16).padStart(2, "0")).join("");
    const result = await homeMutation(householdId, "invite.create", { id: crypto.randomUUID(), token });
    const data = result.data as { record?: { token: string; householdName: string; expiresAt: string } } | null;
    return { invite: data?.record ?? null, error: result.error };
  }
  const { data, error } = await supabase.rpc("create_household_invite", {
    p_household_id: householdId,
  });

  if (error || !data?.length) {
    return {
      invite: null,
      error: error ?? new Error("No invite returned"),
    };
  }

  const invite = data[0] as InviteRow;

  return {
    invite: {
      token: invite.invite_token,
      householdName: invite.household_name,
      expiresAt: invite.expires_at,
    },
    error: null,
  };
}

export async function acceptHouseholdInvite(token: string) {
  if (homeBackendEnabled()) {
    const result = await homeMutation(undefined, "invite.accept", { token });
    const data = result.data as { record?: UserHousehold } | null;
    return { household: data?.record ?? null, error: result.error };
  }
  const { data, error } = await supabase.rpc("accept_household_invite", {
    p_token: token,
  });

  if (error || !data?.length) {
    return {
      household: null,
      error: error ?? new Error("No household returned"),
    };
  }

  return {
    household: mapHousehold(data[0] as HouseholdRow),
    error: null,
  };
}

export type HouseholdMember = { user_id: string; role: string };

export async function listHouseholdMembers(householdId: string) {
  if (!homeBackendEnabled()) return { members: [] as HouseholdMember[], error: new Error("Member management is available in experimental development mode.") };
  const result = await homeMutation(householdId, "household.members", {});
  const data = result.data as { members?: HouseholdMember[] } | null;
  return { members: data?.members ?? [], error: result.error };
}

export async function renameHousehold(householdId: string, name: string) {
  return homeMutation(householdId, "household.rename", { name: name.trim() });
}

export async function removeHouseholdMember(householdId: string, userId: string) {
  return homeMutation(householdId, "membership.remove", { user_id: userId });
}
