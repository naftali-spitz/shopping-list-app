"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Home,
  Link,
  LogOut,
  Mail,
  Menu,
  Moon,
  Plus,
  Sun,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { UserHousehold } from "@/lib/db/households";

type ProfileSettingsModalProps = {
  open: boolean;
  email?: string | null;
  darkMode: boolean;
  soundOn: boolean;
  households: UserHousehold[];
  currentHouseholdId: string | null;
  onClose: () => void;
  onToggleTheme: () => void;
  onToggleSound: () => void;
  onSwitchHousehold: (householdId: string) => void;
  onCreateHousehold: () => void;
  onCreateInviteLink: () => void;
  onLogout: () => void;
};

export function ProfileSettingsModal({
  open,
  email,
  darkMode,
  soundOn,
  households,
  currentHouseholdId,
  onClose,
  onToggleTheme,
  onToggleSound,
  onSwitchHousehold,
  onCreateHousehold,
  onCreateInviteLink,
  onLogout,
}: ProfileSettingsModalProps) {
  const currentHousehold =
    households.find((household) => household.id === currentHouseholdId) ?? null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-md sm:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 80, scale: 1 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 80, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[32px] border border-white/10 bg-[#0b1020]/95 p-6 text-white shadow-2xl backdrop-blur-2xl sm:rounded-[32px] sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-white/20 sm:hidden" />

            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-300">
                  <Menu size={22} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Profile</h2>
                  <p className="mt-1 text-sm text-white/50">Settings and account</p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="rounded-2xl bg-white/10 p-3 transition hover:bg-white/20"
                aria-label="Close profile settings"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white/70">
                  <Mail size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40">Signed in as</p>
                  <p className="truncate text-sm font-medium text-white/85">
                    {email || "Unknown user"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-3xl border border-cyan-300/15 bg-cyan-300/5 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-200">
                    <Home size={18} />
                  </span>
                  <span>
                    <span className="block font-medium">Household</span>
                    <span className="text-sm text-white/45">Switch shopping space</span>
                  </span>
                </span>
              </div>

              <div className="space-y-2">
                {households.map((household) => {
                  const active = household.id === currentHouseholdId;

                  return (
                    <button
                      key={household.id}
                      onClick={() => onSwitchHousehold(household.id)}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-50"
                          : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{household.name}</span>
                        <span className="text-xs text-white/45">{household.role}</span>
                      </span>
                      {active && <Check size={18} />}
                    </button>
                  );
                })}

                <button
                  onClick={onCreateInviteLink}
                  disabled={!currentHousehold}
                  className="flex w-full items-center justify-between rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-left text-cyan-50 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>
                    <span className="block font-medium">Invite to household</span>
                    <span className="text-xs text-white/45">
                      Copy a link for family or friends
                    </span>
                  </span>
                  <Link size={18} />
                </button>

                <button
                  onClick={onCreateHousehold}
                  className="flex w-full items-center justify-between rounded-2xl border border-dashed border-white/20 bg-white/[0.03] px-4 py-3 text-left text-white/75 transition hover:bg-white/10"
                >
                  <span>
                    <span className="block font-medium">Create new household</span>
                    <span className="text-xs text-white/45">Start a separate list</span>
                  </span>
                  <Plus size={18} />
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <button
                onClick={onToggleTheme}
                className="flex w-full items-center justify-between rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-left transition hover:bg-white/10"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white/70">
                    {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                  </span>
                  <span>
                    <span className="block font-medium">Theme</span>
                    <span className="text-sm text-white/45">
                      {darkMode ? "Dark mode" : "Light mode"}
                    </span>
                  </span>
                </span>
                <span className="text-sm text-white/45">Tap to change</span>
              </button>

              <button
                onClick={onToggleSound}
                className="flex w-full items-center justify-between rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-left transition hover:bg-white/10"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white/70">
                    {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
                  </span>
                  <span>
                    <span className="block font-medium">Sound</span>
                    <span className="text-sm text-white/45">
                      {soundOn ? "Enabled" : "Disabled"}
                    </span>
                  </span>
                </span>
                <span
                  className={`relative h-7 w-12 rounded-full transition ${
                    soundOn ? "bg-cyan-400" : "bg-white/15"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                      soundOn ? "right-1" : "right-6"
                    }`}
                  />
                </span>
              </button>

              <button
                onClick={onLogout}
                className="flex w-full items-center justify-between rounded-3xl border border-red-400/20 bg-red-400/10 px-4 py-4 text-left text-red-100 transition hover:bg-red-400/20"
              >
                <span>
                  <span className="block font-medium">Logout</span>
                  <span className="text-sm text-red-100/60">Sign out of this account</span>
                </span>
                <LogOut size={20} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
