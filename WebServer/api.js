
const express = require("express");
const cors = require('cors');
const boardPost = require("./boardPost.js");
const {boardPair,Tag} = require("./boardPair.js");
const dbHandler = require("./dbHandler.js");
const multer  = require('multer')
const upload = multer({ dest: 'uploads/' })
const app = express();
const https = require('https');
const fs = require('fs');
const {execSync}  = require('child_process');
const bodyParser = require("body-parser");
//const urlencodedParser = bodyParser.urlencoded({ extended: false });
const urlencodedParser = bodyParser.raw();
app.use(cors());

/* Uncomment and add paths if using https
var key = fs.readFileSync('PATH TO KEY');
var cert = fs.readFileSync('PATH TO CERT');
var options = {
        key:key,
        cert:cert,
}*/

let dbhandler = new dbHandler;

// Image outdir should be the path to the images directory on the frontend
let imgOutDir = "D:\\Projects\\Javascript\\NodeWebPageServer\\WebUI\\public\\images\\";
dbhandler.dbInit();

//Posts will return an array of boardPost, posts for a thread if thread is specified or posts for a board if board is specified
app.get('/api/posts', async (req,res) => {
	if (req.query.thread != null){
		try{
			console.log("Getting thread " + req.query.thread);
			let posts = await getThread(req.query.thread);
			if(posts.length < 1){
				res.send(404);
			}
			console.log(posts);
			res.send(posts);
		} catch(e){
			console.log("api::posts::getThread " + e);
			res.send(404);
		}
	} else if (req.query.board != null){
		res.send(await getOps(req.query.board));
	} else {
		res.send(404);
	}
});
app.get('/api/boards', async (req,res) => {
	try{
		let boards = await getBoards();
		if (!boards){
			res.send(404);
		} else {
			res.send(boards);
		}
	} catch(e){
		console.log("api::boards " + e);
		res.send(404);
	}
});
app.get('/api/tags', async (req,res) => {
	try{
		let boards = await dbhandler.getTags();
		if (!boards){
			res.send(404);
		} else {
			res.send(boards);
		}
	} catch(e){
		console.log("api::tags " + e);
		res.send(404);
	}
});
// upload.single("userImage") extracts a file-input with id=userImage and other text-input and appeds those as body element to the request. 
// The request is then passed down to the next handler that can process the body. 
app.post('/api/submitTag',upload.single("userImage"), async (req,res) => {
	console.log(req.file,req.body);
	if (req.body.name.length < 1){
		req.body.name = "";
	}
	if(req.body.name==="") {
		res.status(422).send({error: "empty tag"});
	} else {
		let postData;
		postData = new boardPost(null,null,req.body.name,null,null,null,null,null,null,null);
		try{
			let postID = await dbhandler.createTag(postData);
			res.send(200,{error: "Post Success"});
		} catch(e) {
			console.log("api::submitTag::create " + e);
			res.send(422,{error: "Post Error"})
		}
	}
});
app.post('/api/submitPost', upload.single("userImage"), async (req,res) => {
	console.log(req.file,req.body);
	let opBoardID;
	if (req.body.name.length < 1){
		req.body.name = "Anonymous";
	}
	if (req.body.replyToID.length > 0){
		try{
			opBoardID = await opExists(req.body.replyToID);
			if(!opBoardID){
				res.send(422,{error: "Cannot reply to this thread"});
			}
		} catch(e){
			console.log("api::submitPost::opExists " + e);
			res.send(422,{error: "Post Error"})
		}
	} else {
		res.send(422,{error: "Cannot reply to this thread"});
	}
	if(!req.file && req.body.postText < 5){
		res.send(422,{error: "Post too short"});
	} else if (req.body.postText.length > 2000){
		res.send(422,{error: "Post too long"});
	} else {
		let postData
		if (!req.file){
			postData = new boardPost(null,opBoardID,req.body.name,null,req.body.posterID,null,null,req.body.postText,null,req.body.replyToID);
		} else {
			postData = new boardPost(null,opBoardID,req.body.name,null,req.body.posterID,null,req.file.originalname,req.body.postText,req.file.mimetype.split("/")[1],req.body.replyToID);
		}
		try{
			let postID = await createPost(postData);
			if(req.file){
				handleImages(req,postID,req.body.replyToID,true);
			}
			res.send(200,{error: "Post Success"});
		} catch(e){
			console.log("api::submitPost::createPost " + e);
			res.send(422,{error: "Post Error"})
		}
	}
});

app.post('/api/submitOp', upload.single("userImage"), async (req,res) => {
	console.log(req.file,req.body);
	if (req.body.name.length < 1){
		req.body.name = "Anonymous";
	}
	if(!req.file){
		res.send(422,{error: "Opening posts require a file"});
	} else if (req.body.subject === null && req.body.postText === null){
		res.send(422,{error: "Opening posts require text"});
	} else if (req.body.subject.length > 110){
		res.send(422,{error: "Post Subject too long"});
	} else if (req.body.postText.length > 2000){
		res.send(422,{error: "Post too long"});
	} else {
		let op = new boardPost();
		op.op(req.body.name,req.body.subject,req.file.originalname,req.body.postText,req.body.boardID,req.body.posterID,req.file.mimetype.split("/")[1]);
		try{
			let postID = await createOp(op);
			handleImages(req,postID,postID,true);
			res.send(200,{error: "Post Success"});
		} catch(e){
			console.log("api::submitOp::createOp " + e);
			res.send(422,{error: "Post Error"})
		}
	}
	
});
function handleImages(req,postID,threadID,isOp){
	let error = false,cmdString;
	//Make thread image dir recusively
	if (isOp){
		//cmdString="mkdir -p "+imgOutDir+threadID; //linux ; mkdir a\b on windows
		cmdString="mkdir "+imgOutDir+threadID;
		execSync(cmdString, (err, stdout, stderr) => {   
			if (err) {
			  console.log("api::submitOp::imagemagickMakeDir")
			  console.log(err)
			  error = true;
			}
		});
	}
	//Make thumbnail and output to frontend images dir
	// -strip will remove exif data
	cmdString = 'convert '+ req.file.path + " -strip -resize 200x "+imgOutDir+threadID+"/thumb_"+postID+"." + req.file.mimetype.split("/")[1];
	console.log(cmdString);
	execSync(cmdString, (err, stdout, stderr) => {
		if (err) {
		  console.log("api::submitOp::imagemagickConvertThumb")
		  console.log(err)
		  error = true;
		}
	});
	//Make image and output to frontend images dir
	// -strip will remove exif data
	cmdString = 'convert '+ req.file.path + " -strip "+imgOutDir+threadID+"/"+postID+"." + req.file.mimetype.split("/")[1];
	console.log(cmdString);
	execSync(cmdString, (err, stdout, stderr) => {
		if (err) {
		  console.log("api::submitOp::imagemagickConvertImage")
		  console.log(err)
		  error = true;
		}
	});
	//Remove uploaded file
	//cmdString = 'rm '+req.file.path;	//on linux
	cmdString = 'del '+req.file.path;	//on windows
	console.log(cmdString);
	execSync(cmdString, (err, stdout, stderr) => {
		if (err) {
		  console.log("api::submitOp::rm")
		  console.log(err)
		  error = true;
		}
	});
	if (error){
		deletePost(postID);
	}
}
function deletePost(postID){
	return dbhandler.deletePost(postID);
}

function opExists(replyToID){
	return dbhandler.opExists(replyToID);
}
function createOp(op){
	return dbhandler.createOp(op);
}
function createPost(post){
	return dbhandler.createPost(post);
}
function getOps(boardID){
	return dbhandler.getOps(boardID);
}
function getThread(threadID){
	return dbhandler.getThread(threadID);
}

function getBoards(){
	return dbhandler.getBoards();
}

/* Uncomment for https and remove the app .listen below
If using this you need to add paths to the cert and key file at the top of this file
var server = https.createServer(options, app);
server.listen(30050, () => {
        console.log("server listening on 30050");
});
*/

app.listen(30050, () => {
  console.log('CORS-enabled web server listening on port 30050');
})