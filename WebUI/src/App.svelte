<script>
	export let isViewer=false;
	import PostContainer from "./PostContainer.svelte";
	import OpeningPostContainer from "./OpeningPostContainer.svelte";
	import { onMount } from 'svelte';
	import NavBar from "./NavBar.svelte";
	import Viewer from "./Viewer.svelte";
	import * as glob from "./const.svelte";
	import { viewHandle } from './Stores';
	import { get } from 'svelte/store';
	import ReplyInputContainer from "./ReplyInputContainer.svelte";
    import { each } from "svelte/internal";
	let posts;
	let boardPairs,tags;
	let urlparams = new URLSearchParams(window.location.search);
	let threadID = urlparams.get('thread');
	let boardID = urlparams.get('board');
	let boardIndex;
	let boardsRes;
	//let apiURL="http://127.0.0.1:30050/api/";
	let apiURL=glob.apiURL;
	let searching = false;
	let searchPosts = [];
	let count_value;
	let url = document.URL.substring(0,document.URL.lastIndexOf("/")+1);
	onMount(async () => {
		//viewHandle.set(null);
		let handle=get(viewHandle);
		viewHandle.subscribe((value) => {
		if(value){count_value = value.document.title};
		});
		boardPairs = await getBoards();
		tags = await glob.getTags();
		boardIndex = getBoardIndex();
		if (threadID != null){
			posts = await getThread(urlparams.get('thread'));
		} else if (boardID) {
			posts = await getOps(boardID);
		} else {
			//display home
		}
	});
	function getBoardIndex(){
		for(let i=0; i < boardPairs.length; i++){
			if (boardPairs[i].boardID == boardID){
				return i;
			}
		}
	}
	// Fucntion to search the posts array and copy posts containing the search string to a new array
	function handleSearch(event){
		searchPosts = [];
		searching = true;
		console.log("search: " + event.detail.text);
		if (event.detail.text != ""){
			for (let i=0; i < posts.length; i++){
				if(posts[i].postText.includes(event.detail.text) || posts[i].subject.includes(event.detail.text)){
					console.log("found post containing searchString: " + posts[i]);
					searchPosts.push(posts[i]);
				}
			}
		} else {
			searching = false;
		}
	}
	//Function to get a list of boardPairs from the api
	async function getBoards(){
		const res = await fetch(apiURL+"boards");
		boardsRes = await res.json();
		return boardsRes;
	}
	
	//Function to get a list of Opening Posts from the api
	async function getOps(board){
		const res = await fetch(apiURL+"posts?board="+board);
		return await res.json();
	}
	//Function to get a list of posts from the api for a particular thread result[0] is an opening post and the rest are replies to that post
	async function getThread(threadID){
		const res = await fetch(apiURL+"posts?thread="+threadID);
		return await res.json();
	}
</script>
<style>
	:global(:root){
		padding:0;
   		margin:0;
        --primaryAccent: #ffc2e5;
        --secondaryAccent: #c53f8d;
		--subjectColour: #ff0c9a;
        --primaryColour: #242423;
		--secondaryColour: #282A28;
		background-color: var(--secondaryColour);
	}
	section{
		display: grid;
		grid-template-columns: 0.2fr 1fr 1fr 1fr;
		grid-template-rows: 20% 80%;
		height: 100vh;
		/* width: 95vw; */
	}
	#sidebar {
		margin: 0.25em 0.25em;
		padding: 0.25em;
		min-width: 10em;
		min-height: 30em;
		text-align: center;
		grid-row-start: 1;
		grid-row-end: 3;
		font-size: smaller;
	}
	.posts{
		grid-row: 2;
		grid-column-start: 2;
		grid-column-end: 4;
		margin-top_old: 40px;
	}
	.boardBanner{
		margin-top_old: 100px;
		grid-row: 1;
		grid-column-start: 2;
		grid-column-end: 4;
		color: var(--secondaryAccent);
		text-align: center;
		font-size: 1em;
	}
	.home{
		margin:auto;
		margin-top:100px;
		width: 95%;
	}
	.rinImage{
		padding: 0 2em;
		float:left;
		min-width: 10%;

	}
	a{
		color:white;
	}
</style>

<section>
	<h1>The count is {count_value}</h1>
	{#if isViewer}
		<Viewer/>
	{:else}
		{#if boardIndex != undefined}
			{#if boardPairs.length > 0}
				<div class="boardBanner">
					<h1>/{boardPairs[boardIndex].boardID}/ - {boardPairs[boardIndex].boardName}</h1>
				</div>
			{/if}
		{/if}
	
		<!-- Create board banner e.g /g/ - Technology-->
		{#if boardIndex != undefined}
			{#if boardPairs.length > 0}
				<div class="boardBanner">
					<h1>/{boardPairs[boardIndex].boardID}/ - {boardPairs[boardIndex].boardName}</h1>
				</div>
			{/if}
		{/if}
		<!-- Add navbar to the page-->
		{#if boardPairs != undefined}
			{#if boardPairs.length > 0}
				<NavBar on:message={handleSearch} boardPairs={boardPairs}/>
			{/if}
		{/if}
		<!-- Display search results if searching is true otherwise display full posts list-->	
		{#if boardID || threadID}
		<div class="posts">
			{#if searching}
				{#if searchPosts != undefined}
					{#if searchPosts.length > 0}
						{#each searchPosts as post}
							{#if post.replyToID == null}
								<OpeningPostContainer post={post} />
							{:else}
								<PostContainer post={post}/>
							{/if}
						{/each}
					{/if}
				{:else}
					<h1>No Posts Found</h1>
				{/if}
			{:else}
				{#if posts != undefined}
					{#if posts.length > 0}
						{#each posts as post}
							{#if post.replyToID == null}
								<OpeningPostContainer post={post} />
							{:else}
								<PostContainer post={post}/>
							{/if}
						{/each}
					{/if}
				{:else}
					<h1>No Posts Found</h1>
				{/if}
			{/if}
		</div>
		{:else}
			<div class="home">
				<img class="rinImage" src="./images/site/rinImage.jpg" alt=""/>
				{#if boardPairs != undefined}
					{#if boardPairs.length > 0}
						{#each boardPairs as boardPair}
							<h2><a href="{url}?board={boardPair.boardID}">/{boardPair.boardID}/ - {boardPair.boardName}</a></h2>
						{/each}
					{/if}
				{/if}
			</div>
			
		{/if}
	{/if}
</section>
