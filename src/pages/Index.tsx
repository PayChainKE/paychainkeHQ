import React from 'react';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import Features from '@/components/Features';
import ProblemSolution from '@/components/ProblemSolution';
import TechnicalSpecs from '@/components/TechnicalSpecs';
import Footer from '@/components/Footer';

const Index: React.FC = () => {
  console.log('Index page rendering');
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      
      {/* Section Separator */}
      <div className="h-0.5 bg-white/20 mx-auto max-w-6xl"></div>
      
      <Features />
      
      {/* Section Separator */}
      <div className="h-0.5 bg-white/20 mx-auto max-w-6xl"></div>
      
      <ProblemSolution />
      
      {/* Section Separator */}
      <div className="h-0.5 bg-white/20 mx-auto max-w-6xl"></div>
      
      <TechnicalSpecs />
      
      {/* Section Separator */}
      <div className="h-0.5 bg-white/20 mx-auto max-w-6xl"></div>
      
      <Footer />
    </div>
  );
};

export default Index;
