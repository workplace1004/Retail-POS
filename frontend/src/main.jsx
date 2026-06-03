import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import './index.css';
import { LanguageProvider } from './contexts/LanguageContext';
import { CustomerDisplayPage } from './pages/CustomerDisplayPage.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageProvider>
      <HashRouter>
        <Routes>
          <Route path="/price-display" element={<CustomerDisplayPage />} />
          <Route path="/*" element={<App />} />
        </Routes>
      </HashRouter>
    </LanguageProvider>
  </React.StrictMode>
);
