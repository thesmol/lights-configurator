import type { Catalog, Project, Quote } from "../shared";
import { trackLength } from "../domain/trackGeometry";
import { fixtureCount } from "./projectActions";
import { pagesDemo } from "./useCatalog";
import FixtureImage from "./FixtureImage";
const money = (value: number) =>
  new Intl.NumberFormat("ru-RU").format(value) + " ₽";
export default function ProjectSummary({
  project,
  catalog,
  quote,
  pending,
  error,
  onSelectTrack,
  onRemoveTrack,
  removeFixture,
  onDownload,
}: {
  project: Project;
  catalog: Catalog | null;
  quote: Quote | null;
  pending: boolean;
  error: string;
  onSelectTrack: (id: number) => void;
  onRemoveTrack: (id: number) => void;
  removeFixture: (trackId: number, id: number) => void;
  onDownload: () => void;
}) {
  return (
    <aside className="summary flex min-h-0 flex-col overflow-hidden border-l border-[#e5e9e2] bg-white px-[22px] py-[30px] max-[900px]:min-h-[600px] max-[650px]:min-h-0 max-[650px]:px-[22px] max-[650px]:py-[25px]">
      <div className="eyebrow text-[10px] font-extrabold tracking-[.15em] text-[#879f71]">
        03 / РЕЗУЛЬТАТ
      </div>
      <h2>Ваш проект</h2>
      <p className="summary-sub">
        {pagesDemo
          ? "Демоданные · расчёт в браузере"
          : "Комплектация рассчитывается сервером"}
      </p>
      <div className="summary-heading flex justify-between border-b border-[#e9ede6] pb-3 text-[10px] font-extrabold tracking-[.1em]">
        СПЕЦИФИКАЦИЯ{" "}
        <span>
          {project.tracks.length} тр. · {fixtureCount(project)} св.
        </span>
      </div>
      <div className="summary-list mb-6 min-h-0 flex-1 overflow-y-auto pr-3 [scrollbar-gutter:stable]">
        {project.tracks.map((track, index) => (
          <div key={track.id} className="border-b border-[#e1e8db] pb-2">
            <div className="flex items-center gap-2 py-3">
              <button
                className="min-w-0 flex-1 text-left text-xs"
                onClick={() => onSelectTrack(track.id)}
              >
                <strong
                  className={
                    track.id === project.activeTrackId ? "text-[#789b55]" : ""
                  }
                >
                  Трек {index + 1} ·{" "}
                  {trackLength(track, catalog?.layouts ?? []).toFixed(1)} м
                </strong>
                <span className="mt-1 block truncate text-[10px] text-[#86907f]">
                  {catalog?.tracks.find((item) => item.id === track.productId)
                    ?.name ?? track.productId}
                </span>
              </button>
              <button
                className="spec-remove size-7 shrink-0 rounded border border-[#e1e8de] text-[#9aa99b] hover:text-[#a24a42]"
                aria-label={`Удалить трек ${index + 1} со светильниками`}
                onClick={() => onRemoveTrack(track.id)}
              >
                ×
              </button>
            </div>
            {[...track.fixtures]
              .sort((a, b) => {
                const order = catalog?.layouts
                  .find((layout) => layout.id === track.layoutId)
                  ?.segments.map((segment) => segment.id) ?? ["main"];
                return (
                  order.indexOf(a.segmentId ?? "main") -
                    order.indexOf(b.segmentId ?? "main") || a.t - b.t
                );
              })
              .map((fixture, fixtureIndex) => {
                const item = catalog?.fixtures.find(
                  (product) => product.id === fixture.type,
                );
                return (
                  <div
                    key={fixture.id}
                    className="spec-row flex items-center gap-2 border-t border-[#eff1ed] py-2"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded bg-[#edf1e9]">
                      <FixtureImage
                        shape={item?.shape ?? "spot"}
                        imageUrl={item?.imageUrl}
                        name={item?.name}
                        className="h-8 w-8"
                      />
                    </span>
                    <div>
                      <strong>
                        {item?.name ?? fixture.type} #{fixtureIndex + 1}
                      </strong>
                      <small>
                        {
                          catalog?.layouts
                            .find((layout) => layout.id === track.layoutId)
                            ?.segments.find(
                              (segment) =>
                                segment.id === (fixture.segmentId ?? "main"),
                            )?.label
                        }{" "}
                        · {item?.watts ?? "—"} Вт
                      </small>
                    </div>
                    <button
                      className="spec-remove size-7 shrink-0 rounded border border-[#e1e8de] bg-white text-lg text-[#9aa99b] hover:text-[#a24a42]"
                      aria-label={`Удалить ${item?.name ?? fixture.type} №${fixtureIndex + 1} с трека ${index + 1}`}
                      onClick={() => removeFixture(track.id, fixture.id)}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            <details
              className="mt-2 rounded bg-[#f5f7f1] px-2 py-2 text-[10px] text-[#6e7d64]"
              open
            >
              <summary className="cursor-pointer font-bold">
                Обязательная комплектация
              </summary>
              {quote?.tracks
                .find((item) => item.id === track.id)
                ?.requirements.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-2 pt-2"
                  >
                    <span title={item.description}>{item.name}</span>
                    <b className="shrink-0">×{item.quantity}</b>
                  </div>
                ))}
            </details>
          </div>
        ))}
        {!project.tracks.length && (
          <p className="py-5 text-xs text-[#8b9785]">
            Добавьте первый трек из панели слева.
          </p>
        )}
      </div>
      <div className="summary-total mt-auto border-t border-[#e8ece6] pt-5 max-[650px]:mt-[30px]">
        <span aria-live="polite">
          {pending ? "Обновляем стоимость…" : "Предварительная стоимость"}
        </span>
        <strong>{quote ? money(quote.total) : "—"}</strong>
        <small>Демонстрационные цены. Не является офертой.</small>
        <button
          className="primary-btn flex w-full items-center justify-between rounded-md bg-[#8aa665] p-[15px] text-[11px] font-extrabold text-white hover:bg-[#769452]"
          disabled={!quote || pending || !!error}
          onClick={onDownload}
        >
          Скачать спецификацию <span>↗</span>
        </button>
        <p>{error || "Проект автоматически сохраняется в этом браузере."}</p>
      </div>
    </aside>
  );
}
