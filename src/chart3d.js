import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export class CrateChart {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    this.camera.position.set(-8, 11, 15);
    this.camera.lookAt(0, 2, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.42;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 40;
    this.controls.target.set(0, 2.4, 0);
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.25;

    this._addLights();
    this._addZones();
    this._addLabels();
    this.barGroup = new THREE.Group();
    this.scene.add(this.barGroup);
    this._activeStockId = null;

    this._resize();
    window.addEventListener("resize", () => this._resize());
    this._animate();
  }

  _addLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const hemi = new THREE.HemisphereLight(0xdffff0, 0x8e6a42, 0.6);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 1.05);
    sun.position.set(7, 14, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    this.scene.add(sun);

    const rim = new THREE.DirectionalLight(0xffe3a3, 0.45);
    rim.position.set(-8, 5, -6);
    this.scene.add(rim);
  }

  _addZones() {
    // green grass support zone (floor)
    const floorGeo = new THREE.PlaneGeometry(30, 16);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x70c76d, roughness: 1, transparent: true, opacity: 0.85 });
    this.floor = new THREE.Mesh(floorGeo, floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = 0.02;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);

    // red shade resistance zone (ceiling)
    const ceilGeo = new THREE.PlaneGeometry(30, 16);
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0xef6a4b, roughness: 0.9, transparent: true, opacity: 0.36, side: THREE.DoubleSide });
    this.ceiling = new THREE.Mesh(ceilGeo, ceilMat);
    this.ceiling.rotation.x = Math.PI / 2;
    this.ceiling.position.y = 12;
    this.scene.add(this.ceiling);

    // subtle ground grid for depth
    const grid = new THREE.GridHelper(30, 30, 0x498f4b, 0x79c97a);
    grid.position.y = 0.06;
    grid.material.opacity = 0.35;
    grid.material.transparent = true;
    this.scene.add(grid);
  }

  _addLabels() {
    const support = document.createElement("div");
    support.className = "chart-label support-label";
    support.textContent = "SUPPORT · सपोर्ट ज़ोन 🌱";
    this.supportLabel = support;
    this.container.appendChild(support);

    const resistance = document.createElement("div");
    resistance.className = "chart-label resistance-label";
    resistance.textContent = "RESISTANCE · रेजिस्टेंस ज़ोन 🏠";
    this.resistanceLabel = resistance;
    this.container.appendChild(resistance);

    const bubble = document.createElement("div");
    bubble.className = "chart-label price-bubble";
    bubble.textContent = "भाव: ₹—";
    this.priceBubble = bubble;
    this.container.appendChild(bubble);
  }

  setPriceLabel(price) {
    this.priceBubble.textContent = "भाव: ₹" + Number(price).toLocaleString("en-IN");
  }

  _resize() {
    const w = this.container.clientWidth || 400;
    const h = this.container.clientHeight || 400;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _woodTexture() {
    if (this._tex) return this._tex;
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#c89055";
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 14; i++) {
      ctx.strokeStyle = i % 2 ? "rgba(0,0,0,0.09)" : "rgba(255,255,255,0.12)";
      ctx.lineWidth = 2 + Math.random() * 2;
      ctx.beginPath();
      const y = i * 10 + Math.random() * 4;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(40, y + 6 * Math.sin(i), 90, y - 5 * Math.cos(i * 2), 128, y + 3);
      ctx.stroke();
    }
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = "rgba(90,54,20,0.22)";
      ctx.beginPath();
      ctx.ellipse(Math.random() * 128, Math.random() * 128, 4 + Math.random() * 7, 2 + Math.random() * 3, Math.random(), 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    tex.anisotropy = 4;
    this._tex = tex;
    return tex;
  }

  _crateMaterial(colorHex) {
    const mat = new THREE.MeshStandardMaterial({
      map: this._woodTexture(),
      color: colorHex,
      roughness: 0.75,
      metalness: 0.05,
    });
    return mat;
  }

  setStock(stockId) {
    this._activeStockId = stockId;
  }

  update(stock, history) {
    if (!history) return;
    this._activeStockId = stock.id;

    // clear old bars
    while (this.barGroup.children.length) {
      const child = this.barGroup.children.pop();
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    }

    const min = Math.min(...history) - 2;
    const max = Math.max(...history) + 2;
    const span = Math.max(1, max - min);
    const n = history.length;
    const spacing = Math.min(0.9, 20 / Math.max(1, n));
    const width = Math.max(0.22, spacing * 0.62);
    const crateH = 0.52;
    const maxCrates = 16;
    const maxHeight = 10.7;
    const greenMat = this._crateMaterial(0x4fbd65);
    const redMat = this._crateMaterial(0xe46747);
    const goldMat = this._crateMaterial(0xffd25e);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x5c3b1e, transparent: true, opacity: 0.35 });

    for (let i = 0; i < n; i++) {
      const price = history[i];
      const prev = i > 0 ? history[i - 1] : price;
      const up = price >= prev;
      const height = ((price - min) / span) * maxHeight + 0.5;
      const crates = Math.max(1, Math.min(maxCrates, Math.round(height / crateH)));
      const x = (i - (n - 1) / 2) * spacing;
      const mat = up ? greenMat : redMat;

      for (let c = 0; c < crates; c++) {
        const y = c * crateH + crateH / 2;
        const isLast = i === n - 1;
        const geo = new THREE.BoxGeometry(width, crateH * 0.9, width);
        const cube = new THREE.Mesh(geo, isLast ? goldMat : mat);
        cube.position.set(x, y, 0);
        cube.castShadow = true;
        cube.receiveShadow = true;
        this.barGroup.add(cube);

        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat);
        edges.position.copy(cube.position);
        this.barGroup.add(edges);
      }
    }

    this.setPriceLabel(history[n - 1]);
    this._resize();
  }

  _animate() {
    this._raf = requestAnimationFrame(() => this._animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    this.renderer.dispose();
    this.controls.dispose();
  }
}
