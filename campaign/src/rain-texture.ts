import * as THREE from 'three';

/* ---------------------------------------------------------------------------
   Procedural raindrop streak sprites. Each sprite is a soft, motion-blurred
   tail with a bright head. We bake five wind slants so the whole rain layer
   can switch slant as gusts change direction.
   ------------------------------------------------------------------------- */
export function makeRainTexture(slant: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const g = canvas.getContext('2d') as CanvasRenderingContext2D;
  g.clearRect(0, 0, 64, 128);
  const headX = 32 + slant * 7;
  const tailX = 32 - slant * 11;
  const headY = 18;
  const tailY = 116;
  const strokes = [
    { w: 6.5, a: 0.22, color: '180,208,234' },
    { w: 4.0, a: 0.42, color: '205,226,244' },
    { w: 2.0, a: 0.62, color: '235,244,252' },
  ];
  g.lineCap = 'round';
  for (const s of strokes) {
    const grad = g.createLinearGradient(headX, headY, tailX, tailY);
    grad.addColorStop(0, `rgba(${s.color},${s.a})`);
    grad.addColorStop(0.65, `rgba(${s.color},${s.a * 0.55})`);
    grad.addColorStop(1, `rgba(${s.color},0)`);
    g.strokeStyle = grad;
    g.lineWidth = s.w;
    g.beginPath();
    g.moveTo(headX, headY);
    g.quadraticCurveTo((headX + tailX) / 2 + slant * 4, (headY + tailY) / 2, tailX, tailY);
    g.stroke();
  }
  g.fillStyle = 'rgba(230,242,250,0.55)';
  g.beginPath();
  g.ellipse(headX, headY, 1.5, 3.2, slant * 0.5, 0, Math.PI * 2);
  g.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
