import { useEffect, useRef } from "react"
import * as THREE from "three"

export function FuturisticCellBrain() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const width = mount.clientWidth
    const height = mount.clientHeight

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    camera.position.z = 18

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    // Ambient & Point Lighting
    const ambientLight = new THREE.AmbientLight(0x0a192f, 2.5)
    scene.add(ambientLight)

    const blueLight = new THREE.PointLight(0x2563eb, 80, 50)
    blueLight.position.set(6, 6, 8)
    scene.add(blueLight)

    const cyanLight = new THREE.PointLight(0x38bdf8, 60, 40)
    cyanLight.position.set(-8, -4, 6)
    scene.add(cyanLight)

    const purpleBacklight = new THREE.PointLight(0x8b5cf6, 40, 30)
    purpleBacklight.position.set(0, 0, -8)
    scene.add(purpleBacklight)

    // Master container for floating objects
    const group = new THREE.Group()
    scene.add(group)

    // Create Organic Crystalline Cells (like the translucent glowing dark-blue polyhedra in Medvolve)
    const cellGeos = [
      new THREE.DodecahedronGeometry(2.8, 1),
      new THREE.IcosahedronGeometry(2.2, 1),
      new THREE.OctahedronGeometry(1.6, 2),
      new THREE.DodecahedronGeometry(1.4, 0),
      new THREE.IcosahedronGeometry(1.1, 0),
      new THREE.OctahedronGeometry(0.8, 1),
      new THREE.DodecahedronGeometry(0.6, 0),
    ]

    const cellMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#0f172a"),
      emissive: new THREE.Color("#1e3a8a"),
      emissiveIntensity: 0.35,
      roughness: 0.15,
      metalness: 0.1,
      transmission: 0.6, // Glass/translucent
      ior: 1.5,
      reflectivity: 0.9,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      wireframe: false,
    })

    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
    })

    // Spawn 2 clusters (Left primary brain cluster, Right secondary floaters like reference)
    const meshes: { mesh: THREE.Mesh; origPos: THREE.Vector3; speed: number; rotSpeed: THREE.Vector3 }[] = []

    // Cluster 1 (Left big organic lobe):
    const leftClusterCoords = [
      [-4.5, 0.5, 0],
      [-5.8, 2.2, -1],
      [-3.8, -2.0, 1.2],
      [-6.5, -0.8, -0.5],
      [-2.8, 1.6, 2.0],
      [-7.2, 1.0, 0.8],
    ]

    leftClusterCoords.forEach((coord, idx) => {
      const geo = cellGeos[idx % cellGeos.length]
      const mesh = new THREE.Mesh(geo, cellMaterial)
      mesh.position.set(coord[0]!, coord[1]!, coord[2]!)

      // Add edge glow
      const wireGeo = new THREE.WireframeGeometry(geo)
      const line = new THREE.LineSegments(wireGeo, edgeMaterial)
      mesh.add(line)

      group.add(mesh)
      meshes.push({
        mesh,
        origPos: new THREE.Vector3(coord[0]!, coord[1]!, coord[2]!),
        speed: 0.8 + Math.random() * 0.5,
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 0.008,
          (Math.random() - 0.5) * 0.008,
          (Math.random() - 0.5) * 0.008
        ),
      })
    })

    // Cluster 2 (Right floaters):
    const rightClusterCoords = [
      [5.2, -1.2, 1.5],
      [6.4, 1.8, -1],
      [4.2, 2.8, 0],
      [7.0, -0.2, 0.5],
      [3.5, -2.8, -0.8],
    ]

    rightClusterCoords.forEach((coord, idx) => {
      const geo = cellGeos[(idx + 2) % cellGeos.length]
      const mesh = new THREE.Mesh(geo, cellMaterial)
      mesh.position.set(coord[0]!, coord[1]!, coord[2]!)

      const wireGeo = new THREE.WireframeGeometry(geo)
      const line = new THREE.LineSegments(wireGeo, edgeMaterial)
      mesh.add(line)

      group.add(mesh)
      meshes.push({
        mesh,
        origPos: new THREE.Vector3(coord[0]!, coord[1]!, coord[2]!),
        speed: 0.9 + Math.random() * 0.4,
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 0.008,
          (Math.random() - 0.5) * 0.008,
          (Math.random() - 0.5) * 0.008
        ),
      })
    })

    // Micro floating neural dust particles in background
    const particleCount = 200
    const pGeo = new THREE.BufferGeometry()
    const pPos = new Float32Array(particleCount * 3)
    for (let k = 0; k < particleCount * 3; k += 3) {
      pPos[k] = (Math.random() - 0.5) * 30
      pPos[k + 1] = (Math.random() - 0.5) * 20
      pPos[k + 2] = (Math.random() - 0.5) * 15
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3))
    const pMat = new THREE.PointsMaterial({
      size: 0.08,
      color: 0x60a5fa,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
    })
    const dust = new THREE.Points(pGeo, pMat)
    scene.add(dust)

    // Interactive mouse parallax
    let mouseX = 0
    let mouseY = 0
    let targetX = 0
    let targetY = 0

    const handleMouseMove = (e: MouseEvent) => {
      const rect = mount.getBoundingClientRect()
      mouseX = ((e.clientX - rect.left) / width) * 2 - 1
      mouseY = -(((e.clientY - rect.top) / height) * 2 - 1)
    }

    window.addEventListener("mousemove", handleMouseMove)

    let reqId: number
    const clock = new THREE.Clock()

    const animate = () => {
      reqId = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()

      targetX += (mouseX * 0.8 - targetX) * 0.05
      targetY += (mouseY * 0.6 - targetY) * 0.05

      group.rotation.y = targetX * 0.4
      group.rotation.x = -targetY * 0.3

      // Organic gentle floating motion
      meshes.forEach(({ mesh, origPos, speed, rotSpeed }) => {
        mesh.position.y = origPos.y + Math.sin(t * speed + origPos.x) * 0.25
        mesh.position.x = origPos.x + Math.cos(t * speed * 0.8 + origPos.y) * 0.15
        mesh.rotation.x += rotSpeed.x
        mesh.rotation.y += rotSpeed.y
        mesh.rotation.z += rotSpeed.z
      })

      dust.rotation.y = t * 0.02

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
      cancelAnimationFrame(reqId)
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("mousemove", handleMouseMove)
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [])

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 pointer-events-none z-10 overflow-hidden"
    />
  )
}
