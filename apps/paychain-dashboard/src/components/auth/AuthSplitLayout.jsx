import React from 'react';

export default function AuthSplitLayout({ children, rightContent }) {
  return (
    <div className="min-h-screen flex">
      <div className="w-full md:w-3/5 flex items-center justify-center p-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
      <div className="hidden md:flex md:w-2/5 items-center justify-center p-8">
        <div className="w-full max-w-sm">{rightContent}</div>
      </div>
    </div>
  );
}
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
