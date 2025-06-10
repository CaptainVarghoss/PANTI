import { useState, useEffect } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import './App.css';

function App() {
  const [message, setMessage] = useState('');
  const [itemId, setItemId] = useState('');
  const [itemMessage, setItemMessage] = useState('');
  const [postData, setPostData] = useState('');
  const [postResponse, setPostResponse] = useState('');

  // Fetch message from FastAPI
  useEffect(() => {
    // Make sure this URL matches your FastAPI server's address
    fetch('/api/message')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => setMessage(data.message))
      .catch(error => console.error('Error fetching message:', error));
  }, []);

  // Fetch item by ID
  const fetchItem = async () => {
    if (!itemId) {
      setItemMessage('Please enter an item ID.');
      return;
    }
    try {
      // Make sure this URL matches your FastAPI server's address
      const response = await fetch(`/api/items/${itemId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setItemMessage(`Item ID: ${data.item_id}, Query: ${data.q}`);
    } catch (error) {
      console.error('Error fetching item:', error);
      setItemMessage('Error fetching item. Check console for details.');
    }
  };

  // Post data to FastAPI
  const postToFastAPI = async () => {
    try {
      // Make sure this URL matches your FastAPI server's address
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ my_data: postData }), // Send data as JSON
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setPostResponse(JSON.stringify(data, null, 2)); // Pretty print JSON response
    } catch (error) {
      console.error('Error posting data:', error);
      setPostResponse('Error posting data. Check console for details.');
    }
  };

  return (
    <>
      <div>
        <a href="https://vitejs.dev" target="_blank" rel="noreferrer">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank" rel="noreferrer">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React + FastAPI App</h1>

      <h2>Message from Backend:</h2>
      <p>{message || 'Loading...'}</p>

      <h2>Fetch Item by ID:</h2>
      <input
        type="number"
        value={itemId}
        onChange={(e) => setItemId(e.target.value)}
        placeholder="Enter item ID (e.g., 123)"
      />
      <button onClick={fetchItem}>Fetch Item</button>
      <p>{itemMessage}</p>

      <h2>Post Data to Backend:</h2>
      <input
        type="text"
        value={postData}
        onChange={(e) => setPostData(e.target.value)}
        placeholder="Enter data to send"
      />
      <button onClick={postToFastAPI}>Send Data</button>
      <pre>{postResponse}</pre>
    </>
  );
}

export default App;