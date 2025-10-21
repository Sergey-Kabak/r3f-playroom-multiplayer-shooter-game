import { Loader, PerformanceMonitor, SoftShadows } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { Physics } from "@react-three/rapier";
import { Suspense, useState } from "react";
import { Experience } from "./components/Experience";
import { Leaderboard } from "./components/Leaderboard";
import { KeyboardControls } from "@react-three/drei";


export const CrosshairOverlay = () => {
    return (
        <div
            style={{
                position: "fixed",
                top: "50%",
                left: "50%",
                width: "30px",
                height: "30px",
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
                zIndex: 1000,
            }}
        >
            <div
                style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    width: "2px",
                    height: "30px",
                    background: "white",
                    transform: "translate(-50%, -50%)",
                    opacity: 0.9,
                }}
            />
            <div
                style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    width: "30px",
                    height: "2px",
                    background: "white",
                    transform: "translate(-50%, -50%)",
                    opacity: 0.9,
                }}
            />
        </div>
    );
};

const keyboardMap = [
    { name: "forward", keys: ["ArrowUp", "KeyW"] },
    { name: "backward", keys: ["ArrowDown", "KeyS"] },
    { name: "left", keys: ["ArrowLeft", "KeyA"] },
    { name: "right", keys: ["ArrowRight", "KeyD"] },
    { name: "run", keys: ["Shift"] },
];


function App() {
  const [downgradedPerformance, setDowngradedPerformance] = useState(false);
  return (
    <>
      <Loader />
      <Leaderboard />
        <KeyboardControls map={keyboardMap}>
        <Canvas
            shadows
            camera={{ position: [0, 30, 0], fov: 30, near: 2 }}
            dpr={[1, 1.5]} // optimization to increase performance on retina/4k devices
        >
            <color attach="background" args={["#242424"]} />
            <SoftShadows size={42} />

            <PerformanceMonitor
                // Detect low performance devices
                onDecline={(fps) => {
                    setDowngradedPerformance(true);
                }}
            />
            <Suspense>
                <Physics>
                    <Experience downgradedPerformance={downgradedPerformance} />
                </Physics>
            </Suspense>
            {!downgradedPerformance && (
                // disable the postprocessing on low-end devices
                <EffectComposer disableNormalPass>
                    <Bloom luminanceThreshold={1} intensity={1.5} mipmapBlur />
                </EffectComposer>
            )}
        </Canvas>
        </KeyboardControls>
      <CrosshairOverlay />
    </>
  );
}

export default App;
