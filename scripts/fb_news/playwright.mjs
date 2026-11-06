// Playwright is installed globally on this machine (npm i -g playwright), not in the project.
export async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const appData = process.env.APPDATA || 'C:/Users/KruJames/AppData/Roaming';
    return import(`file:///${appData.replace(/\\/g, '/')}/npm/node_modules/playwright/index.mjs`);
  }
}
