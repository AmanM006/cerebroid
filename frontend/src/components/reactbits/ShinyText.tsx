import React from "react"

interface ShinyTextProps {
  text: string
  disabled?: boolean
  speed?: number
  className?: string
}

export const ShinyText: React.FC<ShinyTextProps> = ({
  text,
  disabled = false,
  speed = 5,
  className = "",
}) => {
  const animationDuration = `${speed}s`

  return (
    <span
      className={`inline-block bg-clip-text text-transparent bg-gradient-to-r from-neutral-400 via-white to-neutral-400 bg-[200%_auto] ${
        disabled ? "" : "animate-shine"
      } ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(120deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.95) 50%, rgba(255, 255, 255, 0.4) 100%)",
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text",
        animationDuration,
      }}
    >
      {text}
    </span>
  )
}
