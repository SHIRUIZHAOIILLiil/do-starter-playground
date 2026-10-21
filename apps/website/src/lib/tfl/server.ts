import { createTflService } from './service';

// Imported only by the server route handler. Keep server env out of browser types.
const { env } = (
    globalThis as typeof globalThis & {
        process: { env: Record<string, string | undefined> };
    }
).process;

export const tflService = createTflService({
    appKey: env.TFL_APP_KEY,
    appId: env.TFL_APP_ID,
    mockOnly: env.TFL_DEMO_MODE === 'mock'
});
