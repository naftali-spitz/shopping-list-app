"use client";
import { useEffect, useState } from "react";
import { listHouseholdMembers, removeHouseholdMember, renameHousehold, type HouseholdMember, type UserHousehold } from "@/lib/db/households";

export function HouseholdManagement({ household, hebrew }: { household: UserHousehold; hebrew: boolean }) {
  const [name, setName] = useState(household.name);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void listHouseholdMembers(household.id).then(result => {
      if (!cancelled) {
        setMembers(result.members);
        if (result.error) setMessage(hebrew ? "טעינת המשתמשים נכשלה." : "Could not load members.");
      }
    });
    return () => { cancelled = true; };
  }, [household.id, hebrew]);
  async function rename() {
    setBusy(true); setMessage("");
    const result = await renameHousehold(household.id, name);
    setBusy(false);
    if (result.error) setMessage(hebrew ? "שמירת השם נכשלה. נסה לרענן." : "Could not save the name. Refresh to reconcile.");
    else window.location.reload();
  }
  async function remove(member: HouseholdMember) {
    setBusy(true); setMessage("");
    const result = await removeHouseholdMember(household.id, member.user_id);
    setBusy(false);
    if (result.error) setMessage(hebrew ? "הסרת המשתמש נכשלה." : "Could not remove member.");
    else setMembers(previous => previous.filter(item => item.user_id !== member.user_id));
  }
  return <section className="mt-3 space-y-3 rounded-2xl border border-white/10 p-3">
    {household.role === "owner" ? <div className="flex gap-2">
      <label className="min-w-0 flex-1 text-xs">{hebrew ? "שם הרשימה" : "List name"}<input aria-label="List name" maxLength={120} value={name} onChange={event => setName(event.target.value)} className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 p-2 text-sm" /></label>
      <button type="button" disabled={busy || !name.trim() || name.trim() === household.name} onClick={() => void rename()} className="self-end rounded-xl bg-cyan-300/15 p-2 text-sm disabled:opacity-40">{hebrew ? "שמירה" : "Save name"}</button>
    </div> : null}
    <h3 className="text-sm font-medium">{hebrew ? "משתמשים ברשימה" : "List members"}</h3>
    <ul className="space-y-2">{members.map(member => <li key={member.user_id} className="flex items-center justify-between gap-2 text-xs"><span dir="ltr" title={member.user_id}>{member.user_id.slice(0, 8)} · {member.role}</span>{household.role === "owner" && member.role !== "owner" ? <button disabled={busy} onClick={() => void remove(member)} className="rounded-lg bg-red-400/10 px-2 py-1">{hebrew ? "הסרה" : "Remove member"}</button> : null}</li>)}</ul>
    {message ? <p role="alert" className="text-xs text-red-200">{message}</p> : null}
  </section>;
}
