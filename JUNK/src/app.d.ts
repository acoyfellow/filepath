declare global {
	namespace App {
		interface Platform {
			env?: {
				WORKER: Fetcher;
			};
		}
	}
}

export {};

