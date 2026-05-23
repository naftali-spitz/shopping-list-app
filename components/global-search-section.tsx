import { Search } from "lucide-react";

type GlobalResult = {
  id: string;
  name: string;
  categoryName: string;
};

type GlobalSearchSectionProps = {
  cardClass: string;
  globalSearch: string;
  globalResults: GlobalResult[];
  onGlobalSearchChange: (value: string) => void;
  onQuickAdd: (item: string) => void;
};

export function GlobalSearchSection({
  cardClass,
  globalSearch,
  globalResults,
  onGlobalSearchChange,
  onQuickAdd,
}: GlobalSearchSectionProps) {
  return (
    <section className="mt-8">
      <div
        className={`relative rounded-3xl border p-4 backdrop-blur-xl ${cardClass}`}
      >
        <div className="flex items-center gap-3">
          <Search className="text-cyan-400" size={22} />

          <input
            value={globalSearch}
            onChange={(e) => onGlobalSearchChange(e.target.value)}
            placeholder="חיפוש מהיר להוספה לרשימה..."
            className="w-full bg-transparent text-lg outline-none placeholder:text-slate-400"
          />
        </div>

        {globalResults.length > 0 && (
          <div className="mt-4 space-y-2">
            {globalResults.map((product) => (
              <button
                key={product.id}
                onClick={() => onQuickAdd(product.name)}
                className="flex w-full items-center justify-between rounded-2xl border border-black/5 bg-white/60 px-4 py-3 text-right transition hover:scale-[1.01] hover:bg-cyan-50 dark:border-white/10 dark:bg-white/5"
              >
                <div>
                  <div className="font-medium">{product.name}</div>
                  <div className="text-sm opacity-60">
                    {product.categoryName}
                  </div>
                </div>

                <div className="rounded-full bg-cyan-400/10 px-3 py-1 text-sm text-cyan-600">
                  הוסף
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
