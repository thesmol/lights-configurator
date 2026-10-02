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
  <div className="section-head">
    <span className="section-number">{number}</span>
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
    <label className="number-field">
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
    setQuote(null);
    fetch("/api/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: quoteInput,
      signal: controller.signal,
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw Error(body.error || "Ошибка расчёта");
        return body;
      })
      .then((data) => {
        setQuote(data);
        setError("");
      })
      .catch((e) => {
        if (!(e instanceof Error && e.name === "AbortError")) {
          setError(errorMessage(e));
          setQuote(null);
        }
      });
    return () => controller.abort();
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
  const product = (id: string) => catalog?.fixtures.find((x) => x.id === id);
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
      <header className="topbar">
        <div className="project-title">
          <strong>Конфигуратор освещения</strong>
          <small>ПРОТОТИП · ТРЕКОВАЯ СИСТЕМА</small>
        </div>
        <div className="top-center">ПРОЕКТ ВАШЕЙ КОМНАТЫ</div>
        <div className="header-actions">
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
      <main className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-scroll">
            <div className="eyebrow">01 / ПАРАМЕТРЫ ПРОЕКТА</div>
            <h1>
              Настройте
              <br />
              <em>свой свет.</em>
            </h1>
            <p className="intro">
              Спроектируйте систему под размеры вашей комнаты и сразу увидите
              результат.
            </p>
            <section className="section">
              <SectionHead
                number="01"
                title="Помещение"
                subtitle="Укажите размеры вашей комнаты"
              />
              <div className="dimension-grid">
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
            <section className="section">
              <SectionHead
                number="02"
                title="Трековая система"
                subtitle="Настройте трек на потолке"
              />
              <div className="color-label">Тип монтажа</div>
              <div className="mount-options">
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
              <div className="color-label">Цвет профиля</div>
              <div className="color-options">
                <button
                  className={`color-option ${project.color === "black" ? "active" : ""}`}
                  onClick={() => change({ color: "black" })}
                >
                  <span className="swatch black" /> Чёрный{" "}
                  <span className="check">✓</span>
                </button>
                <button
                  className={`color-option ${project.color === "white" ? "active" : ""}`}
                  onClick={() => change({ color: "white" })}
                >
                  <span className="swatch white" /> Белый{" "}
                  <span className="check">✓</span>
                </button>
              </div>
              <div className="track-length">
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
                <div className="range-ends">
                  <span>0,8 м</span>
                  <span>{(project.roomW - 0.4).toFixed(1)} м</span>
                </div>
              </div>
              <p className="tip">
                Перемещайте трек и светильники на плане потолка.
              </p>
            </section>
            <section className="section fixtures-section">
              <SectionHead
                number="03"
                title="Светильники"
                subtitle="Добавьте приборы на трек"
              />
              <div className="catalog">
                {catalog?.fixtures.map((item) => (
                  <button
                    key={item.id}
                    className="product-card"
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
                    <span className="product-symbol">{item.icon}</span>
                    <span className="product-copy">
                      <strong>{item.name}</strong>
                      <small>
                        {item.type} · {item.watts} Вт
                      </small>
                    </span>
                    <span className="product-price">{money(item.price)}</span>
                    <span className="product-add">+</span>
                  </button>
                )) || <p className="empty-note">Загрузка каталога…</p>}
              </div>
            </section>
            <section className="section atmosphere">
              <SectionHead
                number="04"
                title="Атмосфера"
                subtitle="Оцените характер света"
              />
              <div className="color-label">
                Температура света <strong>{project.kelvin} K</strong>
              </div>
              <input
                id="kelvin"
                className="warm-range"
                type="range"
                min="2700"
                max="5000"
                step="100"
                value={project.kelvin}
                onChange={(e) => change({ kelvin: Number(e.target.value) })}
              />
              <div className="range-ends">
                <span>Тёплый</span>
                <span>Холодный</span>
              </div>
              <div className="track-length">
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
        <div className="workspace">
          <div className="workspace-top">
            <div>
              <div className="eyebrow">02 / ВАШЕ ПРОСТРАНСТВО</div>
              <h2>Посмотрите, как это выглядит</h2>
            </div>
            <div className="view-switch">
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
          <div className="canvas-wrap">
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
            <div className="scene-badge">
              <span className="live-dot" /> ПРЕДПРОСМОТР В РЕАЛЬНОМ ВРЕМЕНИ
            </div>
            <div className="scene-hint">
              {project.view === "3d"
                ? "Перетаскивайте, чтобы повернуть комнату · колесо — масштаб"
                : "Перетаскивайте трек или светильники для настройки"}
            </div>
            <div className="scene-corner">
              {project.roomW.toFixed(1)} × {project.roomD.toFixed(1)} м{" "}
              <span>·</span> h {project.roomH.toFixed(1)} м
            </div>
          </div>
          <div className="workspace-bottom">
            <div className="metric">
              <span>СВЕТИЛЬНИКИ</span>
              <strong>
                {String(
                  quote?.fixtureCount ?? project.fixtures.length,
                ).padStart(2, "0")}
              </strong>
            </div>
            <div className="metric">
              <span>СУММАРНАЯ МОЩНОСТЬ</span>
              <strong>
                {quote?.watts ?? "—"} <small>Вт</small>
              </strong>
            </div>
            <div className="metric">
              <span>СВЕТОВОЙ ПОТОК</span>
              <strong>
                {quote
                  ? new Intl.NumberFormat("ru-RU").format(quote.lumens)
                  : "—"}{" "}
                <small>лм</small>
              </strong>
            </div>
            <div className="metric note">
              <span>ВАЖНО</span>
              <p>Свет в 3D — иллюстрация, не инженерный расчёт освещённости.</p>
            </div>
          </div>
        </div>
        <aside className="summary">
          <div className="eyebrow">03 / РЕЗУЛЬТАТ</div>
          <h2>Ваш проект</h2>
          <p className="summary-sub">
            {pagesDemo
              ? "Демоданные · расчёт в браузере"
              : "Комплектация рассчитывается сервером"}
          </p>
          <div className="summary-visual">
            <div className="summary-line" />
            {project.fixtures.map((f) => (
              <span key={f.id} style={{ left: `${12 + f.t * 76}%` }}>
                {product(f.type)?.icon || "◉"}
              </span>
            ))}
          </div>
          <div className="summary-heading">
            СПЕЦИФИКАЦИЯ{" "}
            <span>
              {quote
                ? quote.items.filter((item) => !product(item.id)).length +
                  project.fixtures.length
                : "—"}{" "}
              поз.
            </span>
          </div>
          <div className="summary-list">
            {quote?.items
              .filter((item) => !product(item.id))
              .map((item) => (
                <div className="spec-row" key={item.id}>
                  <span className="spec-icon">
                    {item.id === "power" ? "⌁" : "━"}
                  </span>
                  <div>
                    <strong>{item.name}</strong>
                    <small>{item.description}</small>
                  </div>
                  <b>×{item.quantity}</b>
                </div>
              ))}
            {project.fixtures.map((fixture, index) => {
              const item = product(fixture.type);
              return (
                <div className="spec-row" key={`fixture-${fixture.id}`}>
                  <span className="spec-icon">{item?.icon ?? "◉"}</span>
                  <div>
                    <strong>
                      {item?.name ?? fixture.type} #{index + 1}
                    </strong>
                    <small>
                      {item?.type} · {item?.watts} Вт
                    </small>
                  </div>
                  <button
                    className="spec-remove"
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
          <div className="summary-total">
            <span>Предварительная стоимость</span>
            <strong>{quote ? money(quote.total) : "—"}</strong>
            <small>Демонстрационные цены. Не является офертой.</small>
            <button
              className="primary-btn"
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
