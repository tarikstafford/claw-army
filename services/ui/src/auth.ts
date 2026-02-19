import { SvelteKitAuth } from '@auth/sveltekit';
import Google from '@auth/sveltekit/providers/google';

export const { handle, signIn, signOut } = SvelteKitAuth({
	providers: [Google],
	trustHost: true,
	// AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET are auto-read from env
});
