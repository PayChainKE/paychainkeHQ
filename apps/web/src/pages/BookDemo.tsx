import React, { useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const BookDemo: React.FC = () => {
  useEffect(() => {
    (function (C: any, A: any, L: any) {
      let p = function (a: any, ar: any) { a.q.push(ar); };
      let d = C.document;
      C.Cal = C.Cal || function () {
        let cal = C.Cal;
        let ar = arguments;
        if (!cal.loaded) {
          cal.ns = {};
          cal.q = cal.q || [];
          d.head.appendChild(d.createElement("script")).src = A;
          cal.loaded = true;
        }
        if (ar[0] === L) {
          const api = function () { p(api, arguments); };
          const namespace = ar[1];
          api.q = api.q || [];
          if (typeof namespace === "string") {
            cal.ns[namespace] = cal.ns[namespace] || api;
            p(cal.ns[namespace], ar);
            p(cal, ["initNamespace", namespace]);
          } else p(cal, ar);
          return;
        }
        p(cal, ar);
      };
    })(window, "https://app.cal.com/embed/embed.js", "init");

    const Cal = (window as any).Cal;
    Cal("init", "paychain-demo", { origin: "https://app.cal.com" });

    Cal.ns["paychain-demo"]("inline", {
      elementOrSelector: "#my-cal-inline-paychain-demo",
      config: { "layout": "month_view", "useSlotsViewOnSmallScreen": "true" },
      calLink: "paychain/paychain-demo",
    });

    Cal.ns["paychain-demo"]("ui", { "hideEventTypeDetails": false, "layout": "month_view", "theme": "dark" });
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      
      <main className="flex-grow flex flex-col items-center justify-center pt-32 pb-16 px-4 sm:px-6 lg:px-8 w-full relative">
        {/* Professional Background */}
        <div className="absolute inset-0 bg-[url('/hero-bg.png')] bg-cover bg-center bg-no-repeat z-0 opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#00351d]/95 via-[#00351d]/90 to-[#00351d] z-0" />
        
        <div className="w-full max-w-4xl text-center mb-12 relative z-10">
          <h1 className="text-4xl md:text-5xl font-extrabold text-[#FBF8F1] tracking-tight mb-4">
            Book a Demo
          </h1>
          <p className="text-lg md:text-xl text-emerald-100/80 max-w-2xl mx-auto">
            Schedule a personalized walkthrough of PayChain and discover how we can streamline your business operations.
          </p>
        </div>

        <div className="w-full max-w-5xl h-[700px] sm:h-[800px] bg-[#002514] rounded-2xl shadow-2xl overflow-hidden flex flex-col items-center p-2 sm:p-4 relative z-10 border border-emerald-900/50">
          <div style={{ width: '100%', height: '100%', overflow: 'scroll' }} id="my-cal-inline-paychain-demo"></div>
        </div>
      </main>

      <div className="relative z-10 bg-[#00351d]">
        <Footer />
      </div>
    </div>
  );
};

export default BookDemo;
