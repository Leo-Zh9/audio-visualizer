import React, { useRef, useState, useEffect, useMemo } from 'react'
import { Canvas, useFrame, extend } from '@react-three/fiber'
import { shaderMaterial, Environment, Lightformer, Points, PointMaterial } from '@react-three/drei'
import { EffectComposer, Bloom, DepthOfField, Vignette, BrightnessContrast } from '@react-three/postprocessing'
import * as THREE from 'three'
import WindLines from './WindLines'

/**
 * Vibrant Organic Blob Material - matching reference image
 */
const VibrantBlobMaterialImpl = shaderMaterial(
	{
		time: 0,
		lightPos: new THREE.Vector3(5, 8, 5),
		uBeat: 0,
		uBpmFreq: 2.0,
		uBaseColor: new THREE.Color('#9b83f7'),
	},
	// Vertex Shader with BPM-reactive vertex-level pulsing
	`
	uniform float time;
	uniform float uBeat;
	uniform float uBpmFreq;
	
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
	
	// Enhanced FBM for richer organic complexity
	float fbm(vec3 p) {
		float value = 0.0;
		float amplitude = 0.5;
		for (int i = 0; i < 6; i++) {
			value += amplitude * snoise(p);
			p *= 2.2;
			amplitude *= 0.45;
		}
		return value;
	}
	
	void main() {
		vec3 pos = position;
		
		// --- CORE STRUCTURAL NOISE - Restores rich 3D volume ---
		float n1 = snoise(pos * 1.2 + time * 0.15);
		float n2 = snoise(pos * 3.5 - time * 0.25);
		float n3 = fbm(pos * 0.8 + time * 0.2);
		float shapeNoise = mix(n1, n2, 0.6) + n3 * 0.5;
		
		// Add medium and fine detail layers
		float mediumNoise = fbm(pos * 1.8 + time * 0.35);
		float fineNoise = snoise(pos * 4.5 + time * 0.45);
		
		// Combined structural noise - gives organic depth
		float combinedNoise = shapeNoise * 0.7 + mediumNoise * 0.4 + fineNoise * 0.2;
		
		// --- ORBITING TIDAL WAVES - Moon-like gravitational pull ---
		float freq = uBpmFreq;                           // BPM frequency
		float orbitSpeed = time * freq;                  // Phase advances with tempo
		
		// Orbit axis - defines the direction tides travel around
		vec3 orbitAxis = normalize(vec3(0.6, 0.8, 0.2));
		
		// Calculate angular position of each vertex around orbit axis
		float angularPos = dot(normalize(pos), orbitAxis) * 3.14159;
		
		// Primary tidal wave - orbits smoothly around the blob
		float tidalWave = sin(angularPos + orbitSpeed * 1.8) * 0.5 + 0.5;
		
		// Secondary tidal wave - different axis for complexity
		vec3 orbitAxis2 = normalize(vec3(-0.4, 0.5, 0.9));
		float angularPos2 = dot(normalize(pos), orbitAxis2) * 3.14159;
		float tidalWave2 = sin(angularPos2 - orbitSpeed * 1.4) * 0.5 + 0.5;
		
		// Combine tidal waves
		float tidalEffect = tidalWave * 0.65 + tidalWave2 * 0.35;
		
		// Subtle swirl for fluidity
		float swirl = sin(dot(pos.xy, vec2(1.3, 1.1)) + time * freq * 0.5);
		
		// --- COMBINE SHAPE + TIDAL WAVES ---
		// Base shape gives volume, tidal waves add orbiting motion
		float baseDisplacement = combinedNoise * 0.45;           // Rich structural depth
		float tidalDisplacement = tidalEffect * 0.12;            // Orbiting tidal bulge
		float swirlDisplacement = swirl * 0.04;                  // Subtle secondary motion
		
		float displacement = baseDisplacement + tidalDisplacement + swirlDisplacement;
		
		vec3 newPos = pos + normal * displacement;
		
		vNormal = normalize(normalMatrix * normal);
		vPosition = pos;
		vWorldPosition = (modelMatrix * vec4(newPos, 1.0)).xyz;
		vDisplacement = displacement;
		
		gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
	}
	`,
	// Fragment Shader - dynamic colors with contour lines
	`
	uniform vec3 lightPos;
	uniform vec3 uBaseColor;
	
	varying vec3 vNormal;
	varying vec3 vPosition;
	varying vec3 vWorldPosition;
	varying float vDisplacement;
	
	// Convert RGB to HSL
	vec3 rgb2hsl(vec3 color) {
		float maxC = max(max(color.r, color.g), color.b);
		float minC = min(min(color.r, color.g), color.b);
		float delta = maxC - minC;
		
		float h = 0.0;
		float s = 0.0;
		float l = (maxC + minC) / 2.0;
		
		if (delta > 0.0) {
			s = l < 0.5 ? delta / (maxC + minC) : delta / (2.0 - maxC - minC);
			
			if (color.r == maxC) {
				h = (color.g - color.b) / delta + (color.g < color.b ? 6.0 : 0.0);
			} else if (color.g == maxC) {
				h = (color.b - color.r) / delta + 2.0;
			} else {
				h = (color.r - color.g) / delta + 4.0;
			}
			h /= 6.0;
		}
		
		return vec3(h, s, l);
	}
	
	// Convert HSL to RGB
	float hue2rgb(float p, float q, float t) {
		if (t < 0.0) t += 1.0;
		if (t > 1.0) t -= 1.0;
		if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
		if (t < 1.0/2.0) return q;
		if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
		return p;
	}
	
	vec3 hsl2rgb(vec3 hsl) {
		float h = hsl.x;
		float s = hsl.y;
		float l = hsl.z;
		
		if (s == 0.0) {
			return vec3(l);
		}
		
		float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
		float p = 2.0 * l - q;
		
		return vec3(
			hue2rgb(p, q, h + 1.0/3.0),
			hue2rgb(p, q, h),
			hue2rgb(p, q, h - 1.0/3.0)
		);
	}
	
	void main() {
		vec3 normal = normalize(vNormal);
		vec3 viewDir = normalize(cameraPosition - vWorldPosition);
		vec3 lightDir = normalize(lightPos - vWorldPosition);
		
		// Micro-detail surface noise for texture depth
		float surfaceNoise = sin(vPosition.x * 8.0 + vPosition.y * 7.5) * 
		                     cos(vPosition.z * 8.5 + vPosition.y * 6.0);
		float microDetail = surfaceNoise * 0.5 + 0.5; // Normalize to 0-1
		
		// Enhanced multi-directional lighting for sculptural depth
		vec3 keyLightDir = normalize(vec3(3.0, 3.0, 5.0));
		vec3 fillLightDir = normalize(vec3(-3.0, -1.0, -2.0));
		vec3 rimLightDir = normalize(vec3(0.0, 3.0, -5.0));
		vec3 sideLightDir = normalize(vec3(-4.0, 0.0, 2.0));
		
		float keyDiff = max(dot(normal, keyLightDir), 0.0);
		float fillDiff = max(dot(normal, fillLightDir), 0.0);
		float rimDiff = max(dot(normal, rimLightDir), 0.0);
		float sideDiff = max(dot(normal, sideLightDir), 0.0);
		
		// MAROON COLOR GRADIENT (overriding dynamic colors)
		// Rich maroon palette with depth
		vec3 highlightColor = vec3(0.95, 0.70, 0.75);   // Soft pink highlights
		vec3 baseColor = vec3(0.65, 0.20, 0.28);        // Deep maroon
		vec3 shadowColor = vec3(0.40, 0.10, 0.15);      // Dark maroon shadows
		
		// Add micro-detail to base color for surface variation
		baseColor = mix(baseColor * 0.92, baseColor * 1.08, microDetail);
		
		// Enhanced lighting with color temperature for dramatic depth
		vec3 keyColor = vec3(1.0, 0.95, 0.88);     // Warm key light
		vec3 fillColor = vec3(0.65, 0.65, 1.0);    // Cool fill light
		vec3 sideColor = vec3(0.82, 0.75, 1.0);    // Soft side accent
		
		vec3 litColor = shadowColor * 0.9; // Slightly darker base
		litColor += highlightColor * keyDiff * 0.95 * keyColor;
		litColor += baseColor * fillDiff * 0.5 * fillColor;
		litColor += highlightColor * rimDiff * 0.4;
		litColor += baseColor * sideDiff * 0.3 * sideColor;
		
		// Clamp to prevent overbright bloom (brightness ceiling)
		litColor = clamp(litColor, vec3(0.0), vec3(0.95));
		
		// HORIZONTAL LINES - 3 pixels thin with same density
		float lineFreq = 80.0; // Keep density at 80 lines
		float horizontalLines = vWorldPosition.y * lineFreq + vDisplacement * 8.0;
		
		// Create 3-pixel thin lines using fwidth (derivative-based thickness)
		float lineValue = fract(horizontalLines);
		float lineWidth = fwidth(horizontalLines) * 3.0; // 3 pixels wide
		float linePattern = smoothstep(lineWidth, lineWidth + 0.01, lineValue) * 
		                    smoothstep(lineWidth, lineWidth + 0.01, 1.0 - lineValue);
		
		// Subtle darkening along lines
		litColor *= mix(0.88, 1.0, linePattern);
		
		// Enhanced Fresnel for edge glow
		float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
		litColor += vec3(0.9, 0.8, 1.0) * fresnel * 0.4;
		
		// Subsurface scattering simulation - light through thick areas
		float thickness = smoothstep(-0.5, 0.5, vDisplacement);
		vec3 subsurfaceColor = vec3(0.95, 0.75, 1.0) * thickness * 0.25;
		litColor += subsurfaceColor;
		
		// Darken entire object by 20% for more saturation
		litColor *= 0.8;
		
		gl_FragColor = vec4(litColor, 1.0);
	}
	`
)

extend({ VibrantBlobMaterialImpl })

/**
 * OrganicBlob - Advanced vertex-level solar flare pulsing with dynamic color
 */
function OrganicBlob({ bpm, color }) {
	const meshRef = useRef()
	const materialRef = useRef()
	const targetColorRef = useRef(new THREE.Color('#9b83f7'))
	const currentColorRef = useRef(new THREE.Color('#9b83f7'))
	const beatFreqRef = useRef(2.0) // Default 120 BPM = 2 Hz
	
	// Update target color when color prop changes
	useEffect(() => {
		if (color) {
			targetColorRef.current.set(color)
		}
	}, [color])
	
	useFrame((state) => {
		if (meshRef.current && materialRef.current) {
			const mat = materialRef.current
			const t = state.clock.getElapsedTime()
			
			// Calculate beat frequency from BPM
			const targetBeatFreq = bpm ? bpm / 60 : 2.0
			
			// Smooth BPM transitions
			beatFreqRef.current = THREE.MathUtils.lerp(
				beatFreqRef.current,
				targetBeatFreq,
				0.015
			)
			
			// BPM-reactive beat value (sine wave from -1 to 1)
			const beat = Math.sin(t * beatFreqRef.current * Math.PI * 2)
			const normalizedBeat = beat * 0.5 + 0.5 // 0 to 1
			
			// Update shader uniforms for vertex-level pulsing
			mat.uniforms.uBeat.value = beat
			mat.uniforms.uBpmFreq.value = beatFreqRef.current
			
			// Drive base morphing speed with BPM
			const morphSpeed = 0.25 + (beatFreqRef.current / 2) * 0.15
			mat.uniforms.time.value = t * morphSpeed
			
			// Static scale (no breathing/pulsing)
			meshRef.current.scale.set(1.44, 0.8, 1.2)
			
			// Smooth color transition (lerp toward target color from key/genre)
			currentColorRef.current.lerp(targetColorRef.current, 0.02)
			
			// Update shader color uniform
			mat.uniforms.uBaseColor.value.copy(currentColorRef.current)
			
			// Slow organic rotation (no beat wobble)
			meshRef.current.rotation.y += 0.0012
			meshRef.current.rotation.x = Math.sin(t * 0.18) * 0.06
		}
	})
	
	return (
		<mesh ref={meshRef} position={[0, -0.1, 0]}>
			<icosahedronGeometry args={[2.0, 120]} />
			<vibrantBlobMaterialImpl 
				ref={materialRef}
				time={0}
				lightPos={new THREE.Vector3(5, 8, 5)}
				uBeat={0}
				uBpmFreq={2.0}
				uBaseColor={new THREE.Color(color)}
			/>
		</mesh>
	)
}

/**
 * CloudScene
 */
function CloudScene({ bpm, color }) {
	return (
		<>
			{/* Subtle background color */}
			<color attach="background" args={["#faf9ff"]} />
			
			{/* Reduced fog for less blur */}
			<fog attach="fog" args={["#eae7f5", 6, 12]} />
			
			{/* Custom Environment with Lightformer */}
			<Environment resolution={256} background={false}>
				<Lightformer 
					form="circle" 
					intensity={0.9} 
					position={[0, 2, 5]} 
					scale={10} 
					color="#fff9e7" 
				/>
			</Environment>
			
			{/* Enhanced tri-light for dramatic depth */}
			<ambientLight intensity={0.35} />
			
			{/* Key light - warm, stronger for depth */}
			<directionalLight 
				position={[3, 3, 5]} 
				intensity={1.2} 
				color="#fff0cf"
			/>
			
			{/* Fill light - cool, positioned for shadow definition */}
			<directionalLight 
				position={[-3, -1, -2]} 
				intensity={0.45} 
				color="#b9aaff"
			/>
			
			{/* Rim light - stronger back edge for depth separation */}
			<directionalLight 
				position={[0, 3, -5]} 
				intensity={0.7} 
				color="#ffffff"
			/>
			
			{/* Side accent light for sculptural depth */}
			<directionalLight 
				position={[-4, 0, 2]} 
				intensity={0.35} 
				color="#d0c0ff"
			/>
			
			{/* Soft backlight for subsurface glow */}
			<pointLight 
				position={[0, -1, -3]} 
				intensity={0.5} 
				color="#ffd8ff"
			/>
			
			{/* Compositional anchoring - shadow bed for grounding */}
			<mesh position={[0, -1.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
				<planeGeometry args={[10, 10]} />
				<meshBasicMaterial 
					color="#dcd9f3" 
					transparent 
					opacity={0.25}
					depthWrite={false}
				/>
			</mesh>
			
			{/* Background particle field for depth */}
			<ParticleField />
			
			{/* The organic blob with BPM reactivity and color */}
			<OrganicBlob bpm={bpm} color={color} />
			
			{/* Whimsical wind lines flowing around the cloud */}
			<WindLines bpm={bpm} color={color} />
			
			{/* Sweeping animated light */}
			<SweepingLight />
			
			{/* Subtle camera movement */}
			<CameraAnimation />
			
			{/* Crisp postprocessing - minimal blur */}
			<EffectComposer>
				<Bloom 
					intensity={0.15}
					luminanceThreshold={0.5}
					luminanceSmoothing={0.9}
					height={300}
				/>
				<BrightnessContrast 
					brightness={0.02}
					contrast={0.15}
				/>
				<DepthOfField 
					focusDistance={0.01}
					focalLength={0.015}
					bokehScale={1.2}
				/>
				<Vignette 
					eskil={false} 
					offset={0.18} 
					darkness={0.4}
				/>
			</EffectComposer>
		</>
	)
}

/**
 * CameraAnimation - Ambient drift with breathing motion
 */
function CameraAnimation() {
	useFrame(({ clock, camera }) => {
		const t = clock.getElapsedTime()
		
		// Ambient camera drift - gentle breathing
		camera.position.x = Math.sin(t * 0.05) * 0.25
		camera.position.y = Math.sin(t * 0.03) * 0.15 + 0.2
		camera.position.z = 6.0 + Math.sin(t * 0.08) * 0.2
		
		camera.lookAt(0, 0, 0)
	})
	return null
}

/**
 * ParticleField - Subtle ambient particles for depth
 */
function ParticleField() {
	const particlesRef = useRef()
	
	// Generate random particle positions
	const positions = useMemo(() => {
		const pos = new Float32Array(300 * 3)
		for (let i = 0; i < 300; i++) {
			pos[i * 3] = (Math.random() - 0.5) * 15      // x
			pos[i * 3 + 1] = (Math.random() - 0.5) * 15  // y
			pos[i * 3 + 2] = (Math.random() - 0.5) * 15  // z
		}
		return pos
	}, [])
	
	useFrame(({ clock }) => {
		if (particlesRef.current) {
			// Gentle rotation for parallax effect
			particlesRef.current.rotation.y = clock.getElapsedTime() * 0.01
			particlesRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.005) * 0.05
		}
	})
	
	return (
		<points ref={particlesRef}>
			<bufferGeometry>
				<bufferAttribute
					attach="attributes-position"
					count={300}
					array={positions}
					itemSize={3}
				/>
			</bufferGeometry>
			<pointsMaterial
				size={0.015}
				color="#ffffff"
				transparent
				opacity={0.25}
				sizeAttenuation
				depthWrite={false}
			/>
		</points>
	)
}

/**
 * SweepingLight - Animated light that slowly moves across the scene
 */
function SweepingLight() {
	const lightRef = useRef()
	
	useFrame(({ clock }) => {
		if (lightRef.current) {
			const t = clock.getElapsedTime()
			
			// Slow sweeping motion
			lightRef.current.position.x = Math.sin(t * 0.1) * 3
			lightRef.current.position.z = Math.cos(t * 0.12) * 2 + 3
			lightRef.current.position.y = Math.sin(t * 0.08) * 1.5 + 2
		}
	})
	
	return (
		<pointLight 
			ref={lightRef}
			position={[0, 2, 3]}
			intensity={0.8}
			color="#f0e8ff"
			distance={8}
		/>
	)
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
export default function CloudVisualizerContainer({ bpm = null, color = '#9b83f7' }) {
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
						position: [0, 0, 3.5],
						fov: 50,
					}}
					dpr={[1, 2]}
					gl={{
						antialias: true,
						alpha: false,
						powerPreference: 'high-performance',
						toneMapping: THREE.ACESFilmicToneMapping,
						toneMappingExposure: 0.75,
					}}
					onCreated={({ gl }) => {
						console.log('[Cloud] Canvas initialized - rendering cloud')
						gl.setClearColor('#ffffff', 1)
					}}
				>
					<CloudScene bpm={bpm} color={color} />
				</Canvas>
			) : (
				<FallbackCloud />
			)}
		</div>
	)
}
