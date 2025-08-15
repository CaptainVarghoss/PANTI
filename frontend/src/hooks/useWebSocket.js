import { useState, useEffect, useRef } from 'react';

export function useWebSocket(url, onMessage) {
    const [isConnected, setIsConnected] = useState(false);
    const ws = useRef(null);

    useEffect(() => {
        if (!url) return;

        const connect = () => {
            ws.current = new WebSocket(url);

            ws.current.onopen = () => {
                console.log('WebSocket connection established');
                setIsConnected(true);
            };

            ws.current.onmessage = (event) => {
                console.log('Message from server: ', event.data);
                if (onMessage) {
                    try {
                        const messageData = JSON.parse(event.data);
                        onMessage(messageData);
                    } catch (e) {
                        console.error('Failed to parse WebSocket message:', e);
                    }
                }
            };

            ws.current.onclose = () => {
                console.log('WebSocket connection closed. Reconnecting in 3 seconds...');
                setIsConnected(false);
                // Simple auto-reconnect logic
                setTimeout(connect, 3000);
            };

            ws.current.onerror = (error) => {
                console.error('WebSocket error:', error);
                // onclose will be called automatically after an error.
            };
        };

        connect();

        // Cleanup on component unmount
        return () => {
            if (ws.current) {
                // Prevent reconnection attempts when the component unmounts
                ws.current.onclose = null;
                ws.current.close();
            }
        };
    }, [url, onMessage]); // Re-run the effect if the URL or onMessage changes

    return { isConnected };
}
