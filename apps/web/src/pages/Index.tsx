import React from 'react';
import Seo from '@/components/Seo';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import VideoSection from '@/components/VideoSection';
// TrustBar removed from homepage — moved to About page
import Features from '@/components/Features';
import ComparisonTable from '@/components/ComparisonTable';
import MobileAppCTA from '@/components/MobileAppCTA';
import TechnicalSpecs from '@/components/TechnicalSpecs';
import Footer from '@/components/Footer';

const Index: React.FC = () => {
  return (
    <div className="min-h-screen bg-background pt-16">
      <Seo
        title="PayChain | Paybill, Bulk Pay & Cash Advance for Kenyan Merchants"
        description="PayChain is a Kenyan fintech platform giving merchants a dedicated, NCBA Bank-backed Paybill, bulk payroll and supplier payouts, and cash advances based on your own sales — no hardware, no hidden fees."
        path="/"
      />
      <Navbar />
      <Hero />
      <VideoSection />
      <Features />
      <ComparisonTable />
      <MobileAppCTA />
      <TechnicalSpecs />
      <Footer />
    </div>
  );
};

export default Index;
