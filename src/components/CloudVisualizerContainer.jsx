import React, { useRef, useState, useEffect } from 'react'
import { Canvas, useFrame, extend } from '@react-three/fiber'
import { shaderMaterial, Environment } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

/**
 * Vibrant Organic Blob Material - matching reference image
 */
const VibrantBlobMaterialImpl = shaderMaterial(
	{
		time: 0,
		lightPos: new THREE.Vector3(5, 8, 5),
	},
	// Vertex Shader with organic displacement
	`
	uniform float time;
	
	varying vec3 vNormal;
	varying vec3 vPosition;
	varying vec3 vWorldPosition;
	varying float vDisplacement;
	
	// Simplex 3D Noise
	vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
	vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
	vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
	vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
	
	float snoise(vec3 v) { 
		const vec2 C = vec2(1.0/6.0, 1.0/3.0);
		const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
		vec3 i  = floor(v + dot(v, C.yyy));
		vec3 x0 = v - i + dot(i, C.xxx);
		vec3 g = step(x0.yzx, x0.xyz);
		vec3 l = 1.0 - g;
		vec3 i1 = min(g.xyz, l.zxy);
		vec3 i2 = max(g.xyz, l.zxy);
		vec3 x1 = x0 - i1 + C.xxx;
		vec3 x2 = x0 - i2 + C.yyy;
		vec3 x3 = x0 - D.yyy;
		i = mod289(i);
		vec4 p = permute(permute(permute(
			i.z + vec4(0.0, i1.z, i2.z, 1.0))
			+ i.y + vec4(0.0, i1.y, i2.y, 1.0))
			+ i.x + vec4(0.0, i1.x, i2.x, 1.0));
		float n_ = 1.0/7.0;
		vec3 ns = n_ * D.wyz - D.xzx;
		vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
		vec4 x_ = floor(j * ns.z);
		vec4 y_ = floor(j - 7.0 * x_);
		vec4 x = x_ * ns.x + ns.yyyy;
		vec4 y = y_ * ns.x + ns.yyyy;
		vec4 h = 1.0 - abs(x) - abs(y);
		vec4 b0 = vec4(x.xy, y.xy);
		vec4 b1 = vec4(x.zw, y.zw);
		vec4 s0 = floor(b0)*2.0 + 1.0;
		vec4 s1 = floor(b1)*2.0 + 1.0;
		vec4 sh = -step(h, vec4(0.0));
		vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
		vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
		vec3 p0 = vec3(a0.xy, h.x);
		vec3 p1 = vec3(a0.zw, h.y);
		vec3 p2 = vec3(a1.xy, h.z);
		vec3 p3 = vec3(a1.zw, h.w);
		vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
		p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
		vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
		m = m * m;
		return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
	}
	
	// FBM for organic complexity
	float fbm(vec3 p) {
		float value = 0.0;
		float amplitude = 0.5;
		for (int i = 0; i < 5; i++) {
			value += amplitude * snoise(p);
			p *= 2.1;
			amplitude *= 0.48;
		}
		return value;
	}
	
	void main() {
		vec3 pos = position;
		
		// Organic displacement
		float displacement = fbm(pos * 0.6 + time * 0.2) * 0.7;
		displacement += snoise(pos * 1.2 + time * 0.3) * 0.3;
		displacement += snoise(pos * 2.5 + time * 0.4) * 0.15;
		
		vec3 newPos = pos + normal * displacement;
		
		vNormal = normalize(normalMatrix * normal);
		vPosition = pos;
		vWorldPosition = (modelMatrix * vec4(newPos, 1.0)).xyz;
		vDisplacement = displacement;
		
		gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
	}
	`,
	// Fragment Shader - vibrant colors with contour lines
	`
	uniform vec3 lightPos;
	
	varying vec3 vNormal;
	varying vec3 vPosition;
	varying vec3 vWorldPosition;
	varying float vDisplacement;
	
	void main() {
		vec3 normal = normalize(vNormal);
		vec3 viewDir = normalize(cameraPosition - vWorldPosition);
		vec3 lightDir = normalize(lightPos - vWorldPosition);
		
		// Strong diffuse lighting
		float NdotL = max(dot(normal, lightDir), 0.0);
		float diffuse = NdotL * 0.85 + 0.15; // High contrast
		
		// PURPLE color gradient
		vec3 highlightColor = vec3(0.85, 0.75, 1.0);   // Light purple highlights
		vec3 baseColor = vec3(0.65, 0.50, 0.95);       // Rich purple
		vec3 shadowColor = vec3(0.45, 0.30, 0.75);     // Deep purple shadows
		
		// Mix based on lighting (strong gradient)
		vec3 litColor = mix(shadowColor, baseColor, diffuse);
		litColor = mix(litColor, highlightColor, pow(NdotL, 1.5) * 0.7);
		
		// HORIZONTAL LINES - thin texture across the shape
		float lineFreq = 40.0; // Fine horizontal lines
		float horizontalLines = sin(vWorldPosition.y * lineFreq + vDisplacement * 8.0);
		
		// Make lines thin and crisp
		float linePattern = smoothstep(0.48, 0.52, horizontalLines * 0.5 + 0.5);
		
		// Subtle darkening along lines
		litColor *= mix(0.88, 1.0, linePattern);
		
		// Fresnel rim light (purple tint)
		float fresnel = pow(1.0 - dot(normal, viewDir), 2.0);
		litColor += vec3(0.9, 0.8, 1.0) * fresnel * 0.3;
		
		gl_FragColor = vec4(litColor, 1.0);
	}
	`
)

extend({ VibrantBlobMaterialImpl })

/**
 * OrganicBlob - The main visible blob
 */
function OrganicBlob() {
	const meshRef = useRef()
	
	useFrame((state) => {
		if (meshRef.current) {
			const mat = meshRef.current.material
			
			// Slow time for gentle morphing
			mat.uniforms.time.value = state.clock.getElapsedTime() * 0.35
			
			// Slow rotation
			meshRef.current.rotation.y += 0.0015
			meshRef.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.18) * 0.06
		}
	})
	
	return (
		<mesh ref={meshRef} position={[0, -0.1, 0]} scale={[1.44, 0.8, 1.2]}>
			<icosahedronGeometry args={[2.0, 80]} />
			<vibrantBlobMaterialImpl 
				time={0}
				lightPos={new THREE.Vector3(5, 8, 5)}
			/>
		</mesh>
	)
}

/**
 * CloudScene
 */
function CloudScene() {
	return (
		<>
			{/* Environment */}
			<Environment preset="sunset" background={false} />
			
			{/* Strong lighting from top-left */}
			<ambientLight intensity={0.5} />
			<directionalLight position={[5, 8, 5]} intensity={2.5} color="#ffffff" />
			<directionalLight position={[-2, 2, -3]} intensity={0.9} color="#e8d8ff" />
			<directionalLight position={[0, -2, -4]} intensity={0.6} color="#d0b8ff" />
			<pointLight position={[0, 2, 2]} intensity={1.5} color="#e8dcff" />
			
			<OrganicBlob />
			
			{/* Subtle camera movement */}
			<CameraAnimation />
			
			{/* Bloom for luminosity */}
			<EffectComposer>
				<Bloom
					intensity={0.9}
					luminanceThreshold={0.5}
					luminanceSmoothing={0.9}
					height={300}
				/>
			</EffectComposer>
		</>
	)
}

/**
 * CameraAnimation
 */
function CameraAnimation() {
	useFrame(({ clock, camera }) => {
		const t = clock.getElapsedTime()
		camera.position.z = 6.0 + Math.sin(t * 0.1) * 0.2
		camera.position.x = Math.sin(t * 0.07) * 0.15
		camera.position.y = 0.3 + Math.cos(t * 0.09) * 0.12
		camera.lookAt(0, -0.1, 0)
	})
	return null
}

/**
 * FallbackCloud
 */
function FallbackCloud() {
	return (
		<div className="absolute inset-0 flex items-center justify-center">
			<div
				style={{
					width: '650px',
					height: '500px',
					borderRadius: '45%',
					background: 'radial-gradient(ellipse at 40% 35%, rgba(165, 127, 242, 1) 0%, rgba(140, 100, 230, 0.95) 20%, rgba(115, 75, 210, 0.85) 40%, rgba(100, 60, 190, 0.5) 60%, rgba(255, 255, 255, 0) 75%)',
					filter: 'blur(25px)',
				}}
			/>
		</div>
	)
}

/**
 * CloudVisualizerContainer
 */
export default function CloudVisualizerContainer({ bpm = null }) {
	const [mounted, setMounted] = useState(false)
	const [webGLError, setWebGLError] = useState(false)

	useEffect(() => {
		setMounted(true)
		
		// WebGL check
		try {
			const canvas = document.createElement('canvas')
			const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
			if (!gl) {
				setWebGLError(true)
			}
		} catch (e) {
			setWebGLError(true)
		}
		
		console.log('[Cloud] WebGL:', !webGLError ? 'YES ✓' : 'NO (fallback)')
	}, [webGLError])

	return (
		<div 
			className="w-full h-full"
			style={{
				opacity: mounted ? 1 : 0,
				transition: 'opacity 2.5s ease-out',
			}}
		>
			{!webGLError ? (
				<Canvas
					className="w-full h-full"
					camera={{
						position: [0, 0.3, 6.0],
						fov: 48,
					}}
					dpr={[1, 2]}
					gl={{
						antialias: true,
						alpha: true,
						powerPreference: 'high-performance',
					}}
					onCreated={({ gl }) => {
						console.log('[Cloud] Rendering vibrant organic blob')
						gl.setClearColor('#ffffff', 0)
					}}
				>
					<CloudScene />
				</Canvas>
			) : (
				<FallbackCloud />
			)}
		</div>
	)
}
