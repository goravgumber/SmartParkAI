import { useEffect, useRef, useState } from 'react'

export default function useCountUp(target, duration = 1500) {
  const [currentValue, setCurrentValue] = useState(0)
  const startRef = useRef(null)
  const fromRef = useRef(0)

  useEffect(() => {
    let frame
    startRef.current = null
    fromRef.current = currentValue
    const to = Number(target) || 0

    function step(timestamp) {
      if (!startRef.current) startRef.current = timestamp
      const elapsed = timestamp - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - (1 - progress) * (1 - progress)
      const next = fromRef.current + (to - fromRef.current) * eased
      setCurrentValue(next)

      if (progress < 1) {
        frame = requestAnimationFrame(step)
      }
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return currentValue
}
