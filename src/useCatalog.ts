import { useEffect, useState } from "react";
import {
  catalog as demoCatalog,
  quote as demoQuote,
  type Catalog,
  type Project,
  type Quote,
} from "../shared";
export const pagesDemo = import.meta.env.VITE_PAGES_DEMO === "true";
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Неизвестная ошибка";
export function useCatalog() {
  const [catalog, setCatalog] = useState<Catalog | null>(
    pagesDemo ? demoCatalog : null,
  );
  const [error, setError] = useState("");
  useEffect(() => {
    if (pagesDemo) return;
    const controller = new AbortController();
    fetch("/api/catalog", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Каталог недоступен");
        setCatalog(await response.json());
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(errorMessage(error));
      });
    return () => controller.abort();
  }, []);
  return { catalog, error };
}
export function useQuote(project: Project, catalog: Catalog | null) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [resolvedInput, setResolvedInput] = useState("");
  const input = JSON.stringify({
    tracks: project.tracks.map((track) => ({
      id: track.id,
      productId: track.productId,
      layoutId: track.layoutId,
      depth: track.depth,
      tail: track.tail,
      length: track.length,
      fixtures: track.fixtures.map((fixture) => ({
        type: fixture.type,
        segmentId: fixture.segmentId ?? "main",
      })),
    })),
  });
  useEffect(() => {
    if (!catalog) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        let result: Quote;
        if (pagesDemo) result = demoQuote(JSON.parse(input), catalog);
        else {
          const response = await fetch("/api/quote", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: input,
            signal: controller.signal,
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || "Ошибка расчёта");
          result = body;
        }
        if (controller.signal.aborted) return;
        setQuote(result);
        setResolvedInput(input);
        setError("");
      } catch (error) {
        if (!controller.signal.aborted) setError(errorMessage(error));
      }
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [catalog, input]);
  return { quote, error, pending: input !== resolvedInput };
}
