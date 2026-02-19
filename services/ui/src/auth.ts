import { SvelteKitAuth } from '@auth/sveltekit';
import Google from '@auth/sveltekit/providers/google';

export const { handle, signIn, signOut } = SvelteKitAuth({
	providers: [Google],
	// AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET are auto-read from env
	// AUTH_TRUST_HOST is automatically true on Vercel; set it in local .env for dev
});
