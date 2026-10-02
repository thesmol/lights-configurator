import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
function lightColor(k) { const t = clamp((k - 2700) / 2300, 0, 1); return new THREE.Color().setRGB(1, .67 + t * .22, .43 + t * .52); }
function seeded(seed) { let value = seed; return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; }; }
function texture(kind) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d'), random = seeded(kind === 'wood' ? 17 : kind === 'wall' ? 29 : 41);
  if (kind === 'wood') {
    ctx.fillStyle = '#a99a86'; ctx.fillRect(0, 0, 512, 512);
    for (let row = 0; row < 8; row++) {
      const y = row * 64; ctx.fillStyle = row % 3 === 0 ? '#ad9d88' : row % 3 === 1 ? '#a49480' : '#aa9984'; ctx.fillRect(0, y + 1, 512, 62);
      ctx.strokeStyle = 'rgba(61,51,42,.27)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
      for (let j = 0; j < 28; j++) { const yy = y + 5 + random() * 53; ctx.strokeStyle = `rgba(65,50,37,${.025 + random() * .07})`; ctx.lineWidth = .5 + random() * 1.3; ctx.beginPath(); ctx.moveTo(random() * 60, yy); ctx.bezierCurveTo(160, yy + random() * 4, 340, yy - random() * 4, 512, yy); ctx.stroke(); }
      const seam = row % 2 ? 170 : 345; ctx.strokeStyle = 'rgba(60,50,42,.2)'; ctx.beginPath(); ctx.moveTo(seam, y); ctx.lineTo(seam, y + 64); ctx.stroke();
    }
  } else {
    ctx.fillStyle = kind === 'wall' ? '#c1c6bd' : '#ab9b86'; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 12000; i++) { const v = Math.floor(random() * 255); ctx.fillStyle = kind === 'wall' ? `rgba(${v},${v},${v},.018)` : `rgba(77,64,50,${.015 + random() * .035})`; ctx.fillRect(random() * 512, random() * 512, kind === 'wall' ? 2 : 4, kind === 'wall' ? 2 : 1); }
  }
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 8; return map;
}
const woodMap = texture('wood'), wallMap = texture('wall'), rugMap = texture('rug');


export default function Room3D({ project, catalog }) {
  const hostRef = useRef(null);
  const orbitRef = useRef({ theta: .72, phi: 1.02, radius: null });
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !catalog) return;
    const width = host.clientWidth, height = host.clientHeight;
    if (!width || !height) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#cbd1ca');
    const camera = new THREE.PerspectiveCamera(38, width / height, .1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    host.appendChild(renderer.domElement);
    if (!orbitRef.current.radius) orbitRef.current.radius = Math.max(project.roomW, project.roomD) * 1.95;
    const aim = () => {
      const { theta, phi, radius } = orbitRef.current;
      camera.position.set(radius * Math.sin(theta) * Math.sin(phi), project.roomH * .45 + radius * Math.cos(phi), radius * Math.cos(theta) * Math.sin(phi));
      camera.lookAt(0, project.roomH * .45, 0);
      renderer.render(scene, camera);
    };
    scene.add(new THREE.AmbientLight(0xffffff, .72));
    const sun = new THREE.DirectionalLight(0xffffff, .85);
    sun.position.set(-3, 8, 5); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -10; sun.shadow.camera.right = 10; sun.shadow.camera.top = 10; sun.shadow.camera.bottom = -10;
    scene.add(sun);
    const box = (w, h, d, x, y, z, material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); return mesh;
    };
    // Cutaway room: textured materials, architectural trim, and a few scale cues.
    woodMap.repeat.set(Math.max(1, project.roomW / 2.2), Math.max(1, project.roomD / 2.2));
    const floorMat = new THREE.MeshStandardMaterial({ map: woodMap, color: '#d6ccbd', roughness: .82 });
    box(project.roomW, .12, project.roomD, 0, -.06, 0, floorMat);
    wallMap.repeat.set(project.roomW / 2.5, project.roomH / 2.5);
    const wallMat = new THREE.MeshStandardMaterial({ map: wallMap, color: '#d6d8d0', side: THREE.DoubleSide, roughness: .94 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(project.roomW, project.roomH), wallMat);
    back.position.set(0, project.roomH / 2, -project.roomD / 2); back.receiveShadow = true; scene.add(back);
    const left = new THREE.Mesh(new THREE.PlaneGeometry(project.roomD, project.roomH), wallMat);
    left.position.set(-project.roomW / 2, project.roomH / 2, 0); left.rotation.y = Math.PI / 2; left.receiveShadow = true; scene.add(left);
    const trimMat = new THREE.MeshStandardMaterial({ color: '#d9d8d0', roughness: .7 });
    box(project.roomW, .085, .035, 0, .045, -project.roomD / 2 + .025, trimMat);
    box(.035, .085, project.roomD, -project.roomW / 2 + .025, .045, 0, trimMat);
    const rounded = (w, h, d, radius, x, y, z, material) => {
      const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, radius), material);
      mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); return mesh;
    };
    const sofaW = Math.min(2.25, project.roomW * .5), sofaX = -project.roomW * .15, sofaZ = -project.roomD * .22;
    const fabric = new THREE.MeshStandardMaterial({ color: '#778279', roughness: 1 });
    const cushion = new THREE.MeshStandardMaterial({ color: '#89958a', roughness: 1 });
    const cushion2 = new THREE.MeshStandardMaterial({ color: '#b7aea1', roughness: 1 });
    const darkWood = new THREE.MeshStandardMaterial({ color: '#554b43', roughness: .78 });
    rounded(sofaW, .23, .79, .07, sofaX, .29, sofaZ, fabric);
    rounded(sofaW, .55, .19, .07, sofaX, .62, sofaZ - .34, fabric);
    rounded(.18, .43, .82, .055, sofaX - sofaW / 2 + .05, .42, sofaZ, fabric);
    rounded(.18, .43, .82, .055, sofaX + sofaW / 2 - .05, .42, sofaZ, fabric);
    for (const side of [-1, 1]) {
      rounded((sofaW - .34) / 2, .12, .57, .055, sofaX + side * (sofaW - .34) / 4, .47, sofaZ + .08, cushion);
      const pillow = rounded(.38, .36, .12, .065, sofaX + side * (sofaW * .32), .72, sofaZ - .18, side < 0 ? cushion2 : cushion);
      pillow.rotation.z = side * .14;
      box(.06, .09, .06, sofaX + side * (sofaW / 2 - .13), .07, sofaZ + .27, darkWood);
    }
    rugMap.repeat.set(2, 1);
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(2.8, project.roomW * .62), Math.min(1.7, project.roomD * .5)), new THREE.MeshStandardMaterial({ map: rugMap, color: '#d7cdc0', roughness: 1, side: THREE.DoubleSide }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(.17, .014, project.roomD * .16); rug.receiveShadow = true; scene.add(rug);
    const tableX = Math.min(.72, project.roomW * .15), tableZ = project.roomD * .16;
    const tableMat = new THREE.MeshStandardMaterial({ color: '#98785e', roughness: .58 });
    rounded(1.02, .075, .56, .055, tableX, .38, tableZ, tableMat);
    const metal = new THREE.MeshStandardMaterial({ color: '#343b38', metalness: .55, roughness: .38 });
    for (const dx of [-.39, .39]) for (const dz of [-.19, .19]) box(.035, .34, .035, tableX + dx, .18, tableZ + dz, metal);
    // A restrained vignette on the back wall and a small plant make the room legible as a home.
    const artX = Math.min(project.roomW * .22, project.roomW / 2 - .58), artY = Math.min(project.roomH - .48, 1.78), artZ = -project.roomD / 2 + .035;
    box(.92, .64, .045, artX, artY, artZ, darkWood);
    box(.85, .57, .052, artX, artY, artZ + .008, new THREE.MeshStandardMaterial({ color: '#ded7c6', roughness: .95 }));
    const art1 = new THREE.Mesh(new THREE.CircleGeometry(.23, 32), new THREE.MeshStandardMaterial({ color: '#9b8978', roughness: 1 }));
    art1.position.set(artX + .13, artY - .06, artZ + .039); scene.add(art1);
    const art2 = new THREE.Mesh(new THREE.CircleGeometry(.13, 32), new THREE.MeshStandardMaterial({ color: '#65776d', roughness: 1 }));
    art2.position.set(artX - .12, artY + .12, artZ + .041); scene.add(art2);
    const plantX = project.roomW / 2 - .4, plantZ = -project.roomD / 2 + .42;
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(.16, .11, .25, 16), new THREE.MeshStandardMaterial({ color: '#9c8a78', roughness: .9 }));
    pot.position.set(plantX, .14, plantZ); pot.castShadow = true; scene.add(pot);
    const leafMat = new THREE.MeshStandardMaterial({ color: '#536d56', roughness: .9, side: THREE.DoubleSide });
    for (let i = 0; i < 7; i++) {
      const angle = i * Math.PI * 2 / 7, height = .45 + (i % 3) * .12;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(.009, .012, height, 6), darkWood);
      stem.position.set(plantX + Math.cos(angle) * .06, .28 + height / 2, plantZ + Math.sin(angle) * .06); stem.rotation.z = Math.cos(angle) * .25; scene.add(stem);
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), leafMat);
      leaf.scale.set(.1, .22, .055); leaf.position.set(plantX + Math.cos(angle) * .17, .3 + height, plantZ + Math.sin(angle) * .17); leaf.rotation.z = -Math.cos(angle) * .45; leaf.castShadow = true; scene.add(leaf);
    }
    const railMat = new THREE.MeshStandardMaterial({ color: project.color === 'black' ? '#171c1b' : '#f5f5f1', metalness: .35, roughness: .38 });
    box(project.trackL, project.mount === 'surface' ? .07 : .025, .075, project.trackX, project.roomH - (project.mount === 'surface' ? .045 : .015), project.trackZ, railMat);
    const color = lightColor(project.kelvin), power = project.brightness / 100;
    for (const f of project.fixtures) {
      const spec = catalog.fixtures.find(x => x.id === f.type);
      if (!spec) continue;
      const x = project.trackX + (f.t - .5) * project.trackL;
      const mesh = f.type === 'line' ? new THREE.Mesh(new THREE.BoxGeometry(.38, .07, .095), railMat) : new THREE.Mesh(new THREE.CylinderGeometry(f.type === 'wide' ? .082 : .065, f.type === 'wide' ? .092 : .075, .15, 20), railMat);
      mesh.position.set(x, project.roomH - (f.type === 'line' ? .11 : .16), project.trackZ); mesh.castShadow = true; scene.add(mesh);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(f.type === 'line' ? .16 : .057, 20), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
      lens.rotation.x = Math.PI / 2; lens.position.set(x, project.roomH - (f.type === 'line' ? .155 : .24), project.trackZ); scene.add(lens);
      const spot = new THREE.SpotLight(color, power * (f.type === 'line' ? 27 : 40), project.roomH * 1.8, THREE.MathUtils.degToRad(spec.beam / 2), .75, 1);
      spot.position.set(x, project.roomH - .22, project.trackZ); spot.target.position.set(x, 0, project.trackZ); spot.castShadow = true; spot.shadow.mapSize.set(512, 512); scene.add(spot, spot.target);
    }
    let dragging = false, lastX = 0, lastY = 0;
    const down = e => { dragging = true; lastX = e.clientX; lastY = e.clientY; renderer.domElement.setPointerCapture(e.pointerId); };
    const move = e => { if (!dragging) return; orbitRef.current.theta -= (e.clientX - lastX) * .008; orbitRef.current.phi = clamp(orbitRef.current.phi + (e.clientY - lastY) * .007, .3, 1.5); lastX = e.clientX; lastY = e.clientY; aim(); };
    const up = () => { dragging = false; };
    const wheel = e => { e.preventDefault(); orbitRef.current.radius = clamp(orbitRef.current.radius + e.deltaY * .008, 4, 25); aim(); };
    renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointermove', move); renderer.domElement.addEventListener('pointerup', up); renderer.domElement.addEventListener('wheel', wheel, { passive: false });
    aim();
    return () => { renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointermove', move); renderer.domElement.removeEventListener('pointerup', up); renderer.domElement.removeEventListener('wheel', wheel); scene.traverse(node => { if (node.geometry) node.geometry.dispose(); if (node.material) (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => m.dispose()); }); renderer.dispose(); renderer.domElement.remove(); };
  }, [project, catalog]);
  return <div id="three-view" ref={hostRef} />;
}
