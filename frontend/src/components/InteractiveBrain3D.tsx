import { useEffect, useRef } from "react"
import * as THREE from "three"

export function InteractiveBrain3D() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const width = mount.clientWidth
    const height = mount.clientHeight

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    camera.position.z = 24

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    // Construct an anatomical brain particle point cloud with hemispheres & sulci curves
    const particleCount = 2800
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)
    const sizes = new Float32Array(particleCount)

    const colorPrimary = new THREE.Color("#6366f1") // Indigo
    const colorAccent = new THREE.Color("#a855f7")  // Purple
    const colorCyan = new THREE.Color("#38bdf8")    // Bright cyan/sky

    let i = 0
    while (i < particleCount) {
      // Hemisphere sign
      const sign = Math.random() > 0.5 ? 1 : -1
      
      // Ellipsoidal brain volume with cortical folds
      const u = Math.random()
      const v = Math.random()
      const theta = u * 2.0 * Math.PI
      const phi = Math.acos(2.0 * v - 1.0)
      const r = 5.2 * Math.cbrt(Math.random())

      let x = r * Math.sin(phi) * Math.cos(theta) * 0.95
      let y = r * Math.sin(phi) * Math.sin(theta) * 0.82
      let z = r * Math.cos(phi) * 1.25

      // Separate into Left and Right cerebral hemispheres
      x += sign * 0.85

      // Add sulcal fold frequency modulation
      const sulcus = Math.sin(x * 2.2) * Math.cos(y * 2.5) * Math.sin(z * 1.8) * 0.45
      x += sulcus
      y += sulcus
      z += sulcus

      // Cull particles that fall into deep interhemispheric fissure
      if (Math.abs(x) < 0.45 && Math.abs(z) < 4.0) continue

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z

      // Subtle gradient mixing
      const lerpFactor = (y + 4.5) / 9.0
      const c = colorPrimary.clone().lerp(colorAccent, lerpFactor)
      if (Math.random() > 0.85) c.lerp(colorCyan, 0.7)

      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b

      sizes[i] = Math.random() * 2.5 + 1.2
      i++
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1))

    // Shader-like glowing points material
    const material = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    })

    const brainPoints = new THREE.Points(geometry, material)
    scene.add(brainPoints)

    // Inner glowing core
    const coreGeo = new THREE.IcosahedronGeometry(2.4, 2)
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x4f46e5,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
    })
    const coreMesh = new THREE.Mesh(coreGeo, coreMat)
    scene.add(coreMesh)

    // Subtle orbital ring
    const ringGeo = new THREE.RingGeometry(6.8, 7.0, 64)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x818cf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25,
    })
    const ringMesh = new THREE.Mesh(ringGeo, ringMat)
    ringMesh.rotation.x = Math.PI / 2.3
    scene.add(ringMesh)

    // Interaction handling
    let mouseX = 0
    let mouseY = 0
    let targetX = 0
    let targetY = 0

    const handleMouseMove = (event: MouseEvent) => {
      const rect = mount.getBoundingClientRect()
      mouseX = ((event.clientX - rect.left) / width) * 2 - 1
      mouseY = -(((event.clientY - rect.top) / height) * 2 - 1)
    }

    mount.addEventListener("mousemove", handleMouseMove)

    let reqId: number
    const clock = new THREE.Clock()

    const animate = () => {
      reqId = requestAnimationFrame(animate)
      const elapsedTime = clock.getElapsedTime()

      // Smooth camera / rotation inertia
      targetX += (mouseX * 0.45 - targetX) * 0.05
      targetY += (mouseY * 0.35 - targetY) * 0.05

      brainPoints.rotation.y = elapsedTime * 0.12 + targetX
      brainPoints.rotation.x = Math.sin(elapsedTime * 0.2) * 0.08 + targetY
      coreMesh.rotation.y = -elapsedTime * 0.18
      ringMesh.rotation.z = elapsedTime * 0.05

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
      mount.removeEventListener("mousemove", handleMouseMove)
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
      geometry.dispose()
      material.dispose()
      coreGeo.dispose()
      coreMat.dispose()
      ringGeo.dispose()
      ringMat.dispose()
      renderer.dispose()
    }
  }, [])

  return (
    <div
      ref={mountRef}
      className="relative flex h-full w-full items-center justify-center cursor-grab active:cursor-grabbing"
    />
  )
}
