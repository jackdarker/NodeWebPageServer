import { writable } from 'svelte/store';
function createCount() {
	const { subscribe, set, update } = writable(null);

	return {
		subscribe,
		set: (x)=>set(x)
	};
}
//stors get reinitialized if you browse a link because the whole app is reinitialized??
export const viewHandle = createCount();
