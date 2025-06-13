import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { view } from '@forge/bridge';
import './styles/styles.css'

// Log initialization message
console.log('PTO app initializing...');

// Function to start the application
const startApp = async () => {
  // Get the root DOM element
  const rootElement = document.getElementById('root');
  
  if (!rootElement) {
    console.error('Root element not found! Make sure there is a div with id="root" in your HTML.');
    return;
  }
  
  // Create root and render the React application (React 18 way)
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  
  console.log('App rendered successfully');
  
  // Resize the Forge iframe if needed
  try {
    await view.resize();
    console.log('Forge iframe resized');
  } catch (error) {
    console.warn('Unable to resize Forge iframe:', error);
  }
};

// Start the application when DOM is ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  startApp();
} else {
  document.addEventListener('DOMContentLoaded', startApp);
}