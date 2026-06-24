import { test, expect, type Page } from '@playwright/test';
import { VIEWS } from '../src/views.config';

/**
 * One screenshot per capture × {desktop, mobile} (Playwright projects) × {light,
 * dark}. Captures are the navigable VIEWS plus a few interaction states that
 * live on the /panel page. The nav chrome is suppressed with ?chrome=0 so each
 * view is captured on its own. Baselines live in tests/visual.spec.ts-snapshots/.
 * Update with: npm run test:visual:update
 */

type Capture = { name: string; path: string; prepare?: (page: Page) => Promise<void> };

// 1×1 transparent PNG — enough to populate the attachment strip.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/v8oAAAAAElFTkSuQmCC',
  'base64'
);

const expandToolCard = async (page: Page) => {
  // The data-testid is on the card wrapper; aria-expanded lives on its button.
  const toggle = page.getByTestId('tool-part').getByRole('button');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
};

// Prepare steps for VIEWS that need an interaction before capture, keyed by name.
const preparers: Record<string, (page: Page) => Promise<void>> = {
  'chat-tool-done': expandToolCard,
  'chat-tool-error': expandToolCard,
  'chat-attachments': async page => {
    await page.getByTestId('attachment-input').setInputFiles({
      name: 'photo.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    });
    await expect(page.getByTestId('attachment-thumb')).toBeVisible();
  },
  camera: async page => {
    await expect(page.getByRole('dialog')).toBeVisible();
    // Let getUserMedia settle into the unavailable/error branch (headless has no camera).
    await expect(page.getByText(/camera/i)).toBeVisible();
  },
};

const captures: Capture[] = [
  ...VIEWS.map(v => ({ name: v.name, path: v.path, prepare: preparers[v.name] })),
  // Interaction states that share the /panel page.
  {
    name: 'panel-switcher',
    path: '/panel',
    prepare: async page => {
      await page.getByTestId('session-switcher').click();
      await expect(page.getByTestId('session-item').first()).toBeVisible();
    },
  },
  {
    name: 'panel-rename',
    path: '/panel',
    prepare: async page => {
      await page.getByTestId('session-rename').click();
      await expect(page.getByTestId('session-rename-input')).toBeVisible();
    },
  },
  {
    name: 'panel-delete',
    path: '/panel',
    prepare: async page => {
      await page.getByTestId('session-delete').click();
      await expect(page.getByText('Delete this chat?')).toBeVisible();
    },
  },
  {
    name: 'panel-config',
    path: '/panel',
    prepare: async page => {
      await page.getByTestId('provider-config-toggle').click();
      await expect(page.getByTestId('provider-form')).toBeVisible();
    },
  },
];

const themes = ['light', 'dark'] as const;

for (const capture of captures) {
  for (const theme of themes) {
    test(`${capture.name} (${theme})`, async ({ page }) => {
      const query = theme === 'dark' ? '?chrome=0&theme=dark' : '?chrome=0';
      await page.goto(capture.path + query);
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready);
      await capture.prepare?.(page);
      await expect(page).toHaveScreenshot(`${capture.name}-${theme}.png`, { fullPage: true });
    });
  }
}
