<script context="module">
    export const apiURL="http://127.0.0.1:30050/api/";
	export const uiURL="http://localhost:5000";
    export async function getTags(){
		const res = await fetch(apiURL+"tags");
		let data = await res.json();
		return data;
	}
</script>