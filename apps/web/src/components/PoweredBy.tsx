import React, { useEffect, useState } from 'react'

const DEFAULT_LOGOS = [
  '/icons/africas-talking.svg',
  '/icons/base-l2.svg',
  '/icons/rust.svg',
  '/icons/mern.svg',
]

export default function PoweredBy({ logos = DEFAULT_LOGOS }: { logos?: string[] }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % logos.length), 3000)
    return () => clearInterval(t)
  }, [logos.length])

  const prev = () => setIndex((i) => (i - 1 + logos.length) % logos.length)
  const next = () => setIndex((i) => (i + 1) % logos.length)

  return (
    <div className="w-full max-w-5xl mx-auto text-center">
      <h3 className="text-xl font-semibold text-[#0A192F]">Powered by top infrastructure providers</h3>

      <div className="mt-6 relative">
        <button
          onClick={prev}
          aria-label="Previous"
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-white border rounded-full p-2 shadow-sm"
        >
          ‹
        </button>

        <div className="h-24 sm:h-28 flex items-center justify-center overflow-hidden">
          {logos.map((src, i) => (
            <img
              key={src}
              src={src}
              alt={`Provider ${i + 1}`}
              className={`mx-6 h-16 sm:h-20 transition-opacity duration-700 ${i === index ? 'opacity-100' : 'opacity-0 absolute'}`}
            />
          ))}
        </div>

        <button
          onClick={next}
          aria-label="Next"
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-white border rounded-full p-2 shadow-sm"
        >
          ›
        </button>
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        {logos.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            aria-label={`Show provider ${i + 1}`}
            className={`w-2 h-2 rounded-full ${i === index ? 'bg-[#0A192F]' : 'bg-gray-200'}`}
          />
        ))}
      </div>
    </div>
  )
}
