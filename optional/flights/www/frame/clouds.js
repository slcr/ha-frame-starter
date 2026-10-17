// Clouds behind the flight card (flights.js), after mrdoob.com/lab/javascript/webgl/clouds: 8000 cloud sheets
// in a row, the camera flies through them, fog in the sky colour hides them in the distance. Drawn twice
// (offset by 8000) so the flight loops seamlessly. Plain WebGL 1, no three.js. The cloud texture is painted
// here instead of loaded. Darker sky at night. Rendered at 0.6 × CSS pixels and only while the canvas is in
// the document. make() returns null without WebGL; the card then shows a plain scrim.
const N = 8000;
const SCALE = 0.6;
const SKY = {
  day: { top: [0x1e, 0x48, 0x77], fog: [0x45, 0x84, 0xb4], tint: [1, 1, 1] },
  night: { top: [0x07, 0x0d, 0x1a], fog: [0x16, 0x24, 0x3b], tint: [0.42, 0.48, 0.6] },
};

const VS = `attribute vec3 aPos; attribute vec2 aUv; uniform mat4 uProj; uniform vec3 uCam; varying vec2 vUv;
  void main() { vUv = aUv; gl_Position = uProj * vec4(aPos - uCam, 1.0); }`;
const FS = `precision highp float; uniform sampler2D uMap; uniform vec3 uFog, uTint; uniform float uNear, uFar; varying vec2 vUv;
  void main() {
    float depth = gl_FragCoord.z / gl_FragCoord.w;
    vec4 c = texture2D(uMap, vUv);
    vec3 col = mix(c.rgb * uTint, uFog * c.a, smoothstep(uNear, uFar, depth));
    gl_FragColor = vec4(col, c.a) * pow(gl_FragCoord.z, 20.0);
  }`;
const SKY_VS = `attribute vec2 aPos; varying float vY; void main() { vY = aPos.y * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
const SKY_FS = `precision mediump float; uniform vec3 uTop, uFog; varying float vY;
  void main() { gl_FragColor = vec4(mix(uFog, uTop, smoothstep(0.5, 1.0, vY)), 1.0); }`;

const cloudImage = () => {
  const s = 256, c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d");
  for (let i = 0; i < 46; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * s * 0.26;
    const x = s / 2 + Math.cos(a) * r * 1.25, y = s / 2 + Math.sin(a) * r * 0.75, R = s * (0.1 + Math.random() * 0.14);
    const rg = g.createRadialGradient(x, y, 0, x, y, R);
    rg.addColorStop(0, "rgba(255,255,255,.34)");
    rg.addColorStop(0.55, "rgba(255,255,255,.16)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = rg;
    g.fillRect(0, 0, s, s);
  }
  g.globalCompositeOperation = "source-atop";
  const lg = g.createLinearGradient(0, s * 0.3, 0, s * 0.85);
  lg.addColorStop(0, "rgba(255,255,255,0)");
  lg.addColorStop(1, "rgba(150,170,195,.55)");
  g.fillStyle = lg;
  g.fillRect(0, 0, s, s);
  return c;
};

const geometry = () => {
  const pos = new Float32Array(N * 2 * 4 * 3), uv = new Float32Array(N * 2 * 4 * 2), idx = new Uint16Array(N * 6);
  const C = [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]];
  const one = [];
  for (let i = 0; i < N; i++) {
    one.push([Math.random() * 1000 - 500, -Math.random() * Math.random() * 200 - 15, i,
      Math.random() * Math.PI, 32 * (Math.random() * Math.random() * 1.5 + 0.5)]);
  }
  let p = 0, u = 0;
  [-N, 0].forEach((dz) => one.forEach(([x, y, z, rot, h]) => {
    const co = Math.cos(rot), si = Math.sin(rot);
    C.forEach(([cx, cy, tu, tv]) => {
      pos[p++] = x + (cx * co - cy * si) * h; pos[p++] = y + (cx * si + cy * co) * h; pos[p++] = z + dz;
      uv[u++] = tu; uv[u++] = tv;
    });
  }));
  for (let i = 0; i < N; i++) idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  return { pos, uv, idx };
};

export const make = () => {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, powerPreference: "low-power" });
  if (!gl) return null;
  const geo = geometry(), img = cloudImage();
  let R = null;

  const prog = (vs, fs) => {
    const p = gl.createProgram();
    [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].forEach(([t, src]) => {
      const s = gl.createShader(t);
      gl.shaderSource(s, src); gl.compileShader(s); gl.attachShader(p, s);
    });
    gl.linkProgram(p);
    return p;
  };
  const buf = (type, data) => { const b = gl.createBuffer(); gl.bindBuffer(type, b); gl.bufferData(type, data, gl.STATIC_DRAW); return b; };
  const init = () => {
    const cloud = prog(VS, FS), sky = prog(SKY_VS, SKY_FS);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const L = (p, n) => gl.getUniformLocation(p, n);
    R = {
      cloud, sky,
      pos: buf(gl.ARRAY_BUFFER, geo.pos), uv: buf(gl.ARRAY_BUFFER, geo.uv), idx: buf(gl.ELEMENT_ARRAY_BUFFER, geo.idx),
      quad: buf(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3])),
      aPos: gl.getAttribLocation(cloud, "aPos"), aUv: gl.getAttribLocation(cloud, "aUv"), aSky: gl.getAttribLocation(sky, "aPos"),
      uProj: L(cloud, "uProj"), uCam: L(cloud, "uCam"), uFog: L(cloud, "uFog"), uTint: L(cloud, "uTint"),
      uNear: L(cloud, "uNear"), uFar: L(cloud, "uFar"), uMap: L(cloud, "uMap"), uTop: L(sky, "uTop"), uSkyFog: L(sky, "uFog"),
    };
  };
  init();
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); R = null; });
  canvas.addEventListener("webglcontextrestored", init);

  const proj = (aspect) => {
    const f = 1 / Math.tan(15 * Math.PI / 180), n = 1, r = 3000;
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (r + n) / (n - r), -1, 0, 0, 2 * r * n / (n - r), 0]);
  };
  const rgb = (c) => c.map((v) => v / 255);

  let raf = 0, t0 = 0, z0 = 0, mx = 0, my = 0, cx = 0, cy = 0, sky = SKY.day;
  const frame = (t) => {
    if (!canvas.isConnected) { raf = 0; return; }
    raf = requestAnimationFrame(frame);
    if (!R) return;
    const w = Math.max(1, Math.round(canvas.clientWidth * SCALE)), h = Math.max(1, Math.round(canvas.clientHeight * SCALE));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    const s = (t - t0) / 1000, z = (z0 + s * 30 + 500 * (1 - Math.exp(-s / 0.7))) % N;
    const tx = mx || Math.sin(s * 0.21) * 60, ty = my || Math.sin(s * 0.13) * 18;
    cx += (tx - cx) * 0.01; cy += (-ty - cy) * 0.01;

    gl.disable(gl.BLEND);
    gl.useProgram(R.sky);
    gl.bindBuffer(gl.ARRAY_BUFFER, R.quad);
    gl.enableVertexAttribArray(R.aSky);
    gl.vertexAttribPointer(R.aSky, 2, gl.FLOAT, false, 0, 0);
    gl.uniform3fv(R.uTop, rgb(sky.top)); gl.uniform3fv(R.uSkyFog, rgb(sky.fog));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disableVertexAttribArray(R.aSky);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(R.cloud);
    gl.uniformMatrix4fv(R.uProj, false, proj(w / h));
    gl.uniform3f(R.uCam, cx, cy, N - z);
    gl.uniform3fv(R.uFog, rgb(sky.fog)); gl.uniform3fv(R.uTint, sky.tint);
    gl.uniform1f(R.uNear, -100); gl.uniform1f(R.uFar, 3000); gl.uniform1i(R.uMap, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, R.idx);
    gl.enableVertexAttribArray(R.aPos); gl.enableVertexAttribArray(R.aUv);
    for (let k = 0; k < 2; k++) {
      gl.bindBuffer(gl.ARRAY_BUFFER, R.pos);
      gl.vertexAttribPointer(R.aPos, 3, gl.FLOAT, false, 0, k * N * 4 * 12);
      gl.bindBuffer(gl.ARRAY_BUFFER, R.uv);
      gl.vertexAttribPointer(R.aUv, 2, gl.FLOAT, false, 0, k * N * 4 * 8);
      gl.drawElements(gl.TRIANGLES, N * 6, gl.UNSIGNED_SHORT, 0);
    }
  };

  const start = (parent, night) => {
    sky = night ? SKY.night : SKY.day;
    parent.prepend(canvas);
    t0 = performance.now(); z0 = Math.random() * N; mx = my = 0;
    if (!raf) raf = requestAnimationFrame(frame);
  };
  const point = (e) => { mx = (e.clientX - innerWidth / 2) * 0.25; my = (e.clientY - innerHeight / 2) * 0.15; };
  return { canvas, start, point };
};
