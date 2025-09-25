/* Minimal config shim copied from src to allow public/ pages to import modules via /lib/* */
export const APP_CONFIG = { BASE_URL: '/api' };
export async function getConfig(){ return { SCRIPT_URL: APP_CONFIG.BASE_URL }; }
