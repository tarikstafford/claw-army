<script lang="ts" module>
  const FRONT_OFFICE_PARTICLE_COLS = [
    'rgba(61,53,96,',
    'rgba(107,95,160,',
    'rgba(232,229,244,',
    'rgba(184,150,90,',
    'rgba(151,124,123,',
  ];

  const BACK_OFFICE_PARTICLE_COLS = [
    'rgba(124,58,237,',
    'rgba(167,139,250,',
    'rgba(196,181,253,',
    'rgba(251,191,36,',
    'rgba(45,212,191,',
  ];

  class Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    r: number;
    alpha: number;
    maxA: number;
    life: number;
    maxL: number;
    col: string;
    W: number;
    H: number;
    ctx: CanvasRenderingContext2D;
    colors: string[];

    constructor(W: number, H: number, ctx: CanvasRenderingContext2D, init: boolean, colors: string[]) {
      this.W = W;
      this.H = H;
      this.ctx = ctx;
      this.colors = colors;
      this.x = Math.random() * W;
      this.y = init ? Math.random() * H : H + 10;
      this.vy = -(0.1 + Math.random() * 0.22);
      this.vx = (Math.random() - 0.5) * 0.14;
      this.r = 0.5 + Math.random() * 1.6;
      this.alpha = 0;
      this.maxA = 0.12 + Math.random() * 0.22;
      this.life = 0;
      this.maxL = 200 + Math.random() * 260;
      this.col = this.colors[Math.floor(Math.random() * this.colors.length)] ?? this.colors[0]!;
    }

    setColors(colors: string[]) {
      this.colors = colors;
      this.col = this.colors[Math.floor(Math.random() * this.colors.length)] ?? this.colors[0]!;
    }

    update(W: number, H: number) {
      this.W = W;
      this.H = H;
    }

    tick() {
      this.life += 1;
      this.x += this.vx;
      this.y += this.vy;
      const t = this.life / this.maxL;
      if (t < 0.12) {
        this.alpha = (t / 0.12) * this.maxA;
      } else if (t > 0.75) {
        this.alpha = ((1 - t) / 0.25) * this.maxA;
      } else {
        this.alpha = this.maxA;
      }

      if (this.life > this.maxL) {
        this.life = 0;
        this.x = Math.random() * this.W;
        this.y = this.H + 10;
        this.alpha = 0;
        this.col = this.colors[Math.floor(Math.random() * this.colors.length)] ?? this.colors[0]!;
      }
    }

    draw() {
      this.ctx.beginPath();
      this.ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      this.ctx.fillStyle = `${this.col}${this.alpha})`;
      this.ctx.fill();
    }
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte';

  let {
    variant = 'marketing',
  }: {
    variant?: 'marketing' | 'front-office' | 'back-office';
  } = $props();

  let canvasEl: HTMLCanvasElement | null = null;

  function getColors(surface: 'marketing' | 'front-office' | 'back-office') {
    return surface === 'back-office' ? BACK_OFFICE_PARTICLE_COLS : FRONT_OFFICE_PARTICLE_COLS;
  }

  onMount(() => {
    if (!canvasEl) return;

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    let W = (canvasEl.width = window.innerWidth);
    let H = (canvasEl.height = window.innerHeight);
    const particles = Array.from({ length: 130 }, (_, index) => new Particle(W, H, ctx, index < 80, getColors(variant)));
    let currentVariant = variant;

    const onResize = () => {
      W = canvasEl ? (canvasEl.width = window.innerWidth) : W;
      H = canvasEl ? (canvasEl.height = window.innerHeight) : H;
      particles.forEach((particle) => particle.update(W, H));
    };

    let raf = 0;

    const loop = () => {
      if (currentVariant !== variant) {
        currentVariant = variant;
        const colors = getColors(currentVariant);
        particles.forEach((particle) => particle.setColors(colors));
      }

      ctx.clearRect(0, 0, W, H);
      particles.forEach((particle) => {
        particle.tick();
        particle.draw();
      });
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener('resize', onResize, { passive: true });
    loop();

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
    };
  });
</script>

<div class={`aurora-shell ${variant}`} aria-hidden="true">
  <canvas bind:this={canvasEl} class="particles"></canvas>
  <div class="layers">
    <div class="layer a1"></div>
    <div class="layer a2"></div>
    <div class="layer a3"></div>
  </div>
  <div class="grid"></div>
</div>

<style>
  .aurora-shell {
    position: fixed;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    z-index: 0;
    view-transition-name: app-aurora;
  }

  .particles,
  .layers,
  .grid {
    position: absolute;
    inset: 0;
  }

  .particles {
    width: 100%;
    height: 100%;
  }

  .layer {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.9;
  }

  .a1 {
    width: 900px;
    height: 600px;
    top: -150px;
    left: -100px;
    animation: af1 24s ease-in-out infinite;
  }

  .a2 {
    width: 600px;
    height: 600px;
    top: 10%;
    right: -120px;
    animation: af2 30s ease-in-out infinite;
  }

  .a3 {
    width: 500px;
    height: 400px;
    bottom: -60px;
    left: 35%;
    animation: af3 19s ease-in-out infinite;
  }

  .grid {
    mask-image: radial-gradient(ellipse 80% 60% at 45% 35%, black 5%, transparent 75%);
  }

  .marketing .a1,
  .front-office .a1 {
    background: radial-gradient(ellipse, rgba(61, 53, 96, 0.11) 0%, transparent 65%);
  }

  .marketing .a2,
  .front-office .a2 {
    background: radial-gradient(ellipse, rgba(184, 150, 90, 0.07) 0%, transparent 65%);
  }

  .marketing .a3,
  .front-office .a3 {
    background: radial-gradient(ellipse, rgba(212, 180, 122, 0.06) 0%, transparent 65%);
  }

  .marketing .grid,
  .front-office .grid {
    background-image:
      linear-gradient(rgba(61, 53, 96, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(61, 53, 96, 0.05) 1px, transparent 1px);
    background-size: 80px 80px;
  }

  .back-office .a1 {
    background: radial-gradient(ellipse, rgba(124, 58, 237, 0.12) 0%, transparent 65%);
  }

  .back-office .a2 {
    background: radial-gradient(ellipse, rgba(45, 212, 191, 0.08) 0%, transparent 65%);
  }

  .back-office .a3 {
    background: radial-gradient(ellipse, rgba(251, 191, 36, 0.06) 0%, transparent 65%);
  }

  .back-office .grid {
    background-image:
      linear-gradient(rgba(124, 58, 237, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(124, 58, 237, 0.05) 1px, transparent 1px);
    background-size: 80px 80px;
  }

  @keyframes af1 {
    0%, 100% { transform: translate3d(0, 0, 0); }
    50% { transform: translate3d(40px, 24px, 0); }
  }

  @keyframes af2 {
    0%, 100% { transform: translate3d(0, 0, 0); }
    50% { transform: translate3d(-36px, 42px, 0); }
  }

  @keyframes af3 {
    0%, 100% { transform: translate3d(0, 0, 0); }
    50% { transform: translate3d(18px, -20px, 0); }
  }
</style>
