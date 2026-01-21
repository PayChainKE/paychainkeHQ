import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

// More accurate Kenya outline based on geographical coordinates (simplified and scaled)
const kenyaOutline = [
  // Starting from the northern border near Sudan/Ethiopia
  [-0.8, 0, 1.8], [-0.6, 0, 1.7], [-0.4, 0, 1.6], [-0.2, 0, 1.5], [0, 0, 1.4], [0.2, 0, 1.3],
  [0.4, 0, 1.2], [0.6, 0, 1.1], [0.8, 0, 1.0], [1.0, 0, 0.9], [1.2, 0, 0.8], [1.4, 0, 0.7],
  [1.6, 0, 0.6], [1.8, 0, 0.5], [1.9, 0, 0.3], [1.95, 0, 0.1], [1.9, 0, -0.1], [1.8, 0, -0.3],
  [1.7, 0, -0.5], [1.6, 0, -0.7], [1.5, 0, -0.9], [1.4, 0, -1.1], [1.3, 0, -1.3], [1.2, 0, -1.5],
  [1.1, 0, -1.6], [1.0, 0, -1.7], [0.9, 0, -1.75], [0.8, 0, -1.8], [0.6, 0, -1.8], [0.4, 0, -1.75],
  [0.2, 0, -1.7], [0, 0, -1.6], [-0.2, 0, -1.5], [-0.4, 0, -1.4], [-0.6, 0, -1.3], [-0.8, 0, -1.2],
  [-1.0, 0, -1.1], [-1.2, 0, -1.0], [-1.4, 0, -0.9], [-1.6, 0, -0.8], [-1.7, 0, -0.6], [-1.75, 0, -0.4],
  [-1.7, 0, -0.2], [-1.6, 0, 0], [-1.5, 0, 0.2], [-1.4, 0, 0.4], [-1.3, 0, 0.6], [-1.2, 0, 0.8],
  [-1.1, 0, 1.0], [-1.0, 0, 1.2], [-0.9, 0, 1.4], [-0.8, 0, 1.6], [-0.8, 0, 1.8]
];

const KenyaMSMEMap: React.FC = () => {
  return (
    <div className="relative w-full h-80 bg-gradient-to-br from-green-100 to-blue-100 rounded-lg overflow-hidden border border-gray-200 shadow-lg">
      <Canvas camera={{ position: [0, 1, 2.5], fov: 60 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <directionalLight position={[-5, 5, -5]} intensity={0.4} />

        {/* Kenya map */}
        <KenyaMap />

        <OrbitControls
          enablePan={false}
          enableZoom={true}
          enableRotate={true}
          minDistance={1.5}
          maxDistance={4}
          maxPolarAngle={Math.PI / 2}
        />
      </Canvas>

      {/* Title */}
      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3">
        <h3 className="text-lg font-bold text-gray-800">Kenya</h3>
        <p className="text-sm text-gray-600">East Africa</p>
      </div>
    </div>
  );
};

const KenyaMap: React.FC = () => {
  const outlinePoints = useMemo(() => {
    return kenyaOutline.map(point => new THREE.Vector3(...point));
  }, []);

  const outlineGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry().setFromPoints(outlinePoints);
    return geom;
  }, [outlinePoints]);

  // Create filled shape
  const shapePoints = useMemo(() => {
    return kenyaOutline.map(point => new THREE.Vector2(point[0], point[2]));
  }, []);

  const shapeGeometry = useMemo(() => {
    const shape = new THREE.Shape(shapePoints);
    return new THREE.ShapeGeometry(shape);
  }, [shapePoints]);

  return (
    <group>
      {/* Filled landmass */}
      <mesh geometry={shapeGeometry} position={[0, -0.01, 0]}>
        <meshStandardMaterial
          color="#22c55e"
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>

      {/* Border outline */}
      <line geometry={outlineGeometry}>
        <lineBasicMaterial color="#166534" linewidth={3} />
      </line>

      {/* Add some elevation variation (simplified mountains/valleys) */}
      <mesh position={[-0.5, 0.02, 0.5]}>
        <cylinderGeometry args={[0.15, 0.15, 0.04, 8]} />
        <meshStandardMaterial color="#16a34a" />
      </mesh>

      <mesh position={[0.3, 0.015, -0.8]}>
        <cylinderGeometry args={[0.12, 0.12, 0.03, 8]} />
        <meshStandardMaterial color="#15803d" />
      </mesh>
    </group>
  );
};

export default KenyaMSMEMap;