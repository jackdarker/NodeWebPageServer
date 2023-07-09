<script>
    import {apiURL} from "./const.svelte";
    import Country from './SearchProposal.svelte';	
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
    const countries = ["Afghanistan","Albania","Algeria","Andorra","Angola","Anguilla","Antigua and Barbuda","Argentina","Armenia","Aruba","Australia","Austria","Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bermuda","Bhutan","Bolivia","Bosnia and Herzegovina","Botswana","Brazil","British Virgin Islands","Brunei","Bulgaria","Burkina Faso","Burundi","Cambodia","Cameroon","Canada","Cape Verde","Cayman Islands","Central African Republic","Chad","Chile","China","Colombia","Congo","Cook Islands","Costa Rica","Cote D Ivoire","Croatia","Cuba","Curacao","Cyprus","Czech Republic","Denmark","Djibouti","Dominica","Dominican Republic","Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Ethiopia","Falkland Islands","Faroe Islands","Fiji","Finland","France","French Polynesia","French West Indies","Gabon","Gambia","Georgia","Germany","Ghana","Gibraltar","Greece","Greenland","Grenada","Guam","Guatemala","Guernsey","Guinea","Guinea Bissau","Guyana","Haiti","Honduras","Hong Kong","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Isle of Man","Israel","Italy","Jamaica","Japan","Jersey","Jordan","Kazakhstan","Kenya","Kiribati","Kosovo","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg","Macau","Macedonia","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania","Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia","Montenegro","Montserrat","Morocco","Mozambique","Myanmar","Namibia","Nauro","Nepal","Netherlands","Netherlands Antilles","New Caledonia","New Zealand","Nicaragua","Niger","Nigeria","North Korea","Norway","Oman","Pakistan","Palau","Palestine","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal","Puerto Rico","Qatar","Reunion","Romania","Russia","Rwanda","Saint Pierre and Miquelon","Samoa","San Marino","Sao Tome and Principe","Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands","Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","St Kitts and Nevis","St Lucia","St Vincent","Sudan","Suriname","Swaziland","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Timor L'Este","Togo","Tonga","Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Turks and Caicos","Tuvalu","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States of America","Uruguay","Uzbekistan","Vanuatu","Vatican City","Venezuela","Vietnam","Virgin Islands (US)","Yemen","Zambia","Zimbabwe"];
    //let apiURL="http://127.0.0.1:30050/api/";
    boardPost.replyToID = threadID;
    boardPost.boardID = boardID;
    //Function to send the reply to the api
    async function submitReply(){
        console.log(boardPost);
        let formData = new FormData(document.getElementById("postForm"));
        formData.append('posterID', boardPost.posterID);
        formData.append('boardID', boardPost.boardID);
        formData.append('replyToID', boardPost.replyToID);
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
    /* FILTERING countres DATA BASED ON INPUT */	
let filteredCountries = [];
// $: console.log(filteredCountries)	

const filterCountries = () => {
	let storageArr = []
	if (inputValue) {
		countries.forEach(country => {
			 if (country.toLowerCase().startsWith(inputValue.toLowerCase())) {
				 storageArr = [...storageArr, makeMatchBold(country)];
			 }
		});
	}
	filteredCountries = storageArr;
}	


    /* HANDLING THE INPUT */
    let searchInput; // use with bind:this to focus element
    let inputValue = "";
        
    $: if (!inputValue) {
        filteredCountries = [];
        hiLiteIndex = null;
    }

    const clearInput = () => {
        inputValue = "";	
        searchInput.focus();
    }
        
    const setInputVal = (countryName) => {
        inputValue = removeBold(countryName);
        filteredCountries = [];
        hiLiteIndex = null;
        document.querySelector('#country-input').focus();
    }	

    const submitValue = () => {
        if (inputValue) {
            console.log(`${inputValue} is submitted!`);
            setTimeout(clearInput, 1000);
        } else {
            alert("You didn't type anything.")
        }
    }

    const makeMatchBold = (str) => {
        // replace part of (country name === inputValue) with strong tags
        let matched = str.substring(0, inputValue.length);
        let makeBold = `<strong>${matched}</strong>`;
        let boldedMatch = str.replace(matched, makeBold);
        return boldedMatch;
    }

    const removeBold = (str) => {
        //replace < and > all characters between
        return str.replace(/<(.)*?>/g, "");
        // return str.replace(/<(strong)>/g, "").replace(/<\/(strong)>/g, "");
    }	
        

    /* NAVIGATING OVER THE LIST OF COUNTRIES W HIGHLIGHTING */	
    let hiLiteIndex = null;
    //$: console.log(hiLiteIndex);	
    $: hiLitedCountry = filteredCountries[hiLiteIndex]; 	
        
    const navigateList = (e) => {
        if (e.key === "ArrowDown" && hiLiteIndex <= filteredCountries.length-1) {
            hiLiteIndex === null ? hiLiteIndex = 0 : hiLiteIndex += 1
        } else if (e.key === "ArrowUp" && hiLiteIndex !== null) {
            hiLiteIndex === 0 ? hiLiteIndex = filteredCountries.length-1 : hiLiteIndex -= 1
        } else if (e.key === "Enter") {
            setInputVal(filteredCountries[hiLiteIndex]);
        } else {
            return;
        }
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
    div.autocomplete {
        /*the container must be positioned relative:*/
        position: relative;
        display: inline-block;
            width: 300px;
        }
        input {
        border: 1px solid transparent;
        background-color: #f1f1f1;
        padding: 10px;
        font-size: 16px;
            margin: 0;
        }
        input[type=text] {
        background-color: #f1f1f1;
        width: 100%;
        }
        input[type=submit] {
        background-color: DodgerBlue;
        color: #fff;
        }
            
        #autocomplete-items-list {
            position: relative;
            margin: 0;
            padding: 0;
            top: 0;
            width: 297px;
            border: 1px solid #ddd;
            background-color: #ddd;
        }	
</style>

<svelte:window on:keydown={navigateList} />
<div class="replyBox">
    <form action="{apiURL+"/submitTag"}" enctype="multipart/form-data"  method="post" id="postForm" autocomplete="off">
        <div class="autocomplete">
            <input id="country-input" 
                             type="text" 
                             placeholder="Search Country Names" 
                             bind:this={searchInput}
                             bind:value={inputValue} 
                             on:input={filterCountries}>
          </div>
        <input type="text" id="nameInput" placeholder="Name" name="name" bind:value={boardPost.name}/>
        <button id="replySubmit" on:click|preventDefault={validateInputs}>Submit</button>

        <!-- FILTERED LIST OF COUNTRIES -->
        {#if filteredCountries.length > 0}
            <ul id="autocomplete-items-list">
            {#each filteredCountries as country, i}
                <Country itemLabel={country} highlighted={i === hiLiteIndex} on:click={() => setInputVal(country)} />
            {/each}			
            </ul>
        {/if}
    </form>    
</div>