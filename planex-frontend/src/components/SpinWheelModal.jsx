import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const FONT = '"Courier New", Courier, monospace'

const SEG_COLORS = [
  '#8A9E6E', '#4A6741', '#5B4A8C', '#2B6CB0',
  '#276749', '#744210', '#1A6B8B', '#B7550A',
  '#6B46C1', '#991B1B', '#2D6A4F', '#A16207',
]

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3) }

export default function SpinWheelModal({ tasks, onClose }) {
  const canvasRef = useRef(null)
  const animRef   = useRef(null)
  const rotRef    = useRef(0)
  const [spinning, setSpinning] = useState(false)
  const [winner,   setWinner]   = useState(null)
  const [hasSpun,  setHasSpun]  = useState(false)
  const navigate = useNavigate()

  const wheelTasks = tasks.slice(0, 20)
  const n = wheelTasks.length

  const draw = useCallback((rot) => {
    const canvas = canvasRef.current
    if (!canvas || n === 0) return
    const ctx = canvas.getContext('2d')
    const sz = canvas.width
    const cx = sz / 2, cy = sz / 2
    const r = cx - 8

    ctx.clearRect(0, 0, sz, sz)

    // Outer shadow ring
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = 16
    ctx.beginPath()
    ctx.arc(cx, cy, r + 4, 0, 2 * Math.PI)
    ctx.fillStyle = '#1a202c'
    ctx.fill()
    ctx.restore()

    const segAngle = (2 * Math.PI) / n
    const base = -Math.PI / 2 + (rot * Math.PI / 180)

    wheelTasks.forEach((task, i) => {
      const a0 = base + i * segAngle
      const a1 = a0 + segAngle

      // Segment
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, a0, a1)
      ctx.closePath()
      ctx.fillStyle = SEG_COLORS[i % SEG_COLORS.length]
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Label
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(a0 + segAngle / 2)
      ctx.textAlign = 'right'
      ctx.fillStyle = '#ffffff'
      ctx.font = `bold ${n <= 8 ? 12 : 10}px ${FONT}`
      ctx.shadowColor = 'rgba(0,0,0,0.7)'
      ctx.shadowBlur = 2
      const maxLen = n <= 8 ? 18 : 13
      const label = task.title.length > maxLen ? task.title.slice(0, maxLen) + '…' : task.title
      ctx.fillText(label, r - 10, 4)
      ctx.restore()
    })

    // Hub
    ctx.beginPath()
    ctx.arc(cx, cy, 22, 0, 2 * Math.PI)
    ctx.fillStyle = '#1a202c'
    ctx.fill()
    ctx.strokeStyle = '#8A9E6E'
    ctx.lineWidth = 3
    ctx.stroke()

    // Hub dot
    ctx.beginPath()
    ctx.arc(cx, cy, 6, 0, 2 * Math.PI)
    ctx.fillStyle = '#8A9E6E'
    ctx.fill()
  }, [wheelTasks, n])

  useEffect(() => { draw(0) }, [draw])
  useEffect(() => () => { if (animRef.current) cancelAnimationFrame(animRef.current) }, [])

  const spin = () => {
    if (spinning || n === 0) return
    setSpinning(true)
    setWinner(null)

    const startRot = rotRef.current
    const extraSpins = 5 + Math.floor(Math.random() * 3)
    const targetRot  = startRot + extraSpins * 360 + Math.random() * 360
    const dur = 4000 + Math.random() * 800
    const t0  = performance.now()

    const step = (now) => {
      const progress = Math.min((now - t0) / dur, 1)
      const cur = startRot + (targetRot - startRot) * easeOutCubic(progress)
      rotRef.current = cur
      draw(cur)

      if (progress < 1) {
        animRef.current = requestAnimationFrame(step)
      } else {
        const finalAngle = ((targetRot % 360) + 360) % 360
        const normalized = (360 - finalAngle) % 360
        const idx = Math.floor(normalized / (360 / n)) % n
        setWinner(wheelTasks[idx])
        setSpinning(false)
        setHasSpun(true)
      }
    }
    animRef.current = requestAnimationFrame(step)
  }

  const priorityColors = {
    High:   { bg: '#f8d7da', color: '#7c1d24' },
    Medium: { bg: '#fff3cd', color: '#664d03' },
    Low:    { bg: '#d1e7dd', color: '#0a3622' },
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget && !spinning) onClose() }}
    >
      <div style={{ background: '#2d3748', borderRadius: 18, padding: '28px 32px', maxWidth: 500, width: '100%', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', fontFamily: FONT }}>

        <h2 style={{ color: '#fff', margin: '0 0 4px', fontSize: 20, letterSpacing: 1 }}>
          Test Your Luck
        </h2>
        <p style={{ color: '#8A9E6E', margin: '0 0 20px', fontSize: 11 }}>
          Spin the wheel — let fate pick your next task
        </p>

        {n === 0 ? (
          <div style={{ padding: '40px 0' }}>
            <p style={{ color: '#718096', fontSize: 13, marginBottom: 20 }}>
              No active tasks to spin!
            </p>
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: '1px solid #4a5568', color: '#718096', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontFamily: FONT, fontSize: 12 }}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Wheel */}
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 4 }}>
              {/* Pointer */}
              <div style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '11px solid transparent', borderRight: '11px solid transparent', borderTop: '22px solid #F6C90E', zIndex: 10, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }} />
              <canvas
                ref={canvasRef}
                width={380}
                height={380}
                style={{ display: 'block', cursor: spinning ? 'default' : 'pointer', borderRadius: '50%' }}
                onClick={spin}
              />
            </div>

            <p style={{ color: '#718096', fontSize: 10, margin: '4px 0 14px' }}>
              {n} active task{n !== 1 ? 's' : ''} on the wheel
            </p>

            {/* Spin button */}
            <button
              onClick={spin}
              disabled={spinning}
              style={{ background: spinning ? '#4a5568' : '#8A9E6E', color: '#fff', border: 'none', borderRadius: 30, padding: '11px 44px', fontSize: 14, fontFamily: FONT, fontWeight: 'bold', cursor: spinning ? 'not-allowed' : 'pointer', transition: 'background 0.2s', letterSpacing: 1 }}
            >
              {spinning ? 'Spinning…' : hasSpun ? 'Spin Again' : 'SPIN'}
            </button>

            {/* Winner card */}
            {winner && !spinning && (
              <div style={{ marginTop: 18, padding: '14px 18px', background: '#3A4558', borderRadius: 10, border: '2px solid #8A9E6E', textAlign: 'left' }}>
                <p style={{ color: '#8A9E6E', fontSize: 10, margin: '0 0 5px', letterSpacing: 1, textTransform: 'uppercase' }}>
                  Your next task
                </p>
                <p style={{ color: '#fff', fontSize: 15, fontWeight: 'bold', margin: '0 0 8px', lineHeight: 1.4 }}>
                  {winner.title}
                </p>
                {winner.priority && (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, backgroundColor: (priorityColors[winner.priority] || priorityColors.Low).bg, color: (priorityColors[winner.priority] || priorityColors.Low).color, fontWeight: 'bold', display: 'inline-block', marginBottom: 10 }}>
                    {winner.priority} priority
                  </span>
                )}
                <div>
                  <button
                    onClick={() => { navigate(`/tasks/${winner.id}`); onClose() }}
                    style={{ background: '#4A6741', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 20px', fontSize: 12, fontFamily: FONT, fontWeight: 'bold', cursor: 'pointer', letterSpacing: 0.5 }}
                  >
                    Go to Task →
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => { if (!spinning) onClose() }}
              style={{ marginTop: 14, background: 'transparent', border: 'none', color: spinning ? 'transparent' : '#4a5568', fontFamily: FONT, cursor: spinning ? 'default' : 'pointer', fontSize: 11 }}
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  )
}
