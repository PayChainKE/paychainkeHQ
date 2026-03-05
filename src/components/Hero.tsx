import React from 'react';

const Hero: React.FC = () => (
  <>
    <section
      className="relative w-full overflow-hidden flex items-end pb-8 sm:pb-12"
      style={{
        backgroundImage: 'url("/Home page/paychain hero section.png")',
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        height: 'clamp(260px, 50vw, 620px)',
      }}
    >
      {/* CTA Buttons — centered on mobile, offset on desktop */}
      <div className="absolute bottom-6 left-[calc(50%-38px)] -translate-x-1/2 sm:top-[calc(50%+152px)] sm:bottom-auto sm:left-[calc(50%-490px)] sm:-translate-x-1/2 sm:-translate-y-1/2 flex flex-row gap-3">
        <a
          href="/how-it-works"
          className="inline-flex items-center justify-center px-8 py-3 rounded-lg bg-black text-white font-semibold text-base hover:bg-gray-800 transition-colors cursor-pointer"
        >
          <span className="inline-block animate-bounce mr-1">👆</span> Join the Waitlist
        </a>
      </div>
    </section>

    {/* Trusted by badge — sits directly below the hero image */}
    <div className="flex items-center gap-3 px-6 py-4 sm:px-10">
      {/* Overlapping avatar stack */}
      <div className="flex -space-x-3">
        {['/Home page/merchant 1.png', '/Home page/merchant 2.png', '/Home page/merchant 3.png'].map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`Merchant ${i + 1}`}
            className="w-8 h-8 rounded-full border-2 border-white object-cover"
          />
        ))}
      </div>
      {/* Stars above text */}
      <div className="flex flex-col gap-0.5">
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <svg key={i} className="w-4 h-4 text-yellow-500 fill-yellow-500" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.286 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.286-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69L9.049 2.927z" />
            </svg>
          ))}
        </div>
        <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
          Trusted by <span className="font-bold text-black">10,000+</span> merchants &amp; enterprises
        </span>
      </div>
    </div>
  </>
);

export default Hero;
