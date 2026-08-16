import * as THREE from 'three';

export function buildHorizonBackdrop(scene: THREE.Scene) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 512;
  const g = canvas.getContext('2d');
  if (!g) return;

  /* canvas y=0 maps to the cylinder's bottom (world y=-80), y=146 to the
     horizon (world y≈0), y=512 to the sky. */
  const sky = g.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#05080d');
  sky.addColorStop(0.18, '#080e16');
  sky.addColorStop(0.285, '#0b141f');
  sky.addColorStop(0.44, '#08101a');
  sky.addColorStop(0.7, '#04080f');
  sky.addColorStop(1, '#010204');
  g.fillStyle = sky;
  g.fillRect(0, 0, 2048, 512);

  const ridge = (baseY: number, amp: number, color: string) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, baseY);
    for (let x = 0; x <= 2048; x += 32) {
      const t = x / 2048;
      const y =
        baseY -
        amp * (0.52 + 0.48 * Math.sin(t * Math.PI * 2 * 3 + 1.4)) -
        amp * 0.3 * Math.sin(t * Math.PI * 2 * 17 + 4.2);
      g.lineTo(x, Math.max(14, y));
    }
    g.lineTo(2048, baseY);
    g.closePath();
    g.fill();
  };

  /* three silhouette ranges, farthest and lightest first */
  ridge(146, 40, 'rgba(14,22,32,0.45)');
  ridge(146, 74, 'rgba(9,15,23,0.68)');
  ridge(146, 108, 'rgba(5,8,13,0.9)');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const geometry = new THREE.CylinderGeometry(900, 900, 280, 48, 1, true);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide,
    fog: true,
    depthWrite: false,
  });
  const backdrop = new THREE.Mesh(geometry, material);
  backdrop.name = 'P0_HORIZON_BACKDROP';
  backdrop.position.y = 60;
  backdrop.renderOrder = -10;
  backdrop.frustumCulled = false;
  scene.add(backdrop);
}
