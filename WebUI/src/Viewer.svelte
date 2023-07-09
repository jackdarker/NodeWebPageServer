<script>
    import { onMount } from "svelte";
    import * as glob from "./const.svelte";
    export let post={
    "postID": 11,
    "name": "Anonymous ",
    "subject": "gthaeg",
    "posterID": null,
    "dateTime": "2023-07-02 15:13:37",
    "fileName": "2fa881f952bddb8cae6a28f096eb9542.jpeg",
    "postText": "egte",
    "fileExt": "jpeg",
    "replyToID": null
    };
    let imagePath, thumbPath;   
    let showThumb = true;
    let url = document.URL.substring(0,document.URL.lastIndexOf("/")+1);
    function buildImagePath(post) {
        //Set file paths if the post has a file
        if (post.fileName.length > 0){
            imagePath = "images/" + (post.replyToID ? post.replyToID : post.postID) + "/" + post.postID + "." + post.fileExt;
            thumbPath = "images/" + (post.replyToID ? post.replyToID : post.postID) + "/thumb_" + post.postID + "." + post.fileExt;
        }
    }
    //receive the image to display from main-app
    window.addEventListener('message', function(event) {
      //alert(`Received ${event.data} from ${event.origin}`);
      if(event.data.post!=undefined) {
            //
            post = event.data.post;
            buildImagePath(post);
      }
    });
</script>
<style>
    .viewContainer{
        background-color: var(--secondaryColour);
        color: var(--secondaryAccent);
        padding: 0.5em;
        color: var(--primaryAccent);
        margin: 1em;
        display: inline-block;
        width: 90%;
    }
</style>

<div class="viewContainer"> <p>Viewer</p>
    <img class="postImage" src="{imagePath}" alt="{post.fileName}" >
</div>