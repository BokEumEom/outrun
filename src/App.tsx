/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CoastlineGame } from './components/CoastlineGame';

export default function App() {
  return (
    <div className="min-h-screen bg-[#060f18] text-[#fff5df] flex flex-col justify-start items-center py-2 sm:py-6 px-2">
      <CoastlineGame />
    </div>
  );
}

