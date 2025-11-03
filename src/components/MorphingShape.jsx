import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useSpring, a } from '@react-spring/three'
import * as THREE from 'three'

export default function MorphingShape({ shapeIndex, onClick }) {
  const meshRef = useRef()
  
  // Smooth transition for shape changes
  const springProps = useSpring({
    scale: 1,
    opacity: 1,
    config: { mass: 1, tension: 280, friction: 60 },
  })

  // Generate refined geometries
  const geometries = useMemo(() => {
    // Sphere with fewer segments for cleaner wireframe (16x16)
    const sphere = new THREE.SphereGeometry(2, 16, 16)
    
    // Equilateral pyramid with balanced proportions (base radius = height/2 for balance)
    const pyramidHeight = 2.5
    const pyramidRadius = pyramidHeight * 0.85 // Equilateral pyramid
    const pyramid = new THREE.ConeGeometry(pyramidRadius, pyramidHeight, 4)
    
    // Cube with proper wireframe
    const cube = new THREE.BoxGeometry(3, 3, 3)
    
    return { sphere, pyramid, cube }
  }, [])

  // Rotation animation with consistent speed
  useFrame((state, delta) => {
    if (meshRef.current) {
      const rotationSpeed = 0.5 // Consistent rotation speed
      meshRef.current.rotation.y += rotationSpeed * delta
      
      // Trigger a subtle scale pulse on shape change
      if (meshRef.current.userData.shapeIndex !== shapeIndex) {
        meshRef.current.userData.shapeIndex = shapeIndex
        meshRef.current.userData.scalePulse = 1.2
      }
      
      // Animate the scale pulse
      if (meshRef.current.userData.scalePulse && meshRef.current.userData.scalePulse > 1) {
        meshRef.current.userData.scalePulse = THREE.MathUtils.lerp(meshRef.current.userData.scalePulse, 1, 0.1)
        meshRef.current.scale.setScalar(meshRef.current.userData.scalePulse)
      }
    }
  })

  // Use the appropriate geometry based on shape index
  const currentGeometry = useMemo(() => {
    const geoms = [geometries.sphere, geometries.pyramid, geometries.cube]
    return geoms[shapeIndex]
  }, [shapeIndex, geometries])

  return (
    <group onClick={onClick}>
      <mesh ref={meshRef} geometry={currentGeometry} position={[0, 0, 0]}>
        {/* Wireframe with EdgesGeometry for clean lines */}
        <edgesGeometry args={[currentGeometry]} />
        <lineBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.95}
          linewidth={2}
        />
      </mesh>
      
      {/* Additional edge lines for better wireframe visibility */}
      <mesh geometry={currentGeometry} position={[0, 0, 0]}>
        <edgesGeometry args={[currentGeometry]} />
        <lineBasicMaterial
          color="#88ccff"
          transparent
          opacity={0.3}
          linewidth={1}
        />
      </mesh>
    </group>
  )
}
