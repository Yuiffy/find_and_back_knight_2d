import { chromium } from 'playwright';

// Windows headless Chromium otherwise selects SwiftShader. Exercise the actual
// D3D renderer used by players; Linux CI retains Chromium's default renderer.
export function launchExtractionBrowser() {
  return chromium.launch({ headless:true, args:process.platform==='win32'?['--use-angle=d3d11']:[] });
}
