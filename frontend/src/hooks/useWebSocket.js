import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to manage a WebSocket connection.
 * @param {string} baseUrl - The base URL for the WebSocket endpoint (e.g., 'ws://localhost:8000/ws/image-updates').
 * @param {string|null} token - The authentication token. If provided, it's appended to the URL.
 * @param {function} onMessage - Callback function to handle incoming messages.
 */
export function useWebSocket(baseUrl, token, isAdmin, onMessage) {
    const [isConnected, setIsConnected] = useState(false);
    const ws = useRef(null);
    const messageHandler = useRef(null);

    messageHandler.current = onMessage;

    useEffect(() => {
        if (!baseUrl) return;

        const connect = () => {
            let finalUrl = baseUrl;
            if (token) {
                finalUrl += `?token=${encodeURIComponent(token)}`;
                if (isAdmin) {
                    console.log('WebSocket: Connecting as Admin.');
                } else {
                    console.log('WebSocket: Connecting as Authenticated User.');
                }
            } else {
                console.log('WebSocket: Connecting as Anonymous.');
            }
            ws.current = new WebSocket(finalUrl);

            ws.current.onopen = () => {
                console.log('WebSocket connection established');
                setIsConnected(true);
            };

            ws.current.onmessage = (event) => {
                if (messageHandler.current) {
                    try {
                        const messageData = JSON.parse(event.data);
                        messageHandler.current(messageData);
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
    }, [baseUrl, token, isAdmin]); // Re-run the effect if the base URL, token, or admin status changes

    return { isConnected };
}