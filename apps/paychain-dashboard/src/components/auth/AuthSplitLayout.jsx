import React from 'react';

export default function AuthSplitLayout({ leftChildren, rightContent }) {
  return (
    <div className="min-h-screen flex bg-[#0A1628] text-white">
      <div className="w-3/5 hidden md:flex items-center justify-center p-8">
        <div className="w-full max-w-md">{leftChildren}</div>
      </div>
      <div className="flex-1 md:w-2/5 p-6 flex items-center justify-center">
        <div className="w-full max-w-md">{rightContent}</div>
      </div>
    </div>
  );
}
