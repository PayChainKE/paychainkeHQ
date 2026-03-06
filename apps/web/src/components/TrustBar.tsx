import React from 'react';
import { CheckCircle2 } from 'lucide-react';

const logos = [
  { src: '/Home page/powered by logos/mpesa.png', alt: 'M-PESA', large: true },
  { src: '/Home page/powered by logos/safaricom.png', alt: 'Safaricom', large: true },
  { src: '/Home page/powered by logos/airtel money.png', alt: 'Airtel Money', large: false },
  { src: '/Home page/powered by logos/telkom.png', alt: 'Telkom', large: false },
];

// Triple for seamless marquee loop
const marqueeLogos = [...logos, ...logos, ...logos];

const TrustBar: React.FC = () => (
  <section className="py-14 bg-white border-y border-gray-100 overflow-hidden">
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 mb-8">
      <div className="flex items-center justify-center gap-2 text-center">
        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
        <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest">
          Powered by top infrastructure providers
        </p>
      </div>
    </div>

    {/* Marquee track */}
    <div
      className="relative"
      style={{ maskImage: 'linear-gradient(90deg, transparent, black 10%, black 90%, transparent)' }}
    >
      <div
        className="flex items-center gap-10 w-max"
        style={{ animation: 'marquee-scroll 24s linear infinite' }}
        onMouseEnter={e => (e.currentTarget.style.animationPlayState = 'paused')}
        onMouseLeave={e => (e.currentTarget.style.animationPlayState = 'running')}
      >
        {marqueeLogos.map((logo, i) => (
          <div key={i} className="flex-shrink-0 flex items-center justify-center px-4">
            <img
              src={logo.src}
              alt={logo.alt}
              className={`${logo.large ? 'h-24 sm:h-28' : 'h-16 sm:h-20'} w-auto object-contain transition-all duration-300`}
            />
          </div>
        ))}
      </div>
    </div>

    <style>{`
      @keyframes marquee-scroll {
        0%   { transform: translateX(0); }
        100% { transform: translateX(-33.333%); }
      }
    `}</style>
  </section>
);

export default TrustBar;
