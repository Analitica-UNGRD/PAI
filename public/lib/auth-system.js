// Lightweight shim for public/ to avoid bundling issues
export const Auth = { isAuthenticated: ()=>false };
document.addEventListener('DOMContentLoaded', ()=>{/* noop for public/ */});
