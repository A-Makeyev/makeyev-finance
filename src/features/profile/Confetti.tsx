'use client'

import { useEffect } from 'react'
import confetti from 'canvas-confetti'

/**
 * The celebratory burst shown once right after an email address is verified
 * (the profile page is opened with `?verified=1`, see the profile pages).
 *
 * Library rather than hand-rolled: the piece is genuinely a canvas particle
 * effect, and `canvas-confetti` gives the custom SVG shapes (triangle, square,
 * coin, tree) and the out-from-the-centre burst that the previous CSS pieces
 * could only approximate (user-requested, with their own snippet). It is a
 * small, dependency-free library, and it is the only reason this component
 * ships a canvas.
 *
 * Everything is fired from the viewport centre with spread 360 and no gravity,
 * so it reads as an explosion outward rather than confetti falling from the
 * top, in three quick waves (0/100/200ms) sized exactly as the snippet had it.
 *
 * Decorative by construction: it renders nothing, the canvas the library
 * creates is pointer-events none, and under reduced motion nothing is fired at
 * all (`disableForReducedMotion` covers the same preference inside the library,
 * this returns before doing any work).
 */
const SHAPES = [
  // A triangle pointing up, a square, a coin (a filled circle) and a tree.
  { path: 'M0 10 L5 0 L10 10z' },
  { path: 'M0 0 L10 0 L10 10 L0 10 Z' },
  { path: 'M5 0 A5 5 0 1 0 5 10 A5 5 0 1 0 5 0 Z' },
  { path: 'M5 0 L10 10 L0 10 Z' },
] as const

export function Confetti() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const scalar = 2
    const shapes = SHAPES.map((shape) => confetti.shapeFromPath(shape.path))
    const defaults = {
      spread: 360,
      ticks: 60,
      gravity: 0,
      decay: 0.96,
      startVelocity: 20,
      shapes,
      scalar,
      // Below the fixed chrome, the band the old CSS confetti used: this is
      // decoration behind the page furniture, never over it.
      zIndex: 60,
      disableForReducedMotion: true,
    }

    const shoot = () => {
      void confetti({ ...defaults, particleCount: 30 })
      void confetti({ ...defaults, particleCount: 5 })
      void confetti({ ...defaults, particleCount: 15, scalar: scalar / 2, shapes: ['circle'] })
    }

    // Three waves just after paint, exactly as the snippet fires them.
    const timers = [0, 100, 200].map((delay) => window.setTimeout(shoot, delay))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [])

  return null
}
