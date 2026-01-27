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
      
      <Features />
      
      <ProblemSolution />
      
      <TechnicalSpecs />
      
      <Footer />
    </div>
  );
};

export default Index;
