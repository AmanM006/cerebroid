import { useEffect, useRef } from "react"
import * as THREE from "three"

// Simplex-style 3D noise for organic nodular tumor bumps
function createNoise3D() {
  const perm = new Uint8Array(512)
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  for (let i = 255; i > 0; i--) {
    const n = Math.floor(Math.random() * (i + 1))
    const q = p[i]!
    p[i] = p[n]!
    p[n] = q
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]!

  return function (x: number, y: number, z: number) {
    const X = Math.floor(x) & 255
    const Y = Math.floor(y) & 255
    const Z = Math.floor(z) & 255
    x -= Math.floor(x)
    y -= Math.floor(y)
    z -= Math.floor(z)
    const u = x * x * x * (x * (x * 6 - 15) + 10)
    const v = y * y * y * (y * (y * 6 - 15) + 10)
    const w = z * z * z * (z * (z * 6 - 15) + 10)

    const A = perm[X]! + Y
    const AA = perm[A]! + Z
    const AB = perm[A + 1]! + Z
    const B = perm[X + 1]! + Y
    const BA = perm[B]! + Z
    const BB = perm[B + 1]! + Z

    function grad(hash: number, gx: number, gy: number, gz: number) {
      const h = hash & 15
      const u_ = h < 8 ? gx : gy
      const v_ = h < 4 ? gy : h === 12 || h === 14 ? gx : gz
      return ((h & 1) === 0 ? u_ : -u_) + ((h & 2) === 0 ? v_ : -v_)
    }

    return (
      (1 - w) *
        ((1 - v) * ((1 - u) * grad(perm[AA]!, x, y, z) + u * grad(perm[BA]!, x - 1, y, z)) +
          v * ((1 - u) * grad(perm[AB]!, x, y - 1, z) + u * grad(perm[BB]!, x - 1, y - 1, z))) +
      w *
        ((1 - v) * ((1 - u) * grad(perm[AA + 1]!, x, y, z - 1) + u * grad(perm[BA + 1]!, x - 1, y, z - 1)) +
          v * ((1 - u) * grad(perm[AB + 1]!, x, y - 1, z - 1) + u * grad(perm[BB + 1]!, x - 1, y - 1, z - 1)))
    )
  }
}

export function NovaCell3DScene() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let animationFrameId: number
    const width = mount.clientWidth
    const height = mount.clientHeight

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x000000, 0.015)

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100)
    camera.position.set(0, 0, 16)

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.4
    mount.appendChild(renderer.domElement)

    // Lighting setup for glowing, shiny organic red tumors in deep obsidian space
    const ambientLight = new THREE.AmbientLight(0x2a0808, 2.0)
    scene.add(ambientLight)

    // Crisp white specular key light
    const keyLight = new THREE.DirectionalLight(0xffffff, 4.2)
    keyLight.position.set(-8, 12, 10)
    scene.add(keyLight)

    // Secondary rim backlight
    const rimLight = new THREE.DirectionalLight(0xff4444, 3.0)
    rimLight.position.set(6, -6, -8)
    scene.add(rimLight)

    // Bright glowing internal red point lights that illuminate the central hero tumor
    const heroRedLight = new THREE.PointLight(0xff1111, 120, 25)
    heroRedLight.position.set(1.4, -0.2, 2.0)
    scene.add(heroRedLight)

    const masterGroup = new THREE.Group()
    scene.add(masterGroup)

    const noise = createNoise3D()

    // Vibrant, glistening hyper-vascular red tumor material
    const primaryTumorMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#ff1e1e"), // Bright vivid crimson/scarlet
      emissive: new THREE.Color("#b91c1c"), // Deep internal vascular red glow
      emissiveIntensity: 0.65,
      roughness: 0.22,
      metalness: 0.15,
      clearcoat: 1.0, // High wet biological shine
      clearcoatRoughness: 0.1,
      transmission: 0.08,
    })

    // Satellite tumor material
    const satelliteTumorMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#ef4444"),
      emissive: new THREE.Color("#991b1b"),
      emissiveIntensity: 0.55,
      roughness: 0.25,
      metalness: 0.12,
      clearcoat: 0.9,
      clearcoatRoughness: 0.14,
    })

    // Micro-nodule material
    const noduleMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#ff3333"),
      emissive: new THREE.Color("#dc2626"),
      emissiveIntensity: 0.75,
      roughness: 0.18,
      clearcoat: 1.0,
    })

    // Helper to generate an organic, bumpy, nodular tumor mesh
    function createTumorGeometry(radius: number, segments: number, bumpScale: number) {
      const geo = new THREE.SphereGeometry(radius, segments, segments)
      const posAttr = geo.attributes.position!
      const v = new THREE.Vector3()

      for (let i = 0; i < posAttr.count; i++) {
        v.fromBufferAttribute(posAttr, i)
        const len = v.length()
        const n1 = noise(v.x * 1.5, v.y * 1.5, v.z * 1.5)
        const n2 = noise(v.x * 3.5, v.y * 3.5, v.z * 3.5) * 0.4
        const n3 = noise(v.x * 7.0, v.y * 7.0, v.z * 7.0) * 0.15
        const disp = 1.0 + (n1 + n2 + n3) * bumpScale
        v.normalize().multiplyScalar(len * disp)
        posAttr.setXYZ(i, v.x, v.y, v.z)
      }
      geo.computeVertexNormals()
      return geo
    }

    // Helper to attach clustered micro-papillary nodules
    function attachNodules(parent: THREE.Object3D, count: number, baseRadius: number) {
      const v = new THREE.Vector3()
      for (let n = 0; n < count; n++) {
        const rad = baseRadius * (0.16 + Math.random() * 0.18)
        const nGeo = new THREE.SphereGeometry(rad, 18, 18)
        const pAttr = nGeo.attributes.position!
        for (let j = 0; j < pAttr.count; j++) {
          v.fromBufferAttribute(pAttr, j)
          const disp = 1.0 + noise(v.x * 5, v.y * 5, v.z * 5) * 0.25
          v.multiplyScalar(disp)
          pAttr.setXYZ(j, v.x, v.y, v.z)
        }
        nGeo.computeVertexNormals()

        const nMesh = new THREE.Mesh(nGeo, noduleMaterial)
        const phi = Math.random() * Math.PI * 2
        const theta = Math.acos(2 * Math.random() - 1)
        const dist = baseRadius * (0.85 + Math.random() * 0.22)
        nMesh.position.set(
          dist * Math.sin(theta) * Math.cos(phi),
          dist * Math.sin(theta) * Math.sin(phi),
          dist * Math.cos(theta)
        )
        parent.add(nMesh)
      }
    }

    // -------------------------------------------------------------
    // 1. PRIMARY HERO TUMOR (Large, organic, vibrant bright red)
    // -------------------------------------------------------------
    const heroGroup = new THREE.Group()
    heroGroup.position.set(1.4, -0.2, 0.5)

    const heroTumorGeo = createTumorGeometry(2.5, 96, 0.42)
    const heroTumorMesh = new THREE.Mesh(heroTumorGeo, primaryTumorMaterial)
    attachNodules(heroTumorMesh, 24, 2.5)
    heroGroup.add(heroTumorMesh)

    masterGroup.add(heroGroup)

    // -------------------------------------------------------------
    // 2. SURROUNDING SATELLITE RED TUMORS (Replacing the balls)
    // -------------------------------------------------------------
    const satelliteConfigs = [
      { x: -2.8, y: 3.0, z: -1.0, r: 1.15, nodules: 12, speed: 0.6, offset: 1.2 },
      { x: 0.2, y: 3.3, z: -2.2, r: 0.85, nodules: 8, speed: 0.5, offset: 2.8 },
      { x: -5.2, y: 1.9, z: -1.4, r: 0.8, nodules: 8, speed: 0.7, offset: 3.5 },
      { x: -7.5, y: 0.8, z: -2.0, r: 0.7, nodules: 6, speed: 0.8, offset: 4.1 },
      { x: -4.8, y: -1.4, z: -0.9, r: 0.95, nodules: 10, speed: 0.55, offset: 5.2 },
      { x: -3.2, y: -2.8, z: -1.8, r: 0.65, nodules: 6, speed: 0.65, offset: 6.0 },
      { x: 5.2, y: 0.4, z: -2.8, r: 0.72, nodules: 7, speed: 0.5, offset: 7.1 },
    ]

    const satelliteMeshes: {
      group: THREE.Group
      origX: number
      origY: number
      origZ: number
      speed: number
      offset: number
    }[] = []

    satelliteConfigs.forEach((cfg) => {
      const g = new THREE.Group()
      g.position.set(cfg.x, cfg.y, cfg.z)

      const sGeo = createTumorGeometry(cfg.r, 36, 0.35)
      const sMesh = new THREE.Mesh(sGeo, satelliteTumorMaterial)
      attachNodules(sMesh, cfg.nodules, cfg.r)
      g.add(sMesh)

      masterGroup.add(g)
      satelliteMeshes.push({
        group: g,
        origX: cfg.x,
        origY: cfg.y,
        origZ: cfg.z,
        speed: cfg.speed,
        offset: cfg.offset,
      })
    })

    // Micro floating red cellular fragments in deep space
    const particleCount = 40
    const pGeo = new THREE.SphereGeometry(0.06, 8, 8)
    const pMat = new THREE.MeshBasicMaterial({
      color: 0xff3b3b,
      transparent: true,
      opacity: 0.5,
    })
    const particleGroup = new THREE.Group()
    const particles: { mesh: THREE.Mesh; origY: number; speed: number }[] = []

    for (let p = 0; p < particleCount; p++) {
      const pMesh = new THREE.Mesh(pGeo, pMat)
      pMesh.position.set(
        (Math.random() - 0.5) * 24,
        (Math.random() - 0.5) * 16,
        -1 - Math.random() * 8
      )
      const scale = 0.5 + Math.random() * 1.5
      pMesh.scale.set(scale, scale, scale)
      particleGroup.add(pMesh)
      particles.push({
        mesh: pMesh,
        origY: pMesh.position.y,
        speed: 0.2 + Math.random() * 0.3,
      })
    }
    scene.add(particleGroup)

    // Parallax tracking
    let targetMouseX = 0
    let targetMouseY = 0
    let currentMouseX = 0
    let currentMouseY = 0

    const handleMouseMove = (e: MouseEvent) => {
      const rect = mount.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
      targetMouseX = x
      targetMouseY = y
    }

    let targetScrollY = 0
    let currentScrollY = 0
    const handleScroll = () => {
      targetScrollY = window.scrollY
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("scroll", handleScroll, { passive: true })

    const clock = new THREE.Clock()

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)
      const elapsedTime = clock.getElapsedTime()

      currentMouseX += (targetMouseX - currentMouseX) * 0.05
      currentMouseY += (targetMouseY - currentMouseY) * 0.05
      currentScrollY += (targetScrollY - currentScrollY) * 0.06

      // Group parallax
      masterGroup.rotation.y = currentMouseX * 0.28
      masterGroup.rotation.x = -currentMouseY * 0.2
      masterGroup.position.x = currentMouseX * 0.45
      masterGroup.position.y = currentMouseY * 0.35 - currentScrollY * 0.002

      // Hero tumor rotation & organic breathing pulse
      heroTumorMesh.rotation.y += 0.004
      heroTumorMesh.rotation.x += 0.002
      const tumorPulse = 1.0 + Math.sin(elapsedTime * 1.5) * 0.03
      heroTumorMesh.scale.set(tumorPulse, tumorPulse, tumorPulse)
      heroGroup.position.y = -0.2 + Math.sin(elapsedTime * 0.7) * 0.15

      // Satellite tumors floating & rotating
      satelliteMeshes.forEach((sat) => {
        const time = elapsedTime * sat.speed + sat.offset
        sat.group.position.x = sat.origX + Math.sin(time * 0.8) * 0.16
        sat.group.position.y = sat.origY + Math.cos(time * 0.9) * 0.2
        sat.group.rotation.x += 0.005
        sat.group.rotation.y += 0.007
      })

      particles.forEach((p) => {
        p.mesh.position.y = p.origY + Math.sin(elapsedTime * p.speed) * 0.3
      })

      renderer.render(scene, camera)
    }

    animate()

    const handleResize = () => {
      if (!mount) return
      const w = mount.clientWidth
      const h = mount.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }

    window.addEventListener("resize", handleResize)

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("scroll", handleScroll)
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
      className="absolute inset-0 pointer-events-none z-10 w-full h-full overflow-hidden"
    />
  )
}
