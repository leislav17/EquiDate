import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installHashNavigation } from './utils/navigation';

installHashNavigation();

createRoot(document.getElementById('root')!).render(<App />);
