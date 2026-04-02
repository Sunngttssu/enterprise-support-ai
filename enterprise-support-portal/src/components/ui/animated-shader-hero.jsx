/**
 * animated-shader-hero.jsx
 * Split into <ShaderBackground> (persistent wrapper) and <HeroContent> (overlay)
 */
import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Zap, ArrowDown } from 'lucide-react';

/* ── Animation styles ────────────────────────────────────────── */
const HERO_STYLES = `
  @keyframes hero-fade-down {
    from { opacity: 0; transform: translateY(-20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes hero-fade-up {
    from { opacity: 0; transform: translateY(30px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes hero-gradient-shift {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  .hero-fade-down { animation: hero-fade-down 0.9s ease-out forwards; }
  .hero-fade-up   { animation: hero-fade-up  0.9s ease-out forwards; opacity: 0; }
  .hero-delay-1   { animation-delay: 0.15s; }
  .hero-delay-2   { animation-delay: 0.30s; }
  .hero-delay-3   { animation-delay: 0.50s; }
  .hero-delay-4   { animation-delay: 0.70s; }
  .hero-delay-5   { animation-delay: 0.90s; }
  .hero-grad-text {
    background: linear-gradient(135deg, #a5b4fc 0%, #c4b5fd 35%, #818cf8 65%, #6d7ef7 100%);
    background-size: 200% 200%;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: hero-gradient-shift 4s ease infinite;
  }
  .hero-grad-text-2 {
    background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 50%, #a5b4fc 100%);
    background-size: 200% 200%;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: hero-gradient-shift 5s ease infinite reverse;
  }
`;

/* ── Default GLSL shader (cosmic nebula) ──────────────────────── */
const defaultShaderSource = `#version 300 es
precision highp float;
out vec4 O;
uniform vec2 resolution;
uniform float time;
#define FC gl_FragCoord.xy
#define T time
#define R resolution
#define MN min(R.x,R.y)

float rnd(vec2 p) {
  p=fract(p*vec2(12.9898,78.233));
  p+=dot(p,p+34.56);
  return fract(p.x*p.y);
}
float noise(in vec2 p) {
  vec2 i=floor(p), f=fract(p), u=f*f*(3.-2.*f);
  float a=rnd(i), b=rnd(i+vec2(1,0)), c=rnd(i+vec2(0,1)), d=rnd(i+1.);
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
float fbm(vec2 p) {
  float t=.0, a=1.; mat2 m=mat2(1.,-.5,.2,1.2);
  for (int i=0; i<5; i++) { t+=a*noise(p); p*=2.*m; a*=.5; }
  return t;
}
float clouds(vec2 p) {
  float d=1., t=.0;
  for (float i=.0; i<3.; i++) {
    float a=d*fbm(i*10.+p.x*.2+.2*(1.+i)*p.y+d+i*i+p);
    t=mix(t,d,a); d=a; p*=2./(i+1.);
  }
  return t;
}
void main(void) {
  vec2 uv=(FC-.5*R)/MN, st=uv*vec2(2,1);
  vec3 col=vec3(0);
  float bg=clouds(vec2(st.x+T*.5,-st.y));
  uv*=1.-.3*(sin(T*.2)*.5+.5);
  for (float i=1.; i<12.; i++) {
    uv+=.1*cos(i*vec2(.1+.01*i,.8)+i*i+T*.5+.1*uv.x);
    vec2 p=uv;
    float d=length(p);
    col+=.00125/d*(cos(sin(i)*vec3(1,2,3))+1.);
    float b=noise(i+p+bg*1.731);
    col+=.002*b/length(max(p,vec2(b*p.x*.02,p.y)));
    col=mix(col,vec3(bg*.25,bg*.137,bg*.05),d);
  }
  O=vec4(col,1);
}`;

/* ── WebGL renderer ──────────────────────────────────────────── */
class WebGLRenderer {
  constructor(canvas, scale) {
    this.canvas = canvas;
    this.scale = scale;
    this.gl = canvas.getContext('webgl2');
    if (!this.gl) return;
    this.gl.viewport(0, 0, canvas.width * scale, canvas.height * scale);
    this.shaderSource = defaultShaderSource;
    this.program = null;
    this.vs = null;
    this.fs = null;
    this.buffer = null;
    this.mouseMove = [0, 0];
    this.mouseCoords = [0, 0];
    this.pointerCoords = [0, 0];
    this.nbrOfPointers = 0;
    this.vertexSrc = `#version 300 es\nprecision highp float;\nin vec4 position;\nvoid main(){gl_Position=position;}`;
    this.vertices = [-1, 1, -1, -1, 1, 1, 1, -1];
  }
  compile(shader, source) {
    const gl = this.gl;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
  }
  test(source) {
    const gl = this.gl;
    const shader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const result = gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? null : gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    return result;
  }
  reset() {
    const gl = this.gl;
    if (!gl || !this.program) return;
    if (!gl.getProgramParameter(this.program, gl.DELETE_STATUS)) {
      if (this.vs) { gl.detachShader(this.program, this.vs); gl.deleteShader(this.vs); }
      if (this.fs) { gl.detachShader(this.program, this.fs); gl.deleteShader(this.fs); }
      gl.deleteProgram(this.program);
    }
  }
  setup() {
    const gl = this.gl;
    if (!gl) return;
    this.vs = gl.createShader(gl.VERTEX_SHADER);
    this.fs = gl.createShader(gl.FRAGMENT_SHADER);
    this.compile(this.vs, this.vertexSrc);
    this.compile(this.fs, this.shaderSource);
    this.program = gl.createProgram();
    gl.attachShader(this.program, this.vs);
    gl.attachShader(this.program, this.fs);
    gl.linkProgram(this.program);
  }
  init() {
    const gl = this.gl;
    if (!gl || !this.program) return;
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.vertices), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(this.program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    this.program.resolution   = gl.getUniformLocation(this.program, 'resolution');
    this.program.time         = gl.getUniformLocation(this.program, 'time');
    this.program.move         = gl.getUniformLocation(this.program, 'move');
    this.program.touch        = gl.getUniformLocation(this.program, 'touch');
    this.program.pointerCount = gl.getUniformLocation(this.program, 'pointerCount');
    this.program.pointers     = gl.getUniformLocation(this.program, 'pointers');
  }
  render(now = 0) {
    const gl = this.gl;
    if (!gl || !this.program || gl.getProgramParameter(this.program, gl.DELETE_STATUS)) return;
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.uniform2f(this.program.resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.program.time, now * 1e-3);
    gl.uniform2f(this.program.move, ...this.mouseMove);
    gl.uniform2f(this.program.touch, ...this.mouseCoords);
    gl.uniform1i(this.program.pointerCount, this.nbrOfPointers);
    gl.uniform2fv(this.program.pointers, this.pointerCoords);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  updateMove(d)  { this.mouseMove = d; }
  updateMouse(c) { this.mouseCoords = c; }
  updatePointerCoords(c) { this.pointerCoords = c; }
  updatePointerCount(n) { this.nbrOfPointers = n; }
  updateScale(s) { this.scale = s; if (this.gl) this.gl.viewport(0, 0, this.canvas.width * s, this.canvas.height * s); }
}

/* ── Pointer handler ────────────────────────────────────────── */
class PointerHandler {
  constructor(element, scale) {
    this.scale = scale;
    this.active = false;
    this.pointers = new Map();
    this.lastCoords = [0, 0];
    this.moves = [0, 0];
    const map = (el, sc, x, y) => [x * sc, el.height - y * sc];
    element.addEventListener('pointerdown', (e) => {
      this.active = true;
      this.pointers.set(e.pointerId, map(element, this.scale, e.clientX, e.clientY));
    });
    element.addEventListener('pointerup', (e) => {
      if (this.pointers.size === 1) this.lastCoords = this.first;
      this.pointers.delete(e.pointerId);
      this.active = this.pointers.size > 0;
    });
    element.addEventListener('pointerleave', (e) => {
      if (this.pointers.size === 1) this.lastCoords = this.first;
      this.pointers.delete(e.pointerId);
      this.active = this.pointers.size > 0;
    });
    element.addEventListener('pointermove', (e) => {
      if (!this.active) return;
      this.lastCoords = [e.clientX, e.clientY];
      this.pointers.set(e.pointerId, map(element, this.scale, e.clientX, e.clientY));
      this.moves = [this.moves[0] + e.movementX, this.moves[1] + e.movementY];
    });
  }
  get count()  { return this.pointers.size; }
  get move()   { return this.moves; }
  get coords() { return this.pointers.size > 0 ? Array.from(this.pointers.values()).flat() : [0, 0]; }
  get first()  { return this.pointers.values().next().value || this.lastCoords; }
  updateScale(s) { this.scale = s; }
}

/* ── useShaderBackground hook ───────────────────────────────── */
function useShaderBackground() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const rendererRef = useRef(null);
  const pointersRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, 0.5 * window.devicePixelRatio);
    rendererRef.current = new WebGLRenderer(canvas, dpr);
    pointersRef.current = new PointerHandler(canvas, dpr);
    rendererRef.current.setup();
    rendererRef.current.init();

    const resize = () => {
      const d = Math.max(1, 0.5 * window.devicePixelRatio);
      canvas.width  = window.innerWidth  * d;
      canvas.height = window.innerHeight * d;
      rendererRef.current?.updateScale(d);
      pointersRef.current?.updateScale(d);
    };
    resize();
    if (rendererRef.current.test(defaultShaderSource) === null) {
      rendererRef.current.shaderSource = defaultShaderSource;
    }
    const loop = (now) => {
      const r = rendererRef.current;
      const p = pointersRef.current;
      if (!r || !p) return;
      r.updateMouse(p.first);
      r.updatePointerCount(p.count);
      r.updatePointerCoords(p.coords);
      r.updateMove(p.move);
      r.render(now);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rendererRef.current?.reset();
    };
  }, []);

  return canvasRef;
}

/* ── 1. ShaderBackground ────────────────────────────────────── */
export function ShaderBackground({ children, className = '' }) {
  const canvasRef = useShaderBackground();
  return (
    <div className={`relative w-full h-screen overflow-hidden bg-black ${className}`}>
      <style>{HERO_STYLES}</style>
      
      {/* Persistent WebGL Background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full touch-none"
        style={{ background: 'black', zIndex: 0 }}
      />
      
      {/* Dark gradient overlay for UI contrast: preserves motion but lowers brightness */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{ 
          background: 'linear-gradient(to bottom, rgba(5,5,15,0.85) 0%, rgba(5,5,15,0.7) 30%, rgba(5,5,20,0.85) 100%)', 
          zIndex: 1 
        }}
      />
      
      {/* Content wrapper */}
      <div className="absolute inset-0 z-10">
        {children}
      </div>
    </div>
  );
}

/* ── 2. HeroContent ─────────────────────────────────────────── */
export function HeroContent({
  headline    = { line1: 'Enterprise AI Support', line2: 'Smarter Customer Assistance' },
  subtitle    = 'Ask about orders, refunds, deliveries, and support in real-time.',
  trustBadge  = { text: 'Local AI · Private & Secure · Always Online', icons: ['🔒'] },
  buttons,
  onStartChat,
  onViewFeatures,
  className = '',
}) {
  const handlePrimary = buttons?.primary?.onClick ?? onStartChat;
  const handleSecondary = buttons?.secondary?.onClick ?? onViewFeatures;
  const primaryLabel   = buttons?.primary?.text   ?? 'Start Chat';
  const secondaryLabel = buttons?.secondary?.text ?? 'View Features';

  return (
    <div className={`flex flex-col items-center justify-center h-full px-6 text-white ${className}`}>
      {trustBadge && (
        <div className="mb-8 hero-fade-down hero-delay-1">
          <div
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium"
            style={{
              background: 'rgba(109,126,247,0.12)',
              border: '1px solid rgba(109,126,247,0.30)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {trustBadge.icons?.map((icon, i) => <span key={i}>{icon}</span>)}
            <span style={{ color: 'rgba(199,210,254,0.90)' }}>{trustBadge.text}</span>
          </div>
        </div>
      )}

      <div className="text-center space-y-2 max-w-5xl mx-auto">
        <motion.h1
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl md:text-7xl lg:text-8xl font-bold leading-tight tracking-tight"
        >
          <span className="hero-grad-text">{headline.line1}</span>
        </motion.h1>

        <motion.h1
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl md:text-7xl lg:text-8xl font-bold leading-tight tracking-tight"
        >
          <span className="hero-grad-text-2">{headline.line2}</span>
        </motion.h1>
      </div>

      <motion.p
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: 0.52 }}
        className="mt-6 max-w-2xl text-center text-lg md:text-xl lg:text-2xl font-light leading-relaxed"
        style={{ color: 'rgba(199,210,254,0.82)' }}
      >
        {subtitle}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.72 }}
        className="flex flex-col sm:flex-row gap-4 justify-center mt-10"
      >
        <motion.button
          onClick={handlePrimary}
          whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.96 }}
          className="flex items-center justify-center gap-2.5 px-9 py-4 rounded-full font-semibold text-lg text-white"
          style={{
            background: 'linear-gradient(135deg, #5a67f2 0%, #7c3aed 100%)',
            boxShadow: '0 8px 32px rgba(90,103,242,0.45)',
          }}
        >
          <MessageSquare size={19} strokeWidth={2} />
          {primaryLabel}
        </motion.button>

        <motion.button
          onClick={handleSecondary}
          whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.96 }}
          className="flex items-center justify-center gap-2.5 px-9 py-4 rounded-full font-semibold text-lg"
          style={{
            background: 'rgba(109,126,247,0.10)',
            border: '1px solid rgba(109,126,247,0.35)',
            color: 'rgba(199,210,254,0.92)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <Zap size={18} strokeWidth={2} />
          {secondaryLabel}
        </motion.button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 0.5 }}
        transition={{ delay: 1.5, duration: 0.8 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}>
          <ArrowDown size={22} style={{ color: 'rgba(165,180,252,0.7)' }} />
        </motion.div>
      </motion.div>
    </div>
  );
}
