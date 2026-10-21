import { createFileRoute } from '@tanstack/react-router';

import { isTflSource } from '../lib/tfl/types';

export const Route = createFileRoute('/api/tfl/$source')({
    server: {
        handlers: {
            GET: async ({ params }) => {
                if (!isTflSource(params.source))
                    return new Response('Unknown TfL source', { status: 404 });
                const { tflService } = await import('../lib/tfl/server');
                return Response.json(await tflService.get(params.source), {
                    headers: { 'Cache-Control': 'no-store' }
                });
            }
        }
    }
});
