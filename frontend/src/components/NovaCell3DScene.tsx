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
    // Black mist fog for dark theme
    scene.fog = new THREE.FogExp2(0x05070a, 0.02)

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
    renderer.toneMappingExposure = 1.3
    mount.appendChild(renderer.domElement)

    // Lighting setup tailored for crisp white glass balls and vibrant red tumor
    const ambientLight = new THREE.AmbientLight(0x222630, 2.5)
    scene.add(ambientLight)

    // Bright specular key light
    const keyLight = new THREE.DirectionalLight(0xffffff, 4.0)
    keyLight.position.set(-8, 12, 10)
    scene.add(keyLight)

    // White rim backlight
    const rimLight = new THREE.DirectionalLight(0xffffff, 3.0)
    rimLight.position.set(6, -6, -8)
    scene.add(rimLight)

    // Internal intense red/crimson point light for the tumor core
    const coreRedLight = new THREE.PointLight(0xff2222, 60, 25)
    coreRedLight.position.set(1.4, -0.2, 0.5)
    scene.add(coreRedLight)

    const masterGroup = new THREE.Group()
    scene.add(masterGroup)

    // Clear White/Pearl Glass Vesicle Membrane Material
    const whiteGlassMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#ffffff"),
      emissive: new THREE.Color("#334155"),
      emissiveIntensity: 0.1,
      roughness: 0.06,
      metalness: 0.1,
      transmission: 0.9, // Ultra high crystal transparency
      ior: 1.45,
      thickness: 1.6,
      specularIntensity: 1.5,
      specularColor: new THREE.Color("#ffffff"),
      transparent: true,
      opacity: 0.9,
    })

    // -------------------------------------------------------------
    // 1. PRIMARY HERO VESICLE WITH VIBRANT RED 3D TUMOR SPHEROID CORE
    // -------------------------------------------------------------
    const heroGroup = new THREE.Group()
    heroGroup.position.set(1.4, -0.2, 0.5)

    // Outer clear white glass sphere
    const heroOuterGeo = new THREE.SphereGeometry(3.6, 64, 64)
    const heroOuterMesh = new THREE.Mesh(heroOuterGeo, whiteGlassMaterial)
    heroGroup.add(heroOuterMesh)

    // --- INNER 3D TUMOR SPHEROID ---
    const noise = createNoise3D()
    const tumorGeo = new THREE.SphereGeometry(2.0, 96, 96)
    const posAttr = tumorGeo.attributes.position!
    const v3 = new THREE.Vector3()

    for (let i = 0; i < posAttr.count; i++) {
      v3.fromBufferAttribute(posAttr, i)
      const len = v3.length()
      const n1 = noise(v3.x * 1.5, v3.y * 1.5, v3.z * 1.5)
      const n2 = noise(v3.x * 3.5, v3.y * 3.5, v3.z * 3.5) * 0.4
      const n3 = noise(v3.x * 7.0, v3.y * 7.0, v3.z * 7.0) * 0.15
      const displacement = 1.0 + (n1 + n2 + n3) * 0.42
      v3.normalize().multiplyScalar(len * displacement)
      posAttr.setXYZ(i, v3.x, v3.y, v3.z)
    }
    tumorGeo.computeVertexNormals()

    // Highly saturated organic RED tumor material
    const tumorMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#ef4444"), // Bright vivid red
      emissive: new THREE.Color("#b91c1c"), // Deep ruby crimson core
      emissiveIntensity: 0.55,
      roughness: 0.28,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.12,
      transmission: 0.12,
    })

    const tumorMesh = new THREE.Mesh(tumorGeo, tumorMaterial)
    tumorGroupAddNodules(tumorMesh)
    heroGroup.add(tumorMesh)

    // Clustered vascular micro-nodules in crimson red
    function tumorGroupAddNodules(parent: THREE.Mesh) {
      const noduleCount = 16
      const noduleMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color("#dc2626"),
        emissive: new THREE.Color("#991b1b"),
        emissiveIntensity: 0.4,
        roughness: 0.2,
        clearcoat: 0.9,
      })

      for (let n = 0; n < noduleCount; n++) {
        const rad = 0.35 + Math.random() * 0.5
        const nGeo = new THREE.SphereGeometry(rad, 24, 24)
        const pAttr = nGeo.attributes.position!
        for (let j = 0; j < pAttr.count; j++) {
          v3.fromBufferAttribute(pAttr, j)
          const disp = 1.0 + noise(v3.x * 4, v3.y * 4, v3.z * 4) * 0.25
          v3.multiplyScalar(disp)
          pAttr.setXYZ(j, v3.x, v3.y, v3.z)
        }
        nGeo.computeVertexNormals()

        const nMesh = new THREE.Mesh(nGeo, noduleMat)
        const phi = Math.random() * Math.PI * 2
        const theta = Math.acos(2 * Math.random() - 1)
        const dist = 1.7 + Math.random() * 0.35
        nMesh.position.set(
          dist * Math.sin(theta) * Math.cos(phi),
          dist * Math.sin(theta) * Math.sin(phi),
          dist * Math.cos(theta)
        )
        parent.add(nMesh)
      }
    }

    masterGroup.add(heroGroup)

    // -------------------------------------------------------------
    // 2. SURROUNDING SATELLITE CELLS: PURE WHITE GLASS BALLS
    // -------------------------------------------------------------
    const satellites = [
      { x: -2.8, y: 3.0, z: -1.0, r: 1.45, speed: 0.6, offset: 1.2 },
      { x: 0.2, y: 3.3, z: -2.2, r: 1.05, speed: 0.5, offset: 2.8 },
      { x: -5.2, y: 1.9, z: -1.4, r: 1.0, speed: 0.7, offset: 3.5 },
      { x: -7.5, y: 0.8, z: -2.0, r: 0.9, speed: 0.8, offset: 4.1 },
      { x: -4.8, y: -1.4, z: -0.9, r: 1.15, speed: 0.55, offset: 5.2 },
      { x: -3.2, y: -2.8, z: -1.8, r: 0.75, speed: 0.65, offset: 6.0 },
      { x: 5.2, y: 0.4, z: -2.8, r: 0.85, speed: 0.5, offset: 7.1 },
    ]

    const satelliteMeshes: {
      group: THREE.Group
      origX: number
      origY: number
      origZ: number
      speed: number
      offset: number
    }[] = []

    satellites.forEach((sat) => {
      const g = new THREE.Group()
      g.position.set(sat.x, sat.y, sat.z)

      const sGeo = new THREE.SphereGeometry(sat.r, 36, 36)
      // Pure White Glass Ball (empty inside, no blue)
      const sMesh = new THREE.Mesh(sGeo, whiteGlassMaterial)
      g.add(sMesh)

      masterGroup.add(g)
      satelliteMeshes.push({
        group: g,
        origX: sat.x,
        origY: sat.y,
        origZ: sat.z,
        speed: sat.speed,
        offset: sat.offset,
      })
    })

    // Micro floating white dust particles
    const particleCount = 45
    const pGeo = new THREE.SphereGeometry(0.08, 12, 12)
    const pMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.4,
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

      // Tumor core rotation & subtle organic morphing
      tumorMesh.rotation.y += 0.005
      tumorMesh.rotation.x += 0.003
      const tumorPulse = 1.0 + Math.sin(elapsedTime * 1.5) * 0.02
      tumorMesh.scale.set(tumorPulse, tumorPulse, tumorPulse)

      // Outer hero membrane breathing
      const heroBreath = 1.0 + Math.sin(elapsedTime * 0.8) * 0.015
      heroGroup.scale.set(heroBreath, heroBreath, heroBreath)
      heroGroup.position.y = -0.2 + Math.sin(elapsedTime * 0.7) * 0.15

      // Satellite floaters animation
      satelliteMeshes.forEach((sat) => {
        const time = elapsedTime * sat.speed + sat.offset
        sat.group.position.x = sat.origX + Math.sin(time * 0.8) * 0.16
        sat.group.position.y = sat.origY + Math.cos(time * 0.9) * 0.2
        sat.group.rotation.x += 0.004
        sat.group.rotation.y += 0.006
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
