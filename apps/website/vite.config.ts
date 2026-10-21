import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { defineConfig, loadEnv } from 'vite-plus';

export default defineConfig(({ mode }) => {
    // Load only TfL server settings; never use VITE_ for API credentials.
    const tflEnv = loadEnv(mode, process.cwd(), 'TFL_');
    for (const [key, value] of Object.entries(tflEnv)) process.env[key] ??= value;
    return {
        resolve: {
            tsconfigPaths: true
        },
        server: {
            port: 5780,
            watch: {
                usePolling: true,
                interval: 100
            }
        },
        css: {
            transformer: 'lightningcss',
            lightningcss: {
                cssModules: true
            }
        },
        plugins: [
            devtools({
                consolePiping: { enabled: false }
            }),
            tanstackStart(),
            // https://tanstack.com/start/latest/docs/framework/react/guide/hosting
            nitro({
                features: { websocket: true }
            }),
            viteReact(),
            // https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md#react-compiler
            babel({
                presets: [
                    reactCompilerPreset({
                        target: '19'
                    })
                ]
            }),
            tailwindcss()
        ]
    };
});
