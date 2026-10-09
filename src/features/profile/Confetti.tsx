'use client'

import { useEffect, useState, type CSSProperties } from 'react'

/**
 * A short celebratory burst for the profile page, shown once right after an
 * email address is verified (the verification link lands here with
 * `?verified=1`, see the profile pages).
 *
 * Hand-rolled rather than a confetti dependency: it is a few dozen absolutely
 * positioned pieces and one keyframe, and AGENTS.md treats a new dependency as
 * a decision rather than a default.
 *
 * Decorative by construction: aria-hidden, pointer-events none (.confetti-
 * layer), and the pieces are generated only after mount, so the server render
 * (which is empty) can never disagree with the client. Under reduced motion
 * nothing is generated at all and the component simply stays empty.
 *
 * "Short" is deliberate: every piece finishes within ~2.4s and the whole layer
 * is removed at BURST_MS, so it never becomes a layer the user has to wait out.
 * It was sized up, lengthened by a second and given three shapes and two waves
 * over its first version, then enlarged again with the extra shapes and a sway
 * (user-requested): at the original size and flat straight fall it read as a
 * flicker rather than a celebration.
 */
const PIECE_COUNT = 90
const BURST_MS = 3200

/** Brand accents plus celebration hues; readable on both theme surfaces. */
const COLORS = [
  '#0f5c4b',
  '#2fa37c',
  '#f2c14e',
  '#e06c75',
  '#5b8def',
  '#c084fc',
  '#ff9f45',
  '#38bdf8',
]

type Shape = 'square' | 'circle' | 'ribbon'

interface Piece {
  left: number
  drift: number
  sway: number
  spin: number
  delay: number
  duration: number
  width: number
  height: number
  color: string
  shape: Shape
  radius: string
}

/** Pure-ish: the randomness is fine because it only ever runs in the browser. */
function makePieces(): Piece[] {
  return Array.from({ length: PIECE_COUNT }, (_, index) => {
    // Launch points spread across the top edge, pulled toward the middle so
    // the burst reads as coming from the card rather than a flat curtain.
    const spread = (index / (PIECE_COUNT - 1)) * 100
    const size = 8 + Math.round(Math.random() * 10)
    const shape: Shape = index % 5 === 0 ? 'ribbon' : index % 3 === 0 ? 'circle' : 'square'
    // Two waves, half a second apart, so the burst reads as a shower rather
    // than a single curtain. Every piece (delay + duration) still lands inside
    // BURST_MS, so the layer is never cut mid-fall.
    const wave = index % 2 === 0 ? 0 : 450
    const width = shape === 'ribbon' ? 5 + Math.round(Math.random() * 3) : size
    const height =
      shape === 'ribbon'
        ? size + 9
        : shape === 'circle'
          ? // Equal sides, so border-radius turns it into a real circle.
            size
          : size + Math.round(Math.random() * 4)
    return {
      left: 50 + (spread - 50) * 0.92,
      drift: Math.round((spread - 50) * 3),
      // A sideways push at the midpoint (see the 50% keyframe): without it every
      // piece falls on a straight line and the whole thing looks mechanical.
      sway: Math.round((Math.random() - 0.5) * 130),
      spin: 360 + Math.round(Math.random() * 720),
      delay: wave + Math.round(Math.random() * 250),
      duration: 1500 + Math.round(Math.random() * 900),
      width,
      height,
      color: COLORS[index % COLORS.length],
      shape,
      radius: shape === 'circle' ? '9999px' : shape === 'ribbon' ? '9999px' : '2px',
    }
  })
}

export function Confetti() {
  const [pieces, setPieces] = useState<Piece[] | null>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setPieces(makePieces())
    const timer = window.setTimeout(() => setPieces(null), BURST_MS)
    return () => window.clearTimeout(timer)
  }, [])

  if (!pieces) return null

  return (
    <div className="confetti-layer" aria-hidden="true" data-testid="profile-confetti">
      {pieces.map((piece, index) => (
        <span
          key={index}
          className="confetti-piece"
          data-shape={piece.shape}
          style={
            {
              left: `${piece.left}%`,
              width: `${piece.width}px`,
              height: `${piece.height}px`,
              backgroundColor: piece.color,
              borderRadius: piece.radius,
              animationDelay: `${piece.delay}ms`,
              animationDuration: `${piece.duration}ms`,
              '--confetti-drift': `${piece.drift}px`,
              '--confetti-sway': `${piece.sway}px`,
              '--confetti-spin': `${piece.spin}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
