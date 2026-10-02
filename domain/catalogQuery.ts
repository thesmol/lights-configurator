import type { LightProduct, TrackProduct } from "./types.js";

export interface CatalogQuery {
  q?: string;
  category?: string;
  page?: number;
  pageSize?: number;
  sort?: "name" | "price-asc" | "price-desc";
}
export interface CatalogPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}
export const productCategory = (item: LightProduct | TrackProduct) =>
  "mount" in item ? item.mount : item.type;
export function queryCatalog<T extends LightProduct | TrackProduct>(
  items: T[],
  query: CatalogQuery = {},
): CatalogPage<T> {
  const q = (query.q ?? "").trim().toLocaleLowerCase("ru");
  const filtered = items.filter(
    (item) =>
      (!query.category || productCategory(item) === query.category) &&
      `${item.id} ${item.name} ${"description" in item ? item.description : item.type}`
        .toLocaleLowerCase("ru")
        .includes(q),
  );
  if (query.sort === "price-asc")
    filtered.sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));
  else if (query.sort === "price-desc")
    filtered.sort((a, b) => b.price - a.price || a.id.localeCompare(b.id));
  else
    filtered.sort(
      (a, b) => a.name.localeCompare(b.name, "ru") || a.id.localeCompare(b.id),
    );
  const pageSize = Math.max(1, Math.min(50, Math.floor(query.pageSize ?? 6)));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.max(1, Math.min(pages, Math.floor(query.page ?? 1)));
  return {
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pageSize,
    pages,
  };
}
