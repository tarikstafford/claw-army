<script lang="ts" module>
  const PARTICLE_COLS = [
    'rgba(124,58,237,',
    'rgba(167,139,250,',
    'rgba(196,181,253,',
    'rgba(251,191,36,',
    'rgba(45,212,191,',
  ];

  // Defined at module scope to avoid Svelte's nested-class perf warning
  class Particle {
    x: number; y: number; vx: number; vy: number;
    r: number; alpha: number; maxA: number;
    life: number; maxL: number; col: string;
    W: number; H: number;
    ctx: CanvasRenderingContext2D;

    constructor(W: number, H: number, ctx: CanvasRenderingContext2D, init: boolean) {
      this.W = W; this.H = H; this.ctx = ctx;
      this.x = Math.random() * W;
      this.y = init ? Math.random() * H : H + 10;
      this.vy = -(0.10 + Math.random() * 0.22);
      this.vx = (Math.random() - 0.5) * 0.14;
      this.r = 0.5 + Math.random() * 1.6;
      this.alpha = 0;
      this.maxA = 0.12 + Math.random() * 0.22;
      this.life = 0;
      this.maxL = 200 + Math.random() * 260;
      this.col = PARTICLE_COLS[Math.floor(Math.random() * PARTICLE_COLS.length)];
    }

    update(W: number, H: number) { this.W = W; this.H = H; }

    tick() {
      this.life++; this.x += this.vx; this.y += this.vy;
      const t = this.life / this.maxL;
      if (t < 0.12)      this.alpha = (t / 0.12) * this.maxA;
      else if (t > 0.75) this.alpha = ((1 - t) / 0.25) * this.maxA;
      else               this.alpha = this.maxA;
      if (this.life > this.maxL) {
        this.life = 0; this.x = Math.random() * this.W;
        this.y = this.H + 10; this.alpha = 0;
      }
    }

    draw() {
      this.ctx.beginPath();
      this.ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      this.ctx.fillStyle = this.col + this.alpha + ')';
      this.ctx.fill();
    }
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte';

  onMount(() => {
    const canvas = document.getElementById('particles') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0;

    const onResize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      particles.forEach(p => p.update(W, H));
    };
    window.addEventListener('resize', onResize, { passive: true });
    onResize();

    const particles = Array.from({ length: 130 }, (_, i) => new Particle(W, H, ctx, i < 80));
    let raf: number;

    const loop = () => {
      ctx.clearRect(0, 0, W, H);
      particles.forEach(p => { p.tick(); p.draw(); });
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
    };
  });
</script>

<canvas id="particles"></canvas>

<style>
  :global(canvas#particles) {
    position: fixed; inset: 0;
    pointer-events: none; z-index: 1;
  }
</style>
