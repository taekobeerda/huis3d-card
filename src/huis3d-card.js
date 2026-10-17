// huis3d-card: lichte 3D-weergave van het huis in Home Assistant (eigen kaart, three.js r160)
// - verdiepingen en muren (volledig / laag / doorzichtig) zoals in huis-3d.html
// - lampen lichten op als ze in HA aan staan (emissief, geen dure lichtbronnen); tik op een lamp = aan/uit
// - live labels: PV-opbrengst en batterijlading
// Model: /local/huis3d/huis-3d.glb (export uit huis-3d.html; objectnamen = entity_id met '.' -> '_', groepen laag_*)
// three.js r160 wordt bij het bouwen meegebundeld (één bestand, geen internet nodig)
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';

const F1 = 2.88, F2 = 5.28;
const FLOORS = [['bg', 'Begane grond', 0], ['v1', '1e verdieping', F1], ['vl', 'Vliering', F2], ['dak', 'Dak', 99]];
const BIJ = {laag_bg: 'bg', laag_keuken: 'bg', laag_install: 'bg', laag_garage: 'bg', laag_poort: 'bg', laag_v1: 'v1', laag_vl: 'vl', laag_dak: 'dak', laag_pv: 'dak'};
const BOUW = ['laag_bg', 'laag_v1', 'laag_vl', 'laag_dak', 'laag_garage'];
const PRESETS = [
  ['Buiten', ['bg', 'v1', 'vl', 'dak'], 'hoog', [-13, 11, -11], [4.5, 3, 6]],
  ['Begane grond', ['bg'], 'laag', [4.5, 13, 17], [4.5, 0, 6]],
  ['1e verdieping', ['bg', 'v1'], 'laag', [4.5, 15, 16], [4.5, F1, 6]],
  ['Vliering', ['bg', 'v1', 'vl'], 'laag', [4.5, 17, 15], [4.5, F2, 6]],
  ['Garage', ['bg'], 'door', [12.5, 4.5, -4.5], [9.2, 1.2, 1.5]],
];

class Huis3dCard extends HTMLElement {
  setConfig(c) { this._c = Object.assign({model: '/local/huis3d/huis-3d.glb', height: 'calc(100vh - 56px)', labels: {}, poort: {}, bel: {}}, c);
    this._c.poort = Object.assign({hoek: 90, open: {links: [0, 24], rechts: [2, 17]}, dicht: {rechts: [0, 16], links: [2, 27]}}, this._c.poort); }
  getCardSize() { return 12; }
  set hass(h) { this._h = h; if (!this._init) this._bouw(); else this._staat(); }

  _bouw() {
    this._init = true;
    const r = this.attachShadow({mode: 'open'});
    r.innerHTML = `<style>
      :host{display:block}.w{position:relative;height:${this._c.height};background:#1b1d21;overflow:hidden;border-radius:var(--ha-card-border-radius,12px)}
      canvas{display:block;width:100%;height:100%;touch-action:none}
      .p{position:absolute;top:10px;left:10px;display:flex;flex-direction:column;gap:6px;max-width:calc(100% - 20px)}
      .rij{display:flex;flex-wrap:wrap;gap:4px}
      button{font:13px/1 var(--paper-font-body1_-_font-family,sans-serif);padding:6px 9px;border-radius:6px;border:1px solid #3a3e45;background:rgba(32,35,40,.85);color:#e8e6e1;cursor:pointer}
      button.on{background:#2f7fd1;border-color:#2f7fd1;color:#fff}
      .lbl{position:absolute;transform:translate(-50%,-100%);background:rgba(255,255,255,.92);color:#16324f;font:600 13px sans-serif;padding:3px 7px;border-radius:6px;pointer-events:none;white-space:nowrap}
      .lk{position:absolute;transform:translate(-50%,-50%);width:26px;height:26px;border-radius:50%;border:2px solid rgba(255,255,255,.85);background:rgba(60,64,70,.85);cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;font-size:14px;line-height:1;box-shadow:0 1px 4px rgba(0,0,0,.5)}
      .lk.aan{background:#ffd24a;border-color:#fff3c4;box-shadow:0 0 12px 4px rgba(255,210,74,.7)}
.pop{position:absolute;width:min(420px,70%);background:#111;border:1px solid #3a3e45;border-radius:10px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.6);z-index:5}
      .info{position:absolute;transform:translate(-50%,-100%);background:rgba(20,22,26,.9);color:#e8e6e1;font:12px/1.35 sans-serif;padding:6px 9px;border-radius:8px;border:1px solid #3a3e45;pointer-events:none;white-space:nowrap;min-width:120px}
      .info b{display:block;font-size:12.5px;margin-bottom:2px;color:#fff}.info .r{display:flex;justify-content:space-between;gap:12px}.info .r span:first-child{opacity:.7}
      .pop .kop{touch-action:none;display:flex;align-items:center;gap:6px;padding:5px 8px;background:#202328;color:#e8e6e1;font:13px sans-serif;cursor:move;user-select:none}
      .pop .kop span{flex:1}.pop .kop button{padding:3px 7px;font-size:12px}.pop img,.pop video{display:block;width:100%;background:#000}
      .dlg{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(32,35,40,.97);color:#fff;font:15px sans-serif;padding:16px 18px;border-radius:10px;z-index:6;box-shadow:0 6px 24px rgba(0,0,0,.6);text-align:center}
      .dlg div{margin-top:12px;display:flex;gap:8px;justify-content:center}
      .mld{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);background:rgba(32,35,40,.92);color:#fff;font:14px sans-serif;padding:8px 14px;border-radius:8px;transition:opacity .4s;pointer-events:none}
      .laad{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#aaa;font:14px sans-serif}
    </style><div class="w"><canvas></canvas><div class="laad">Model laden…</div>
      <div class="p"><div class="rij" id="pre"></div><div class="rij" id="fl"></div><div class="rij" id="wa"></div></div></div>`;
    const w = r.querySelector('.w'), canvas = r.querySelector('canvas');
    this._w = w;
    const ren = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
    ren.setPixelRatio(Math.min(devicePixelRatio, 1.5)); ren.localClippingEnabled = true; ren.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, 1, .05, 300);
    cam.position.set(-13, 11, -11);
    const ctl = new OrbitControls(cam, canvas); ctl.target.set(4.5, 3, 6); ctl.enableDamping = true; ctl.screenSpacePanning = true; ctl.minDistance = .1; ctl.maxDistance = 120;
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8f98, 1.6), zon = new THREE.DirectionalLight(0xffffff, 1.4);
    zon.position.set(-10, 22, 16); scene.add(hemi, zon);
    Object.assign(this, {ren, scene, cam, ctl, hemi, zon});
    { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
      this._gloedTex = new THREE.CanvasTexture(c); }
    this._pool = Array.from({length: 10}, () => { const l = new THREE.PointLight(0xffe6b0, 0, 9, 1.6); scene.add(l); return l; });   // max 10 lampen tegelijk echte lichtval
    this._st = {f: new Set(['bg', 'v1', 'vl', 'dak']), wand: 'hoog', nacht: false};
    this._wandVlak = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e4); this._plafVlak = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e4);

    const knop = (el, t, fn) => { const b = document.createElement('button'); b.textContent = t; b.onclick = fn; r.getElementById(el).appendChild(b); return b; };
    PRESETS.forEach(([t, fl, wa, p, tg]) => knop('pre', t, () => { this._st.f = new Set(fl); this._st.wand = wa; this._toepassen(); this._vlieg(p, tg); }));
    this._fb = FLOORS.map(([k, t]) => { const b = knop('fl', t, () => { this._st.f.has(k) ? this._st.f.delete(k) : this._st.f.add(k); this._toepassen(); }); b.dataset.k = k; return b; });
    this._wb = [['hoog', 'Muren volledig'], ['laag', 'Muren laag'], ['door', 'Doorzichtig']].map(([k, t]) => { const b = knop('wa', t, () => { this._st.wand = k; this._toepassen(); }); b.dataset.k = k; return b; });
    this._nb = knop('wa', 'Nacht', () => { this._st.nacht = !this._st.nacht; this._toepassen(); });
    this._st.knop = true; this._kb = knop('wa', 'Knoppen', () => { this._st.knop = !this._st.knop; this._toepassen(); });
    this._st.info = false; this._ib = knop('wa', 'Info', () => { this._st.info = !this._st.info; this._toepassen(); });

    // model altijd opnieuw laten controleren (cache: 'no-cache' = alleen opnieuw downloaden als het bestand veranderd is)
    fetch(this._c.model, {cache: 'no-cache'}).then(r => { if (!r.ok) throw new Error(r.status + ' ' + r.statusText); return r.arrayBuffer(); })
      .then(buf => new GLTFLoader().parse(buf, '', g => {
      r.querySelector('.laad').remove();
      const root = g.scene; scene.add(root); this._root = root;
      this._lagen = {}; this._lampen = []; this._bouwMats = []; this._binnenMats = [];
      root.traverse(o => {
        if (o.name && o.name.startsWith('laag_')) this._lagen[o.name] = o;
        if (o.name && /^(light|switch)_/.test(o.name)) this._lampen.push(o);
        if (o.userData && o.userData.soort) (this._gedrag = this._gedrag || []).push(o);
        if (o.name && /^camera_/.test(o.name)) (this._cams = this._cams || []).push(o);
        if (o.name && /^poort_(links|rechts)$/.test(o.name)) (this._vleugels = this._vleugels || {})[o.name.slice(6)] = o;
        if (o.name && o.name === (this._c.bel.sensor || '').replace('.', '_')) this._belObj = o;
      });
      const anker = o => { const a = new THREE.Object3D(), bb = new THREE.Box3().setFromObject(o), c = bb.getCenter(new THREE.Vector3()); o.worldToLocal(c); a.position.copy(c); o.add(a); o.userData.anker = a; return o; };
      (this._cams || []).forEach(anker); Object.values(this._vleugels || {}).forEach(anker);
      if (this._belObj) { this._belObj.traverse(o => { if (o.isMesh) o.material = o.material.clone(); }); }
      const kloon = new Map();
      for (const [n, grp] of Object.entries(this._lagen)) grp.traverse(o => { if (!o.isMesh) return;
        const bouw = BOUW.includes(n), wand = o.userData && o.userData.wand;
        const f = m => { const key = m.uuid + (bouw ? 'b' : 'i'); if (!kloon.has(key)) { const c = m.clone(); c.userData = {op: m.opacity, tr: m.transparent, dw: m.depthWrite}; kloon.set(key, c); (bouw ? this._bouwMats : this._binnenMats).push(c); } return kloon.get(key); };
        o.material = Array.isArray(o.material) ? o.material.map(f) : f(o.material);
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.clippingPlanes = [bouw || wand ? this._wandVlak : this._plafVlak]); });
      // lampen: eigen materiaal zodat ze los kunnen oplichten
      this._lampen.forEach(l => { l.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.userData.lamp = l.name; } });
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: this._gloedTex, color: 0xffe6b0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}));
        const bb = new THREE.Box3().setFromObject(l), c = bb.getCenter(new THREE.Vector3()); l.worldToLocal(c); sp.position.copy(c); sp.scale.setScalar(.9); sp.visible = false; l.add(sp); l.userData.gloed = sp; });
      this._labels = {};
      root.traverse(o => { if (o.name && o.name.endsWith('_label')) { o.visible = false; const d = document.createElement('div'); d.className = 'lbl'; w.appendChild(d);
        this._labels[o.name.replace(/_label$/, '').replace('_', '.')] = {o, d}; } });
      const mk = (l, txt, fn, soort) => { const k = document.createElement('button'); k.className = 'lk'; k.textContent = txt; k.dataset.soort = soort;
        k.onclick = ev => { ev.stopPropagation(); fn(); }; w.appendChild(k); return {l, k}; };
      this._knoppen = [...this._lampen.map(l => mk(l, '💡', () => this._schakel(l), 'lamp')),
        ...(this._cams || []).map(c => mk(c, '📷', () => this._camera(c.name.replace('_', '.'), c), 'cam')),
        ...(this._vleugels && this._c.poort.entity ? [mk(this._vleugels.rechts || this._vleugels.links, '🚧', () => this._poortVraag(), 'poort')] : []),
        ...(this._gedrag || []).filter(o => o.userData.soort === 'garagedeur').map(o => mk(anker(o), '🚗', () => this._garageVraag(o), 'garage'))];
      // info-kaartjes (HTML) bij apparaten, met een ℹ️-knopje om ze te openen
      this._infos = (this._gedrag || []).filter(o => o.userData.soort === 'info').map(o => { const d = document.createElement('div'); d.className = 'info'; w.appendChild(d); return {o, d, open: false}; });
      this._knoppen.push(...this._infos.map(i => mk(i.o, 'ℹ️', () => this._infoWissel(i.o.name), 'info')));
      // stroom van de warmtepomp: bolletjes die door de leidingen bewegen
      this._stromen = (this._gedrag || []).filter(o => o.userData.soort === 'stroom').map(o => {
        const p = o.userData.pad, pts = []; for (let i = 0; i < p.length; i += 3) pts.push(new THREE.Vector3(p[i], p[i + 1], p[i + 2]));
        const curve = new THREE.CurvePath(); for (let i = 0; i < pts.length - 1; i++) curve.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
        const len = curve.getLength(), n = Math.max(12, Math.round(len / .35)), im = new THREE.InstancedMesh(new THREE.SphereGeometry(.035, 10, 8), new THREE.MeshBasicMaterial({color: 0xff5a36}), n);
        im.frustumCulled = false; im.visible = false; (o.parent || this._root).add(im); return {o, curve, im, n, len}; });
      this._toepassen(); this._staat();
    }, e => { throw e; })).catch(e => { const l = r.querySelector('.laad'); if (l) l.textContent = 'Model niet geladen: ' + e.message; });

    // tik op een lamp = aan/uit (niet bij slepen)
    const ray = new THREE.Raycaster(), m = new THREE.Vector2(); let dn = null;
    canvas.addEventListener('pointerdown', e => dn = [e.clientX, e.clientY]);
    canvas.addEventListener('pointerup', e => {
      if (!dn || Math.hypot(e.clientX - dn[0], e.clientY - dn[1]) > 6 || !this._root) return;
      const b = canvas.getBoundingClientRect(); m.set((e.clientX - b.left) / b.width * 2 - 1, -(e.clientY - b.top) / b.height * 2 + 1); ray.setFromCamera(m, cam);
      // eerste echte treffer (geen doorzichtig glas/vitrage, niet in een weggesneden stuk)
      const hit = ray.intersectObject(this._root, true).find(h => { let o = h.object; while (o) { if (!o.visible) return false; o = o.parent; }
        const mt = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material; if (h.object.isSprite || (mt && mt.transparent && mt.opacity < .7)) return false;
        return this._wandVlak.distanceToPoint(h.point) >= 0 && (h.object.userData.wand || this._plafVlak.distanceToPoint(h.point) >= 0 || BOUW.some(n => this._lagen[n] && this._lagen[n].getObjectById(h.object.id))); });
      // lamp kiezen: direct geraakt, of binnen ca. 35 px van het klikpunt en niet achter een muur
      let o = hit && hit.object; while (o && !(o.name && /^(light|switch)_/.test(o.name))) o = o.parent;
      if (!o) { const vz = (lp) => { let p = lp; while (p) { if (!p.visible) return false; p = p.parent; } return true; }, w0 = new THREE.Vector3();
        let best = null, bd = 35;
        for (const l of this._lampen) { if (!vz(l)) continue; l.userData.gloed.getWorldPosition(w0); const afst = w0.distanceTo(cam.position), q = w0.clone().project(cam);
          const px = Math.hypot((q.x + 1) / 2 * b.width - (e.clientX - b.left), (1 - q.y) / 2 * b.height - (e.clientY - b.top));
          if (px < bd && (!hit || afst <= hit.distance + .9)) { bd = px; best = l; } }
        o = best; }
      if (o) { this._schakel(o); return; }
      let x = hit && hit.object; while (x && !(x.name && (/^camera_|^poort_/.test(x.name) || x === this._belObj || (x.userData && /garagedeur|info|deur/.test(x.userData.soort || ''))))) x = x.parent;
      if (!x) return;
      if (x.userData.soort === 'garagedeur') { this._garageVraag(x); return; }
      if (x.userData.soort === 'deur') { this._infoWissel(x.name.replace(/^deur_/, 'info_')); return; }
      if (x.userData.soort === 'info') { this._infoWissel(x.name); return; }
      if (x === this._belObj) this._camera(this._c.bel.camera, x);
      else if (x.name.startsWith('camera_')) this._camera(x.name.replace('_', '.'), x);
      else this._poortVraag();
    });
    // geluid mag pas na een eerste tik (browserregel): dan alvast het audiokanaal openen
    const ontgrendel = () => { try { this._ac = this._ac || new (window.AudioContext || window.webkitAudioContext)(); this._ac.resume(); } catch (_) {} };
    w.addEventListener('pointerdown', ontgrendel, {passive: true});
    canvas.addEventListener('dblclick', e => {
      const b = canvas.getBoundingClientRect(); m.set((e.clientX - b.left) / b.width * 2 - 1, -(e.clientY - b.top) / b.height * 2 + 1); ray.setFromCamera(m, cam);
      const hit = this._root && ray.intersectObject(this._root, true).find(h => { let o = h.object; while (o) { if (!o.visible) return false; o = o.parent; } return true; });
      if (hit) { const d = cam.position.clone().sub(ctl.target); this._vlieg(hit.point.clone().add(d.setLength(Math.min(d.length(), 4))).toArray(), hit.point.toArray()); }
    });

    new ResizeObserver(() => { const b = w.getBoundingClientRect(); if (!b.width) return; ren.setSize(b.width, b.height, false); cam.aspect = b.width / b.height; cam.updateProjectionMatrix(); }).observe(w);
    let zichtbaar = true; new IntersectionObserver(es => zichtbaar = es[0].isIntersecting).observe(w);
    const v = new THREE.Vector3();
    const loop = () => { requestAnimationFrame(loop); if (!zichtbaar || document.hidden) return;
      if (this._vl) { const f = Math.min(1, (performance.now() - this._vl.s) / 700), q = f < .5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
        cam.position.lerpVectors(this._vl.p0, this._vl.p1, q); ctl.target.lerpVectors(this._vl.t0, this._vl.t1, q); if (f >= 1) this._vl = null; }
      this._poortAnim(); this._gedragAnim(); ctl.update(); ren.render(scene, cam);
      if (this._knoppen) { const b = w.getBoundingClientRect(); for (const {l, k} of this._knoppen) { let vis = this._st.knop, p = l; while (p && vis) { if (!p.visible) vis = false; p = p.parent; }
          if (vis) { (l.userData.gloed || l.userData.anker || l).getWorldPosition(v); v.project(cam); vis = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05; }
          k.style.display = vis ? '' : 'none'; k._x = (v.x + 1) / 2 * b.width; k._y = (1 - v.y) / 2 * b.height; k._v = vis; }
        // knopjes achter een muur of vloer verbergen (raycast, niet elk frame)
        const nu = performance.now();
        if (!this._occT || nu - this._occT > 250) { this._occT = nu; const rc = this._occRay || (this._occRay = new THREE.Raycaster()), w0 = new THREE.Vector3();
          for (const {l, k} of this._knoppen) { if (!k._v) continue; (l.userData.gloed || l.userData.anker || l).getWorldPosition(w0);
            const dir = w0.clone().sub(cam.position), afst = dir.length(); rc.set(cam.position, dir.normalize()); rc.camera = cam; rc.far = afst - .25;
            k._dicht = rc.intersectObject(this._root, true).some(h => { if (h.object.isSprite) return false; let o = h.object; while (o) { if (!o.visible || o === l) return false; o = o.parent; }
              const mt = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material; if (mt && mt.transparent && mt.opacity < .7) return false;
              return this._wandVlak.distanceToPoint(h.point) >= 0 && this._plafVlak.distanceToPoint(h.point) >= 0; }); } }
        for (const {k} of this._knoppen) if (k._v && k._dicht) { k._v = false; k.style.display = 'none'; }
        // knopjes die (bijna) op elkaar vallen naast elkaar zetten (bv. eettafel up/down)
        const zicht = this._knoppen.filter(({k}) => k._v);
        zicht.forEach(({k}, i) => { for (let j = 0; j < i; j++) { const o = zicht[j].k; if (Math.hypot(k._x - o._x, k._y - o._y) < 26) { k._x = o._x + 30; } }
          k.style.left = k._x + 'px'; k.style.top = k._y + 'px'; }); }
      if (this._infos) { const b = w.getBoundingClientRect(); for (const i of this._infos) { let vis = (i.open || this._st.info), p = i.o; while (p && vis) { if (!p.visible) vis = false; p = p.parent; }
          if (vis) { i.o.getWorldPosition(v); v.project(cam); vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1; }
          i.d.style.display = vis ? '' : 'none'; if (vis) { i.d.style.left = (v.x + 1) / 2 * b.width + 'px'; i.d.style.top = (1 - v.y) / 2 * b.height - 18 + 'px'; } } }
      if (this._labels) for (const {o, d} of Object.values(this._labels)) { o.getWorldPosition(v); let vis = true, p = o; while (p) { if (p !== o && !p.visible) vis = false; p = p.parent; }
        v.project(cam); const b = w.getBoundingClientRect(); d.style.display = vis && v.z < 1 ? '' : 'none'; d.style.left = (v.x + 1) / 2 * b.width + 'px'; d.style.top = (1 - v.y) / 2 * b.height + 'px'; } };
    loop();
  }

  _schakel(l) {
    const id = l.name.replace('_', '.'), s = this._h.states[id];
    const droog = this._droog();   // testmodus: niets schakelen
    if (!s) { this._melding(id + ' niet gevonden in Home Assistant'); return; }
    if (s.state === 'unavailable') { this._melding(`${s.attributes.friendly_name || id} is niet bereikbaar`); return; }
    if (droog) console.log('huis3d dryrun toggle', id); else this._h.callService(id.split('.')[0], 'toggle', {entity_id: id});
    this._melding(`${s.attributes.friendly_name || id} ${s.state === 'on' ? 'uit' : 'aan'}`);
  }

  _actief(u, s) {
    if (!s) return false;
    if (u.boven !== undefined) return parseFloat(s.state) > u.boven;
    if (u.aan) return u.aan.includes(s.state);
    if (u.uit) return !u.uit.includes(s.state);
    return s.state === 'on';
  }

  _gedragAnim() {
    if (!this._gedrag || !this._h) return;
    const S = this._h.states, nu = performance.now(), dt = Math.min(.1, (nu - (this._gt || nu)) / 1000); this._gt = nu;
    for (const o of this._gedrag) { const u = o.userData, s = S[u.entity];
      if (u.soort === 'deur') { const as = u.as || 'y', doel = this._actief({}, s) ? u.hoek * Math.PI / 180 * (u.richting || 1) : 0, c = o.rotation[as];
        o.rotation[as] = c + (doel - c) * Math.min(1, dt * 3); }
      else if (u.soort === 'garagedeur') { const open = !!s && s.state === 'on';
        if (o._f === undefined) o._f = open ? 1 : 0;
        const bezig = o._doel !== undefined && nu < o._doelTot, doel = bezig ? o._doel : (open ? 1 : 0);
        const snel = !bezig && !open ? 1 / 1.5 : 1 / (u.duur || 14);          // sensor zegt dicht terwijl het model nog open staat: snel bijwerken
        o._f += Math.sign(doel - o._f) * Math.min(Math.abs(doel - o._f), dt * snel);
        const q = o._f * o._f * (3 - 2 * o._f); o.rotation.x = q * Math.PI / 2; }
    }
    for (const st of this._stromen || []) { const u = st.o.userData, aan = S[u.aan] && S[u.aan].state === 'on';
      let zicht = aan; for (let p = st.o.parent; p && zicht; p = p.parent) if (!p.visible) zicht = false;
      st.im.visible = zicht; if (!zicht) continue;
      const cyc = (S[u.modus] || {}).state || '', tap = S[u.tapwater] && S[u.tapwater].state === 'on', koel = /koel/i.test(cyc);
      st.im.material.color.setHex(u.retour ? (koel ? 0xff9a6a : 0x4a8cff) : (tap ? 0xffa024 : koel ? 0x3fb6ff : 0xff4a2a));
      const t0 = (nu / 1000 * .5 / st.len) % 1, m = new THREE.Matrix4(), pnt = new THREE.Vector3();
      for (let i = 0; i < st.n; i++) { st.curve.getPointAt((t0 + i / st.n) % 1, pnt); m.makeTranslation(pnt.x, pnt.y, pnt.z); st.im.setMatrixAt(i, m); }
      st.im.instanceMatrix.needsUpdate = true; }
  }

  _fmt(id) {
    const s = this._h.states[id]; if (!s) return '–';
    if (this._h.formatEntityState) { try { const t = this._h.formatEntityState(s); if (t) return t; } catch (_) {} }
    const u = s.attributes.unit_of_measurement || '', v = s.state;
    if (u === 'h' && !isNaN(parseFloat(v))) { const m = Math.round(parseFloat(v) * 60); return m >= 60 ? `${Math.floor(m / 60)} u ${m % 60} min` : `${m} min`; }
    if (!isNaN(parseFloat(v)) && u) return `${parseFloat(v).toLocaleString('nl-NL', {maximumFractionDigits: 1})} ${u}`;
    return v.replace(/^.*_program_/, '').replace(/_/g, ' ');
  }

  _infoWissel(naam) { const i = (this._infos || []).find(x => x.o.name === naam); if (i) { i.open = !i.open; this._staat(); } }

  _garageVraag(o) {
    const u = o.userData, s = this._h.states[u.entity], open = !!s && s.state === 'on';
    const d = document.createElement('div'); d.className = 'dlg';
    d.innerHTML = `${open ? 'Garagedeur sluiten?' : 'Garagedeur openen?'}<div><button data-a="ja">${open ? 'Sluiten' : 'Openen'}</button><button data-a="nee">Annuleren</button></div>`;
    this._w.appendChild(d);
    d.querySelector('[data-a="nee"]').onclick = () => d.remove();
    d.querySelector('[data-a="ja"]').onclick = () => { d.remove();
      if (this._droog()) console.log('huis3d dryrun garagedeur', u.knop); else this._h.callService(u.knop.split('.')[0], 'turn_on', {entity_id: u.knop});
      o._doel = open ? 0 : 1; o._doelTot = performance.now() + (u.duur || 14) * 1000 + 3000; this._melding(open ? 'Garagedeur gaat dicht' : 'Garagedeur gaat open'); };
  }

  _droog() { try { return localStorage.getItem('huis3d_dryrun') === '1'; } catch (_) { return false; } }

  // ----- camera: live beeld in een versleepbaar venster in het model, met beeld-in-beeld (PiP) en 'volledig' (HA-venster)
  _camera(id, obj) {
    const s = this._h.states[id]; if (!s) { this._melding(id + ' niet gevonden'); return; }
    const w = this._w; let p = this.shadowRoot.querySelector(`.pop[data-id="${id}"]`);
    if (p) { p._weg(); return; }
    p = document.createElement('div'); p.className = 'pop'; p.dataset.id = id;
    p.innerHTML = `<div class="kop"><span>${s.attributes.friendly_name || id}</span><button data-a="pip" title="Beeld-in-beeld">⧉ PiP</button><button data-a="vol" title="Openen in Home Assistant">⤢</button><button data-a="x">✕</button></div><div class="beeld"></div>`;
    const vak = p.querySelector('.beeld');
    // live beeld via Home Assistant zelf (kiest WebRTC/HLS/MJPEG en werkt ook via de externe URL); terugval: MJPEG-stream
    const fallback = () => { const img = document.createElement('img'); img.src = `/api/camera_proxy_stream/${id}?token=${s.attributes.access_token}`; vak.replaceChildren(img); };
    (window.loadCardHelpers ? window.loadCardHelpers() : Promise.reject()).then(hlp => {
      const kaart = hlp.createCardElement({type: 'picture-entity', entity: id, camera_view: 'live', show_name: false, show_state: false, tap_action: {action: 'none'}});
      kaart.hass = this._h; vak.replaceChildren(kaart); p._kaart = kaart; }).catch(fallback);
    const b = w.getBoundingClientRect(), v = new THREE.Vector3(); (obj && (obj.userData.anker || obj)).getWorldPosition(v); v.project(this.cam);
    p.style.left = Math.max(8, Math.min(b.width - 300, (v.x + 1) / 2 * b.width + 20)) + 'px'; p.style.top = Math.max(60, Math.min(b.height - 260, (1 - v.y) / 2 * b.height - 120)) + 'px';
    w.appendChild(p);
    p._weg = () => { vak.replaceChildren(); p.remove(); };
    p.querySelector('[data-a="x"]').onclick = () => p._weg();
    p.querySelector('[data-a="vol"]').onclick = () => this.dispatchEvent(new CustomEvent('hass-more-info', {detail: {entityId: id}, bubbles: true, composed: true}));
    p.querySelector('[data-a="pip"]').onclick = () => this._pip(id, vak);
    // slepen aan de kop (muis en vinger)
    const kop = p.querySelector('.kop'); let d0 = null;
    kop.onpointerdown = e => { if (e.target.tagName === 'BUTTON') return; e.preventDefault(); d0 = [e.clientX - p.offsetLeft, e.clientY - p.offsetTop]; kop.setPointerCapture(e.pointerId); };
    kop.onpointermove = e => { if (d0) { e.preventDefault(); p.style.left = e.clientX - d0[0] + 'px'; p.style.top = Math.max(0, e.clientY - d0[1]) + 'px'; } };
    kop.onpointerup = kop.onpointercancel = () => d0 = null;
    return p;
  }

  async _pip(id, vak) {
    // zoek de video die Home Assistant in het venster afspeelt (ook in shadow DOM)
    const zoek = (r, sel) => { if (!r) return null; const e = r.querySelector && r.querySelector(sel); if (e) return e; for (const x of r.querySelectorAll ? r.querySelectorAll('*') : []) { const f = x.shadowRoot && zoek(x.shadowRoot, sel); if (f) return f; } return null; };
    try {
      let vid = zoek(vak, 'video');
      if (vid && vid.readyState >= 2) {
        if (document.pictureInPictureEnabled && vid.requestPictureInPicture) { await vid.requestPictureInPicture(); return; }
        if (vid.webkitSupportsPresentationMode && vid.webkitSupportsPresentationMode('picture-in-picture')) { vid.webkitSetPresentationMode('picture-in-picture'); return; }
      }
      // geen video (MJPEG-beeld): HLS-stream ophalen en die in beeld-in-beeld zetten
      const r = await this._h.callWS({type: 'camera/stream', entity_id: id, format: 'hls'});
      vid = document.createElement('video'); vid.muted = true; vid.playsInline = true; vid.autoplay = true; vid.controls = true;
      if (!vid.canPlayType('application/vnd.apple.mpegurl')) throw new Error('deze browser speelt geen HLS-stream af');
      vid.src = r.url; vid.style.cssText = 'width:100%;display:block'; vak.replaceChildren(vid); await vid.play();
      if (vid.webkitSupportsPresentationMode) vid.webkitSetPresentationMode('picture-in-picture'); else await vid.requestPictureInPicture();
    } catch (e) { this._melding('Beeld-in-beeld lukt niet: ' + e.message); }
  }

  // ----- poort: één druk op de schakelaar start openen of sluiten; stand wordt bijgehouden in een HA-helper
  _poortVraag() {
    const c = this._c.poort, st = c.state && this._h.states[c.state], open = st && st.state === 'on';
    const d = document.createElement('div'); d.className = 'dlg';
    d.innerHTML = `${open ? 'Hek sluiten?' : 'Hek openen?'}<div><button data-a="ja">${open ? 'Sluiten' : 'Openen'}</button><button data-a="nee">Annuleren</button></div>`;
    this._w.appendChild(d);
    d.querySelector('[data-a="nee"]').onclick = () => d.remove();
    d.querySelector('[data-a="ja"]').onclick = () => { d.remove();
      if (this._droog()) console.log('huis3d dryrun poort', c.entity); else this._h.callService(c.entity.split('.')[0], 'turn_on', {entity_id: c.entity});
      this._melding(open ? 'Hek gaat dicht' : 'Hek gaat open'); };
  }

  _poortAnim() {
    const V = this._vleugels, c = this._c.poort; if (!V || !c.state || !this._h) return;
    const s = this._h.states[c.state]; if (!s) return;
    const open = s.state === 'on', t = (Date.now() - new Date(s.last_changed).getTime()) / 1000, max = (c.hoek ?? 90) * Math.PI / 180;
    for (const kant of ['links', 'rechts']) { const g = V[kant]; if (!g) continue;
      const [start, duur] = (open ? c.open : c.dicht)[kant], f = Math.min(1, Math.max(0, (t - start) / duur)), q = f * f * (3 - 2 * f);
      const hoek = (open ? q : 1 - q) * max; g.rotation.y = (g.userData.scharnier || (kant === 'links' ? 1 : -1)) * hoek; }
  }

  // ----- deurbel: licht op, belgeluid, camerabeeld open
  _bel(aan) {
    if (this._belObj) this._belObj.traverse(o => { if (o.isMesh) { o.material.emissive = new THREE.Color(aan ? 0x5fb8ff : 0x2e9bff); o.material.emissiveIntensity = aan ? 6 : .8; } });
    if (!aan) return;
    this._melding('Er wordt aangebeld');
    if (this._c.bel.camera && !this.shadowRoot.querySelector(`.pop[data-id="${this._c.bel.camera}"]`)) this._camera(this._c.bel.camera, this._belObj);
    try { const ac = this._ac || (this._ac = new (window.AudioContext || window.webkitAudioContext)()); ac.resume();
      [[659.3, 0], [523.3, .45]].forEach(([fq, dt]) => { const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + dt;   // ding-dong
        o.type = 'sine'; o.frequency.value = fq; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.5, t0 + .02); g.gain.exponentialRampToValueAtTime(.001, t0 + 1.4);
        o.connect(g).connect(ac.destination); o.start(t0); o.stop(t0 + 1.5); }); } catch (_) {}
  }

  _melding(t) { const r = this.shadowRoot; let d = r.querySelector('.mld'); if (!d) { d = document.createElement('div'); d.className = 'mld'; this._w.appendChild(d); }
    d.textContent = t; d.style.opacity = 1; clearTimeout(this._mt); this._mt = setTimeout(() => d.style.opacity = 0, 1600); }

  _vlieg(p, t) { this._vl = {p0: this.cam.position.clone(), t0: this.ctl.target.clone(), p1: new THREE.Vector3(...p), t1: new THREE.Vector3(...t), s: performance.now()}; }

  _toepassen() {
    const st = this._st;
    if (this._lagen) for (const [n, g] of Object.entries(this._lagen)) g.visible = BIJ[n] ? st.f.has(BIJ[n]) : false;
    const hoogste = Math.max(-1, ...[...st.f].map(k => FLOORS.find(f => f[0] === k)[2]));
    this._wandVlak.constant = st.wand === 'laag' && hoogste < 90 ? hoogste + 1.10 : 1e4;
    this._plafVlak.constant = st.wand === 'laag' && hoogste < 90 ? hoogste + 2.30 : 1e4;
    (this._bouwMats || []).forEach(m => { const dz = st.wand === 'door'; m.transparent = dz || m.userData.tr; m.opacity = dz ? Math.min(m.userData.op, .16) : m.userData.op; m.depthWrite = dz ? false : m.userData.dw; m.needsUpdate = true; });
    this.hemi.intensity = st.nacht ? .18 : 1.6; this.zon.intensity = st.nacht ? .03 : 1.4; this._staat();
    this.scene.background = new THREE.Color(st.nacht ? 0x0b0d14 : 0x1b1d21);
    this._fb.forEach(b => b.classList.toggle('on', st.f.has(b.dataset.k)));
    this._wb.forEach(b => b.classList.toggle('on', b.dataset.k === st.wand)); this._nb.classList.toggle('on', st.nacht); this._kb.classList.toggle('on', st.knop); this._ib.classList.toggle('on', st.info);
  }

  _staat() {
    if (!this._lampen || !this._h) return;
    const S = this._h.states;
    const bs = this._c.bel.sensor && S[this._c.bel.sensor], bel = !!bs && bs.state === 'on';
    if (bel !== this._belAan) { if (this._belAan !== undefined || !bel) this._bel(bel); this._belAan = bel; }
    this._lampen.forEach(l => { const s = S[l.name.replace('_', '.')], aan = s && s.state === 'on';
      let col = new THREE.Color(0xfff1c8);
      if (aan && s.attributes.rgb_color) col = new THREE.Color(...s.attributes.rgb_color.map(x => x / 255));
      const k = aan ? (s.attributes.brightness ?? 255) / 255 : 0;
      l.traverse(o => { if (o.isMesh) { o.material.emissive = col; o.material.emissiveIntensity = aan ? 2 + 4 * k : 0; } });
      const sp = l.userData.gloed; if (sp) { sp.visible = aan; sp.material.color.copy(col); sp.material.opacity = .55 + .45 * k; sp.scale.setScalar((this._st.nacht ? 1.4 : .8) * (.6 + .6 * k)); }
      l.userData.aan = aan ? k : -1; l.userData.kleur = col; });
    (this._knoppen || []).forEach(({l, k}) => { const s = S[l.name.replace('_', '.')]; k.classList.toggle('aan', !!s && s.state === 'on'); k.title = s ? s.attributes.friendly_name : l.name; k.style.opacity = s && s.state === 'unavailable' ? .4 : 1; });
    // echte lichtval voor de helderste brandende lampen (pool, zodat er niets opnieuw gecompileerd hoeft te worden)
    const lit = this._lampen.filter(l => l.userData.aan >= 0 && l.visible !== false).sort((a, b) => b.userData.aan - a.userData.aan), p = new THREE.Vector3();
    this._pool.forEach((pl, i) => { const l = lit[i]; if (!l) { pl.intensity = 0; return; }
      l.userData.gloed.getWorldPosition(p); pl.position.copy(p).add(new THREE.Vector3(0, -.12, 0)); pl.color.copy(l.userData.kleur);
      pl.intensity = (this._st.nacht ? 9 : 4) * (.4 + .6 * l.userData.aan); });
    (this._gedrag || []).filter(o => o.userData.soort === 'lampje').forEach(o => { const u = o.userData, aan = this._actief(u, S[u.entity]), c = new THREE.Color(u.kleur || '#ff2020');
      o.traverse(m => { if (m.isMesh) { if (!m._eigen) { m.material = m.material.clone(); m._eigen = true; m._kleur0 = m.material.color.clone(); }
        m.material.emissive = c; m.material.emissiveIntensity = aan ? (u.vlak ? 1.1 : 5) : 0; m.material.color.copy(aan && !u.vlak ? c : m._kleur0); } }); });
    (this._infos || []).forEach(i => { const u = i.o.userData;
      i.d.innerHTML = `<b>${u.titel || ''}</b>` + u.regels.map(([l, e]) => `<div class="r"><span>${l}</span><span>${this._fmt(e)}</span></div>`).join(''); });
    for (const [e, {d}] of Object.entries(this._labels || {})) { const s = S[e]; if (!s) { d.textContent = ''; continue; }
      const naam = this._c.labels[e] || (e.includes('pv_power') ? 'Zon' : e.includes('state_of_charge') ? 'Batterij' : '');
      const u = s.attributes.unit_of_measurement || '', x = parseFloat(s.state), w = isNaN(x) ? s.state : (u === '%' ? Math.round(x) : x.toFixed(u === 'kW' ? 2 : 1)).toString().replace('.', ',');
      d.textContent = `${naam} ${w} ${u}`.trim(); }
  }
}
customElements.define('huis3d-card', Huis3dCard);
window.customCards = window.customCards || []; window.customCards.push({type: 'huis3d-card', name: 'Huis 3D', description: 'Eigen 3D-model van het huis met lampen en energie'});
