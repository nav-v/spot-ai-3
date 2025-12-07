import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Handle CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        const apiKey = process.env.FIRECRAWL_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: 'Scrape service not configured' });
        }

        console.log(`[Scrape] Fetching: ${url}`);

        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                url,
                formats: ['markdown'],
                onlyMainContent: true
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Scrape] Firecrawl error:', errorText);
            return res.status(response.status).json({ error: 'Failed to scrape URL' });
        }

        const data = await response.json();

        return res.status(200).json({
            success: true,
            data: {
                title: data.data?.metadata?.title || '',
                content: data.data?.markdown || '',
                url: url
            }
        });

    } catch (error) {
        console.error('[Scrape API] Error:', error);
        return res.status(500).json({ error: 'Failed to scrape URL' });
    }
}
