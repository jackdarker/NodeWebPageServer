<script>
    import { onMount } from "svelte";
    import * as glob from "./const.svelte";
    import { viewHandle } from './Stores';
    import { get } from 'svelte/store';
    export let post;
    let imagePath, thumbPath;   
    let showThumb = true;
    let url = document.URL.substring(0,document.URL.lastIndexOf("/")+1);
    //Set file paths if the post has a file
    if (post.fileName.length > 0){
            imagePath = "images/" + (post.replyToID ? post.replyToID : post.postID) + "/" + post.postID + "." + post.fileExt;
            thumbPath = "images/" + (post.replyToID ? post.replyToID : post.postID) + "/thumb_" + post.postID + "." + post.fileExt;
    }

    function thumbToggle(){
        showThumb = !showThumb;
    }
    function openWindow(post){
        let handle=get(viewHandle);
        if(handle && !handle.closed) {
            handle.postMessage(post, '*');
        } else {
            handle = open(glob.uiURL+'/subpage.html')
            //let newWindow = open(glob.uiURL+'/subpage.html', 'Viewer', 'width=300,height=300')
            //newWindow.focus();
            handle.onload = function() {
                let html = `<div style="font-size:30px">Welcome!</div>`;
                handle.document.body.insertAdjacentHTML('afterbegin', html); 
                handle.postMessage(post, '*');
            };
            viewHandle.set(handle);
        }
    }
</script>
<style>
    .postContainer{
        background-color: var(--secondaryColour);
        padding: 0.5em;
        color: var(--primaryAccent);
        margin: 1em;
        display: inline-block;
        width: 90%;
    }
    .postHeader {
        display: table-row;
    }
    ul {
        list-style-type: none;
    }
    li {
        padding: 0 0.5em 0 0;
        float: left;
    }
    #name {
        color: var(--secondaryAccent);
    }
    #subject {
        color: var(--subjectColour);
    }
    .postBody{
        clear: both;
    }
    .postImage{
        width: 100%;
        float: left;
        padding: 0 1em 0 0;
    }
    .postThumb{
        width: 14em;
        float: left;
        padding: 0 1em 0 0;
    }
    .postBody > p{
        padding: 0.5em;
        margin: 0.5em;
    }
</style>
<div class="postContainer">
    <div class="postBody">
        <ul class="postHeader">
            <li><a target="_blank" href={imagePath}>{post.fileName}</a></li>
            <li><button on:click={()=>openWindow({post})}>Ext.Window</button></li>
        </ul>
        {#if post.fileName != ""}
            {#if showThumb}
                <img class="postThumb" src="{thumbPath}" alt="{post.fileName}" on:click={thumbToggle}>
            {:else}
                <img class="postImage" src="{imagePath}" alt="{post.fileName}" on:click={thumbToggle}>
            {/if}
            
        {/if}
        <ul class="postHeader">
            <li id="subject">{post.subject}</li>
            <li id="name">{post.name}</li>
            <li>{post.dateTime}</li>
            <li><a href="{url+"?thread="+post.postID}">Post#{post.postID}</a></li>
        </ul>
        
        <p class="postText">{post.postText}</p>
    </div>
</div>