import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Catalog, Project } from "../shared";

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
function lightColor(k: number) {
  const t = clamp((k - 2700) / 2300, 0, 1);
  return new THREE.Color().setRGB(1, 0.67 + t * 0.22, 0.43 + t * 0.52);
}
function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
function texture(kind: "wood" | "wall") {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");
  const random = seeded(kind === "wood" ? 17 : 29);
  if (kind === "wood") {
    ctx.fillStyle = "#aa9882";
    ctx.fillRect(0, 0, 512, 512);
    for (let row = 0; row < 16; row++) {
      const y = row * 32;
      const tone = 149 + Math.floor(random() * 5);
      ctx.fillStyle = `rgb(${tone + 17},${tone},${tone - 20})`;
      ctx.fillRect(0, y + 1, 512, 31);
      ctx.strokeStyle = "rgba(61,51,42,.13)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
      for (let j = 0; j < 18; j++) {
        const yy = y + 3 + random() * 26;
        ctx.strokeStyle = `rgba(65,50,37,${0.015 + random() * 0.025})`;
        ctx.lineWidth = 0.5 + random() * 0.5;
        ctx.beginPath();
        ctx.moveTo(random() * 60, yy);
        ctx.bezierCurveTo(
          160,
          yy + random() * 4,
          340,
          yy - random() * 4,
          512,
          yy,
        );
        ctx.stroke();
      }
      const seam = row % 2 ? 170 : 345;
      ctx.strokeStyle = "rgba(60,50,42,.1)";
      ctx.beginPath();
      ctx.moveTo(seam, y);
      ctx.lineTo(seam, y + 32);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = "#c1c6bd";
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 12000; i++) {
      const v = Math.floor(random() * 255);
      ctx.fillStyle = `rgba(${v},${v},${v},.018)`;
      ctx.fillRect(random() * 512, random() * 512, 2, 2);
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;
  return map;
}
const woodMap = texture("wood"),
  wallMap = texture("wall");

export default function Room3D({
  project,
  catalog,
}: {
  project: Project;
  catalog: Catalog | null;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<{
    theta: number;
    phi: number;
    radius: number | null;
  }>({ theta: 0.72, phi: 1.02, radius: null });
  const lampsRef = useRef<
    Array<{
      spot: THREE.SpotLight;
      lens: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
      baseIntensity: number;
    }>
  >([]);
  const renderRef = useRef<(() => void) | null>(null);
  const fixtureSceneRef = useRef<{
    group: THREE.Group;
    railMat: THREE.MeshStandardMaterial;
  } | null>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !catalog) return;
    const width = host.clientWidth,
      height = host.clientHeight;
    if (!width || !height) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#cbd1ca");
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    host.appendChild(renderer.domElement);
    if (!orbitRef.current.radius)
      orbitRef.current.radius = Math.max(project.roomW, project.roomD) * 1.95;
    const aim = () => {
      const { theta, phi } = orbitRef.current;
      const radius =
        orbitRef.current.radius ??
        Math.max(project.roomW, project.roomD) * 1.95;
      camera.position.set(
        radius * Math.sin(theta) * Math.sin(phi),
        project.roomH * 0.45 + radius * Math.cos(phi),
        radius * Math.cos(theta) * Math.sin(phi),
      );
      camera.lookAt(0, project.roomH * 0.45, 0);
      renderer.render(scene, camera);
    };
    renderRef.current = aim;
    scene.add(new THREE.AmbientLight(0xffffff, 0.72));
    const sun = new THREE.DirectionalLight(0xffffff, 0.85);
    sun.position.set(-3, 8, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -10;
    sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 10;
    sun.shadow.camera.bottom = -10;
    scene.add(sun);
    const box = (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      material: THREE.Material,
    ) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    };
    // Cutaway room: textured materials, architectural trim, and a few scale cues.
    woodMap.repeat.set(
      Math.max(1, Math.round(project.roomW / 2.2)),
      Math.max(1, Math.round(project.roomD / 2.2)),
    );
    const floorMat = new THREE.MeshStandardMaterial({
      map: woodMap,
      color: "#d6ccbd",
      roughness: 0.82,
    });
    box(project.roomW, 0.12, project.roomD, 0, -0.06, 0, floorMat);
    wallMap.repeat.set(project.roomW / 2.5, project.roomH / 2.5);
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallMap,
      color: "#d6d8d0",
      side: THREE.DoubleSide,
      roughness: 0.94,
    });
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(project.roomW, project.roomH),
      wallMat,
    );
    back.position.set(0, project.roomH / 2, -project.roomD / 2);
    back.receiveShadow = true;
    scene.add(back);
    const left = new THREE.Mesh(
      new THREE.PlaneGeometry(project.roomD, project.roomH),
      wallMat,
    );
    left.position.set(-project.roomW / 2, project.roomH / 2, 0);
    left.rotation.y = Math.PI / 2;
    left.receiveShadow = true;
    scene.add(left);
    const trimMat = new THREE.MeshStandardMaterial({
      color: "#d9d8d0",
      roughness: 0.7,
    });
    box(
      project.roomW,
      0.085,
      0.035,
      0,
      0.045,
      -project.roomD / 2 + 0.025,
      trimMat,
    );
    box(
      0.035,
      0.085,
      project.roomD,
      -project.roomW / 2 + 0.025,
      0.045,
      0,
      trimMat,
    );
    const rounded = (
      w: number,
      h: number,
      d: number,
      radius: number,
      x: number,
      y: number,
      z: number,
      material: THREE.Material,
    ) => {
      const mesh = new THREE.Mesh(
        new RoundedBoxGeometry(w, h, d, 4, radius),
        material,
      );
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    };
    const sofaW = Math.min(2.25, project.roomW * 0.5),
      sofaX = -project.roomW * 0.15,
      sofaZ = -project.roomD * 0.22;
    const fabric = new THREE.MeshStandardMaterial({
      color: "#778279",
      roughness: 1,
    });
    const cushion = new THREE.MeshStandardMaterial({
      color: "#89958a",
      roughness: 1,
    });
    const cushion2 = new THREE.MeshStandardMaterial({
      color: "#b7aea1",
      roughness: 1,
    });
    const darkWood = new THREE.MeshStandardMaterial({
      color: "#554b43",
      roughness: 0.78,
    });
    rounded(sofaW, 0.23, 0.79, 0.07, sofaX, 0.29, sofaZ, fabric);
    rounded(sofaW, 0.55, 0.19, 0.07, sofaX, 0.62, sofaZ - 0.34, fabric);
    rounded(
      0.18,
      0.43,
      0.82,
      0.055,
      sofaX - sofaW / 2 + 0.05,
      0.42,
      sofaZ,
      fabric,
    );
    rounded(
      0.18,
      0.43,
      0.82,
      0.055,
      sofaX + sofaW / 2 - 0.05,
      0.42,
      sofaZ,
      fabric,
    );
    for (const side of [-1, 1]) {
      rounded(
        (sofaW - 0.34) / 2,
        0.12,
        0.57,
        0.055,
        sofaX + (side * (sofaW - 0.34)) / 4,
        0.47,
        sofaZ + 0.08,
        cushion,
      );
      const pillow = rounded(
        0.38,
        0.36,
        0.12,
        0.065,
        sofaX + side * (sofaW * 0.32),
        0.72,
        sofaZ - 0.18,
        side < 0 ? cushion2 : cushion,
      );
      pillow.rotation.z = side * 0.14;
      box(
        0.06,
        0.09,
        0.06,
        sofaX + side * (sofaW / 2 - 0.13),
        0.07,
        sofaZ + 0.27,
        darkWood,
      );
    }
    const tableX = Math.min(0.72, project.roomW * 0.15),
      tableZ = project.roomD * 0.16;
    const tableMat = new THREE.MeshStandardMaterial({
      color: "#98785e",
      roughness: 0.58,
    });
    rounded(1.02, 0.075, 0.56, 0.055, tableX, 0.38, tableZ, tableMat);
    const metal = new THREE.MeshStandardMaterial({
      color: "#343b38",
      metalness: 0.55,
      roughness: 0.38,
    });
    for (const dx of [-0.39, 0.39])
      for (const dz of [-0.19, 0.19])
        box(0.035, 0.34, 0.035, tableX + dx, 0.18, tableZ + dz, metal);
    // A restrained vignette on the back wall and a small plant make the room legible as a home.
    const artX = Math.min(project.roomW * 0.22, project.roomW / 2 - 0.58),
      artY = Math.min(project.roomH - 0.48, 1.78),
      artZ = -project.roomD / 2 + 0.035;
    box(0.92, 0.64, 0.045, artX, artY, artZ, darkWood);
    box(
      0.85,
      0.57,
      0.052,
      artX,
      artY,
      artZ + 0.008,
      new THREE.MeshStandardMaterial({ color: "#ded7c6", roughness: 0.95 }),
    );
    const art1 = new THREE.Mesh(
      new THREE.CircleGeometry(0.23, 32),
      new THREE.MeshStandardMaterial({ color: "#9b8978", roughness: 1 }),
    );
    art1.position.set(artX + 0.13, artY - 0.06, artZ + 0.039);
    scene.add(art1);
    const art2 = new THREE.Mesh(
      new THREE.CircleGeometry(0.13, 32),
      new THREE.MeshStandardMaterial({ color: "#65776d", roughness: 1 }),
    );
    art2.position.set(artX - 0.12, artY + 0.12, artZ + 0.041);
    scene.add(art2);
    const plantX = project.roomW / 2 - 0.4,
      plantZ = -project.roomD / 2 + 0.42;
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.11, 0.25, 16),
      new THREE.MeshStandardMaterial({ color: "#9c8a78", roughness: 0.9 }),
    );
    pot.position.set(plantX, 0.14, plantZ);
    pot.castShadow = true;
    scene.add(pot);
    const leafMat = new THREE.MeshStandardMaterial({
      color: "#536d56",
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 7; i++) {
      const angle = (i * Math.PI * 2) / 7,
        height = 0.45 + (i % 3) * 0.12;
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.009, 0.012, height, 6),
        darkWood,
      );
      stem.position.set(
        plantX + Math.cos(angle) * 0.06,
        0.28 + height / 2,
        plantZ + Math.sin(angle) * 0.06,
      );
      stem.rotation.z = Math.cos(angle) * 0.25;
      scene.add(stem);
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), leafMat);
      leaf.scale.set(0.1, 0.22, 0.055);
      leaf.position.set(
        plantX + Math.cos(angle) * 0.17,
        0.3 + height,
        plantZ + Math.sin(angle) * 0.17,
      );
      leaf.rotation.z = -Math.cos(angle) * 0.45;
      leaf.castShadow = true;
      scene.add(leaf);
    }
    const railMat = new THREE.MeshStandardMaterial({
      color: project.color === "black" ? "#171c1b" : "#f5f5f1",
      metalness: 0.35,
      roughness: 0.38,
    });
    const rail = box(
      project.trackL,
      project.mount === "surface" ? 0.07 : 0.025,
      0.075,
      project.trackX,
      project.roomH - (project.mount === "surface" ? 0.045 : 0.015),
      project.trackZ,
      railMat,
    );
    rail.castShadow = false;
    const fixtureGroup = new THREE.Group();
    scene.add(fixtureGroup);
    fixtureSceneRef.current = { group: fixtureGroup, railMat };
    let dragging = false,
      lastX = 0,
      lastY = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      orbitRef.current.theta -= (e.clientX - lastX) * 0.008;
      orbitRef.current.phi = clamp(
        orbitRef.current.phi + (e.clientY - lastY) * 0.007,
        0.3,
        1.5,
      );
      lastX = e.clientX;
      lastY = e.clientY;
      aim();
    };
    const up = () => {
      dragging = false;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      orbitRef.current.radius = clamp(
        (orbitRef.current.radius ?? 8) + e.deltaY * 0.008,
        4,
        25,
      );
      aim();
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("wheel", wheel, { passive: false });
    aim();
    return () => {
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("wheel", wheel);
      scene.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        node.geometry.dispose();
        const materials = Array.isArray(node.material)
          ? node.material
          : [node.material];
        materials.forEach((material: THREE.Material) => material.dispose());
      });
      fixtureSceneRef.current = null;
      renderRef.current = null;
      lampsRef.current = [];
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [
    project.roomW,
    project.roomD,
    project.roomH,
    project.trackX,
    project.trackZ,
    project.trackL,
    project.mount,
    project.color,
    catalog,
  ]);
  useEffect(() => {
    const fixtureScene = fixtureSceneRef.current;
    if (!fixtureScene || !catalog) return;
    const { group, railMat } = fixtureScene;
    group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.geometry.dispose();
      if (node.material !== railMat) {
        const materials = Array.isArray(node.material)
          ? node.material
          : [node.material];
        materials.forEach((material) => material.dispose());
      }
    });
    group.clear();
    const color = lightColor(project.kelvin),
      power = project.brightness / 100;
    lampsRef.current = [];
    const lightCount = Math.min(4, project.fixtures.length);
    const illuminated = new Set(
      Array.from({ length: lightCount }, (_, index) =>
        lightCount === 1
          ? 0
          : Math.round(
              (index * (project.fixtures.length - 1)) / (lightCount - 1),
            ),
      ),
    );
    for (const [index, f] of project.fixtures.entries()) {
      const spec = catalog.fixtures.find((x) => x.id === f.type);
      if (!spec) continue;
      const x = project.trackX + (f.t - 0.5) * project.trackL;
      const mountOffset = project.mount === "recessed" ? 0.05 : 0;
      const mesh =
        f.type === "line"
          ? new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.07, 0.095), railMat)
          : new THREE.Mesh(
              new THREE.CylinderGeometry(
                f.type === "wide" ? 0.082 : 0.065,
                f.type === "wide" ? 0.092 : 0.075,
                0.15,
                20,
              ),
              railMat,
            );
      mesh.position.set(
        x,
        project.roomH - (f.type === "line" ? 0.11 : 0.16) + mountOffset,
        project.trackZ,
      );
      mesh.castShadow = false;
      group.add(mesh);
      const lens = new THREE.Mesh(
        new THREE.CircleGeometry(f.type === "line" ? 0.16 : 0.057, 20),
        new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
      );
      lens.rotation.x = Math.PI / 2;
      lens.position.set(
        x,
        project.roomH - (f.type === "line" ? 0.155 : 0.24) + mountOffset,
        project.trackZ,
      );
      group.add(lens);
      // Representative spotlights light the room; every fixture still has a visible lens.
      if (!illuminated.has(index)) continue;
      const spot = new THREE.SpotLight(
        color,
        power * (f.type === "line" ? 27 : 40),
        project.roomH * 1.8,
        THREE.MathUtils.degToRad(spec.beam / 2),
        0.75,
        1,
      );
      spot.position.set(x, project.roomH - 0.22 + mountOffset, project.trackZ);
      spot.target.position.set(x, 0, project.trackZ);
      spot.castShadow = false;
      group.add(spot, spot.target);
      lampsRef.current.push({
        spot,
        lens,
        baseIntensity: f.type === "line" ? 27 : 40,
      });
    }
    renderRef.current?.();
  }, [
    project.fixtures,
    project.roomW,
    project.roomD,
    project.roomH,
    project.trackX,
    project.trackZ,
    project.trackL,
    project.mount,
    project.color,
    catalog,
  ]);
  useEffect(() => {
    const color = lightColor(project.kelvin);
    for (const { spot, lens, baseIntensity } of lampsRef.current) {
      spot.color.copy(color);
      spot.intensity = (baseIntensity * project.brightness) / 100;
      lens.material.color.copy(color);
    }
    renderRef.current?.();
  }, [project.kelvin, project.brightness]);
  return <div id="three-view" ref={hostRef} />;
}
