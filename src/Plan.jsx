import { useEffect, useRef, useState } from 'react';
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export default function Plan({ project, catalog, setProject }) {
  const host = useRef(null), drag = useRef(null);
  const [size, setSize] = useState({ width: 700, height: 500 });
  useEffect(() => { const observer = new ResizeObserver(() => { const r = host.current?.getBoundingClientRect(); if (r?.width && r?.height) setSize(old => old.width === r.width && old.height === r.height ? old : { width: r.width, height: r.height }); }); observer.observe(host.current); const stop = () => { drag.current = null; }; window.addEventListener('pointerup', stop); return () => { observer.disconnect(); window.removeEventListener('pointerup', stop); };  }, []);
  const { width, height } = size, pad = Math.min(60, width * .1);
  const scale = Math.min((width - pad * 2) / project.roomW, (height - pad * 2) / project.roomD);
  const w = project.roomW * scale, d = project.roomD * scale, x = (width - w) / 2, y = (height - d) / 2;
  const railX = x + w / 2 + project.trackX * scale, railY = y + d / 2 + project.trackZ * scale;
  const start = e => {
    const fixture = e.target.closest('.plan-fixture'), rail = e.target.closest('.rail-hit');
    if (!fixture && !rail) return;
    drag.current = fixture ? { kind: 'fixture', id: Number(fixture.dataset.id) } : { kind: 'rail', startX: e.clientX, startY: e.clientY, x: project.trackX, z: project.trackZ };
    if (fixture) setProject(p => ({ ...p, selected: drag.current.id }));
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = e => {
    if (!drag.current) return;
    const bounds = host.current.getBoundingClientRect();
    if (drag.current.kind === 'fixture') {
      const t = clamp(((e.clientX - bounds.left) - railX) / (project.trackL * scale) + .5, .03, .97);
      setProject(p => ({ ...p, fixtures: p.fixtures.map(f => f.id === drag.current.id ? { ...f, t } : f) }));
    } else {
      const nextX = clamp(drag.current.x + (e.clientX - drag.current.startX) / scale, -(project.roomW - project.trackL) / 2 + .2, (project.roomW - project.trackL) / 2 - .2);
      const nextZ = clamp(drag.current.z + (e.clientY - drag.current.startY) / scale, -project.roomD / 2 + .35, project.roomD / 2 - .35);
      setProject(p => ({ ...p, trackX: nextX, trackZ: nextZ }));
    }
  };
  return <div id="plan-view" ref={host}><svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} onPointerDown={start} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
    <defs><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="#d8ddd7" strokeWidth="1" /></pattern></defs>
    <rect width={width} height={height} fill="#e8ebe5" /><rect x={x} y={y} width={w} height={d} fill="#fafaf6" stroke="#adb4a8" strokeWidth="2" /><rect x={x} y={y} width={w} height={d} fill="url(#grid)" opacity=".6" />
    <text x={x + 12} y={y + 25} className="plan-label">ПОТОЛОК · {project.roomW.toFixed(1)} × {project.roomD.toFixed(1)} М</text>
    <line className="rail-hit" x1={railX - project.trackL * scale / 2} x2={railX + project.trackL * scale / 2} y1={railY} y2={railY} stroke="transparent" strokeWidth="30" />
    <line x1={railX - project.trackL * scale / 2} x2={railX + project.trackL * scale / 2} y1={railY} y2={railY} stroke={project.color === 'black' ? '#202522' : '#afb4ae'} strokeWidth="9" strokeLinecap="round" pointerEvents="none" />
    {project.fixtures.map(f => <g key={f.id} className={`plan-fixture ${project.selected === f.id ? 'selected' : ''}`} data-id={f.id} transform={`translate(${railX + (f.t - .5) * project.trackL * scale},${railY})`}><circle r="15" fill="#fff" stroke={project.selected === f.id ? '#7e9f58' : '#222a25'} strokeWidth="3" /><text textAnchor="middle" dominantBaseline="central" fontSize="15">{catalog.fixtures.find(p => p.id === f.type)?.icon}</text></g>)}
  </svg></div>;
}
