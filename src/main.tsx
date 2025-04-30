import React from 'react';
import ReactDOM from 'react-dom/client';
import HelloWorld from './components/HelloWorld';
import './index.css';

const App = () => {
  return <HelloWorld />;
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);