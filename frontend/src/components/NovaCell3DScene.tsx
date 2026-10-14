import { useEffect, useRef } from "react"
import * as THREE from "three"

interface CellConfig {
  x: number
  y: number
  z: number
  radius: number
  nucleiCount: number
  nucleiRadius: number
  driftSpeed: number
  rotSpeed: number
  noiseOffset: number
}

export function NovaCell3DScene() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let animationFrameId: number
    const width = mount.clientWidth
    const height = mount.clientHeight

    // Scene with smooth light sky-blue mist/fog matching reference #cdeaf7
    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0xd6effb, 0.025)

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100)
    camera.position.set(0, 0, 16)

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    mount.appendChild(renderer.domElement)

    // Lighting setup for glossy, translucent, hydro-gel cell aesthetics
    const ambientLight = new THREE.AmbientLight(0xbbe3f7, 2.2)
    scene.add(ambientLight)

    // Key bright white/light-cyan specular highlight light (from top-left)
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.5)
    keyLight.position.set(-8, 12, 10)
    scene.add(keyLight)

    // Vibrant cyan fill light from right-center
    const fillLight = new THREE.PointLight(0x00c4f0, 80, 50)
    fillLight.position.set(8, -2, 8)
    scene.add(fillLight)

    // Deep aquamarine rim/backlight
    const rimLight = new THREE.DirectionalLight(0x22d3ee, 2.0)
    rimLight.position.set(5, -6, -8)
    scene.add(rimLight)

    // Cell outer membrane material: Translucent, refractive glass/liquid vesicle
    const membraneMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#48cbf7"),
      emissive: new THREE.Color("#0284c7"),
      emissiveIntensity: 0.15,
      roughness: 0.08,
      metalness: 0.05,
      transmission: 0.78, // high glass liquid transparency
      ior: 1.35, // water/cytoplasm refractive index
      thickness: 1.6,
      specularIntensity: 1.0,
      specularColor: new THREE.Color("#ffffff"),
      transparent: true,
      opacity: 0.88,
    })

    // Inner organelle / cell nucleus material: Vibrant deep cyan-blue, semi-diffuse with internal glow
    const organelleMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#0284c7"),
      emissive: new THREE.Color("#0369a1"),
      emissiveIntensity: 0.55,
      roughness: 0.28,
      metalness: 0.1,
      transmission: 0.45,
      ior: 1.4,
      transparent: true,
      opacity: 0.95,
    })

    // Internal chromatin / nucleolus particles material
    const chromatinMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#0c4a6e"),
      roughness: 0.4,
      metalness: 0.1,
    })

    // Group for all cells
    const masterGroup = new THREE.Group()
    scene.add(masterGroup)

    // Define cell layout accurately matching NovaCell reference:
    // 1. Center hero giant cell (slightly right of center, taking up prominent vertical center)
    // 2. Top-center medium cell
    // 3. Top-left floater cell
    // 4. Far-left mid floater
    // 5. Far-left bottom floater
    // 6. Mid-left lower cell
    // 7. Right background micro cells
    const cellConfigs: CellConfig[] = [
      // Primary Hero Giant Cell
      {
        x: 0.4,
        y: -0.4,
        z: 0.8,
        radius: 3.8,
        nucleiCount: 4,
        nucleiRadius: 1.15,
        driftSpeed: 0.4,
        rotSpeed: 0.003,
        noiseOffset: 0,
      },
      // Top Center Cell
      {
        x: -2.2,
        y: 3.2,
        z: -1.0,
        radius: 1.5,
        nucleiCount: 3,
        nucleiRadius: 0.48,
        driftSpeed: 0.6,
        rotSpeed: 0.004,
        noiseOffset: 1.5,
      },
      // Top mid-high cell
      {
        x: 0.2,
        y: 3.0,
        z: -2.5,
        radius: 1.1,
        nucleiCount: 2,
        nucleiRadius: 0.38,
        driftSpeed: 0.5,
        rotSpeed: 0.005,
        noiseOffset: 3.2,
      },
      // Upper Left floater
      {
        x: -4.8,
        y: 2.1,
        z: -1.2,
        radius: 1.05,
        nucleiCount: 2,
        nucleiRadius: 0.34,
        driftSpeed: 0.7,
        rotSpeed: 0.006,
        noiseOffset: 2.1,
      },
      // Far Left edge floater
      {
        x: -7.2,
        y: 1.0,
        z: -2.0,
        radius: 0.95,
        nucleiCount: 1,
        nucleiRadius: 0.32,
        driftSpeed: 0.8,
        rotSpeed: 0.005,
        noiseOffset: 4.0,
      },
      // Lower Left floater
      {
        x: -4.5,
        y: -1.2,
        z: -0.8,
        radius: 1.15,
        nucleiCount: 2,
        nucleiRadius: 0.38,
        driftSpeed: 0.55,
        rotSpeed: 0.004,
        noiseOffset: 5.3,
      },
      // Bottom Far Left tiny
      {
        x: -3.0,
        y: -2.6,
        z: -1.8,
        radius: 0.75,
        nucleiCount: 1,
        nucleiRadius: 0.26,
        driftSpeed: 0.65,
        rotSpeed: 0.005,
        noiseOffset: 6.1,
      },
      // Right edge floater
      {
        x: 4.8,
        y: 0.2,
        z: -3.0,
        radius: 0.9,
        nucleiCount: 2,
        nucleiRadius: 0.3,
        driftSpeed: 0.5,
        rotSpeed: 0.004,
        noiseOffset: 7.2,
      },
    ]

    interface CellItem {
      group: THREE.Group
      origX: number
      origY: number
      origZ: number
      driftSpeed: number
      rotSpeed: number
      noiseOffset: number
    }

    const cells: CellItem[] = []

    cellConfigs.forEach((cfg) => {
      const cellGroup = new THREE.Group()
      cellGroup.position.set(cfg.x, cfg.y, cfg.z)

      // Outer cell membrane sphere
      // Use higher detail for smoothness
      const sphereGeo = new THREE.SphereGeometry(cfg.radius, 48, 48)
      const outerMesh = new THREE.Mesh(sphereGeo, membraneMaterial)
      cellGroup.add(outerMesh)

      // Subtle membrane highlight ring / surface rim
      const innerCluster = new THREE.Group()

      // Add clustered nuclei inside the cell
      const nucleusGeo = new THREE.SphereGeometry(cfg.nucleiRadius, 32, 32)
      for (let n = 0; n < cfg.nucleiCount; n++) {
        const nucleus = new THREE.Mesh(nucleusGeo, organelleMaterial)
        // Position nuclei clustered near the center
        const angle = (n / cfg.nucleiCount) * Math.PI * 2
        const dist = cfg.radius * 0.28
        nucleus.position.set(
          Math.cos(angle) * dist,
          Math.sin(angle) * dist * 0.85,
          (Math.sin(n * 2) * 0.3 - 0.1) * dist
        )
        // Add tiny chromatin granules inside each nucleus
        const chromatinGeo = new THREE.SphereGeometry(cfg.nucleiRadius * 0.32, 16, 16)
        const chromatin = new THREE.Mesh(chromatinGeo, chromatinMaterial)
        chromatin.position.set(0.1, 0.1, 0.1)
        nucleus.add(chromatin)

        innerCluster.add(nucleus)
      }

      cellGroup.add(innerCluster)
      masterGroup.add(cellGroup)

      cells.push({
        group: cellGroup,
        origX: cfg.x,
        origY: cfg.y,
        origZ: cfg.z,
        driftSpeed: cfg.driftSpeed,
        rotSpeed: cfg.rotSpeed,
        noiseOffset: cfg.noiseOffset,
      })
    })

    // Floating micro biological droplets / vesicles in the distance
    const vesicleCount = 45
    const vesicleGeo = new THREE.SphereGeometry(0.12, 16, 16)
    const vesicleMat = new THREE.MeshPhysicalMaterial({
      color: 0x67e8f9,
      transmission: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.6,
    })
    const vesicleGroup = new THREE.Group()
    const vesicles: { mesh: THREE.Mesh; origY: number; speed: number }[] = []

    for (let v = 0; v < vesicleCount; v++) {
      const mesh = new THREE.Mesh(vesicleGeo, vesicleMat)
      mesh.position.set(
        (Math.random() - 0.5) * 22,
        (Math.random() - 0.5) * 14,
        -1 - Math.random() * 8
      )
      const scale = 0.5 + Math.random() * 1.5
      mesh.scale.set(scale, scale, scale)
      vesicleGroup.add(mesh)
      vesicles.push({
        mesh,
        origY: mesh.position.y,
        speed: 0.2 + Math.random() * 0.3,
      })
    }
    scene.add(vesicleGroup)

    // Parallax mouse interaction
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

    // Parallax on scroll
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

      // Smooth lerp for parallax
      currentMouseX += (targetMouseX - currentMouseX) * 0.05
      currentMouseY += (targetMouseY - currentMouseY) * 0.05
      currentScrollY += (targetScrollY - currentScrollY) * 0.06

      // Rotate and float entire group with mouse & scroll parallax
      masterGroup.rotation.y = currentMouseX * 0.25
      masterGroup.rotation.x = -currentMouseY * 0.18
      masterGroup.position.x = currentMouseX * 0.4
      masterGroup.position.y = currentMouseY * 0.3 - currentScrollY * 0.002

      // Animate individual cells with organic breathing and floating
      cells.forEach((cell) => {
        const time = elapsedTime * cell.driftSpeed + cell.noiseOffset
        // Float oscillation
        cell.group.position.x = cell.origX + Math.sin(time * 0.8) * 0.18
        cell.group.position.y = cell.origY + Math.cos(time * 0.9) * 0.22
        cell.group.position.z = cell.origZ + Math.sin(time * 0.5) * 0.15

        // Gentle rotation
        cell.group.rotation.x += cell.rotSpeed
        cell.group.rotation.y += cell.rotSpeed * 1.3
        cell.group.rotation.z += cell.rotSpeed * 0.7

        // Pulsing / breathing scale effect
        const breath = 1 + Math.sin(time * 1.2) * 0.025
        cell.group.scale.set(breath, breath, breath)
      })

      // Animate background vesicles
      vesicles.forEach((v) => {
        v.mesh.position.y = v.origY + Math.sin(elapsedTime * v.speed) * 0.3
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
