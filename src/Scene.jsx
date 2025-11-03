import { Suspense, useState, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { useSpring, a } from '@react-spring/three'
import MorphingShape from './components/MorphingShape'
import CameraController from './components/CameraController'

export default function Scene() {
  const [shape, setShape] = useState(0) // 0: sphere, 1: pyramid, 2: cube
  
  const handleClick = () => {
    setShape((prev) => (prev + 1) % 3)
  }

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.2} />
      <directionalLight position={[5, 5, 5]} intensity={0.5} />
      <directionalLight position={[-5, -5, -5]} intensity={0.3} />
      
      {/* Scene content */}
      <MorphingShape 
        shapeIndex={shape}
        onClick={handleClick}
      />
      
      {/* Camera controller for smooth parallax drift */}
      <CameraController />
      
      {/* Post-processing effects for soft sci-fi glow */}
      <EffectComposer>
        <Bloom
          intensity={0.8}
          luminanceThreshold={0.5}
          luminanceSmoothing={0.9}
          height={300}
        />
      </EffectComposer>
    </>
  )
}
