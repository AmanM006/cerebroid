import React, { useEffect, useState, useRef } from "react"

interface DecryptedTextProps {
  text: string
  speed?: number
  maxIterations?: number
  sequential?: boolean
  revealDirection?: "start" | "end" | "center"
  useOriginalCharsOnly?: boolean
  characters?: string
  className?: string
  encryptedClassName?: string
  parentClassName?: string
  animateOn?: "hover" | "view" | "load"
}

export const DecryptedText: React.FC<DecryptedTextProps> = ({
  text,
  speed = 40,
  maxIterations = 10,
  sequential = true,
  revealDirection = "start",
  characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+0123456789",
  className = "",
  encryptedClassName = "text-cyan-400 font-mono",
  parentClassName = "",
  animateOn = "load",
}) => {
  const [displayText, setDisplayText] = useState(text)
  const [isHovering, setIsHovering] = useState(false)
  const [isScrambling, setIsScrambling] = useState(false)
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set())
  const hasAnimated = useRef(false)
  const containerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let interval: any
    let currentIteration = 0

    const getNextIndex = (revealedSet: Set<number>) => {
      const textLength = text.length
      switch (revealDirection) {
        case "start":
          return revealedSet.size
        case "end":
          return textLength - 1 - revealedSet.size
        case "center": {
          const middle = Math.floor(textLength / 2)
          const offset = Math.floor(revealedSet.size / 2)
          const nextIndex =
            revealedSet.size % 2 === 0 ? middle + offset : middle - offset - 1
          if (nextIndex >= 0 && nextIndex < textLength && !revealedSet.has(nextIndex)) {
            return nextIndex
          }
          for (let i = 0; i < textLength; i++) {
            if (!revealedSet.has(i)) return i
          }
          return 0
        }
        default:
          return revealedSet.size
      }
    }

    const availableChars = characters.split("")

    const shuffleText = (originalText: string, currentRevealed: Set<number>) => {
      return originalText
        .split("")
        .map((char, i) => {
          if (char === " ") return " "
          if (currentRevealed.has(i)) return originalText[i]
          return availableChars[Math.floor(Math.random() * availableChars.length)]
        })
        .join("")
    }

    if (isHovering || (animateOn === "load" && !hasAnimated.current)) {
      setIsScrambling(true)
      interval = setInterval(() => {
        setRevealedIndices((prevRevealed) => {
          if (sequential) {
            if (prevRevealed.size < text.length) {
              const nextIndex = getNextIndex(prevRevealed)
              const newRevealed = new Set(prevRevealed)
              newRevealed.add(nextIndex)
              setDisplayText(shuffleText(text, newRevealed))
              return newRevealed
            } else {
              clearInterval(interval)
              setIsScrambling(false)
              hasAnimated.current = true
              return prevRevealed
            }
          } else {
            setDisplayText(shuffleText(text, prevRevealed))
            currentIteration++
            if (currentIteration >= maxIterations) {
              clearInterval(interval)
              setIsScrambling(false)
              setDisplayText(text)
              hasAnimated.current = true
            }
            return prevRevealed
          }
        })
      }, speed)
    } else {
      setDisplayText(text)
      setRevealedIndices(new Set())
    }

    return () => clearInterval(interval)
  }, [isHovering, text, speed, maxIterations, sequential, revealDirection, characters, animateOn])

  return (
    <span
      ref={containerRef}
      className={`inline-block whitespace-pre-wrap ${parentClassName}`}
      onMouseEnter={() => animateOn === "hover" && setIsHovering(true)}
      onMouseLeave={() => animateOn === "hover" && setIsHovering(false)}
    >
      <span className="sr-only">{displayText}</span>
      <span aria-hidden="true">
        {displayText.split("").map((char, index) => {
          const isRevealedOrDone =
            revealedIndices.has(index) || !isScrambling || !sequential

          return (
            <span
              key={index}
              className={isRevealedOrDone ? className : encryptedClassName}
            >
              {char}
            </span>
          )
        })}
      </span>
    </span>
  )
}
