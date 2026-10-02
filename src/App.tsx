import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Room3D from "./Room3D";
import Plan from "./Plan";
import {
  catalog as demoCatalog,
  quote as demoQuote,
  type Catalog,
  type FixtureType,
  type Project,
  type Quote,
} from "../shared";
import { DEFAULT_PROJECT, normalizeProject, readSavedProject } from "./project";
import {
  findFreePosition,
  minimumTrackLength,
  placeFixtures,
} from "./placement";

const pagesDemo = import.meta.env.VITE_PAGES_DEMO === "true";
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const money = (n: number) => new Intl.NumberFormat("ru-RU").format(n) + " ₽";
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Неизвестная ошибка";
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
  const [project, setProject] = useState<Project>(readSavedProject);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (pagesDemo) {
      setCatalog(demoCatalog);
      return;
    }
    const controller = new AbortController();
    fetch("/api/catalog", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw Error("Каталог недоступен");
        return r.json();
      })
      .then(setCatalog)
      .catch((e) => {
        if (!(e instanceof Error && e.name === "AbortError")) {
          setError(errorMessage(e));
          setQuote(null);
        }
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("lights-prototype-v1", JSON.stringify(project));
    } catch {
      /* Storage may be unavailable. */
    }
  }, [project]);
  // Position changes do not affect prices, so an unchanged string does not refetch a quote.
  const quoteInput = JSON.stringify({
    mount: project.mount,
    trackL: project.trackL,
    fixtures: project.fixtures.map((fixture) => ({ type: fixture.type })),
  });
  useEffect(() => {
    if (!catalog) return;
    if (pagesDemo) {
      try {
        setQuote(demoQuote(JSON.parse(quoteInput)));
        setError("");
      } catch (e) {
        setError(errorMessage(e));
        setQuote(null);
      }
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch("/api/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: quoteInput,
        signal: controller.signal,
      })
        .then(async (r) => {
          const body = await r.json();
          if (!r.ok) throw Error(body.error || "Ошибка расчёта");
          return body as Quote;
        })
        .then((data) => {
          if (controller.signal.aborted) return;
          setQuote(data);
          setError("");
        })
        .catch((e) => {
          if (controller.signal.aborted) return;
          if (!(e instanceof Error && e.name === "AbortError")) {
            setError(errorMessage(e));
            setQuote(null);
          }
        });
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [catalog, quoteInput]);
  const change = (patch: Partial<Project>) =>
    setProject((p) => ({ ...p, ...patch }));
  const setRoom = (key: "roomW" | "roomD" | "roomH", value: number) =>
    setProject((p) => {
      const next = {
        ...p,
        [key]:
          key === "roomW"
            ? Math.max(value, minimumTrackLength(p.fixtures) + 0.4)
            : value,
      };
      next.trackL = clamp(next.trackL, 0.8, Math.max(0.8, next.roomW - 0.4));
      next.fixtures = placeFixtures(next.fixtures, next.trackL);
      next.trackX = clamp(
        next.trackX,
        -(next.roomW - next.trackL) / 2 + 0.2,
        (next.roomW - next.trackL) / 2 - 0.2,
      );
      next.trackZ = clamp(
        next.trackZ,
        -next.roomD / 2 + 0.35,
        next.roomD / 2 - 0.35,
      );
      return next;
    });
  const addFixture = (type: FixtureType) =>
    setProject((p) => {
      if (p.fixtures.length >= 40) return p;
      const id = Math.max(0, ...p.fixtures.map((f) => f.id)) + 1;
      const fixture = { id, type, t: 0.5 };
      if (minimumTrackLength([...p.fixtures, fixture]) > p.trackL + 1e-8)
        return p;
      const t = findFreePosition(p.fixtures, p.trackL, type);
      const fixtures =
        t === null
          ? placeFixtures([...p.fixtures, fixture], p.trackL)
          : [...p.fixtures, { ...fixture, t }];
      return { ...p, selected: id, fixtures };
    });
  const removeFixture = (id: number) =>
    setProject((p) => {
      const fixtures = p.fixtures.filter((f) => f.id !== id);
      return {
        ...p,
        fixtures,
        selected: p.selected === id ? (fixtures[0]?.id ?? null) : p.selected,
      };
    });
  useEffect(() => {
    const selected = project.selected;
    if (project.view !== "plan" || selected === null) return;
    const removeOnKey = (event: KeyboardEvent) => {
      if (event.key !== "Backspace" && event.key !== "Delete") return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      )
        return;
      event.preventDefault();
      removeFixture(selected);
    };
    window.addEventListener("keydown", removeOnKey);
    return () => window.removeEventListener("keydown", removeOnKey);
  }, [project.view, project.selected]);
  useEffect(() => {
    if (project.view !== "plan" || project.selected === null) return;
    const clearSelection = (event: globalThis.PointerEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest(".plan-fixture")
      )
        return;
      setProject((current) => ({ ...current, selected: null }));
    };
    document.addEventListener("pointerdown", clearSelection);
    return () => document.removeEventListener("pointerdown", clearSelection);
  }, [project.view, project.selected]);
  const product = (id: string) => catalog?.fixtures.find((x) => x.id === id);
  const fixturesInTrackOrder = [...project.fixtures].sort((a, b) => a.t - b.t);
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
      const loaded = normalizeProject(JSON.parse(await file.text()));
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
      `Трек: ${project.trackL} м, ${project.color === "black" ? "чёрный" : "белый"}, ${project.mount === "surface" ? "накладной" : "встроенный"}`,
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
              setProject(DEFAULT_PROJECT);
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
                  min={2}
                  max={12}
                  onChange={(v) => setRoom("roomW", v)}
                />
                <NumberField
                  label="Глубина"
                  value={project.roomD}
                  min={2}
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
                subtitle="Настройте трек на потолке"
              />
              <div className="color-label mb-[10px] flex justify-between text-[11px] font-bold text-[#4c5b4f]">
                Тип монтажа
              </div>
              <div className="mount-options mb-4 grid grid-cols-2 gap-2">
                {(
                  catalog?.tracks ?? [
                    {
                      id: "surface",
                      name: "Накладной трек",
                      description: "На поверхность потолка",
                    },
                    {
                      id: "recessed",
                      name: "Встроенный трек",
                      description: "Вровень с потолком",
                    },
                  ]
                ).map((track) => (
                  <button
                    key={track.id}
                    className={`mount-option ${project.mount === track.id ? "active" : ""}`}
                    onClick={() => change({ mount: track.id })}
                  >
                    <strong>
                      {track.id === "surface" ? "Накладной" : "Встроенный"}
                    </strong>
                    <small>{track.description}</small>
                  </button>
                ))}
              </div>
              <div className="color-label mb-[10px] flex justify-between text-[11px] font-bold text-[#4c5b4f]">
                Цвет профиля
              </div>
              <div className="color-options grid grid-cols-2 gap-2">
                <button
                  className={`color-option ${project.color === "black" ? "active" : ""}`}
                  onClick={() => change({ color: "black" })}
                >
                  <span className="swatch black size-[15px] rounded-full border border-[#d6ddd4]" />{" "}
                  Чёрный{" "}
                  <span className="check ml-auto hidden text-[#78995d]">✓</span>
                </button>
                <button
                  className={`color-option ${project.color === "white" ? "active" : ""}`}
                  onClick={() => change({ color: "white" })}
                >
                  <span className="swatch white size-[15px] rounded-full border border-[#d6ddd4]" />{" "}
                  Белый{" "}
                  <span className="check ml-auto hidden text-[#78995d]">✓</span>
                </button>
              </div>
              <div className="track-length mt-[17px]">
                <label>
                  Длина трека <strong>{project.trackL.toFixed(1)} м</strong>
                </label>
                <input
                  id="trackL"
                  type="range"
                  min="0.8"
                  aria-label="Длина трека"
                  max={Math.max(0.8, project.roomW - 0.4)}
                  step="0.1"
                  value={project.trackL}
                  onChange={(e) =>
                    setProject((p) => {
                      const trackL = Math.max(
                        Number(e.target.value),
                        Math.ceil(minimumTrackLength(p.fixtures) * 10) / 10,
                        0.8,
                      );
                      return {
                        ...p,
                        trackL,
                        fixtures: placeFixtures(p.fixtures, trackL),
                        trackX: clamp(
                          p.trackX,
                          -(p.roomW - trackL) / 2 + 0.2,
                          (p.roomW - trackL) / 2 - 0.2,
                        ),
                      };
                    })
                  }
                />
                <div className="range-ends mt-[5px] flex justify-between text-[10px] text-[#a5aea4]">
                  <span>0,8 м</span>
                  <span>{(project.roomW - 0.4).toFixed(1)} м</span>
                </div>
              </div>
              <p className="tip mt-4 border-l-2 border-[#abc196] bg-[#f5f7f2] px-[10px] py-2 text-[10px] leading-[1.5] text-[#9aa699]">
                Перемещайте трек и светильники на плане потолка.
              </p>
            </section>
            <section className="section fixtures-section border-t border-[#e9ede6] pt-[21px] pb-[22px]">
              <SectionHead
                number="03"
                title="Светильники"
                subtitle="Добавьте приборы на трек"
              />
              <div className="catalog grid gap-[7px]">
                {catalog?.fixtures.map((item) => (
                  <button
                    key={item.id}
                    className="product-card flex items-center gap-[9px] rounded-md border border-[#e8ece6] bg-white p-2 text-left text-[#263327] transition duration-150 hover:border-[#9db88c] hover:bg-[#fbfdf9] disabled:cursor-not-allowed disabled:border-[#e8ece6] disabled:bg-[#f1f3ef] disabled:opacity-[.42]"
                    onClick={() => addFixture(item.id)}
                    disabled={
                      project.fixtures.length >= 40 ||
                      minimumTrackLength([
                        ...project.fixtures,
                        { id: -1, type: item.id, t: 0.5 },
                      ]) >
                        project.trackL + 1e-8
                    }
                  >
                    <span className="product-symbol grid size-9 shrink-0 place-items-center rounded bg-[#eef1ea] text-[19px] text-[#344338]">
                      {item.icon}
                    </span>
                    <span className="product-copy grid flex-1 gap-[3px]">
                      <strong>{item.name}</strong>
                      <small>
                        {item.type} · {item.watts} Вт
                      </small>
                    </span>
                    <span className="product-price text-[10px] font-bold">
                      {money(item.price)}
                    </span>
                    <span className="product-add text-lg text-[#83a469]">
                      +
                    </span>
                  </button>
                )) || (
                  <p className="empty-note text-[11px] text-[#96a195]">
                    Загрузка каталога…
                  </p>
                )}
              </div>
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
              catalog && <Plan project={project} setProject={setProject} />
            )}
            <div className="scene-badge absolute top-[23px] left-[25px] z-2 rounded bg-[#fffefaed] px-3 py-[9px] text-[9px] font-extrabold tracking-[.1em] text-[#526453] shadow-[0_2px_12px_#34412f16] max-[650px]:top-3 max-[650px]:left-3 max-[650px]:text-[8px]">
              <span className="live-dot mr-[7px] inline-block size-[6px] rounded-full bg-[#89b163]" />{" "}
              ПРЕДПРОСМОТР В РЕАЛЬНОМ ВРЕМЕНИ
            </div>
            <div className="scene-hint absolute bottom-[18px] left-[25px] z-2 rounded bg-[#ffffff99] px-[10px] py-2 text-[10px] text-[#5d6d60] max-[650px]:bottom-[45px] max-[650px]:right-[10px] max-[650px]:left-[10px] max-[650px]:text-center">
              {project.view === "3d"
                ? "Перетаскивайте, чтобы повернуть комнату · колесо — масштаб"
                : "Перетаскивайте трек и светильники · Delete/Backspace — удалить выбранный"}
            </div>
            <div className="scene-corner absolute right-[25px] bottom-[18px] z-2 rounded bg-[#ffffff99] px-[10px] py-2 text-[11px] font-extrabold text-[#3e5540] max-[650px]:right-[10px] max-[650px]:bottom-[10px]">
              {project.roomW.toFixed(1)} × {project.roomD.toFixed(1)} м{" "}
              <span>·</span> h {project.roomH.toFixed(1)} м
            </div>
          </div>
          <div className="workspace-bottom grid h-[95px] grid-cols-[1fr_1.2fr_1.2fr_1.6fr] border-t border-[#e3e8df] bg-white max-[1150px]:grid-cols-3 max-[650px]:h-20">
            <div className="metric border-r border-[#edf0eb] px-[18px] pt-[22px] pb-[17px] max-[1150px]:px-[10px] max-[1150px]:py-[18px]">
              <span>СВЕТИЛЬНИКИ</span>
              <strong>
                {String(
                  quote?.fixtureCount ?? project.fixtures.length,
                ).padStart(2, "0")}
              </strong>
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
              {quote
                ? quote.items.filter((item) => !product(item.id)).length +
                  project.fixtures.length
                : "—"}{" "}
              поз.
            </span>
          </div>
          <div className="summary-list mb-6 min-h-0 flex-1 overflow-y-auto pr-3 [scrollbar-gutter:stable]">
            {quote?.items
              .filter((item) => !product(item.id))
              .map((item) => (
                <div
                  className="spec-row flex items-center gap-[10px] border-b border-[#eff1ed] py-[13px]"
                  key={item.id}
                >
                  <span className="spec-icon grid size-[30px] shrink-0 place-items-center rounded bg-[#edf1e9] text-[#526b51]">
                    {item.id === "power" ? "⌁" : "━"}
                  </span>
                  <div>
                    <strong>{item.name}</strong>
                    <small>{item.description}</small>
                  </div>
                  <b>×{item.quantity}</b>
                </div>
              ))}
            {fixturesInTrackOrder.map((fixture, index) => {
              const item = product(fixture.type);
              return (
                <div
                  className="spec-row flex items-center gap-[10px] border-b border-[#eff1ed] py-[13px]"
                  key={`fixture-${fixture.id}`}
                >
                  <span className="spec-icon grid size-[30px] shrink-0 place-items-center rounded bg-[#edf1e9] text-[#526b51]">
                    {item?.icon ?? "◉"}
                  </span>
                  <div>
                    <strong>
                      {item?.name ?? fixture.type} #{index + 1}
                    </strong>
                    <small>
                      {item?.type} · {item?.watts} Вт
                    </small>
                  </div>
                  <button
                    className="spec-remove size-7 shrink-0 rounded border border-[#e1e8de] bg-white text-lg text-[#9aa99b] hover:border-[#d6aaa5] hover:text-[#a24a42]"
                    type="button"
                    aria-label={`Удалить ${item?.name ?? "светильник"} №${index + 1}`}
                    onClick={() => removeFixture(fixture.id)}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
          <div className="summary-total mt-auto border-t border-[#e8ece6] pt-5 max-[650px]:mt-[30px]">
            <span>Предварительная стоимость</span>
            <strong>{quote ? money(quote.total) : "—"}</strong>
            <small>Демонстрационные цены. Не является офертой.</small>
            <button
              className="primary-btn flex w-full items-center justify-between rounded-md bg-[#8aa665] p-[15px] text-[11px] font-extrabold text-white hover:bg-[#769452]"
              disabled={!quote}
              onClick={download}
            >
              Скачать спецификацию <span>↗</span>
            </button>
            <p>
              {error || "Проект автоматически сохраняется в этом браузере."}
            </p>
          </div>
        </aside>
      </main>
      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
    </>
  );
}
