// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session: {
				user: { id: string; email: string | null; name: string | null; image?: string | null };
				session: { id: string; userId: string };
			} | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}
export {};
