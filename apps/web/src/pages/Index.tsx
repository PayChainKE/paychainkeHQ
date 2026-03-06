import React from 'react';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import TrustBar from '@/components/TrustBar';
import Features from '@/components/Features';
import ComparisonTable from '@/components/ComparisonTable';
import ProblemSolution from '@/components/ProblemSolution';
import TechnicalSpecs from '@/components/TechnicalSpecs';
import Footer from '@/components/Footer';

const Index: React.FC = () => {
  return (
    <div className="min-h-screen bg-background pt-16">
      <Navbar />
      <Hero />
      <TrustBar />
      <Features />
      <ComparisonTable />
      <ProblemSolution />
      <TechnicalSpecs />
      <Footer />
    </div>
  );
};

export default Index;
