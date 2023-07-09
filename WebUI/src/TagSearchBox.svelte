<script>
    export let itemList = ["Afghanistan","Albania","Algeria","Andorra","Angola","Anguilla","Antigua and Barbuda","Argentina","Armenia","Aruba","Australia","Austria","Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bermuda","Bhutan","Bolivia","Bosnia and Herzegovina","Botswana","Brazil","British Virgin Islands","Brunei","Bulgaria","Burkina Faso","Burundi","Cambodia","Cameroon","Canada","Cape Verde","Cayman Islands","Central African Republic","Chad","Chile","China","Colombia","Congo","Cook Islands","Costa Rica","Cote D Ivoire","Croatia","Cuba","Curacao","Cyprus","Czech Republic","Denmark","Djibouti","Dominica","Dominican Republic","Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Ethiopia","Falkland Islands","Faroe Islands","Fiji","Finland","France","French Polynesia","French West Indies","Gabon","Gambia","Georgia","Germany","Ghana","Gibraltar","Greece","Greenland","Grenada","Guam","Guatemala","Guernsey","Guinea","Guinea Bissau","Guyana","Haiti","Honduras","Hong Kong","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Isle of Man","Israel","Italy","Jamaica","Japan","Jersey","Jordan","Kazakhstan","Kenya","Kiribati","Kosovo","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg","Macau","Macedonia","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania","Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia","Montenegro","Montserrat","Morocco","Mozambique","Myanmar","Namibia","Nauro","Nepal","Netherlands","Netherlands Antilles","New Caledonia","New Zealand","Nicaragua","Niger","Nigeria","North Korea","Norway","Oman","Pakistan","Palau","Palestine","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal","Puerto Rico","Qatar","Reunion","Romania","Russia","Rwanda","Saint Pierre and Miquelon","Samoa","San Marino","Sao Tome and Principe","Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands","Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","St Kitts and Nevis","St Lucia","St Vincent","Sudan","Suriname","Swaziland","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Timor L'Este","Togo","Tonga","Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Turks and Caicos","Tuvalu","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States of America","Uruguay","Uzbekistan","Vanuatu","Vatican City","Venezuela","Vietnam","Virgin Islands (US)","Yemen","Zambia","Zimbabwe"];
    export let placeholder = "Search Name";
    export let inputValue="";
    /* FILTERING countres DATA BASED ON INPUT */	
let filteredItems = [];
let itemLabel;
let highlighted;
// $: console.log(filteredCountries)	

const filterItems = () => {
	let storageArr = []
	if (inputValue) {
		itemList.forEach(item => {
			 if (item.toLowerCase().startsWith(inputValue.toLowerCase())) {
				 storageArr = [...storageArr, makeMatchBold(item)];
			 }
		});
	}
	filteredItems = storageArr;
}	

/* HANDLING THE INPUT */
let searchInput; // use with bind:this to focus element
    
$: if (!inputValue) {
    filteredItems = [];
    hiLiteIndex = null;
}

const clearInput = () => {
    inputValue = "";	
    searchInput.focus();
}
    
const setInputVal = (countryName) => {
    inputValue = removeBold(countryName);
    filteredItems = [];
    hiLiteIndex = null;
    document.querySelector('#search-input').focus();
}	
const makeMatchBold = (str) => {
    // replace part of ( name === inputValue) with strong tags
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
$: hiLitedCountry = filteredItems[hiLiteIndex]; 	
    
const navigateList = (e) => {
    if (e.key === "ArrowDown" && hiLiteIndex <= filteredItems.length-1) {
        hiLiteIndex === null ? hiLiteIndex = 0 : hiLiteIndex += 1
    } else if (e.key === "ArrowUp" && hiLiteIndex !== null) {
        hiLiteIndex === 0 ? hiLiteIndex = filteredItems.length-1 : hiLiteIndex -= 1
    } else if (e.key === "Enter") {
        setInputVal(filteredItems[hiLiteIndex]);
    } else {
        return;
    }
} 
</script>
<style>
    div.autocomplete {
        /*the container must be positioned relative:*/
        position: relative;
        display: inline-block;
            width: 300px;
    }
    input {
    border: 1px solid transparent;
    color: var(--primaryAccent);
    background-color: var(--secondaryColour);
    font-size: 0.8em;
        margin: 0;
    }
    input[type=text] {
        border: 1px;
        border-color: var(--secondaryAccent);
        border-style: solid;
        border-radius: 1em;
        width: 100%;
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
    li.autocomplete-items {
      list-style: none;
        border-bottom: 1px solid #d4d4d4;
        z-index: 99;
        /*position the autocomplete items to be the same width as the container:*/
        top: 100%;
        left: 0;
        right: 0;
        padding: 10px;
        cursor: pointer;
        background-color: #fff;
    }
    
    li.autocomplete-items:hover {
        /*when hovering an item:*/
        background-color: #81921f;
        color: white;
    }
    
    li.autocomplete-items:active {
        /*when navigating through the items using the arrow keys:*/
        background-color: DodgerBlue !important;
        color: #ffffff;
    }	
        
    .autocomplete-active {
        /*when navigating through the items using the arrow keys:*/
        background-color: DodgerBlue !important;
        color: #ffffff;
    }
</style>

<svelte:window on:keydown={navigateList} />
<div class="autocomplete">
    <input id="search-input" name="name" type="text" 
                     placeholder={placeholder} 
                     bind:this={searchInput}
                     bind:value={inputValue} 
                     on:input={filterItems}>
</div>
<!-- FILTERED LIST OF ITEMS -->
{#if filteredItems.length > 0}
<ul id="autocomplete-items-list">
{#each filteredItems as item, i}    
    <li class="autocomplete-items" class:autocomplete-active={i === hiLiteIndex} on:click={() => setInputVal(item)} >{@html item}</li>
    <!--<Country itemLabel={item} highlighted={i === hiLiteIndex} on:click={() => setInputVal(item)} />-->
{/each}			
</ul>
{/if}