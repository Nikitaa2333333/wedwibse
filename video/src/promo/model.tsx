// Настоящая 3D-модель телефона (Three.js) под нашим живым экраном.
// Модель: «iPhone 16 - Free», автор Wes (sketchfab.com/wimell), лицензия Sketchfab Standard:
// коммерчески можно, сам файл отдельно не распространяем — поэтому в git его нет
// (video/public/models/phone.glb, см. video/README.md).
//
// Как совмещено с экраном. Экран, островок и элементы над стеклом — DOM в CSS 3D
// (phone3d.tsx). Модель рисуется WebGL-камерой, совпадающей с CSS-перспективой
// (камера в центре кадра на расстоянии perspective), а матрица модели — та же CSS-трансформа
// (DOMMatrix от той же строки transform), переведённая в оси Three (Y вверх).
// Дисплей модели скрыт: на его месте наш экран.
import { ThreeCanvas } from '@remotion/three';
import { useThree } from '@react-three/fiber';
import React, { useEffect, useMemo, useState } from 'react';
import { cancelRender, continueRender, delayRender, staticFile, useVideoConfig } from 'remotion';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SCREEN_H, SCREEN_W } from './stage';

// дисплей модели (меш с плоским лицом на z = 0.3901): ±3.2633 × ±7.0425
const DISP = { hw: 3.2633, hh: 7.0425, z: 0.3901 };
const K = SCREEN_W / (DISP.hw * 2); // единиц CSS на единицу модели

/** модель → локальные CSS-координаты экрана (0..390 × 0..844, Y вниз, Z к зрителю) */
const MODEL_TO_CSS = new THREE.Matrix4().set(
  K, 0, 0, DISP.hw * K,
  0, -K, 0, DISP.hh * K,
  0, 0, K, -DISP.z * K,
  0, 0, 0, 1,
);
const FLIP_Y = new THREE.Matrix4().makeScale(1, -1, 1);

let cache: Promise<THREE.Group> | null = null;
const loadPhone = () =>
  (cache ??= new Promise((res, rej) =>
    new GLTFLoader().load(staticFile('models/phone.glb'), (g) => {
      g.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry.computeBoundingBox();
        const b = m.geometry.boundingBox!;
        // всё плоское на уровне дисплея (сам дисплей, островок) прячем — там наш DOM-экран
        if (Math.abs(b.min.z - DISP.z) < 1e-3 && Math.abs(b.max.z - DISP.z) < 1e-3) m.visible = false;
        // корпус у модели бирюзовый — перекрашиваем в тёмный графит (под бумагу и чернила сайта)
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat?.color) {
          const { r, g, b: bl } = mat.color;
          if (g > r * 1.3 && g > 0.05) mat.color.setRGB(0.09 + (g - 0.1) * 0.15, 0.085 + (g - 0.1) * 0.14, 0.08 + (g - 0.1) * 0.13);
          void bl;
          mat.envMapIntensity = 1.2;
        }
      });
      res(g.scene);
    }, undefined, rej)));

const Rig: React.FC<{ css: string; perspective: number; phone: THREE.Group }> = ({ css, perspective, phone }) => {
  const { camera, gl, scene } = useThree();
  const { width: W, height: H } = useVideoConfig();
  useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.05;
  }, [gl, scene]);
  const cam = camera as THREE.PerspectiveCamera;
  cam.position.set(W / 2, -H / 2, perspective);
  cam.up.set(0, 1, 0);
  cam.lookAt(W / 2, -H / 2, 0);
  cam.fov = (2 * Math.atan(H / 2 / perspective) * 180) / Math.PI;
  cam.aspect = W / H;
  cam.near = 10;
  cam.far = perspective * 4;
  cam.updateProjectionMatrix();

  const group = useMemo(() => {
    const g = new THREE.Group();
    g.matrixAutoUpdate = false;
    g.add(phone);
    return g;
  }, [phone]);
  const m = new DOMMatrix(css);
  const cssM = new THREE.Matrix4().fromArray(m.toFloat64Array() as unknown as number[]);
  group.matrix.copy(FLIP_Y).multiply(cssM).multiply(MODEL_TO_CSS);
  group.matrixWorldNeedsUpdate = true;
  return <primitive object={group} />;
};

export const PhoneModel: React.FC<{ css: string; perspective: number }> = ({ css, perspective }) => {
  const { width, height } = useVideoConfig();
  const [phone, setPhone] = useState<THREE.Group | null>(null);
  const [handle] = useState(() => delayRender('3D-модель телефона'));
  useEffect(() => {
    loadPhone().then((p) => { setPhone(p); continueRender(handle); }).catch((e) => cancelRender(e));
  }, [handle]);
  return (
    <ThreeCanvas width={width} height={height} style={{ position: 'absolute', inset: 0 }} gl={{ alpha: true, antialias: true }} camera={{ position: [0, 0, 1] }}>
      <ambientLight intensity={0.25} />
      <directionalLight position={[width * 0.2, height * 0.3, 2000]} intensity={1.6} />
      {phone && <Rig css={css} perspective={perspective} phone={phone} />}
    </ThreeCanvas>
  );
};

export { SCREEN_H };
