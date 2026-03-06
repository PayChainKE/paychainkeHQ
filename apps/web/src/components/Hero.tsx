import React from 'react';

const Hero: React.FC = () => (
  <section className="w-full bg-white overflow-hidden relative">
    <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 flex flex-col lg:flex-row items-center gap-10 lg:gap-0 py-12 sm:py-16 lg:py-20">

      {/* Left — text content */}
      <div className="w-full lg:w-1/2 flex flex-col items-start lg:-ml-12">
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-black leading-tight">
          Simple tools for<br />a <span style={{ color: '#00bf63' }}>secure</span> business.
        </h1>
        <p className="mt-4 text-sm sm:text-base lg:text-lg text-gray-600 leading-relaxed max-w-lg">
          <strong>Paychain</strong> makes it simple for your business to accept secure payments while providing inflation protection, bulk payouts, and automated business tools.
        </p>

        {/* CTA Button — desktop only */}
        <div className="hidden lg:block mt-6">
          <a
            href="/how-it-works"
            className="inline-flex items-center justify-center px-6 py-3 text-sm sm:text-base rounded-lg bg-black text-white font-semibold hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <span className="inline-block animate-bounce mr-1">👆</span> Join the Waitlist
          </a>
        </div>

        {/* Trusted by badge — desktop only (shown below button) */}
        <div className="hidden lg:flex items-center gap-3 mt-6">
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
      </div>

      {/* Right — design image (mobile: in flow, desktop: absolute right edge) */}
      <div className="w-full flex items-center justify-center lg:absolute lg:right-0 lg:top-0 lg:h-full lg:w-1/2 lg:justify-end">
        <img
          src="/Home page/design 1.png"
          alt="Paychain app design"
          className="w-full max-w-sm sm:max-w-md md:max-w-lg lg:h-full lg:w-auto lg:max-w-none h-auto object-contain"
        />
      </div>

      {/* CTA Button — mobile only (shown after image, before badge) */}
      <div className="flex lg:hidden w-full">
        <a
          href="/how-it-works"
          className="inline-flex items-center justify-center px-6 py-3 text-sm rounded-lg bg-black text-white font-semibold hover:bg-gray-800 transition-colors cursor-pointer"
        >
          <span className="inline-block animate-bounce mr-1">👆</span> Join the Waitlist
        </a>
      </div>

      {/* Trusted by badge — mobile only (shown after image) */}
      <div className="flex lg:hidden items-center gap-3 w-full">
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

    </div>
  </section>
);

export default Hero;
