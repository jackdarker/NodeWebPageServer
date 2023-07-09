class boardPair {
	constructor(boardID,boardName){
		this.boardID = boardID;
		this.boardName = boardName;
	}
}
class Tag{
	constructor(tagID,tagName){
		this.tagID=tagID,this.tagName=tagName;
	}
}
module.exports = {boardPair,Tag};