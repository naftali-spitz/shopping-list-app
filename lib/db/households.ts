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

function mapHousehold(row: HouseholdRow): UserHousehold {
  return {
    id: row.household_id,
    name: row.household_name,
    role: row.member_role,
  };
}

export async function getOrCreateCurrentHousehold() {
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
