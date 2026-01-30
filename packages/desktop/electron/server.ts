import http from 'http';

const PORT = 21337;

export function startServer(onRepoChange: (path: string, url?: string) => void) {
    const server = http.createServer((req, res) => {
        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        if (req.method === 'POST' && req.url === '/api/notify') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    if (data && data.path) {
                        console.log('Received repo change notification:', data.path, data.url);
                        onRepoChange(data.path, data.url);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    } else {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Missing path' }));
                    }
                } catch (e) {
                    console.error("JSON Parse Error. Raw body:", body);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON' }));
                }
            });
        } else {
            res.writeHead(404);
            res.end();
        }
    });

    server.listen(PORT, '127.0.0.1', () => {
        console.log(`Licorice Notification Server running on port ${PORT}`);
    });

    return server;
}
