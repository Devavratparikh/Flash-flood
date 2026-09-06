import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  W, D,
  easeOutCubic,
  disposeObject,
  buildDistrictGroup,
} from "../utils/terrain.js";

export default function TerrainCanvas({ district, selected, onSelect }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);

  if (sceneRef.current) {
    sceneRef.current.selectedId = selected ? selected.id : null;
  }

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 800;
    const height = mount.clientHeight || 480;

    const scene = new THREE.Scene();
    // Flat background matching the site's theme color exactly, no gradient.
    scene.background = new THREE.Color(0x0b0f14);
    scene.fog = new THREE.Fog(0x0b0f14, 460, 980);

    const camera = new THREE.PerspectiveCamera(42, width / height, 1, 2000);
    camera.position.set(0, 420, 620);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 10, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 220;
    controls.maxDistance = 900;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.update();

    scene.add(new THREE.AmbientLight(0x8fa4b5, 0.28));
    scene.add(new THREE.HemisphereLight(0x9fc0d4, 0x3c3226, 0.55));
    const sun = new THREE.DirectionalLight(0xffe9c8, 1.2);
    sun.position.set(-260, 340, 180);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -W / 1.5;
    sun.shadow.camera.right = W / 1.5;
    sun.shadow.camera.top = D / 1.1;
    sun.shadow.camera.bottom = -D / 1.1;
    sun.shadow.camera.near = 50;
    sun.shadow.camera.far = 900;
    sun.shadow.bias = -0.0018;
    sun.target.position.set(0, 0, 0);
    scene.add(sun.target);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x5b8fa8, 0.3);
    rim.position.set(200, 120, -260);
    scene.add(rim);

    const particleCount = 22;
    const particles = [];
    const pGeo = new THREE.SphereGeometry(2.6, 10, 10);
    const pMat = new THREE.MeshStandardMaterial({
      color: 0xe6f6ff,
      emissive: 0x7cc4e0,
      emissiveIntensity: 0.95,
      roughness: 0.25,
    });
    for (let i = 0; i < particleCount; i++) {
      const mesh = new THREE.Mesh(pGeo, pMat);
      mesh.userData.t = i / particleCount;
      scene.add(mesh);
      particles.push(mesh);
    }

    const state = {
      scene, camera, renderer, controls, particles,
      districtGroup: null, curve: null, markers: [], district: null,
      selectedId: selected ? selected.id : null,
      zoomAnim: null,
    };
    sceneRef.current = state;

    let downX = 0, downY = 0, moved = 0;
    const dom = renderer.domElement;
    const raycaster = new THREE.Raycaster();
    const mouseV = new THREE.Vector2();

    function handleClick(e) {
      const rect = dom.getBoundingClientRect();
      mouseV.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseV.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouseV, camera);
      const hits = raycaster.intersectObjects(state.markers);
      if (hits.length && state.district) {
        const zid = hits[0].object.userData.zoneId;
        const z = state.district.zones.find((zz) => zz.id === zid);
        if (z) onSelect(z);
      }
    }
    const onDown = (e) => { downX = e.clientX; downY = e.clientY; moved = 0; state.zoomAnim = null; };
    const onMove = (e) => { moved += Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY); };
    const onUp = (e) => { if (moved < 6) handleClick(e); };
    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointerup", onUp);
    dom.addEventListener("wheel", () => { state.zoomAnim = null; }, { passive: true });

    let raf;
    const clock = new THREE.Clock();
    function animate() {
      const dt = Math.min(clock.getDelta(), 0.1);

      if (state.zoomAnim) {
        const t = Math.min((performance.now() - state.zoomAnim.start) / state.zoomAnim.duration, 1);
        const e = easeOutCubic(t);
        camera.position.lerpVectors(state.zoomAnim.fromPos, state.zoomAnim.toPos, e);
        controls.update();
        if (t >= 1) {
          state.zoomAnim = null;
          controls.enabled = true;
        }
      } else {
        controls.update();
      }

      if (state.districtGroup && state.districtGroup.userData.flowTex) {
        state.districtGroup.userData.flowTex.offset.x -= dt * 0.6;
      }
      if (state.curve) {
        state.particles.forEach((p) => {
          p.userData.t = (p.userData.t + dt * 0.045) % 1;
          const pt = state.curve.getPointAt(p.userData.t);
          p.position.set(pt.x, pt.y + 1.2, pt.z);
        });
      }
      state.markers.forEach((m) => {
        if (m.userData.tier === "act") {
          const s = 1 + Math.sin(performance.now() * 0.006) * 0.18;
          m.scale.set(s, s, s);
        }
        m.position.y = state.selectedId === m.userData.zoneId
          ? m.userData.baseY + 3 + Math.sin(performance.now() * 0.004) * 1.5
          : m.userData.baseY;
      });

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    }
    animate();

    function onResize() {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) return;
      const aspect = w / h;
      camera.aspect = aspect;
      camera.fov = aspect < 1 ? 56 : 42;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    onResize();
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("pointerup", onUp);
      controls.dispose();
      if (state.districtGroup) disposeObject(state.districtGroup);
      pGeo.dispose();
      pMat.dispose();
      if (mount.contains(dom)) mount.removeChild(dom);
      renderer.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const state = sceneRef.current;
    if (!state) return;

    if (state.districtGroup) {
      state.scene.remove(state.districtGroup);
      disposeObject(state.districtGroup);
    }
    const { group, curve, markers } = buildDistrictGroup(district);
    state.scene.add(group);
    state.districtGroup = group;
    state.curve = curve;
    state.markers = markers;
    state.district = district;

    const overview = new THREE.Vector3(
      state.camera.position.x * 1.4 + 120,
      620,
      state.camera.position.z * 1.4 + 260
    );
    const focused = new THREE.Vector3(280, 260, 420);

    state.controls.enabled = false;
    state.camera.position.copy(overview);
    state.zoomAnim = {
      start: performance.now(),
      duration: 1300,
      fromPos: overview,
      toPos: focused,
    };
  }, [district]);

  return <div ref={mountRef} className="ff-terrain-wrap" style={{ width: "100%", position: "relative" }} />;
}