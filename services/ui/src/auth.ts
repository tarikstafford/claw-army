import { SvelteKitAuth } from '@auth/sveltekit';
import Google from '@auth/sveltekit/providers/google';

export const { handle, signIn, signOut } = SvelteKitAuth({
	providers: [Google],
	trustHost: true,
	callbacks: {
		redirect({ url, baseUrl }) {
			// After sign-in, default to /dashboard instead of /
			if (url === baseUrl || url === `${baseUrl}/`) return `${baseUrl}/dashboard`;
			// Allow relative URLs and same-origin URLs
			if (url.startsWith('/')) return `${baseUrl}${url}`;
			if (url.startsWith(baseUrl)) return url;
			return `${baseUrl}/dashboard`;
		},
	},
	// AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET are auto-read from env
});
