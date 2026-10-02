import { useEffect, useState, type ReactNode } from "react";

import type { LightProduct, TrackProduct } from "../shared";
import {
  productCategory,
  queryCatalog,
  type CatalogPage,
} from "../domain/catalogQuery";
import { pagesDemo } from "./useCatalog";

const PAGE_SIZE = 6;
export default function CatalogPicker<T extends LightProduct | TrackProduct>({
  items,
  resource,
  label,
  category,
  description,
  preview,
  selectedId,
  actionLabel,
  onPick,
  disabledReason,
}: {
  items: T[];
  resource: "tracks" | "fixtures";
  label: string;
  category: (item: T) => string;
  description: (item: T) => string;
  preview?: (item: T) => ReactNode;
  selectedId?: string;
  actionLabel: string;
  onPick: (item: T) => void;
  disabledReason?: (item: T) => string | null;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const categories = [
    ...new Map(
      items.map((item) => [productCategory(item), category(item)]),
    ).entries(),
  ];
  const local = queryCatalog(items, {
    q: query,
    category: filter,
    page: page + 1,
    pageSize: PAGE_SIZE,
  });
  const requestKey = new URLSearchParams({
    q: query,
    category: filter,
    page: String(page + 1),
    pageSize: String(PAGE_SIZE),
  }).toString();
  const [remote, setRemote] = useState<{
    key: string;
    data: CatalogPage<T>;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (pagesDemo) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/${resource}?${requestKey}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Не удалось загрузить товары");
        const data = await response.json();
        if (!controller.signal.aborted) {
          setRemote({ key: requestKey, data });
          setError("");
        }
      } catch {
        if (!controller.signal.aborted)
          setError(
            "Не удалось загрузить товары. Измените поиск, чтобы повторить.",
          );
      }
    }, 150);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [resource, requestKey]);
  const result = pagesDemo
    ? local
    : remote?.key === requestKey
      ? remote.data
      : local;
  const loading = !pagesDemo && remote?.key !== requestKey;
  const { pages } = result;
  const currentPage = result.page - 1;
  return (
    <div className="catalog-picker grid gap-2" aria-label={label}>
      <input
        aria-label={`Поиск: ${label}`}
        type="search"
        placeholder="Название или артикул"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(0);
        }}
        className="w-full rounded border border-[#dce4d8] bg-white p-2 text-xs outline-[#8aaa69]"
      />
      {categories.length > 1 && (
        <div
          className="flex min-w-0 flex-wrap gap-1 pb-1"
          aria-label={`Фильтр: ${label}`}
        >
          {[["", "Все"], ...categories].map(([value, label]) => (
            <button
              key={value}
              onClick={() => {
                setFilter(value);
                setPage(0);
              }}
              aria-pressed={filter === value}
              className={`max-w-full rounded px-2 py-1 text-[10px] [overflow-wrap:anywhere] ${filter === value ? "bg-[#dfe9d5] text-[#344c2d]" : "bg-[#f0f3ed] text-[#74816e]"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {items.length > PAGE_SIZE && (
        <div className="flex justify-between text-[10px] text-[#899581]">
          <span>{result.total} моделей</span>
          {pages > 1 && (
            <span>
              {currentPage + 1} / {pages}
            </span>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-[#a24a42]">
          {error}
        </p>
      )}
      <div className="catalog grid gap-3 sm:grid-cols-2" aria-busy={loading}>
        {result.items.map((item) => {
          const reason =
            disabledReason?.(item) ??
            (loading ? "Загрузка каталога…" : error || null);
          return (
            <button
              key={item.id}
              type="button"
              className={`product-card flex w-full items-center gap-2 rounded-md border p-2 text-left transition hover:border-[#9db88c] disabled:cursor-not-allowed disabled:bg-[#f1f3ef] disabled:opacity-45 ${selectedId === item.id ? "border-[#8aaa69] bg-[#f0f5e9]" : "border-[#e8ece6] bg-white"}`}
              aria-label={`${actionLabel} ${item.name}`}
              aria-pressed={
                selectedId === undefined ? undefined : selectedId === item.id
              }
              title={reason ?? description(item)}
              disabled={!!reason}
              onClick={() => onPick(item)}
            >
              {preview && (
                <span className="grid h-16 w-20 shrink-0 place-items-center rounded bg-[#eef1ea]">
                  {preview(item)}
                </span>
              )}
              <span className="product-copy grid min-w-0 flex-1 gap-1.5">
                <strong className="truncate">{item.name}</strong>
                <small>{description(item)}</small>
                <span className="text-[10px] font-bold">
                  {new Intl.NumberFormat("ru-RU").format(item.price)} ₽
                </span>
              </span>
              <span className="shrink-0 text-lg text-[#83a469]">
                {selectedId === item.id ? "✓" : "+"}
              </span>
            </button>
          );
        })}
        {!result.items.length && (
          <p className="py-4 text-xs text-[#798574]">
            Ничего не найдено. Измените поиск или фильтр.
          </p>
        )}
      </div>
      {pages > 1 && (
        <div className="flex justify-between gap-2">
          <button
            className="outline-btn disabled:opacity-40"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            ← Назад
          </button>
          <button
            className="outline-btn disabled:opacity-40"
            disabled={currentPage + 1 >= pages}
            onClick={() => setPage(currentPage + 1)}
          >
            Далее →
          </button>
        </div>
      )}
    </div>
  );
}
