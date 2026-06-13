/**
 * Whether Google sign-in is configured. The button is hidden until a real
 * OAuth client id is set in VITE_GOOGLE_CLIENT_ID — otherwise it renders but
 * fails on click. Set the real id (from the Google Cloud console) to enable.
 */
const id = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export const GOOGLE_ENABLED =
  !!id && !id.includes('your-google-client-id');
