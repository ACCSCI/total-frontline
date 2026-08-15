import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { Document, Primitive, NodeIO } from '@gltf-transform/core';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = `${root}public/models`;
await mkdir(outDir, { recursive: true });

/* Build one military crate from three.js geometry, then write it as a real
   .glb through @gltf-transform. The browser side loads it with GLTFLoader at
   runtime — this proves the streaming pipeline without baking geometry in JS. */
const doc = new Document();
const buffer = doc.createBuffer('crate');
const scene = doc.createScene('crate-scene');

function addBox(doc, buffer, { size, offset, color, roughness = 0.8, metalness = 0.1 }) {
  const geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
  const pos = new Float32Array(geo.attributes.position.array);
  const nrm = new Float32Array(geo.attributes.normal.array);
  const idx = new Uint16Array(geo.index.array);

  const position = doc
    .createAccessor(`${color.toString(16)}-pos`)
    .setType('VEC3')
    .setArray(pos)
    .setBuffer(buffer);
  const normal = doc
    .createAccessor(`${color.toString(16)}-nrm`)
    .setType('VEC3')
    .setArray(nrm)
    .setBuffer(buffer);
  const indices = doc
    .createAccessor(`${color.toString(16)}-idx`)
    .setType('SCALAR')
    .setArray(idx)
    .setBuffer(buffer);

  const material = doc
    .createMaterial(color.toString(16))
    .setBaseColorFactor([color.r, color.g, color.b, 1])
    .setMetallicFactor(metalness)
    .setRoughnessFactor(roughness);

  const prim = doc
    .createPrimitive(`${color.toString(16)}-prim`)
    .setMode(Primitive.Mode.TRIANGLES)
    .setAttribute('POSITION', position)
    .setAttribute('NORMAL', normal)
    .setIndices(indices)
    .setMaterial(material);

  const mesh = doc.createMesh(`${color.toString(16)}-mesh`).addPrimitive(prim);
  const node = doc.createNode(`${color.toString(16)}-node`).setMesh(mesh).setTranslation(offset);
  scene.addChild(node);
}

addBox(doc, buffer, { size: [1.0, 0.72, 0.62], offset: [0, 0.36, 0], color: new THREE.Color(0x3e4a36) });
addBox(doc, buffer, { size: [1.04, 0.07, 0.66], offset: [0, 0.755, 0], color: new THREE.Color(0x24251f), metalness: 0.3 });
addBox(doc, buffer, { size: [1.04, 0.08, 0.09], offset: [0, 0.39, -0.29], color: new THREE.Color(0x1b1c17), roughness: 0.6 });
addBox(doc, buffer, { size: [1.04, 0.08, 0.09], offset: [0, 0.39, 0.29], color: new THREE.Color(0x1b1c17), roughness: 0.6 });

const glb = await new NodeIO().writeBinary(doc);
const file = `${outDir}/supply_crate.glb`;
await writeFile(file, glb);
console.log(`wrote ${file} (${glb.byteLength} bytes)`);
