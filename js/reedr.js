/******************\
| Real Life Speed  |
|  Reader - Reedr  |
| @author Anthony  |
| @version 0.1     |
| @date 2015/11/07 |
| @edit 2015/11/07 |
\******************/

var Reedr = (function() {
  'use strict';

  /**********
   * config */
  var DISP_WID = 600;

  /*************
   * constants */

  /*********************
   * working variables */
  var canvas, ctx;
  var dims, pixels;

  /******************
  * work functions */
  function initReedr() {
    canvas = $s('#canvas');
    canvas.style.width = DISP_WID+'px';
    canvas.style.height = DISP_WID+'px';
    ctx = canvas.getContext('2d');

    dims = [0, 0], pixels = [];
    $s('#image-sel').addEventListener('change', function(e) {
      updatePixelData(e, displayImage);
    });
  }

  //displays the currently loaded image
  function displayImage() {
    //display the og image
    canvas.style.height = (DISP_WID*(dims[1]/dims[0]))+'px';
    canvas.width = dims[0];
    canvas.height = dims[1];

    //get the pixels in grayscale
    var gray = [];
    var avgGray = 0;
    for (var y = 0; y < dims[1]; y++) { //for all intended rows
			for (var x = 0; x < dims[0]; x++) { //and for each intended column
				var idx = 4*(dims[0]*y + x); //idx of this pixel in the pixels array
        var val = 0.21*pixels[idx]+0.72*pixels[idx+1]+0.07*pixels[idx+2];
        gray.push(val);
        avgGray += val;
			}
		}
    avgGray /= dims[0]*dims[1];

    //turn gray into black and white
    var bw = [];
    for (var y = 0; y < dims[1]; y++) { //for all intended rows
			for (var x = 0; x < dims[0]; x++) { //and for each intended column
				var idx = dims[0]*y + x; //idx of this pixel in the pixels array
        if (gray[idx] > 0.75*avgGray) bw.push(1);
        else bw.push(0);
			}
		}

    var currImageData = ctx.getImageData(0, 0, dims[0], dims[1]);
		for (var y = 0; y < dims[1]; y++) { //for all intended rows
			for (var x = 0; x < dims[0]; x++) { //and for each intended column
				var idx = 4*(dims[0]*y + x); //idx of this pixel in the pixels array
				for (var c = 0; c < 3; c++) { //and for all three colors, lol c++
					currImageData.data[idx+c] = 255*bw[idx/4];
				}
				currImageData.data[idx+3] = 255;
			}
		}
		ctx.putImageData(currImageData, 0, 0);

    renderDividers(bw);
  }

  //renders lines between each of the lines of text
  function renderDividers(bw) {
    //loop over the horizontal rows for clear lines across
    var n = 1;
    var offset = dims[0]/n;
    for (var ai = 0; ai < n; ai++) {
      var blocks = [[]];
      for (var y = 0; y < dims[1]; y++) {
        var score = 0;
        for (var x = ai*offset; x < (ai+1)*offset; x++) {
          score += bw[y*dims[0]+x];
        }
        if (score > 0.9*offset) {
          blocks[blocks.length-1].push([y, score]);
        } else if (blocks[blocks.length-1].length !== 0) {
          blocks.push([]);
        }
      }

      blocks.map(function(streak) {
        return streak.reduce(function(best, pair) {
          if (pair[1] >= best[1]) return pair;
          else return best;
        }, [-1, -Infinity]);
      }).forEach(function(peak) {
        ctx.fillStyle = 'red';
        ctx.fillRect(ai*offset, peak[0]-0.5, (ai+1)*offset, 2);
      });
    }
  }

  //from http://www.syntaxxx.com/accessing-user-device-photos-
  //     with-the-html5-camera-api/
  //updates the pixels array with the selected image's data
  function updatePixelData(e, callback) {
    //bring selected photo in
    var fileInput = e.target.files;
    if (fileInput.length > 0) {
      //get the file
      var windowURL = window.URL || window.webkitURL;
      var picURL = windowURL.createObjectURL(fileInput[0]);
      getPixelsFromImage(picURL, function(data, width) {
        dims = [width, data.length/(4*width)];
        pixels = data;
        windowURL.revokeObjectURL(picURL);

        callback();
      });
    }
  }

  /********************
   * helper functions */
  //given a url, provides a callback with the pixel data of the corresp image
  function getPixelsFromImage(location, callback) { //returns array of px colors
   	var timeStartedGettingPixels = new Date().getTime();
   	var img = new Image(); //make a new image
   	img.onload = function() { //when it is finished loading
   		var canvas = document.createElement('canvas'); //make a canvas element
   		canvas.width = img.width; //with this width
   		canvas.height = img.height; //and this height (the same as the img)
   		canvas.style.display = 'none'; //hide it from the user
   		document.body.appendChild(canvas); //then add it to the document's body
   		var ctx = canvas.getContext('2d'); //now get the context
   		ctx.drawImage(img, 0, 0, img.width, img.height); //so that you can draw it
   		var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
   		document.body.removeChild(canvas); //all done, so get rid of it

   		//...all so you can send the pixels, width, and the time taken to get
       //them back through the callback
   		var ret = [];
   		for (var ai = 0; ai < imageData.data.length; ai++) {
         ret.push(imageData.data[ai]); //annoying copy so the array can be edited
   		}
       callback(ret, img.width, new Date().getTime() - timeStartedGettingPixels);
   	};

   	img.src = location; //load the image
  }

  function $s(id) { //for convenience
    if (id.charAt(0) !== '#') return false;
    return document.getElementById(id.substring(1));
  }

  return {
    init: initReedr
  };
})();

window.addEventListener('load', Reedr.init);
