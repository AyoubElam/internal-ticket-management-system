'use client'

export default function LoginBackgroundLines() {
  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden pointer-events-none select-none z-0">
      {/* Soft Ambient Full-Screen Backlights */}
      <div
        className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full animate-pulse-glow"
        style={{
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, rgba(99, 102, 241, 0.04) 50%, transparent 75%)',
          filter: 'blur(70px)',
        }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[700px] h-[700px] rounded-full animate-pulse-glow"
        style={{
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.09) 0%, rgba(59, 130, 246, 0.03) 50%, transparent 75%)',
          filter: 'blur(70px)',
          animationDelay: '4s',
        }}
      />

      {/* Full Viewport Vector Waves (100vw x 100vh) */}
      <svg
        className="w-full h-full absolute inset-0"
        viewBox="0 0 1920 1080"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="fullWaveGrad1" x1="0" y1="200" x2="1920" y2="880" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.75" />
            <stop offset="35%" stopColor="#3b82f6" stopOpacity="0.85" />
            <stop offset="70%" stopColor="#6366f1" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.65" />
          </linearGradient>

          <linearGradient id="fullWaveGrad2" x1="1920" y1="100" x2="0" y2="980" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.7" />
            <stop offset="40%" stopColor="#38bdf8" stopOpacity="0.8" />
            <stop offset="75%" stopColor="#3b82f6" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0.6" />
          </linearGradient>

          <filter id="fullGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* --- Fullscreen Wave 1 (Top Left to Bottom Right) --- */}
        <g className="animate-wave-flow" style={{ transformOrigin: '960px 540px' }}>
          <path
            d="M -100 250
               C 350 40, 750 680, 1200 280
               C 1500 40, 1750 650, 2020 380"
            stroke="url(#fullWaveGrad1)"
            strokeWidth="3"
            strokeLinecap="round"
            filter="url(#fullGlow)"
          />
          <path
            d="M -100 275
               C 350 65, 750 705, 1200 305
               C 1500 65, 1750 675, 2020 405"
            stroke="url(#fullWaveGrad1)"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.35"
          />
        </g>

        {/* --- Fullscreen Wave 2 (Bottom Left to Top Right) --- */}
        <g className="animate-wave-flow-reverse" style={{ transformOrigin: '960px 540px' }}>
          <path
            d="M -100 800
               C 300 1000, 700 380, 1150 820
               C 1450 1080, 1720 420, 2020 700"
            stroke="url(#fullWaveGrad2)"
            strokeWidth="2.5"
            strokeLinecap="round"
            filter="url(#fullGlow)"
          />
          <path
            d="M -100 825
               C 300 1025, 700 405, 1150 845
               C 1450 1105, 1720 445, 2020 725"
            stroke="url(#fullWaveGrad2)"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.3"
          />
        </g>

        {/* --- Fullscreen Wave 3 (Center Connecting Ribbon) --- */}
        <g className="animate-float-slow" style={{ transformOrigin: '960px 540px' }}>
          <path
            d="M -50 520
               C 450 780, 1450 300, 1970 560"
            stroke="url(#fullWaveGrad1)"
            strokeWidth="1.5"
            strokeDasharray="12 10"
            opacity="0.4"
          />
        </g>
      </svg>
    </div>
  )
}
