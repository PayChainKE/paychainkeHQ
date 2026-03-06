import React, { useState, useEffect } from 'react';

interface LoadingScreenProps {
  isLoading: boolean;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ isLoading }) => {
  const [displayText, setDisplayText] = useState('');
  const fullText = 'Welcome to PaychainKE HQ....';

  useEffect(() => {
    if (!isLoading) return;

    let index = 0;
    const timer = setInterval(() => {
      if (index < fullText.length) {
        setDisplayText(fullText.slice(0, index + 1));
        index++;
      } else {
        clearInterval(timer);
      }
    }, 100); // 100ms delay between each letter

    return () => clearInterval(timer);
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <div className="flex flex-col items-center space-y-6">
        {/* Logo */}
        <div className="relative">
          <img
            src="/logo 1.png"
            alt="PayChain HQ Logo"
            className="w-32 h-32 md:w-40 md:h-40 object-contain"
          />
        </div>

        {/* Loading spinner */}
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-3 h-3 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-3 h-3 bg-primary rounded-full animate-bounce"></div>
        </div>

        {/* Loading text */}
        <p className="text-gray-600 text-sm font-medium">
          {displayText}
          <span className="animate-pulse">|</span>
        </p>
      </div>
    </div>
  );
};

export default LoadingScreen;