import { useEffect, useRef, useState, type ChangeEvent } from "react";
import CatalogDialog from "./CatalogDialog";
import TrackCatalogDialog from "./TrackCatalogDialog";
import ProjectSummary from "./ProjectSummary";
import Room3D from "./Room3D";
import Plan from "./Plan";
import FixtureImage from "./FixtureImage";
import type { Project, TrackPlacement } from "../shared";
import {
  DEFAULT_PROJECT,
  createDefaultProject,
  normalizeProject,
  readSavedProject,
} from "./project";
import { trackBounds, trackLength } from "../domain/trackGeometry";
import TrackShapeEditor from "./TrackShapeEditor";
import {
  addFixture,
  cannotAddFixture,
  fixtureCount,
  newTrack,
  removeFixture as deleteFixture,
  removeTrack,
  updateTrack,
} from "./projectActions";
import CatalogPicker from "./CatalogPicker";
import { errorMessage, useCatalog, useQuote } from "./useCatalog";

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const money = (n: number) => new Intl.NumberFormat("ru-RU").format(n) + " ₽";
const SectionHead = ({
  number,
  title,
  subtitle,
}: {
  number: string;
  title: string;
  subtitle: string;
}) => (
  <div className="section-head mb-[17px] flex items-start gap-[11px]">
    <span className="section-number grid size-[27px] shrink-0 place-items-center rounded-full border border-[#c7d6b8] text-[10px] font-extrabold text-[#728f5c]">
      {number}
    </span>
    <div>
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  </div>
);
function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const parsed = Number(draft.replace(",", "."));
    const next =
      Number.isFinite(parsed) && draft.trim() !== ""
        ? clamp(parsed, min, max)
        : value;
    setDraft(String(next));
    if (next !== value) onChange(next);
  };
  return (
    <label className="number-field min-w-0 rounded-md border border-[#e5eae1] px-[9px] py-2">
      <span>{label}</span>
      <div>
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <small>м</small>
      </div>
    </label>
  );
}

export default function App() {
  const [project, setProject] = useState<Project>(DEFAULT_PROJECT);
  const { catalog, error: catalogError } = useCatalog();
  const { quote, error: quoteError, pending } = useQuote(project, catalog);
  const error = catalogError || quoteError;
  const [toast, setToast] = useState("");
  const [choosingTrack, setChoosingTrack] = useState(false);
  const [choosingFixture, setChoosingFixture] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const loadedRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!catalog || loadedRef.current) return;
    setProject(readSavedProject(catalog));
    loadedRef.current = true;
    setLoaded(true);
  }, [catalog]);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem("lights-prototype-v1", JSON.stringify(project));
    } catch {
      /* Storage may be unavailable. */
    }
  }, [project, loaded]);
  const activeTrack = project.tracks.find(
    (track) => track.id === project.activeTrackId,
  );
  const change = (patch: Partial<Project>) =>
    setProject((current) => ({ ...current, ...patch }));
  const editTrack = (update: (track: TrackPlacement) => TrackPlacement) =>
    setProject((current) =>
      updateTrack(current, current.activeTrackId ?? -1, update),
    );
  const setRoom = (key: "roomW" | "roomD" | "roomH", value: number) =>
    setProject((current) => {
      const next = { ...current, [key]: value };
      if (key === "roomW")
        next.roomW = Math.max(
          value,
          ...current.tracks.map(
            (track) =>
              trackBounds(track, catalog?.layouts ?? []).width +
              2 * Math.abs(track.x) +
              0.4,
          ),
        );
      if (key === "roomD")
        next.roomD = Math.max(
          value,
          ...current.tracks.map((track) => Math.abs(track.z) * 2 + 0.7),
        );
      return next;
    });
  const removeFixture = (trackId: number, id: number) =>
    setProject((current) => deleteFixture(current, trackId, id));
  useEffect(() => {
    const selected = project.selectedFixture;
    const selectedTrack = project.selectedTrackId;
    if (project.view !== "plan" || (!selected && selectedTrack === null))
      return;
    const removeOnKey = (event: KeyboardEvent) => {
      if (
        !["Backspace", "Delete"].includes(event.key) ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      if (
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName))
      )
        return;
      event.preventDefault();
      setProject((current) =>
        selected
          ? deleteFixture(current, selected.trackId, selected.id)
          : removeTrack(current, selectedTrack!),
      );
    };
    const clearSelection = (event: globalThis.PointerEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest(".plan-fixture, .rail-hit, [data-track-select]")
      )
        return;
      setProject((current) => ({
        ...current,
        selectedFixture: null,
        selectedTrackId: null,
      }));
    };
    window.addEventListener("keydown", removeOnKey);
    document.addEventListener("pointerdown", clearSelection);
    return () => {
      window.removeEventListener("keydown", removeOnKey);
      document.removeEventListener("pointerdown", clearSelection);
    };
  }, [project.view, project.selectedFixture, project.selectedTrackId]);
  const flash = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 2800);
  };
  const downloadProject = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "lighting-project.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };
  const openProject = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 1_000_000)
        throw new Error("Файл проекта слишком большой");
      const loaded = normalizeProject(
        JSON.parse(await file.text()),
        catalog ?? undefined,
      );
      if (!loaded) throw new Error("Файл не содержит проект освещения");
      setProject(loaded);
      flash("Проект открыт");
    } catch (error) {
      flash(errorMessage(error));
    }
    event.target.value = "";
  };
  const download = () => {
    if (!quote) return;
    const lines = [
      "Проект трекового освещения",
      "",
      `Комната: ${project.roomW} × ${project.roomD} × ${project.roomH} м`,
      ...project.tracks.map(
        (track, index) =>
          `Трек ${index + 1}: ${catalog?.tracks.find((item) => item.id === track.productId)?.name ?? track.productId}, ${trackLength(track, catalog?.layouts ?? []).toFixed(1)} м, ${track.color === "black" ? "чёрный" : "белый"}, ${track.fixtures.length} светильников`,
      ),
      `Свет: ${project.kelvin} K, яркость ${project.brightness}%`,
      "",
      "Комплектация:",
      ...quote.items.map(
        (item) =>
          `${item.name} — ${item.quantity} шт. × ${money(item.unitPrice)} = ${money(item.total)}`,
      ),
      "",
      `Итого: ${money(quote.total)}`,
      "",
      "Демонстрационные товары и цены. Требуется подключение реального каталога.",
    ];
    const blob = new Blob(["\ufeff" + lines.join("\n")], {
      type: "text/plain;charset=utf-8",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "lighting-specification.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };
  return (
    <>
      <header className="topbar flex h-20 items-center justify-between border-b border-[#e7e9e3] bg-white px-8 max-[650px]:h-16 max-[650px]:px-4">
        <div className="project-title flex min-w-[250px] flex-col gap-1 max-[650px]:min-w-0">
          <strong>Конфигуратор освещения</strong>
          <small>ПРОТОТИП · ТРЕКОВАЯ СИСТЕМА</small>
        </div>
        <div className="top-center text-[10px] font-extrabold tracking-[.17em] text-[#8a948a] max-[1150px]:hidden">
          ПРОЕКТ ВАШЕЙ КОМНАТЫ
        </div>
        <div className="header-actions flex gap-3.5 max-[650px]:gap-[3px]">
          <button
            className="text-btn"
            onClick={() => {
              setProject(createDefaultProject(catalog ?? undefined));
              flash("Проект сброшен");
            }}
          >
            ↺ <span>Начать заново</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={openProject}
          />
          <button className="text-btn" onClick={() => fileRef.current?.click()}>
            ↥ <span>Открыть проект</span>
          </button>
          <button className="outline-btn" onClick={downloadProject}>
            ↧ <span>Скачать проект</span>
          </button>
        </div>
      </header>
      <main className="app-shell grid h-[calc(100vh-80px)] min-h-[680px] grid-cols-[340px_minmax(400px,1fr)_300px] max-[1150px]:grid-cols-[285px_minmax(300px,1fr)_260px] max-[900px]:h-auto max-[900px]:grid-cols-[1fr_280px] max-[650px]:block">
        <aside className="sidebar overflow-auto border-r border-[#e8ebe5] bg-white max-[900px]:col-span-2 max-[900px]:overflow-visible">
          <div className="sidebar-scroll px-7 pt-[30px] pb-[42px] max-[1150px]:px-5 max-[1150px]:py-[26px] max-[900px]:grid max-[900px]:grid-cols-2 max-[900px]:gap-x-[30px] max-[900px]:p-[25px] max-[650px]:block max-[650px]:p-[22px]">
            <div className="eyebrow text-[10px] font-extrabold tracking-[.15em] text-[#879f71]">
              01 / ПАРАМЕТРЫ ПРОЕКТА
            </div>
            <h1>
              Настройте
              <br />
              <em>свой свет.</em>
            </h1>
            <p className="intro mb-[26px] max-w-[260px] text-xs leading-[1.65] text-[#849087] max-[900px]:col-span-2 max-[900px]:mb-3">
              Спроектируйте систему под размеры вашей комнаты и сразу увидите
              результат.
            </p>
            <section className="section border-t border-[#e9ede6] pt-[21px] pb-[22px]">
              <SectionHead
                number="01"
                title="Помещение"
                subtitle="Укажите размеры вашей комнаты"
              />
              <div className="dimension-grid grid grid-cols-3 gap-2">
                <NumberField
                  label="Ширина"
                  value={project.roomW}
                  min={Math.max(
                    2,
                    ...project.tracks.map(
                      (track) =>
                        trackBounds(track, catalog?.layouts ?? []).width +
                        2 * Math.abs(track.x) +
                        0.4,
                    ),
                  )}
                  max={12}
                  onChange={(v) => setRoom("roomW", v)}
                />
                <NumberField
                  label="Глубина"
                  value={project.roomD}
                  min={Math.max(
                    2,
                    ...project.tracks.map(
                      (track) =>
                        trackBounds(track, catalog?.layouts ?? []).depth +
                        2 * Math.abs(track.z) +
                        0.7,
                    ),
                  )}
                  max={12}
                  onChange={(v) => setRoom("roomD", v)}
                />
                <NumberField
                  label="Высота"
                  value={project.roomH}
                  min={2.2}
                  max={5}
                  onChange={(v) => setRoom("roomH", v)}
                />
              </div>
            </section>
            <section className="section border-t border-[#e9ede6] pt-[21px] pb-[22px]">
              <SectionHead
                number="02"
                title="Трековая система"
                subtitle={`${project.tracks.length} треков в проекте`}
              />
              <div
                className="mb-3 grid max-h-40 gap-1 overflow-y-auto pr-1 [scrollbar-gutter:stable]"
                aria-label="Треки проекта"
              >
                {project.tracks.map((track, index) => (
                  <button
                    key={track.id}
                    data-track-select
                    aria-pressed={track.id === project.activeTrackId}
                    className={`rounded border p-2 text-left text-xs ${track.id === project.activeTrackId ? "border-[#8aaa69] bg-[#edf3e5]" : "border-[#e1e7db]"}`}
                    onClick={() =>
                      change({
                        activeTrackId: track.id,
                        selectedTrackId: track.id,
                        activeSegmentId: "main",
                        selectedFixture: null,
                      })
                    }
                  >
                    <strong>Трек {index + 1}</strong>
                    <span className="float-right text-[#7c8976]">
                      {trackLength(track, catalog?.layouts ?? []).toFixed(1)} м
                      · {track.fixtures.length} шт.
                    </span>
                  </button>
                ))}
              </div>
              <button
                className="outline-btn mb-4 w-full disabled:opacity-40"
                disabled={
                  !catalog ||
                  !newTrack(project, catalog.tracks[0]?.id ?? "", catalog)
                }
                onClick={() => {
                  if (!catalog?.tracks[0]) return;
                  setProject((current) => {
                    const track = newTrack(
                      current,
                      catalog.tracks[0].id,
                      catalog,
                    );
                    return track
                      ? {
                          ...current,
                          tracks: [...current.tracks, track],
                          activeTrackId: track.id,
                          selectedTrackId: track.id,
                          activeSegmentId: "main",
                          selectedFixture: null,
                        }
                      : current;
                  });
                  setChoosingTrack(true);
                }}
              >
                + Добавить трек
              </button>
              {activeTrack && catalog && (
                <>
                  <div className="mb-4">
                    <span className="mb-1 block text-[10px] text-[#889580]">
                      Профиль трека
                    </span>
                    <button
                      className="flex w-full items-center justify-between gap-3 border-b border-[#dce3d6] py-2 text-left text-xs hover:border-[#879f71]"
                      onClick={() => setChoosingTrack(true)}
                      aria-haspopup="dialog"
                      aria-label="Выбрать профиль трека"
                    >
                      <strong className="min-w-0 truncate font-semibold">
                        {catalog.tracks.find(
                          (item) => item.id === activeTrack.productId,
                        )?.name ?? activeTrack.productId}
                      </strong>
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 16 16"
                        className="size-4 shrink-0 text-[#869b74]"
                      >
                        <path
                          d="m5 3 5 5-5 5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                      </svg>
                    </button>
                  </div>
                  {choosingTrack && (
                    <TrackCatalogDialog
                      catalog={catalog}
                      track={activeTrack}
                      onClose={() => setChoosingTrack(false)}
                      onPick={(id) => {
                        editTrack((track) => ({ ...track, productId: id }));
                        setChoosingTrack(false);
                      }}
                    />
                  )}
                  <div className="color-options mb-4 grid grid-cols-2 gap-2">
                    {(["black", "white"] as const).map((color) => (
                      <button
                        key={color}
                        className={`color-option ${activeTrack.color === color ? "active" : ""}`}
                        onClick={() =>
                          editTrack((track) => ({ ...track, color }))
                        }
                      >
                        <span
                          className={`swatch ${color} size-[15px] rounded-full border border-[#d6ddd4]`}
                        />
                        {color === "black" ? "Чёрный" : "Белый"}
                      </button>
                    ))}
                  </div>
                  <TrackShapeEditor
                    project={project}
                    track={activeTrack}
                    catalog={catalog}
                    onChange={setProject}
                    onReject={() =>
                      flash(
                        "Недостаточно места: проверьте размеры комнаты, соседние треки и светильники.",
                      )
                    }
                  />
                </>
              )}
            </section>
            <section className="section fixtures-section border-t border-[#e9ede6] pt-[21px] pb-[22px]">
              <SectionHead
                number="03"
                title="Светильники"
                subtitle={
                  activeTrack
                    ? `На трек ${project.tracks.indexOf(activeTrack) + 1} · добавьте и переместите на плане`
                    : "Сначала добавьте трек"
                }
              />
              {catalog ? (
                <>
                  <button
                    className="flex w-full items-center justify-between rounded-md border border-[#b5c5a6] bg-[#f5f8f0] px-4 py-3 text-xs font-semibold text-[#486039] hover:bg-[#eaf0e0] disabled:opacity-40"
                    disabled={!activeTrack}
                    onClick={() => setChoosingFixture(true)}
                    aria-haspopup="dialog"
                    aria-label="Открыть каталог светильников"
                  >
                    Добавить светильник <span className="text-lg">+</span>
                  </button>
                  {choosingFixture && (
                    <CatalogDialog
                      title="Выберите светильник"
                      onClose={() => setChoosingFixture(false)}
                    >
                      <CatalogPicker
                        items={catalog.fixtures}
                        resource="fixtures"
                        label="Светильники"
                        category={(item) => item.type}
                        description={(item) =>
                          `${item.type} · ${item.watts} Вт`
                        }
                        preview={(item) => (
                          <FixtureImage
                            shape={item.shape}
                            imageUrl={item.imageUrl}
                            name={item.name}
                            className="h-14 w-20"
                          />
                        )}
                        actionLabel="Добавить"
                        onPick={(item) => {
                          setProject((current) =>
                            addFixture(current, item.id, catalog),
                          );
                          setChoosingFixture(false);
                        }}
                        disabledReason={(item) =>
                          cannotAddFixture(
                            project,
                            activeTrack,
                            item.id,
                            catalog,
                          )
                        }
                      />
                    </CatalogDialog>
                  )}
                </>
              ) : (
                <p className="text-xs text-[#8b9785]">
                  {error || "Загрузка каталога…"}
                </p>
              )}
            </section>
            <section className="section atmosphere border-t border-[#e9ede6] pt-[21px] pb-[22px]">
              <SectionHead
                number="04"
                title="Атмосфера"
                subtitle="Оцените характер света"
              />
              <div className="color-label mb-[10px] flex justify-between text-[11px] font-bold text-[#4c5b4f]">
                Температура света <strong>{project.kelvin} K</strong>
              </div>
              <input
                id="kelvin"
                className="warm-range accent-[#ce9e63]"
                type="range"
                min="2700"
                max="5000"
                step="100"
                value={project.kelvin}
                onChange={(e) => change({ kelvin: Number(e.target.value) })}
              />
              <div className="range-ends mt-[5px] flex justify-between text-[10px] text-[#a5aea4]">
                <span>Тёплый</span>
                <span>Холодный</span>
              </div>
              <div className="track-length mt-[17px]">
                <label>
                  Яркость <strong>{project.brightness}%</strong>
                </label>
                <input
                  id="brightness"
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={project.brightness}
                  onChange={(e) =>
                    change({ brightness: Number(e.target.value) })
                  }
                />
              </div>
            </section>
          </div>
        </aside>
        <div className="workspace flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#e6e9e3] max-[900px]:min-h-[600px] max-[900px]:overflow-visible max-[650px]:min-h-[580px]">
          <div className="workspace-top flex h-[92px] items-center justify-between bg-[#f3f5f0] px-[30px] pt-[25px] pb-[18px] max-[1150px]:p-5 max-[650px]:block max-[650px]:h-auto max-[650px]:p-[22px]">
            <div>
              <div className="eyebrow text-[10px] font-extrabold tracking-[.15em] text-[#879f71]">
                02 / ВАШЕ ПРОСТРАНСТВО
              </div>
              <h2>Посмотрите, как это выглядит</h2>
            </div>
            <div className="view-switch flex gap-[2px] rounded-md bg-[#e8ece5] p-[3px]">
              <button
                className={project.view === "3d" ? "active" : ""}
                onClick={() => change({ view: "3d" })}
              >
                ⬡ 3D-комната
              </button>
              <button
                className={project.view === "plan" ? "active" : ""}
                onClick={() => change({ view: "plan" })}
              >
                ⊞ План потолка
              </button>
            </div>
          </div>
          <div className="canvas-wrap relative min-h-0 flex-1 overflow-hidden max-[900px]:h-[500px] max-[900px]:shrink-0 max-[650px]:h-[410px]">
            {project.view === "3d" ? (
              <Room3D project={project} catalog={catalog} />
            ) : (
              catalog && (
                <Plan
                  project={project}
                  catalog={catalog}
                  setProject={setProject}
                />
              )
            )}
            <div className="scene-badge absolute top-[23px] left-[25px] z-2 rounded bg-[#fffefaed] px-3 py-[9px] text-[9px] font-extrabold tracking-[.1em] text-[#526453] shadow-[0_2px_12px_#34412f16] max-[650px]:top-3 max-[650px]:left-3 max-[650px]:text-[8px]">
              <span className="live-dot mr-[7px] inline-block size-[6px] rounded-full bg-[#89b163]" />{" "}
              ПРЕДПРОСМОТР В РЕАЛЬНОМ ВРЕМЕНИ
            </div>
            <div className="scene-hint absolute bottom-[18px] left-[25px] z-2 rounded bg-[#ffffff99] px-[10px] py-2 text-[10px] text-[#5d6d60] max-[650px]:bottom-[45px] max-[650px]:right-[10px] max-[650px]:left-[10px] max-[650px]:text-center">
              {project.view === "3d"
                ? "Перетаскивайте, чтобы повернуть комнату · колесо — масштаб"
                : "Перетаскивайте трек и светильники · Delete/Backspace — удалить выбранное"}
            </div>
            <div className="scene-corner absolute right-[25px] bottom-[18px] z-2 rounded bg-[#ffffff99] px-[10px] py-2 text-[11px] font-extrabold text-[#3e5540] max-[650px]:right-[10px] max-[650px]:bottom-[10px]">
              {project.roomW.toFixed(1)} × {project.roomD.toFixed(1)} м{" "}
              <span>·</span> h {project.roomH.toFixed(1)} м
            </div>
          </div>
          <div className="workspace-bottom grid h-[95px] grid-cols-[1fr_1.2fr_1.2fr_1.6fr] border-t border-[#e3e8df] bg-white max-[1150px]:grid-cols-3 max-[650px]:h-20">
            <div className="metric border-r border-[#edf0eb] px-[18px] pt-[22px] pb-[17px] max-[1150px]:px-[10px] max-[1150px]:py-[18px]">
              <span>СВЕТИЛЬНИКИ</span>
              <strong>{String(fixtureCount(project)).padStart(2, "0")}</strong>
            </div>
            <div className="metric border-r border-[#edf0eb] px-[18px] pt-[22px] pb-[17px] max-[1150px]:px-[10px] max-[1150px]:py-[18px]">
              <span>СУММАРНАЯ МОЩНОСТЬ</span>
              <strong>
                {quote?.watts ?? "—"} <small>Вт</small>
              </strong>
            </div>
            <div className="metric border-r border-[#edf0eb] px-[18px] pt-[22px] pb-[17px] max-[1150px]:px-[10px] max-[1150px]:py-[18px]">
              <span>СВЕТОВОЙ ПОТОК</span>
              <strong>
                {quote
                  ? new Intl.NumberFormat("ru-RU").format(quote.lumens)
                  : "—"}{" "}
                <small>лм</small>
              </strong>
            </div>
            <div className="metric note border-r border-[#edf0eb] px-[18px] pt-[22px] pb-[17px] max-[1150px]:px-[10px] max-[1150px]:py-[18px]">
              <span>ВАЖНО</span>
              <p>Свет в 3D — иллюстрация, не инженерный расчёт освещённости.</p>
            </div>
          </div>
        </div>
        <ProjectSummary
          project={project}
          catalog={catalog}
          quote={quote}
          pending={pending}
          error={error}
          onSelectTrack={(id) =>
            change({
              activeTrackId: id,
              selectedTrackId: id,
              activeSegmentId: "main",
              selectedFixture: null,
            })
          }
          onRemoveTrack={(id) =>
            setProject((current) => removeTrack(current, id))
          }
          removeFixture={removeFixture}
          onDownload={download}
        />
      </main>
      <div
        className={`toast pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded bg-[#283725] px-5 py-3 text-sm text-white shadow-lg transition-opacity ${toast ? "opacity-100" : "opacity-0"}`}
      >
        {toast}
      </div>
    </>
  );
}
