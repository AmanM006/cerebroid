import { useEffect, useRef } from "react"
import * as THREE from "three"

export function LiquidAuroraCanvas() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let animationFrameId: number
    const width = mount.clientWidth
    const height = mount.clientHeight

    const scene = new THREE.Scene()
    const camera = new THREE.Camera()

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    // Full screen quad geometry
    const geometry = new THREE.PlaneGeometry(2, 2)

    // Liquid Aurora Flowing Ribbon Shader Material
    // Matches the deep obsidian-to-cyan ribbon glow in the MES26 reference exactly
    const fragmentShader = `
      precision highp float;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec2 u_mouse;

      // Simplex-type noise functions
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                            0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                           -0.577350269189626,  // -1.0 + 2.0 * C.x
                            0.024390243902439); // 1.0 / 41.0
        vec2 i  = floor(v + dot(v, C.yy) );
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
              + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m ;
        m = m*m ;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        vec2 p = uv * 2.0 - 1.0;
        p.x *= u_resolution.x / u_resolution.y;

        float t = u_time * 0.25;

        // Dynamic fluid wave warp
        float n1 = snoise(vec2(p.x * 0.8 + t * 0.3, p.y * 0.8 - t * 0.2));
        float n2 = snoise(vec2(p.x * 1.4 - t * 0.4, p.y * 1.2 + n1 * 0.6));
        
        // Liquid ribbon curve coordinates
        float wave = sin(p.y * 1.8 + n2 * 1.2 + t * 0.5) * 0.6;
        float dist = abs(p.x - wave - (u_mouse.x * 0.2));

        // Aurora Ribbon core
        float glow1 = 0.045 / (dist * dist + 0.035);
        float glow2 = 0.08 / (dist + 0.18);

        // Secondary subtle diagonal strand
        float wave2 = cos(p.x * 1.5 - n1 * 0.8 + t * 0.35) * 0.5;
        float dist2 = abs(p.y - wave2);
        float glow3 = 0.03 / (dist2 * dist2 + 0.08);

        // Gradient Colors: Cyan-Emerald (#00c8b3), Teal (#0284c7), deep obsidian
        vec3 cyan = vec3(0.0, 0.85, 0.88);
        vec3 teal = vec3(0.06, 0.65, 0.82);
        vec3 deepBlue = vec3(0.02, 0.22, 0.45);
        vec3 emerald = vec3(0.0, 0.78, 0.55);

        vec3 col = mix(deepBlue, teal, clamp(n1 * 0.5 + 0.5, 0.0, 1.0));
        col = mix(col, cyan, glow1 * 0.55);
        col += emerald * (glow3 * 0.35);

        // Add film grain noise for high-end cinematic tactile look
        float grain = fract(sin(dot(uv + t * 0.01, vec2(12.9898, 78.233))) * 43758.5453) * 0.045;

        vec3 finalColor = col * (glow1 + glow2 * 0.6) + grain;

        // Dark vignette on edges
        float vignette = 1.0 - smoothstep(0.4, 1.4, length(p * 0.7));
        finalColor *= vignette;

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `

    const uniforms = {
      u_resolution: { value: new THREE.Vector2(width, height) },
      u_time: { value: 0 },
      u_mouse: { value: new THREE.Vector2(0, 0) },
    }

    const material = new THREE.ShaderMaterial({
      vertexShader: `
        void main() {
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader,
      uniforms,
      depthTest: false,
      depthWrite: false,
    })

    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    const handleMouseMove = (e: MouseEvent) => {
      const rect = mount.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width - 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5
      uniforms.u_mouse.value.set(x, y)
    }

    window.addEventListener("mousemove", handleMouseMove)

    const clock = new THREE.Clock()

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)
      uniforms.u_time.value = clock.getElapsedTime()
      renderer.render(scene, camera)
    }

    animate()

    const handleResize = () => {
      if (!mount) return
      const w = mount.clientWidth
      const h = mount.clientHeight
      renderer.setSize(w, h)
      uniforms.u_resolution.value.set(w, h)
    }

    window.addEventListener("resize", handleResize)

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("resize", handleResize)
      if (mount && renderer.domElement) {
        mount.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [])

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 pointer-events-none w-full h-full overflow-hidden"
    />
  )
}
