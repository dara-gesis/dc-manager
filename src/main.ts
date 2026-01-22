// Entry point for the application bundle.
// Importing CSS here ensures Vite bundles global styles once.
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import 'datatables.net-bs5/css/dataTables.bootstrap5.min.css';
import '@/ui/styles/app.css';

// Bootstraps all feature controllers and shared UI components.
import { bootstrapApp } from '@/app/bootstrap';

// Initialize the app once the module is evaluated.
bootstrapApp();
