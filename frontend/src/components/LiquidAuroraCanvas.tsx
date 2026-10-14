import { useEffect, useRef, type CSSProperties } from "react"
import * as THREE from "three"

const VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`

const FRAGMENT_SHADER = `
#define MAX_COLORS 8
uniform vec2 uCanvas;
uniform float uTime;
uniform float uSpeed;
uniform vec2 uRot;
uniform int uColorCount;
uniform vec3 uColors[MAX_COLORS];
uniform int uTransparent;
uniform float uScale;
uniform float uFrequency;
uniform float uNoise;
varying vec2 vUv;

void main() {
  float t = uTime * uSpeed;
  vec2 p = vUv * 2.0 - 1.0;

  vec2 rp = vec2(
    p.x * uRot.x - p.y * uRot.y,
    p.x * uRot.y + p.y * uRot.x
  );

  vec2 q = vec2(rp.x * (uCanvas.x / uCanvas.y), rp.y);
  q /= max(uScale, 0.0001);
  q /= 0.5 + 0.2 * dot(q, q);
  q += 0.2 * cos(t) - 7.56;

  vec3 col = vec3(0.0);
  float a = 1.0;

  vec2 s = q;
  vec3 sumCol = vec3(0.0);
  float cover = 0.0;

  for (int i = 0; i < MAX_COLORS; i++) {
    if (i >= uColorCount) break;
    s -= 0.01;
    vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));
    float m = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(i)) / 4.0);
    float w = 1.0 - exp(-6.0 / exp(6.0 * m));
    sumCol += uColors[i] * w;
    cover = max(cover, w);
  }

  col = clamp(sumCol, 0.0, 1.0);
  a = uTransparent > 0 ? cover : 1.0;

  if (uNoise > 0.0) {
    float n = fract(sin(dot(gl_FragCoord.xy + uTime, vec2(12.9898, 78.233))) * 43758.5453);
    col += (n - 0.5) * uNoise;
  }

  gl_FragColor = vec4(col, a);
}
`

export interface LiquidAuroraCanvasProps {
  className?: string
  style?: CSSProperties
  rotation?: number
  speed?: number
  colors?: string[]
  transparent?: boolean
  autoRotate?: number
  scale?: number
  frequency?: number
  noise?: number
}

export function LiquidAuroraCanvas({
  className = "",
  style,
  rotation = 0,
  speed = 0.2,
  colors = ["#ef4444", "#dc2626", "#000000"],
  transparent = true,
  autoRotate = 2.0, // Continuous smooth autonomous rotation
  scale = 1,
  frequency = 1,
  noise = 0.1,
}: LiquidAuroraCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let animationFrameId: number
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const geometry = new THREE.PlaneGeometry(2, 2)

    const colorVectors = Array.from({ length: 8 }, () => new THREE.Vector3())

    colors.slice(0, 8).forEach((hex, idx) => {
      const num = parseInt(hex.replace("#", ""), 16)
      colorVectors[idx]!.set(((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255)
    })

    const uniforms = {
      uCanvas: { value: new THREE.Vector2(mount.clientWidth, mount.clientHeight) },
      uTime: { value: 0 },
      uSpeed: { value: speed },
      uRot: { value: new THREE.Vector2(1, 0) },
      uColorCount: { value: colors.length },
      uColors: { value: colorVectors },
      uTransparent: { value: transparent ? 1 : 0 },
      uScale: { value: scale },
      uFrequency: { value: frequency },
      uNoise: { value: noise },
    }

    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      uniforms,
    })

    const quad = new THREE.Mesh(geometry, material)
    scene.add(quad)

    const renderer = new THREE.WebGLRenderer({ alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    const handleResize = () => {
      if (!mount) return
      renderer.setSize(mount.clientWidth, mount.clientHeight, false)
      uniforms.uCanvas.value.set(mount.clientWidth, mount.clientHeight)
    }
    handleResize()
    window.addEventListener("resize", handleResize)

    const clock = new THREE.Clock()

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)
      uniforms.uTime.value = clock.getElapsedTime()
      // Autonomous smooth fluid animation without mouse tracking
      const angle = (rotation + autoRotate * uniforms.uTime.value) * (Math.PI / 180)
      uniforms.uRot.value.set(Math.cos(angle), Math.sin(angle))
      renderer.render(scene, camera)
    }

    animate()

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener("resize", handleResize)
      renderer.dispose()
      geometry.dispose()
      material.dispose()
      if (mount && renderer.domElement) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [colors, speed, rotation, autoRotate, scale, frequency, noise, transparent])

  return (
    <div
      ref={mountRef}
      className={className}
      style={{ position: "absolute", inset: 0, overflow: "hidden", ...style }}
    />
  )
}
