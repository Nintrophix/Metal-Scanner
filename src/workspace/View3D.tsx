import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { bbox, ensureCCW, type Part } from '../geom/polygon';

/**
 * Extruded preview of the 2D profile. Thickness is the stock/cut-depth setting, not a measured
 * value: the scanner sees the part from above only.
 */
export function View3D({ part, original, thickness, compare }: { part: Part; original: Part | null; thickness: number; compare: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls; group: THREE.Group; frame: number } | null>(null);
  const framedFor = useRef('');

  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      el.textContent = 'WebGL is not available in this browser, so the 3D preview cannot be shown. The plan view and exports are unaffected.';
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100000);
    camera.up.set(0, 0, 1);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9bccb, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-1, -2, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xdfe1ff, 0.6);
    rim.position.set(2, 1, 1.5);
    scene.add(rim);
    const group = new THREE.Group();
    scene.add(group);
    const s = { renderer, scene, camera, controls, group, frame: 0 };
    sceneRef.current = s;
    // A fresh camera needs framing even if an earlier (disposed) scene was framed.
    framedFor.current = '';

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      s.frame = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(s.frame);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    for (const c of [...s.group.children]) {
      s.group.remove(c);
      c.traverse((o) => {
        if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose();
      });
    }
    const outline = ensureCCW(part.outline);
    if (outline.length < 3) return;
    const shape = new THREE.Shape(outline.map((p) => new THREE.Vector2(p.x, p.y)));
    for (const h of part.holes) {
      const path = new THREE.Path();
      path.absarc(h.x, h.y, h.d / 2, 0, Math.PI * 2, true);
      shape.holes.push(path);
    }
    const depth = Math.max(0.1, thickness);
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 48 });
    const mat = new THREE.MeshStandardMaterial({ color: 0xd2d4dc, metalness: 0.2, roughness: 0.55 });
    s.group.add(new THREE.Mesh(geo, mat));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color: 0x5c5d68 }));
    s.group.add(edges);

    const b = bbox(outline);
    const span = Math.max(b.maxX - b.minX, b.maxY - b.minY);
    const grid = new THREE.GridHelper(span * 2, 20, 0xd3d3da, 0xe5e5ea);
    grid.rotation.x = Math.PI / 2;
    grid.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, -0.01);
    s.group.add(grid);

    if (compare && original) {
      const pts = ensureCCW(original.outline).map((p) => new THREE.Vector3(p.x, p.y, depth + 0.05));
      const ghost = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0x8a8b99, dashSize: span / 80, gapSize: span / 120 }));
      ghost.computeLineDistances();
      s.group.add(ghost);
    }

    // Frame the camera once per part footprint so edits do not yank the view.
    const key = `${Math.round(span)}`;
    if (framedFor.current !== key) {
      framedFor.current = key;
      const c = new THREE.Vector3((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, depth / 2);
      s.controls.target.copy(c);
      // Fit the bounding sphere inside the narrower of the two fields of view.
      const radius = Math.hypot(b.maxX - b.minX, b.maxY - b.minY, depth) / 2;
      const fovV = (s.camera.fov * Math.PI) / 180;
      const fovH = 2 * Math.atan(Math.tan(fovV / 2) * s.camera.aspect);
      const d = (radius / Math.sin(Math.min(fovV, fovH) / 2)) * 1.08;
      const dir = new THREE.Vector3(-0.35, -0.8, 0.62).normalize();
      s.camera.position.copy(c.clone().addScaledVector(dir, d));
      s.camera.near = span / 100;
      s.camera.far = span * 100;
      s.camera.updateProjectionMatrix();
    }
  }, [part, original, thickness, compare]);

  return <div ref={host} className="view3d" aria-label="3D extruded preview. Drag to orbit, scroll to zoom." />;
}
