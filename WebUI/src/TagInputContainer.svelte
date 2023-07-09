<script>
    import { onMount } from 'svelte';
    import {apiURL,getTags} from "./const.svelte";
    import TagSearchBox from "./TagSearchBox.svelte";
    let urlparams = new URLSearchParams(window.location.search);
    let threadID = urlparams.get('thread');
    let boardID = urlparams.get('board');
    let boardPost = {
        "name": "Anonymous ",
        "subject":"",
        "posterID":"",
        "replyToID": "",
        "postText":"",
        "boardID":"",
    }
    let tags;
    //let apiURL="http://127.0.0.1:30050/api/";
    onMount(async () => {
        tags = await getTags();
        boardPost.replyToID = threadID;
        boardPost.boardID = boardID;
    });
    //Function to send the reply to the api
    async function submitReply(){
        console.log(boardPost);
        let formData = new FormData(document.getElementById("postForm"));
        formData.append('posterID', boardPost.posterID);
        formData.append('boardID', boardPost.boardID);
        formData.append('replyToID', boardPost.replyToID);
        //for (const key of formData.keys()) {
        //    console.log(key);
        //}
        let url;
        url = apiURL+"submitTag";
        let res = await fetch(url,{
            method: 'POST',
            body: formData,
        });

        let status = await res.status
        let response = await res.json();
        console.log(status);
        if (status != 200){
            alert(response.error);
        } else {
            location.reload();
        }
    }
    function validateInputs(){
        submitReply();
    }
    
</script>
<style>
    .replyBox{
        margin:auto;
        margin-top: 40px;
        background-color: var(--primaryColour);
        border-radius: 0.5em;
        box-shadow: 0 0 1px 1px var(--secondaryAccent);
        padding: 0.5em;
        color: var(--primaryAccent);
        display: table;
        min-width: 15%;
        max-width: 95%;
    }
    #postForm{
        width:100%
    }
    button,input,textarea{
        padding: 0 0.4em;
        font-size: 0.8em;
        margin: 0;
        margin-bottom: 1em;
        border: 1px;
        border-style: solid;
        border-color: var(--secondaryAccent);
        border-radius: 2px;
        color:var(--primaryAccent);
        background-color: var(--secondaryColour);
    }
    textarea{
        width:100%;
        min-height:10em;
    }
</style>

<div class="replyBox">
    {#if tags!=undefined && tags.length > 0}
		{#each tags as tag}
			<span class="tags">{tag.tagName} </span>
		{/each}
	{/if}
    <form action="{apiURL+"/submitTag"}" enctype="multipart/form-data"  method="post" id="postForm" autocomplete="off">
        <TagSearchBox itemList={["bing","google"]} placeholder="Name" bind:inputValue={boardPost.name}/>
        <input type="text" id="nameInput" placeholder="xyt" name="postText" bind:value={boardPost.postText}/>-->
        <button id="replySubmit" on:click|preventDefault={validateInputs}>Submit</button>

    </form>    
</div>