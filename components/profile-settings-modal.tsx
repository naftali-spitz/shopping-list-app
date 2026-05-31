"use client";

import { ReactNode, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  Home,
  Link,
  LogOut,
  Mail,
  Menu,
  Moon,
  Plus,
  Settings,
  Sun,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";
import { useCurrentHousehold } from "@/hooks/useCurrentHousehold";
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

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10 text-cyan-200">
        {icon}
      </span>
      <span>
        <span className="block text-sm font-semibold text-white/90">{title}</span>
        {subtitle && <span className="text-xs text-white/45">{subtitle}</span>}
      </span>
    </div>
  );
}

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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [householdExpanded, setHouseholdExpanded] = useState(true);
  const { deleteHousehold } = useCurrentHousehold();
  const currentHousehold =
    households.find((household) => household.id === currentHouseholdId) ?? null;
  const canDeleteCurrentHousehold = currentHousehold?.role === "owner";
  const otherHouseholds = households.filter(
    (household) => household.id !== currentHouseholdId
  );

  const confirmDeleteHousehold = async () => {
    if (!currentHousehold || !canDeleteCurrentHousehold) return;

    const deleted = await deleteHousehold(currentHousehold.id);

    if (!deleted) return;

    setDeleteConfirmOpen(false);
    onClose();
    window.location.reload();
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 backdrop-blur-md sm:items-center sm:p-4"
            onClick={onClose}
          >
            <motion.div
              initial={{ opacity: 0, y: 80, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 80, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[32px] border border-white/10 bg-[#0b1020]/95 p-5 text-white shadow-2xl backdrop-blur-2xl sm:rounded-[32px] sm:p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-white/20 sm:hidden" />

              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-300">
                    <Menu size={22} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Menu</h2>
                    <p className="mt-1 text-sm text-white/50">Households and settings</p>
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

              <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white/70">
                    <Mail size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/40">Signed in</p>
                    <p className="truncate text-sm font-medium text-white/85">
                      {email || "Unknown user"}
                    </p>
                  </div>
                  {currentHousehold && (
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
                      {currentHousehold.role}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-5 rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.06] p-4">
                <button
                  type="button"
                  onClick={() => setHouseholdExpanded((value) => !value)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-200">
                      <Home size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-white/90">
                        Current household
                      </span>
                      <span className="block truncate text-xs text-white/45">
                        {currentHousehold
                          ? `${currentHousehold.name} • ${currentHousehold.role}`
                          : "No active household"}
                      </span>
                    </span>
                  </span>
                  <ChevronDown
                    size={20}
                    className={`shrink-0 text-white/55 transition ${
                      householdExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {householdExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      {currentHousehold && (
                        <div className="mt-4 rounded-2xl border border-cyan-300/30 bg-cyan-300/15 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-base font-semibold text-cyan-50">
                                {currentHousehold.name}
                              </p>
                              <p className="mt-1 text-xs text-cyan-50/55">
                                Active household • {currentHousehold.role}
                              </p>
                            </div>
                            <Check className="shrink-0 text-cyan-100" size={20} />
                          </div>
                        </div>
                      )}

                      {otherHouseholds.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="px-1 text-xs font-medium uppercase tracking-[0.18em] text-white/35">
                            Switch to
                          </p>
                          {otherHouseholds.map((household) => (
                            <button
                              key={household.id}
                              onClick={() => onSwitchHousehold(household.id)}
                              className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-white/80 transition hover:bg-white/10"
                            >
                              <span className="min-w-0">
                                <span className="block truncate font-medium">{household.name}</span>
                                <span className="text-xs text-white/40">{household.role}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <button
                          onClick={onCreateInviteLink}
                          disabled={!currentHousehold}
                          className="flex items-center justify-between rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-left text-cyan-50 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span>
                            <span className="block text-sm font-semibold">Invite</span>
                            <span className="text-xs text-white/45">Copy link</span>
                          </span>
                          <Link size={18} />
                        </button>

                        <button
                          onClick={onCreateHousehold}
                          className="flex items-center justify-between rounded-2xl border border-dashed border-white/20 bg-white/[0.03] px-4 py-3 text-left text-white/75 transition hover:bg-white/10"
                        >
                          <span>
                            <span className="block text-sm font-semibold">New household</span>
                            <span className="text-xs text-white/45">Separate list</span>
                          </span>
                          <Plus size={18} />
                        </button>
                      </div>

                      <button
                        onClick={() => setDeleteConfirmOpen(true)}
                        disabled={!canDeleteCurrentHousehold}
                        className="mt-2 flex w-full items-center justify-between rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-left text-red-100 transition hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span>
                          <span className="block font-medium">Delete household</span>
                          <span className="text-xs text-red-100/60">
                            {canDeleteCurrentHousehold
                              ? "Permanently removes this household"
                              : "Only the owner can delete this household"}
                          </span>
                        </span>
                        <Trash2 size={18} />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <SectionTitle
                  icon={<Settings size={17} />}
                  title="Preferences"
                  subtitle="Personal to this device"
                />

                <div className="space-y-2">
                  <button
                    onClick={onToggleTheme}
                    className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10"
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
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/55">
                      Change
                    </span>
                  </button>

                  <button
                    onClick={onToggleSound}
                    className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10"
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
                </div>
              </div>

              <button
                onClick={onLogout}
                className="mt-5 flex w-full items-center justify-between rounded-3xl border border-red-400/20 bg-red-400/10 px-4 py-4 text-left text-red-100 transition hover:bg-red-400/20"
              >
                <span>
                  <span className="block font-medium">Logout</span>
                  <span className="text-sm text-red-100/60">Sign out of this account</span>
                </span>
                <LogOut size={20} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        open={deleteConfirmOpen}
        title="Delete household?"
        description={`This will permanently delete ${currentHousehold?.name ?? "this household"}, including its categories, products, shopping list, history, members, and invite links. This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => void confirmDeleteHousehold()}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </>
  );
}
