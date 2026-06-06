import { Plus, Search, X } from "lucide-react";
import { AppCopy } from "@/lib/i18n";

type GlobalResult = {
  id: string;
  name: string;
  categoryName: string;
};

type GlobalSearchSectionProps = {
  copy: AppCopy;
  cardClass: string;
  globalSearch: string;
  globalResults: GlobalResult[];
  onGlobalSearchChange: (value: string) => void;
  onQuickAdd: (item: string) => void;
  onAddMissingProduct?: (name: string) => void;
};

export function GlobalSearchSection({
  copy,
  cardClass,
  globalSearch,
  globalResults,
  onGlobalSearchChange,
  onQuickAdd,
  onAddMissingProduct,
}: GlobalSearchSectionProps) {
  const trimmedSearch = globalSearch.trim();
  const showAddMissingProduct =
    trimmedSearch.length > 0 && globalResults.length === 0 && Boolean(onAddMissingProduct);

  return (
    <section className="mt-8">
      <div className={`relative rounded-3xl border p-4 backdrop-blur-xl ${cardClass}`}>
        <div className="flex items-center gap-3">
          <Search className="text-cyan-400" size={22} />

          <input
            value={globalSearch}
            onChange={(e) => onGlobalSearchChange(e.target.value)}
            placeholder={copy.search.placeholder}
            dir="auto"
            className="w-full bg-transparent text-lg outline-none placeholder:text-slate-400"
          />

          {trimmedSearch && (
            <button
              type="button"
              onClick={() => onGlobalSearchChange("")}
              className="rounded-full bg-white/10 p-2 text-white/60 transition hover:bg-white/20 hover:text-white"
              aria-label={copy.search.clearSearch}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {globalResults.length > 0 && (
          <div className="mt-4 space-y-2">
            {globalResults.map((product) => (
              <button
                key={product.id}
                onClick={() => onQuickAdd(product.name)}
                className="flex w-full items-center justify-between rounded-2xl border border-black/5 bg-white/60 px-4 py-3 text-start transition hover:scale-[1.01] hover:bg-cyan-50 dark:border-white/10 dark:bg-white/5"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium" dir="auto">{product.name}</div>
                  <div className="truncate text-sm opacity-60" dir="auto">
                    {product.categoryName}
                  </div>
                </div>

                <div className="rounded-full bg-cyan-400/10 px-3 py-1 text-sm text-cyan-600">
                  {copy.common.add}
                </div>
              </button>
            ))}
          </div>
        )}

        {showAddMissingProduct && (
          <button
            type="button"
            onClick={() => onAddMissingProduct?.(trimmedSearch)}
            className="mt-4 flex w-full items-center justify-between rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-start transition hover:scale-[1.01] hover:bg-cyan-300/15"
          >
            <div className="min-w-0">
              <div className="text-sm text-white/60">{copy.search.noResults}</div>
              <div className="mt-1 truncate font-semibold text-cyan-100" dir="auto">
                {copy.search.addMissing(trimmedSearch)}
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-full bg-cyan-300 px-3 py-1 text-sm font-bold text-slate-950">
              <Plus size={14} />
              {copy.common.add}
            </div>
          </button>
        )}
      </div>
    </section>
  );
}
