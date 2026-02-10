import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Charge les variables d'environnement (API_KEY)
  // Casting process to any to avoid TS error: Property 'cwd' does not exist on type 'Process'
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Important: Cela permet à 'process.env.API_KEY' de fonctionner dans le code compilé
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  };
});