import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'

/**
 * WindLines - Animated flowing energy lines around the cloud
 * Creates ethereal, drifting wisps that harmonize with BPM and color
 */
export default function WindLines({ bpm = 120, color = '#ffffff' }) {
	const groupRef = useRef()
	const linesRef = useRef([])
	
	// Generate orbital paths like electrons around nucleus
	const orbitalData = useMemo(() => {
		const orbitals = []
		const numOrbits = 8 // Multiple orbital rings
		
		for (let i = 0; i < numOrbits; i++) {
			const orbitRadius = 3.2 + i * 0.4 // Increasing orbital radii
			const tiltX = (i * 0.4) - 1.2 // Vary X-axis tilt (up/down angle)
			const tiltZ = Math.sin(i * 0.7) * 0.8 // Vary Z-axis tilt (side angle)
			const orbitSpeed = 0.2 - (i * 0.02) // Outer orbits slower (physics!)
			
			orbitals.push({
				radius: orbitRadius,
				tiltX: tiltX,
				tiltZ: tiltZ,
				speed: orbitSpeed,
				opacity: 0.4 - (i * 0.03),
				lineWidth: 5.0 - (i * 0.3), // Much thicker lines
			})
		}
		
		return orbitals
	}, [])
	
	// Animate orbits like electrons revolving around nucleus
	useFrame(({ clock }) => {
		if (!groupRef.current) return
		
		const t = clock.getElapsedTime()
		const bpmFactor = bpm / 120
		
		// Each orbital group revolves around the center (cloud)
		groupRef.current.children.forEach((child, idx) => {
			if (child && orbitalData[idx]) {
				const orbit = orbitalData[idx]
				
				// Apply unique tilt to each orbital plane (creates 3D variety)
				child.rotation.x = orbit.tiltX
				child.rotation.z = orbit.tiltZ
				
				// REVOLVE at constant speed (independent of BPM!)
				child.rotation.y = t * orbit.speed
				
				// Access the Line component inside the group
				const lineChild = child.children[0]
				if (lineChild && lineChild.material) {
					// Animate dash flow along the orbital path (constant)
					lineChild.material.dashOffset = -t * 0.25
					
					// Gentle opacity breathing
					lineChild.material.opacity = orbit.opacity + Math.sin(t * 0.4 + idx * 0.8) * 0.1
				}
			}
		})
	})
	
	// Black orbital lines for maximum contrast
	const lineColor = useMemo(() => {
		return new THREE.Color('#000000')
	}, [])
	
	return (
		<group ref={groupRef}>
			{orbitalData.map((orbit, i) => {
				// Create circular orbital path
				const points = []
				const segments = 64
				
				for (let j = 0; j <= segments; j++) {
					const angle = (j / segments) * Math.PI * 2
					points.push(new THREE.Vector3(
						orbit.radius * Math.cos(angle),
						0, // Flat circle (tilt applied via rotation)
						orbit.radius * Math.sin(angle)
					))
				}
				
				return (
					<group key={i}>
						<Line
							points={points}
							color={lineColor}
							lineWidth={orbit.lineWidth}
							dashed
							dashSize={0.4}
							gapSize={0.7}
							transparent
							opacity={orbit.opacity}
							depthWrite={false}
							blending={THREE.NormalBlending}
						/>
					</group>
				)
			})}
		</group>
	)
}

