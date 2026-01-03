'use client';

import React from 'react';
import IFrameContext from '@/contexts/IFrameContext';
import SVG1 from '@/components/svg/SVG';
import SVG2 from '@/components/svg/SVG2';
import SVG3 from '@/components/svg/SVG3';

export default function SvgsPage() {
  return (
    <IFrameContext.Provider value={{ playing: true }}>
      <div className="min-h-screen bg-black text-white flex flex-col items-center py-8 px-4 gap-8">
        <h1 className="text-2xl font-semibold mb-2">SVG Animation Gallery</h1>
        <p className="text-sm text-gray-300 mb-4 text-center max-w-xl">
          These are the three SVG components rendered at a glance so you can quickly inspect their animations.
        </p>

        <div className="w-full max-w-5xl grid gap-8 md:grid-cols-2">
          {/* SVG 1 - uses IFrameContext.playing */}
          <div className="bg-zinc-900/70 rounded-2xl p-4 border border-zinc-800 flex flex-col items-center">
            <h2 className="text-lg font-medium mb-2">SVG 1 (Context-driven animation)</h2>
            <p className="text-xs text-gray-400 mb-3 text-center">
              `playing` is forced to <span className="font-mono text-emerald-300">true</span> so motion is always on.
            </p>
            <div className="w-full flex justify-center">
              <SVG1 />
            </div>
          </div>

          {/* SVG 2 */}
          <div className="bg-zinc-900/70 rounded-2xl p-4 border border-zinc-800 flex flex-col items-center">
            <h2 className="text-lg font-medium mb-2">SVG 2 (CSS animation)</h2>
            <p className="text-xs text-gray-400 mb-3 text-center">
              Renders at full width of the card so you can see line-drawing and motion details.
            </p>
            <div className="w-full flex justify-center">
              <div className="w-full max-w-3xl">
                <SVG2 />
              </div>
            </div>
          </div>

          {/* SVG 3 */}
          <div className="bg-zinc-900/70 rounded-2xl p-4 border border-zinc-800 flex flex-col items-center md:col-span-2">
            <h2 className="text-lg font-medium mb-2">SVG 3 (Full illustration)</h2>
            <p className="text-xs text-gray-400 mb-3 text-center">
              Centered and scaled for a full view of the character and decorative animations.
            </p>
            <div className="w-full flex justify-center">
              <div className="w-full max-w-3xl">
                <SVG3 />
              </div>
            </div>
          </div>
        </div>
      </div>
    </IFrameContext.Provider>
  );
}


