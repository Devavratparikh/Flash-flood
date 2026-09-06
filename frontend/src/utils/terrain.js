import * as THREE from "three";
import { TIER, tierFor } from "../data/districts.js";

// ---------------------------------------------------------------------------
// PHASE 2+ NOTE: everything in this file generates a *procedural* terrain.
// When you move to real elevation data, this is the file to change:
//   - heightAt(x, z, seed) gets replaced by a lookup into a real DEM raster
//     (SRTM/Bhuvan), sampled onto this same grid.
//   - makeDetailTexture() gets replaced by an actual satellite image tile
//     (e.g. via Mapbox GL JS's raster-dem + satellite-v9 style).
// The rest of the pipeline (mesh, river, markers, camera) stays the same.
// ---------------------------------------------------------------------------

export const W = 640, D = 420, SEGX = 110, SEGZ = 70;

export function riverZ(x, seed) {
  return 70 * Math.sin(((x + W / 2) / W) * Math.PI * 2 * 1.15 + seed);
}

export function heightAt(x, z, seed) {
  const rz = riverZ(x, seed);
  const d = Math.abs(z - rz);
  const slope = Math.pow(d, 0.86) * 0.62;
  const bigForm = Math.sin(x * 0.006 + seed) * Math.cos(z * 0.008 + seed * 1.4) * 6;
  const noise =
    Math.sin(x * 0.014 + seed) * Math.cos(z * 0.02 + seed * 1.7) * 9 +
    Math.sin(x * 0.05 + seed * 2.3) * 3.2 +
    Math.sin(x * 0.11 + z * 0.09 + seed * 3.1) * 1.6;
  return Math.min(Math.max(slope + noise + bigForm, 1.2), 92);
}

// Terrain surface colors intentionally stay natural/realistic (green valley
// floor -> rock -> snow) rather than matching the site's UI palette -- these
// represent elevation, not branding.
function colorForHeight(h) {
  const stops = [
    { t: 0, c: [42, 88, 56] },
    { t: 14, c: [83, 106, 60] },
    { t: 32, c: [111, 99, 76] },
    { t: 55, c: [131, 126, 120] },
    { t: 92, c: [228, 232, 236] },
  ];
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (h >= stops[i].t && h <= stops[i + 1].t) {
      a = stops[i];
      b = stops[i + 1];
      break;
    }
  }
  const span = b.t - a.t || 1;
  const f = Math.min(Math.max((h - a.t) / span, 0), 1);
  return [
    (a.c[0] + (b.c[0] - a.c[0]) * f) / 255,
    (a.c[1] + (b.c[1] - a.c[1]) * f) / 255,
    (a.c[2] + (b.c[2] - a.c[2]) * f) / 255,
  ];
}

export function makeDetailTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f2f2f0";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, r = 1.5 + Math.random() * 5;
    const dark = Math.random() > 0.4;
    ctx.beginPath();
    ctx.fillStyle = dark ? `rgba(20,20,15,${0.05 + Math.random() * 0.08})` : `rgba(255,255,255,${0.04 + Math.random() * 0.07})`;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 7);
  return tex;
}

export function makeFlowTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#2c7a9a";
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 4;
  for (let i = -64; i < 128; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 64, 64);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 1);
  return tex;
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function disposeObject(obj) {
  if (!obj) return;
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });
}

export function buildDistrictGroup(district) {
  const group = new THREE.Group();

  const geo = new THREE.PlaneGeometry(W, D, SEGX, SEGZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z, district.seed);
    pos.setY(i, h);
    const [r, g, b] = colorForHeight(h);
    colors.push(r, g, b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const detailTex = makeDetailTexture();
  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: detailTex,
    roughness: 0.92,
    metalness: 0,
  });
  const terrain = new THREE.Mesh(geo, terrainMat);
  terrain.receiveShadow = true;
  terrain.castShadow = true;
  group.add(terrain);

  const riverPts = [];
  for (let x = -W / 2; x <= W / 2; x += 24) {
    const rz = riverZ(x, district.seed);
    const h = heightAt(x, rz, district.seed);
    riverPts.push(new THREE.Vector3(x, h + 1.4, rz));
  }
  const curve = new THREE.CatmullRomCurve3(riverPts);
  const tubeGeo = new THREE.TubeGeometry(curve, 220, 6.5, 8, false);
  const flowTex = makeFlowTexture();
  const riverMat = new THREE.MeshStandardMaterial({
    map: flowTex,
    transparent: true,
    opacity: 0.9,
    roughness: 0.2,
    metalness: 0.15,
    emissive: 0x0c3c56,
    emissiveIntensity: 0.35,
  });
  const river = new THREE.Mesh(tubeGeo, riverMat);
  group.add(river);
  group.userData.flowTex = flowTex;

  const markers = [];
  district.zones.forEach((z) => {
    const tier = tierFor(z.score);
    const zc = riverZ(z.x, district.seed) + z.zOff;
    const h = heightAt(z.x, zc, district.seed);
    const color = TIER[tier].hex;

    const postGeo = new THREE.CylinderGeometry(1.1, 1.1, 14, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x2b3540 });
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(z.x, h + 7, zc);
    post.castShadow = true;
    group.add(post);

    const headGeo = new THREE.SphereGeometry(6.5, 20, 20);
    const headMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.55,
      roughness: 0.4,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(z.x, h + 15, zc);
    head.castShadow = true;
    head.userData.zoneId = z.id;
    head.userData.baseY = h + 15;
    head.userData.tier = tier;
    group.add(head);
    markers.push(head);

    const ringGeo = new THREE.RingGeometry(9, 12, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(z.x, h + 1.6, zc);
    group.add(ring);
  });

  return { group, curve, markers };
}