'use strict';
/* MAIN MENU — nested navigation plus an independent WebGPU atmosphere plate. */
const MENU_PAGES = ['singleMenu', 'loadoutMenu', 'settingsMenu', 'campaignMenu'];
let activeMenuPage = '';

function showMainMenuPage(page = '', focus = true) {
  activeMenuPage = MENU_PAGES.includes(page) ? page : '';
  const nav = $('mainMenuNav');
  nav.hidden = !!activeMenuPage;
  $('menuOverview').hidden = !!activeMenuPage;
  for (const id of MENU_PAGES) ($(id) as HTMLElement).hidden = id !== activeMenuPage;
  const labels = {
    singleMenu: ['单人模式', 'TOTAL FRONTLINE — 选择作战地图'],
    loadoutMenu: ['武器配置', 'TOTAL FRONTLINE — 作战装备终端'],
    settingsMenu: ['全局设置', 'TOTAL FRONTLINE — 系统与操作'],
    campaignMenu: ['单人战役', 'TOTAL FRONTLINE — 暂无可用行动'],
  };
  const label = labels[activeMenuPage] || ['作战终端', 'TOTAL FRONTLINE — 作战终端'];
  $('menuContext').textContent = label[0];
  $('menuSubtitle').textContent = label[1];
  if (!focus) return;
  const target = activeMenuPage
    ? ($(activeMenuPage).querySelector('.menuBack') as HTMLElement)
    : (nav.querySelector('.menuEntry') as HTMLElement);
  target?.focus();
}

document.querySelectorAll<HTMLElement>('[data-menu-target]').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    SFX.init();
    SFX.menuMusic(true);
    showMainMenuPage(button.dataset.menuTarget);
  });
});
document.querySelectorAll<HTMLElement>('.menuBack').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    showMainMenuPage();
  });
});
/* The campaign is the WebGPU Vite entry built next to the legacy bundle. One
   main menu owns both modes, so the deathmatch build is the shared front door. */
document.getElementById('campaignLaunch')?.addEventListener('click', () => {
  SFX.init();
  location.href = 'campaign/';
});
addEventListener('keydown', (event) => {
  if (event.code !== 'Escape' || !activeMenuPage || G.started) return;
  event.preventDefault();
  showMainMenuPage();
});

/* A real WGSL/WebGPU background. It is deliberately isolated from the r128
   battle renderer so the menu can use the requested backend without risking
   weapons, scopes or the existing GLSL post chain. */
async function initMenuWebGPU() {
  const status = $('menuRendererState');
  const gpu = (navigator as any).gpu;
  const canvas = $('menuGpu') as HTMLCanvasElement;
  if (!gpu) {
    status.textContent = 'WEBGPU 不可用 · 静态降级';
    status.style.color = 'rgba(255,179,64,.72)';
    return;
  }
  try {
    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('No adapter');
    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu') as any;
    const format = gpu.getPreferredCanvasFormat();
    const shader = device.createShaderModule({
      code: `
struct U { resolution: vec2f, time: f32, pointer: f32 }
@group(0) @binding(0) var<uniform> u: U;
@vertex fn vs(@builtin(vertex_index) i:u32)->@builtin(position) vec4f {
  let p = array<vec2f,3>(vec2f(-1.,-1.),vec2f(3.,-1.),vec2f(-1.,3.));
  return vec4f(p[i],0.,1.);
}
fn hash(p:vec2f)->f32 { return fract(sin(dot(p,vec2f(127.1,311.7)))*43758.5453); }
fn noise(p:vec2f)->f32 {
  let i=floor(p); let f=fract(p); let q=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2f(1,0)),q.x),mix(hash(i+vec2f(0,1)),hash(i+vec2f(1)),q.x),q.y);
}
fn fbm(p0:vec2f)->f32 { var p=p0; var a=.5; var s=0.; for(var i=0;i<5;i++){s+=a*noise(p);p=mat2x2f(1.6,-1.2,1.2,1.6)*p;a*=.48;} return s; }
@fragment fn fs(@builtin(position) pos:vec4f)->@location(0) vec4f {
  let uv=(pos.xy-.5*u.resolution)/u.resolution.y;
  let t=u.time*.075; let drift=vec2f(t,-t*.37);
  let smoke=fbm(uv*2.25+drift+fbm(uv*3.7-drift)*.65);
  let cloud=smoothstep(.34,.88,smoke+uv.y*.21);
  var col=mix(vec3f(.012,.019,.028),vec3f(.10,.135,.17),cloud);
  let horizon=exp(-abs(uv.y+.13)*8.5);
  col+=vec3f(.22,.115,.035)*horizon*(.26+.74*smoke);
  let beam=pow(max(0.,dot(normalize(vec2f(.78,.38)),normalize(uv-vec2f(.18,.15)))),42.);
  col+=vec3f(.34,.20,.08)*beam*.24;
  let cells=floor((uv+vec2f(t*.7,-t*.16))*vec2f(38.,22.));
  let ember=step(.973,hash(cells))*smoothstep(-.28,.42,uv.y)*(.4+.6*sin(u.time*2.+hash(cells)*9.));
  col+=ember*vec3f(1.15,.37,.06);
  let scan=.016*sin(pos.y*.72+u.time*3.2);
  col+=scan; col*=1.-.32*smoothstep(.2,.9,length(uv));
  return vec4f(pow(max(col,vec3f(0)),vec3f(.82)),1.);
}`,
    });
    const pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: shader, entryPoint: 'vs' },
      fragment: { module: shader, entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });
    const uniform = device.createBuffer({ size: 16, usage: 0x40 | 0x08 });
    const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: uniform } }] });
    let configuredW = 0, configuredH = 0;
    const draw = (now) => {
      requestAnimationFrame(draw);
      if (!document.body.classList.contains('menu-open') || document.hidden) return;
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      const w = Math.max(2, Math.floor(innerWidth * dpr)), h = Math.max(2, Math.floor(innerHeight * dpr));
      if (w !== configuredW || h !== configuredH) {
        configuredW = canvas.width = w; configuredH = canvas.height = h;
        context.configure({ device, format, alphaMode: 'opaque' });
      }
      device.queue.writeBuffer(uniform, 0, new Float32Array([w, h, now * .001, 0]));
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
      pass.setPipeline(pipeline); pass.setBindGroup(0, bind); pass.draw(3); pass.end();
      device.queue.submit([encoder.finish()]);
    };
    status.textContent = 'WEBGPU · 高性能适配器';
    document.body.dataset.menuRenderer = 'webgpu';
    requestAnimationFrame(draw);
  } catch (_) {
    status.textContent = 'WEBGPU 初始化失败 · 静态降级';
    status.style.color = 'rgba(255,179,64,.72)';
  }
}

document.body.classList.add('menu-open');
showMainMenuPage('', false);
void initMenuWebGPU();

/* Branded click-to-enter gate. The user gesture here is what lets the browser
   unlock Web Audio, so the main-menu BGM can start immediately instead of
   waiting for the first menu navigation click. */
const introEl = $('intro');
const startEl = $('startScreen');
if (introEl && !introEl.classList.contains('hide') && startEl) {
  startEl.style.visibility = 'hidden';
}
function enterFromIntro() {
  if (!introEl || introEl.classList.contains('hide')) return;
  SFX.init();
  SFX.resume();
  SFX.menuMusic(true);
  introEl.classList.add('hide');
  if (startEl) startEl.style.visibility = '';
}
introEl?.addEventListener('click', enterFromIntro);
addEventListener('keydown', (event) => {
  if (event.code === 'Enter' || event.code === 'Space') enterFromIntro();
});

/* Homepage 2D atmosphere overlay. It sits behind the menu panel but above the
   3D weapon plate, adding the Call-of-Duty-style dust drift and the occasional
   bright spark that is hard to read inside the tiny 3D showcase frame. */
function initHomeAtmosphere() {
  const canvas = document.getElementById('homeFx') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let w = 0, h = 0;
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = canvas.width = Math.max(2, Math.floor(innerWidth * dpr));
    h = canvas.height = Math.max(2, Math.floor(innerHeight * dpr));
  };
  resize();
  addEventListener('resize', resize);

  const dust: any[] = [];
  for (let i = 0; i < 90; i++) {
    dust.push({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      r: 1.6 + Math.random() * 2.6,
      vx: 5 + Math.random() * 14,
      vy: -4 - Math.random() * 9,
      a: 0.26 + Math.random() * 0.3,
      tw: Math.random() * Math.PI * 2,
    });
  }

  const smoke: any[] = [];
  for (let i = 0; i < 8; i++) {
    smoke.push({
      x: Math.random() * innerWidth,
      y: innerHeight * (0.2 + Math.random() * 0.7),
      r: (100 + Math.random() * 160) * Math.min(window.devicePixelRatio || 1, 1.5),
      vx: 3 + Math.random() * 7,
      vy: -2 - Math.random() * 4,
      a: 0.035 + Math.random() * 0.045,
      tw: Math.random() * Math.PI * 2,
    });
  }

  const sparks: any[] = [];
  for (let i = 0; i < 14; i++) {
    sparks.push({
      x: 0, y: 0,
      vx: 0, vy: 0,
      life: 0, maxLife: 0,
      delay: 0.2 + i * 0.16 + Math.random() * 0.24,
    });
  }

  const drawGlow = (x: number, y: number, radius: number, alpha: number, rgb: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, radius));
    g.addColorStop(0, `rgba(${rgb},${alpha})`);
    g.addColorStop(0.4, `rgba(${rgb},${alpha * 0.35})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, radius), 0, Math.PI * 2);
    ctx.fill();
  };

  let last = performance.now();
  const tick = (now: number) => {
    requestAnimationFrame(tick);
    const active = document.body.classList.contains('menu-open') && !document.hidden;
    if (!active) {
      last = now;
      return;
    }
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);

    // Drifting dust motes, normal blending so they never turn into fog.
    for (const p of dust) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x > innerWidth + 6) p.x = -6;
      if (p.y < -6) p.y = innerHeight + 6;
      p.tw += dt * 2.2;
      const a = p.a * (0.75 + 0.25 * Math.sin(p.tw));
      ctx.fillStyle = `rgba(205,218,230,${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Slow large smoke ghosts.
    for (const p of smoke) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x > innerWidth + p.r) p.x = -p.r;
      if (p.y < -p.r) p.y = innerHeight + p.r;
      p.tw += dt * 0.35;
      drawGlow(p.x, p.y, p.r, p.a * (0.8 + 0.2 * Math.sin(p.tw)), '128,138,150');
    }

    // Occasional sparks: brief warm streaks with a tiny hot core.
    ctx.globalCompositeOperation = 'lighter';
    for (const p of sparks) {
      if (p.life <= 0) {
        p.delay -= dt;
        if (p.delay > 0) continue;
        p.life = p.maxLife = 0.4 + Math.random() * 0.4;
        p.x = innerWidth * (0.48 + Math.random() * 0.46);
        p.y = innerHeight * (0.25 + Math.random() * 0.55);
        p.vx = (Math.random() - 0.35) * 26;
        p.vy = -28 - Math.random() * 55;
      } else {
        p.life -= dt;
        const k = Math.max(0, p.life / p.maxLife);
        const fade = Math.min(1, (1 - k) * 5) * Math.min(1, k * 4);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 55 * dt;
        const sx = p.x - p.vx * 0.055;
        const sy = p.y - p.vy * 0.055;
        ctx.strokeStyle = `rgba(255,196,130,${(fade * 0.7).toFixed(3)})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        drawGlow(p.x, p.y, 3.5 + 8.0 * (1 - k), fade, '255,210,160');
        ctx.fillStyle = `rgba(255,244,224,${fade.toFixed(3)})`;
        ctx.fillRect(p.x - 0.8, p.y - 0.8, 1.6, 1.6);
        if (p.life <= 0) {
          p.delay = 0.9 + Math.random() * 2.3;
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  };
  requestAnimationFrame(tick);
}

initHomeAtmosphere();
