<script>
    export let boardPairs = [];
    import { createEventDispatcher } from 'svelte';
    import ReplyInputContainer from "./ReplyInputContainer.svelte";
    import TagInputContainer from "./TagInputContainer.svelte";
    const dispatch = createEventDispatcher();
    const fruits= ["Açaí", "Akee", "Apple", "Apricot", "Avocado", "Banana", "Bilberry", "Black sapote"];
    let showReplyBox = false; 
    let showTagEditBox=false;
    let searchString = "";
    let url = document.URL.substr(0,document.URL.lastIndexOf("/")+1);
    function toggleReplyBox(){
        showReplyBox = !showReplyBox;
    }
    function toggleTagBox(){
        showTagEditBox = !showTagEditBox;
    }
    function dispatchSearch() {
		dispatch('message', {
			text: searchString
		});
	}
    console.log(boardPairs.size);
    let urlparams = new URLSearchParams(window.location.search);
    let threadID = urlparams.get('thread');
    let boardID = urlparams.get('board');
</script>
<style>
    .topBar{
        background-color: var(--primaryColour);
		margin_old: 0.25em 0.25em;
		padding: 0.25em;
		min-width: 10em;
		min-height: 30em;
		text-align: center;
        grid-column:1;
		grid-row-start: 1;
		grid-row-end: 3;
		font-size: smaller;
	}
    .topBar_old {
		background-color: var(--primaryColour);
		display:inline-block;
        overflow: hidden;
        position:fixed;
        top: 0;
        width:100%;
        padding: 0.2em 0 0.2em 0;
        margin-bottom: 20px;
        border: 0;
        border-bottom: 1px;
        border-style: solid;
        border-color: var(--secondaryAccent);
    }
    button, input{
        border: 1px;
        margin: 0;
        border-style: solid;
        border-color: var(--secondaryAccent);
        border-radius: 1em;
        color:var(--secondaryAccent);
        background-color: var(--secondaryColour);
    }
    button {
        padding: 0 0.4em;
        font-size: 0.8em;
    }
    #searchInput{
        width: 100%;
        padding_old:0 1em;
        font-size: 0.8em;
        border: 1px;
        border-style: solid;
        border-color: var(--secondaryAccent);
        border-radius: 1em;
        color:var(--primaryAccent);
        background-color: var(--secondaryColour);
    }
	ul {
        padding:0;
        margin: 0;
        list-style-type: none;
        display_old: table-row;
	}
	li{
        float_old:left;
        margin-right_old: 2em;
        margin-left_old: 2em;
    }
    p{  
        margin:0;
        color: var(--secondaryAccent);
        margin-right: 0.5em;
        margin-left: 0.5em;
    }
    .boardLink{
        margin:0;
    }
</style>
<aside class="topBar">
    <ul>
        <li><a href="{url}"><p>Image-Browser</p></a></li>	
        {#if boardPairs != undefined}
            {#if boardPairs.length > 0}
                {#each boardPairs as boardPair}
                    <li class="boardLink"><a href="{url}?board={boardPair.boardID}">/{boardPair.boardID}/</a></li>
                {/each}
            {/if}
        {/if}
        <li><input id="searchInput" label="Search" bind:value={searchString} on:change={dispatchSearch} type="text"/></li>
        {#if threadID == null}
            {#if boardID != null}
                <li><button id="replyButton" on:click={toggleReplyBox}>New Thread</button></li>
            {/if}
        {:else}
            <li><button id="replyButton" on:click={toggleReplyBox}>Reply</button></li>
        {/if}
        <li><button id="tagEditButton" on:click={toggleTagBox}>Reply</button></li>
    </ul>
</aside>
{#if showReplyBox}
    <ReplyInputContainer/>
{/if}
{#if showTagEditBox}
    <TagInputContainer/>
{/if}