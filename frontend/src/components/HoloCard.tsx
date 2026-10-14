import React, { useEffect, useRef } from "react";

const PERSPECTIVE = 1100;

interface SpringState {
  tiltX: number;
  tiltY: number;
  tiltVX: number;
  tiltVY: number;
  lift: number;
  liftV: number;
  lightX: number;
  lightY: number;
  clock: number;
}

const spring = (
  value: number,
  velocity: number,
  target: number,
  stiffness: number,
  damping: number,
  dt: number
): [number, number] => {
  const next = velocity + ((target - value) * stiffness - velocity * damping) * dt;
  return [value + next * dt, next];
};

interface HoloCardProps {
  imageSrc?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const HoloCard: React.FC<HoloCardProps> = ({
  imageSrc = "/assets/mri_sagittal.png",
  className = "",
  style = {},
}) => {
  const shellRef = useRef<HTMLDivElement>(null);
  const rotorRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number | null>(null);

  const pointerRef = useRef({ x: 0, y: 0, inside: false });
  const stateRef = useRef<SpringState>({
    tiltX: 0,
    tiltY: 0,
    tiltVX: 0,
    tiltVY: 0,
    lift: 1,
    liftV: 0,
    lightX: 50,
    lightY: 50,
    clock: 0,
  });

  useEffect(() => {
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const state = stateRef.current;
      const pointer = pointerRef.current;

      const targetTiltX = pointer.inside ? -pointer.y * 18 : 0;
      const targetTiltY = pointer.inside ? pointer.x * 20 : 0;
      const targetLift = pointer.inside ? 1.05 : 1.0;

      const stiffness = 85;
      const damping = 12;

      [state.tiltX, state.tiltVX] = spring(
        state.tiltX,
        state.tiltVX,
        targetTiltX,
        stiffness,
        damping,
        dt
      );
      [state.tiltY, state.tiltVY] = spring(
        state.tiltY,
        state.tiltVY,
        targetTiltY,
        stiffness,
        damping,
        dt
      );
      [state.lift, state.liftV] = spring(
        state.lift,
        state.liftV,
        targetLift,
        stiffness,
        damping,
        dt
      );

      const targetLightX = pointer.inside ? (pointer.x + 1) * 50 : 50;
      const targetLightY = pointer.inside ? (pointer.y + 1) * 50 : 50;
      state.lightX += (targetLightX - state.lightX) * 0.12;
      state.lightY += (targetLightY - state.lightY) * 0.12;

      if (rotorRef.current) {
        rotorRef.current.style.transform = `perspective(${PERSPECTIVE}px) scale(${state.lift}) rotateX(${state.tiltX}deg) rotateY(${state.tiltY}deg)`;
      }

      if (shadowRef.current) {
        shadowRef.current.style.transform = `translate(${-state.tiltY * 0.9}px, ${
          state.tiltX * 0.9 + 15
        }px) scale(${0.88 + (state.lift - 1) * 1.8})`;
        shadowRef.current.style.opacity = pointer.inside ? "0.85" : "0.5";
      }

      if (glareRef.current) {
        glareRef.current.style.background = `radial-gradient(circle at ${state.lightX}% ${state.lightY}%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.03) 40%, transparent 70%)`;
        glareRef.current.style.opacity = pointer.inside ? "1" : "0.4";
      }

      rafId.current = requestAnimationFrame(tick);
    };

    rafId.current = requestAnimationFrame(tick);

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  const track = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = shellRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    pointerRef.current = {
      x: Math.max(-1, Math.min(1, nx)),
      y: Math.max(-1, Math.min(1, ny)),
      inside: true,
    };
  };

  const leave = () => {
    pointerRef.current.inside = false;
  };

  return (
    <div
      ref={shellRef}
      onPointerMove={track}
      onPointerEnter={track}
      onPointerLeave={leave}
      className={`relative select-none ${className}`}
      style={{
        perspective: `${PERSPECTIVE}px`,
        ...style,
      }}
    >
      {/* Dynamic 3D Parallax Drop Shadow */}
      <div
        ref={shadowRef}
        className="pointer-events-none absolute inset-4 rounded-[28px] bg-black/80 blur-2xl transition-opacity duration-300"
        style={{ transformOrigin: "center center" }}
      />

      {/* Physics Rotor Card Element */}
      <div
        ref={rotorRef}
        className="relative flex flex-col overflow-hidden rounded-[22px] border border-slate-700/80 bg-gradient-to-b from-[#181624] via-[#0f0e18] to-[#07060c] p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.95)] cursor-pointer will-change-transform"
        style={{
          transformStyle: "preserve-3d",
          transformOrigin: "center center",
        }}
      >
        {/* Specular Radial Light Reflection Layer */}
        <div
          ref={glareRef}
          className="pointer-events-none absolute inset-0 z-30 rounded-[22px] transition-opacity duration-300"
        />

        {/* Top Clinical Spec Bar */}
        <div
          style={{ transform: "translateZ(24px)" }}
          className="flex items-center justify-between px-2.5 py-1.5 text-[9.5px] font-mono text-slate-400 border-b border-slate-800/80"
        >
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            <span className="text-slate-200 font-semibold tracking-wider">T1 SE SAGITTAL</span>
          </div>
          <span className="text-slate-500 font-medium">256 × 192</span>
        </div>

        {/* 3D Raised Sagittal MRI Scan Frame */}
        <div
          style={{ transform: "translateZ(42px)" }}
          className="relative mt-2 overflow-hidden rounded-xl bg-black border border-slate-800/90 p-1.5 shadow-xl"
        >
          <img
            src={imageSrc}
            alt="Sagittal MRI Brain Scan"
            className="h-auto max-h-[56vh] w-full rounded-lg object-contain contrast-[1.1] filter pointer-events-none"
          />
          {/* Subtle Inset Vignette */}
          <div className="pointer-events-none absolute inset-0 rounded-xl shadow-[inset_0_0_20px_rgba(0,0,0,0.7)]" />
        </div>

        {/* Bottom Acquisition Metric Bar */}
        <div
          style={{ transform: "translateZ(24px)" }}
          className="mt-2.5 flex items-center justify-between px-2.5 py-1 text-[10px] font-mono text-slate-400"
        >
          <span className="text-slate-400 font-medium">TR: 465.0 · TE: 17.0</span>
          <span className="text-cyan-400 font-semibold tracking-wide">DFOV: 23.0cm</span>
        </div>
      </div>
    </div>
  );
};
