import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

export default function CameraController() {
  const { camera } = useThree()
  const timeRef = useRef(0)

  useFrame((state, delta) => {
    timeRef.current += delta
    
    // Subtle camera drift for depth
    const driftAmount = 0.5
    const driftSpeed = 0.3
    
    camera.position.x = Math.sin(timeRef.current * driftSpeed) * driftAmount * 0.1
    camera.position.y = Math.cos(timeRef.current * driftSpeed * 0.7) * driftAmount * 0.1
    camera.lookAt(0, 0, 0)
  })

  return null
}
