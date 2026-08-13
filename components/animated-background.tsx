export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden opacity-30">
      <svg
        className="absolute w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="glowLine" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="var(--color-primary)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>

        {/* Dynamic network lines */}
        <g stroke="url(#glowLine)" strokeWidth="1" fill="none">
          {/* Diagonal 1 */}
          <path
            d="M -100 -100 L 2000 2000"
            style={{
              strokeDasharray: '400 1600',
              animation: 'drawLine 15s linear infinite',
            }}
          />
          {/* Horizontal 1 */}
          <path
            d="M -200 300 L 2000 300"
            style={{
              strokeDasharray: '300 1700',
              animation: 'drawLine 20s linear infinite 5s',
            }}
          />
          {/* Vertical 1 */}
          <path
            d="M 600 -200 L 600 1500"
            style={{
              strokeDasharray: '500 1500',
              animation: 'drawLine 18s linear infinite 2s',
            }}
          />
          {/* Diagonal 2 */}
          <path
            d="M 1500 -100 L -100 1500"
            style={{
              strokeDasharray: '350 1650',
              animation: 'drawLine 22s linear infinite 7s',
            }}
          />
          {/* Horizontal 2 */}
          <path
            d="M -200 800 L 2500 800"
            style={{
              strokeDasharray: '450 1550',
              animation: 'drawLine 25s linear infinite 12s',
            }}
          />
        </g>
      </svg>
    </div>
  )
}
