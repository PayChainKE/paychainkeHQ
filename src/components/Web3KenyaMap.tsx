import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Text, Stars, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { motion } from 'framer-motion';
import { useBaseScanner, Transaction } from '@/hooks/useBaseScanner';

// Colors
const NEON_BLUE = '#00D4FF';
const EMERALD_GREEN = '#10B981';

// Hexagonal Kenya Map Component
const KenyaMap: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const hexagons = useMemo(() => {
    const temp = [];
    const radius = 0.5;
    const height = radius * Math.sqrt(3) / 2;

    // Create a hexagonal grid representing Kenya
    for (let q = -5; q <= 5; q++) {
      for (let r = -5; r <= 5; r++) {
        if (Math.abs(q + r) <= 5) {
          const x = radius * (3/2 * q);
          const z = radius * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r);
          temp.push({ x, z, q, r });
        }
      }
    }
    return temp;
  }, []);

  useEffect(() => {
    if (meshRef.current) {
      hexagons.forEach((hex, i) => {
        const matrix = new THREE.Matrix4();
        matrix.setPosition(hex.x, 0, hex.z);
        meshRef.current!.setMatrixAt(i, matrix);
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [hexagons]);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.1) * 0.1;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[new THREE.CylinderGeometry(0.5, 0.5, 0.1, 6), new THREE.MeshStandardMaterial({
      color: NEON_BLUE,
      wireframe: true,
      metalness: 0.8,
      roughness: 0.2,
      emissive: NEON_BLUE,
      emissiveIntensity: 0.1
    }), hexagons.length]}>
    </instancedMesh>
  );
};

// Smart Contract Nodes
const SmartContractNodes: React.FC = () => {
  const nodes = useMemo(() => [
    { position: [2, 1, 2] as [number, number, number], shape: 'box' as const },
    { position: [-2, 1, -2] as [number, number, number], shape: 'octahedron' as const },
    { position: [0, 1.5, 3] as [number, number, number], shape: 'tetrahedron' as const },
  ], []);

  return (
    <>
      {nodes.map((node, i) => (
        <Node key={i} position={node.position} shape={node.shape} />
      ))}
    </>
  );
};

const Node: React.FC<{ position: [number, number, number]; shape: 'box' | 'octahedron' | 'tetrahedron' }> = ({ position, shape }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.7;
    }
  });

  const geometry = useMemo(() => {
    switch (shape) {
      case 'box': return new THREE.BoxGeometry(0.3, 0.3, 0.3);
      case 'octahedron': return new THREE.OctahedronGeometry(0.3);
      case 'tetrahedron': return new THREE.TetrahedronGeometry(0.3);
      default: return new THREE.BoxGeometry(0.3, 0.3, 0.3);
    }
  }, [shape]);

  return (
    <mesh ref={meshRef} position={position} geometry={geometry}>
      <meshStandardMaterial
        color={EMERALD_GREEN}
        metalness={0.9}
        roughness={0.1}
        emissive={EMERALD_GREEN}
        emissiveIntensity={0.3}
      />
    </mesh>
  );
};

// Data Cubes for Anchoring Animation
const DataCubes: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const cubes = useMemo(() => {
    return transactions.filter(tx => tx.status === 'anchored').map(tx => ({
      id: tx.hash,
      position: getLocationPosition(tx.location),
      startTime: tx.timestamp
    }));
  }, [transactions]);

  useEffect(() => {
    if (meshRef.current) {
      cubes.forEach((cube, i) => {
        const matrix = new THREE.Matrix4();
        matrix.setPosition(cube.position[0], 0, cube.position[2]);
        meshRef.current!.setMatrixAt(i, matrix);
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [cubes]);

  useFrame((state) => {
    if (meshRef.current && cubes.length > 0) {
      cubes.forEach((cube, i) => {
        const elapsed = (state.clock.elapsedTime * 1000 - cube.startTime) / 1000;
        const y = Math.min(elapsed * 2, 5); // Rise up to y=5
        const matrix = new THREE.Matrix4();
        matrix.setPosition(cube.position[0], y, cube.position[2]);
        meshRef.current!.setMatrixAt(i, matrix);
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  if (cubes.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({
      color: EMERALD_GREEN,
      emissive: EMERALD_GREEN,
      emissiveIntensity: 0.5
    }), cubes.length]}>
    </instancedMesh>
  );
};

const getLocationPosition = (location: string): [number, number, number] => {
  const positions: Record<string, [number, number, number]> = {
    'Nairobi': [0, 0, 0],
    'Mombasa': [1, 0, -1],
    'Kisumu': [-1, 0, 1],
    'Nakuru': [0.5, 0, 0.5],
    'Eldoret': [-0.5, 0, 0.8],
    'Thika': [0.3, 0, -0.2],
    'Malindi': [1.5, 0, -1.5],
    'Kitale': [-0.8, 0, 1.2],
    'Garissa': [0.7, 0, -1.8],
    'Kakamega': [-1.2, 0, 0.9]
  };
  return positions[location] || [0, 0, 0];
};

// Floating Ledger
const FloatingLedger: React.FC<{ recentAnchors: Transaction[] }> = ({ recentAnchors }) => {
  return (
    <Html position={[3, 2, 0]} center>
      <div className="bg-black/80 backdrop-blur-md border border-white/20 rounded-lg p-4 text-white font-mono text-sm max-w-xs">
        <h3 className="text-emerald-400 mb-2">Recent Anchors</h3>
        <div className="space-y-1">
          {recentAnchors.map((tx, i) => (
            <motion.div
              key={tx.hash}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="text-xs"
            >
              {tx.hash} - KES {tx.amount}
            </motion.div>
          ))}
        </div>
      </div>
    </Html>
  );
};

// Cloud Layer
const CloudLayer: React.FC = () => {
  return (
    <mesh position={[0, 5, 0]}>
      <boxGeometry args={[10, 0.1, 10]} />
      <meshStandardMaterial
        color={NEON_BLUE}
        transparent
        opacity={0.3}
        emissive={NEON_BLUE}
        emissiveIntensity={0.2}
      />
    </mesh>
  );
};

// UI Overlay
const UIOverlay: React.FC = () => {
  return (
    <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md border border-white/20 rounded-lg p-4 text-white">
      <h3 className="text-emerald-400 mb-2">Merchant Dashboard</h3>
      <div className="space-y-2">
        <div>On-Chain Credit Score: <span className="text-emerald-400">95/100</span></div>
        <div>Truth Reputation: <span className="text-blue-400">★★★★★</span></div>
        <div>Active Nodes: <span className="text-blue-400">1,247</span></div>
      </div>
    </div>
  );
};

// Main Component
const Web3KenyaMap: React.FC = () => {
  console.log('Web3KenyaMap rendering');
  const { transactions, recentAnchors } = useBaseScanner();

  return (
    <div className="relative w-full h-96 bg-black">
      <Canvas camera={{ position: [0, 3, 5], fov: 75 }}>
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={0.5} color={NEON_BLUE} />
        <pointLight position={[-10, 10, -10]} intensity={0.5} color={EMERALD_GREEN} />

        <KenyaMap />
        <SmartContractNodes />
        <DataCubes transactions={transactions} />
        <FloatingLedger recentAnchors={recentAnchors} />
        <CloudLayer />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade />

        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />

        <EffectComposer>
          <Bloom intensity={0.5} kernelSize={3} luminanceThreshold={0.9} luminanceSmoothing={0.025} />
        </EffectComposer>
      </Canvas>

      <UIOverlay />
    </div>
  );
};

export default Web3KenyaMap;