import { createRoot } from 'react-dom/client';
import App from './app/App';
import './styles/styles.css';
import './settings/palette';

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
