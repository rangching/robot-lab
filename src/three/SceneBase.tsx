import { ContactShadows, Environment, Grid, Lightformer } from '@react-three/drei';

/** 共用燈光、環境反射、地板網格 */
export function SceneBase({ floorY = -0.18, grid = true }: { floorY?: number; grid?: boolean }) {
  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[5, 10, 4]} intensity={1.7} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} />
      <directionalLight position={[-6, 4, -5]} intensity={0.5} color="#bae6fd" />
      <hemisphereLight args={['#ffffff', '#cbd5e1', 0.5]} />
      <Environment resolution={128}>
        <Lightformer intensity={2} position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[12, 12, 1]} />
        <Lightformer intensity={1.2} color="#22e3ff" position={[-6, 2, 2]} rotation={[0, Math.PI / 2, 0]} scale={[8, 3, 1]} />
        <Lightformer intensity={0.8} color="#ffffff" position={[6, 3, -2]} rotation={[0, -Math.PI / 2, 0]} scale={[8, 3, 1]} />
      </Environment>
      <ContactShadows position={[0, floorY - 0.01, 0]} opacity={0.32} scale={18} blur={2.2} far={5} resolution={512} color="#1e3a5f" />
      {grid && (
        <Grid
          position={[0, floorY - 0.02, 0]}
          args={[40, 40]}
          cellSize={0.5}
          cellThickness={0.6}
          cellColor="#cfdcea"
          sectionSize={2.5}
          sectionThickness={1}
          sectionColor="#93b4d3"
          fadeDistance={26}
          fadeStrength={1.4}
          infiniteGrid
        />
      )}
    </>
  );
}
