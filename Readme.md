# NodeWebPageServer

This is a ripoff of https://github.com/NO-ob/rinChan that I used to learn something and create my own webpage-generator for browsing my image collection.

There are 2 components that work together
- WebServer: the Backend running in Nodejs, storing the images and connected data
- WebUI: some middleware that also runs in Nodejs; fetches the image from WebServer and wrap them into webpage document sent to client 

There are some extra dependencies
- Nodejs
- SQLite (database storing the serverdata)
- ImageMagick (for creating thumbnails)
- Svelte (to built the html pages sent to the browser)

## WebServer

The imgOutDir variable in WebServer/api.js needs to be set to /PATH TO/WebUI/public/images/

It can then be launched by running:
```
npm install
npm start
```

The webservers API can be accessed by http://localhost:30050/api/...

## WebUI

The apiURL variable in WebUI/src/App.svelte and WebUI/src/ReplyInputContainer.svelte needs to be set to the url the server is running on including the port 

It can then be launched by running:
```
npm install 
npm run dev
```
To build the webUI you can run:
```
npm run build
```
This will produce a minified files which can then be deployed to a server, every thing in the WebUI/public/ folder is needed

The webservers API can be accessed by http://localhost:5000/
