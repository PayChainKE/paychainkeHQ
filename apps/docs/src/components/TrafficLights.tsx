import React from "react";

// Purely decorative — the familiar macOS terminal-window dots, signalling
// "this is a shell/code window" at a glance before anyone reads a line of it.
export default function TrafficLights() {
  return (
    <div className="flex items-center gap-1.5 shrink-0" aria-hidden="true">
      <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
      <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
      <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
    </div>
  );
}
