import React from 'react';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
// TrustBar removed from homepage — moved to About page
import Features from '@/components/Features';
import ComparisonTable from '@/components/ComparisonTable';
import MobileAppCTA from '@/components/MobileAppCTA';
import TechnicalSpecs from '@/components/TechnicalSpecs';
import Footer from '@/components/Footer';

const Index: React.FC = () => {
  return (
    <div className="min-h-screen bg-background pt-16">
      <Navbar />
      <Hero />
      <Features />
      <ComparisonTable />
      <MobileAppCTA />
      <TechnicalSpecs />
      <Footer />
    </div>
  );
};

export default Index;
