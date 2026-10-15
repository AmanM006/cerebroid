import React, { useEffect, useRef } from "react"

export const CyberGridPerspective: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationFrameId: number
    let offset = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const w = canvas.width
      const h = canvas.height
      const horizonY = h * 0.58 // Horizon line positioned behind the dashboard

      // 1. Perspective grid lines receding to vanishing center
      const vanishingX = w * 0.5
      const vanishingY = horizonY

      ctx.save()

      // Gradient for neon purple grid lines
      const gridGradient = ctx.createLinearGradient(0, horizonY, 0, h)
      gridGradient.addColorStop(0, "rgba(168, 85, 247, 0.7)") // Intense purple at horizon
      gridGradient.addColorStop(0.3, "rgba(147, 51, 234, 0.4)")
      gridGradient.addColorStop(1, "rgba(88, 28, 135, 0.0)")

      ctx.strokeStyle = gridGradient
      ctx.lineWidth = 1

      // Radial receding lines
      const numLines = 36
      for (let i = -numLines; i <= numLines; i++) {
        const bottomX = vanishingX + i * (w / 18)
        ctx.beginPath()
        ctx.moveTo(vanishingX, vanishingY)
        ctx.lineTo(bottomX, h)
        ctx.stroke()
      }

      // Horizontal depth lines (moving toward camera)
      offset = (offset + 0.3) % 40
      for (let y = 0; y < h - horizonY; y += 40) {
        const adjustedY = horizonY + Math.pow((y + offset) / (h - horizonY), 2.2) * (h - horizonY)
        if (adjustedY < horizonY) continue

        const alpha = Math.min(1, Math.max(0, (adjustedY - horizonY) / 100)) * (1 - (adjustedY - horizonY) / (h - horizonY))
        ctx.strokeStyle = `rgba(168, 85, 247, ${alpha * 0.6})`
        ctx.beginPath()
        ctx.moveTo(0, adjustedY)
        ctx.lineTo(w, adjustedY)
        ctx.stroke()
      }

      // Ceiling subtle grid (Top inverted grid)
      const topVanishingY = horizonY * 0.2
      const topGradient = ctx.createLinearGradient(0, 0, 0, horizonY * 0.5)
      topGradient.addColorStop(0, "rgba(147, 51, 234, 0.2)")
      topGradient.addColorStop(1, "rgba(88, 28, 135, 0.0)")
      ctx.strokeStyle = topGradient
      for (let i = -numLines; i <= numLines; i++) {
        const topX = vanishingX + i * (w / 20)
        ctx.beginPath()
        ctx.moveTo(vanishingX, topVanishingY)
        ctx.lineTo(topX, 0)
        ctx.stroke()
      }

      ctx.restore()

      animationFrameId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
    />
  )
}
