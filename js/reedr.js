/******************\
| Real Life Speed  |
|  Reader - Reedr  |
| @author Anthony  |
| @version 0.2     |
| @date 2015/11/07 |
| @edit 2015/11/07 |
\******************/

var Reedr = (function() {
  'use strict';

  /**********
   * config */
  var DISP_WID = 360;
  var WORD_DISP_HT = 80;

  /*************
   * constants */

  /*********************
   * working variables */
  var canvas, ctx;
  var dims, pixels, labels;

  /******************
  * work functions */
  function initReedr() {
    //canvas stuff
    canvas = $s('#canvas');
    canvas.style.width = DISP_WID+'px';
    canvas.style.height = DISP_WID+'px';
    ctx = canvas.getContext('2d');

    //misc variable init
    dims = [0, 0], pixels = [], labels = [];

    //do work whenever the selected picture changes
    $s('#image-sel').addEventListener('change', function(e) {
      updatePixelData(e, function() {
        var bw = colToBW(pixels, dims[0]); //first, remove the color
        var blurred = getSmoothing(getSmoothing(bw)); //then, blur it
        labels = labelWords(blurred);
        var mapping = getMappingFromLabels(labels, dims[0]);
        var boxes = getBoxes(mapping);

        //render the bounding boxes of all the words
        displayImageBW(bw);

        //sort the boxes
        var avgBoxHt = boxes.reduce(function(a, b) {
          return a + b[3];
        }, 0)/boxes.length;
        var numRows = dims[1]/avgBoxHt;

        //pass one of the sort
        boxes.sort(function(a, b) {
          var center1 = [a[0]+a[2]/2, a[1]+a[3]/2];
          var center2 = [b[0]+b[2]/2, b[1]+b[3]/2];
          var score1 = center1[1]*numRows + center1[0];
          var score2 = center2[1]*numRows + center2[0];
          return score1 - score2;
        });

        //controls to box words
        var wordIdx = 0;
        var gray = colToGray(pixels, dims[0], true, 1.6);
        window.addEventListener('keydown', function(e) {
          if (e.keyCode === 32) { //space
            canvas.width = DISP_WID;
            canvas.height = WORD_DISP_HT;
            canvas.style.width = DISP_WID+'px';
            canvas.style.height = WORD_DISP_HT+'px';

            wordIdx += 1;

            drawWordPxArray(
              getWordPicInBox(
                gray[1],
                gray[0],
                mapping, boxes[wordIdx]
              ), boxes[wordIdx][2]
            );
          }
        });
      });
    });
  }

  //updates the pixels array with the selected image's data. From:
  //  www.syntaxxx.com/accessing-user-device-photos-with-the-html5-camera-api/
  function updatePixelData(e, callback) {
    //bring selected photo in
    var fileInput = e.target.files;
    if (fileInput.length > 0) {
      //get the file
      var windowURL = window.URL || window.webkitURL;
      var picURL = windowURL.createObjectURL(fileInput[0]);
      getPixelsFromImage(picURL, 2*DISP_WID, function(data, width, time) {
        //report out
        console.log('Finished loading pixels in '+time+'ms.');

        //fix funky orientations
        if (width > data.length/(4*width)) {
          //rotate it
          pixels = [];
          for (var x = 0; x < width; x++) {
            for (var y = data.length/(4*width)-1; y >= 0; y--) {
              var idx = 4*(y*width+x); //idx in data
              pixels.push(data[idx]);
              pixels.push(data[idx+1]);
              pixels.push(data[idx+2]);
              pixels.push(data[idx+3]);
            }
          }
          //update the dimension and pixels working vars
          dims = [data.length/(4*width), width];
        } else {
          //keep its orientation
          pixels = data;
          dims = [width, data.length/(4*width)];
        }

        //get rid of the blob and finish
        windowURL.revokeObjectURL(picURL);
        callback();
      });
    }
  }

  //displays the currently loaded image in BW and returns the BW data
  function displayImageBW(bw) {
    //fix the dimensions
    canvas.style.display = 'block';
    canvas.style.height = (DISP_WID*(dims[1]/dims[0]))+'px';
    canvas.width = dims[0];
    canvas.height = dims[1];

    //display the bw image
    var currImageData = ctx.getImageData(0, 0, dims[0], dims[1]);
    for (var y = 0; y < dims[1]; y++) { //for all intended rows
      for (var x = 0; x < dims[0]; x++) { //and for each intended column
        var idx = 4*(dims[0]*y + x); //idx of this pixel in the pixels array
        for (var c = 0; c < 3; c++) { //and for all three colors, lol c++
          currImageData.data[idx+c] = Math.floor(255*bw[idx/4]);
        }
        currImageData.data[idx+3] = 255;
      }
    }
    ctx.putImageData(currImageData, 0, 0);
  }

  //blurs a black/white image using a gaussian kernal
  function getSmoothing(bw) {
    var gauss = [];
    for (var i = 0; i < bw.length; i++) {
      gauss.push(0);
    }

    var dists = [];
    for (var j = -4; j <= 4; j++) {
      dists.push([]);
      for (var k = -4; k <= 4; k++) {
        dists[j + 4].push(gaussDist(j, k, 1, 1.6));
      }
    }

    for (var i = 0; i < bw.length; i++) {
      if (bw[i] === 0) {
        var row = Math.floor(i / dims[0]);
        var col = i % dims[0];
        for (var j = Math.max(row-4, 0); j <= Math.min(row+4, dims[1]-1); j++) {
          for (var k = Math.max(col-4,0); k <= Math.min(col+4,dims[0]-1); k++) {
            gauss[j * dims[0] + k] += 4 * dists[j + 4 - row][k + 4 - col];
          }
        }
      }
    }
    for (var i = 0; i < gauss.length; i++) {
      if (gauss[i] > 0.65) {
        gauss[i] = 0;
      } else {
        gauss[i] = 1;
      }
    }
    return gauss;
  }

  //finds and labels all contiguous regions (same foreground color)
  function labelWords(blurred) {
    var threshold = 0.5;
    var labels = [];
    for (var i = 0; i < blurred.length; i++) {
      labels.push(0);
    }
    var val = 1;
    var counter = 0;
    for (var i = 0; i < blurred.length; i++) {
      if (labels[i] != 0 || blurred[i] === 1) {
        continue;
      } else {
        var q = [i];
        var ind = 0;
        while (ind < q.length) {
          var cur = q[ind];
          var row = Math.floor(cur / dims[0])
          var col = cur % dims[0];
          if (row + 1 < dims[1]) {
            var el = (row + 1) * dims[0] + col;
            if (blurred[el] < threshold && labels[el] === 0) {
              labels[el] = val;
              q.push(el);
            }
          }
          if (row - 1 >= 0) {
            var el = (row - 1) * dims[0] + col;
            if (blurred[el] < threshold && labels[el] === 0) {
              labels[el] = val;
              q.push(el);
            }
          }
          if (col - 1 >= 0) {
            var el = row * dims[0] + col - 1;
            if (blurred[el] < threshold && labels[el] === 0) {
              labels[el] = val;
              q.push(el);
            }
          }
          if (col + 1 < dims[0]) {
            var el = row * dims[0] + col + 1;
            if (blurred[el] < threshold && labels[el] === 0) {
              labels[el] = val;
              q.push(el);
            }
          }
          ind++;
        }
        val++;
      }
    }

    return labels;
  }

  /********************
   * helper functions */
  //given a mapping and a box descriptor, return an image of the word
  function getWordPicInBox(gray, avgGray, mapping, box) {
    var pxs = [];
    var wordPxs = mapping[box[4]];
    for (var y = box[1]; y < box[1]+box[3]; y++) {
      for (var x = box[0]; x < box[0]+box[2]; x++) {
        if (wordPxs.hasOwnProperty(x+','+y)) {
          var idx = y*dims[0] + x;
          pxs.push(Math.floor(gray[idx]));
          pxs.push(Math.floor(gray[idx]));
          pxs.push(Math.floor(gray[idx]));
        } else {
          pxs.push(255);
          pxs.push(255);
          pxs.push(255);
        }
        pxs.push(255); //opacity
      }
    }

    return pxs;
  }

  //given an array of color info, render that to the canvas
  function drawWordPxArray(arr, width) {
    //display the bw image
    var xOff = (canvas.width - width)/2;
    var yOff = (canvas.height - arr.length/(4*width))/2;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    var currImageData = ctx.getImageData(0, 0, width, arr.length/(4*width));
    for (var ai = 0; ai < arr.length; ai++) {
      currImageData.data[ai] = arr[ai];
    }
    ctx.putImageData(currImageData, xOff, yOff);
  }

  //this function maps word indices to all their constituent pixel locations
  function getMappingFromLabels(labels, width) {
    var mapping = {};
    labels.forEach(function(label, idx) {
      if (label === 0) return; //ignore zero

      var x = idx % width;
      var y = Math.floor(idx/width);
      var key = x+','+y;
      if (!mapping.hasOwnProperty(label)) mapping[label] = {};
      mapping[label][key] = true;
    });

    //prune tiny blobs
    var minNumPxs = 25;
    var ret = [];
    for (var wi in mapping) {
      if (
        mapping.hasOwnProperty(wi) &&
        Object.keys(mapping[wi]).length >= minNumPxs
      ) {
        ret.push(mapping[wi]);
      }
    }
    return ret; //array of objects, px locations as keys
  }

  //converts an array of values to black and white, depending on a threshold
  function grayToBW(data, width, thresh) {
    return data.map(function(intensity) {
      return intensity > thresh ? 1 : 0;
    });
  }

  //converts an RGBA image array into a grayscale image array
  function colToGray(data, width, wantAverage, contrast) {
    contrast = contrast || 1;
    //convert to grayscale
    var gray = [], avgGray = 0;
    var ht = data.length/(4*width);
    for (var y = 0; y < ht; y++) { //for all intended rows
      for (var x = 0; x < width; x++) { //and for each intended column
        var idx = 4*(dims[0]*y + x); //idx of this pixel in the pixels array
        var val = 0.21*data[idx]+0.72*data[idx+1]+0.07*data[idx+2];
        gray.push(Math.min(255, Math.floor(contrast*val)));
        avgGray += val;
      }
    }
    avgGray /= dims[0]*dims[1];
    if (wantAverage) return [avgGray, gray];
    else return gray;
  }

  //converts an RGBA image array into a binary array (black and white)
  function colToBW(data, width, thresh) {
    thresh = thresh || 0.75;

    //convert to grayscale
    var grayAndAvg = colToGray(data, width, true);
    return grayToBW(grayAndAvg[1], width, thresh*grayAndAvg[0]);
  }

  //given a url, provides a callback with the pixel data of the corresp image
  //  resized to the given width
  function getPixelsFromImage(location, W2, callback) {
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
      var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

      //code for the resizing
      var H2 = W2*(img.height/img.width);
      var data2 = ctx.getImageData(0, 0, W2, H2).data;
      var ratio = canvas.width/W2;
      var ratioHalf = Math.ceil(ratio);
      document.body.removeChild(canvas); //all done, so get rid of it

      //hermite, thanks to ViliusL from
      //  https://github.com/viliusle/Hermite-resize/blob/master/hermite.js
      for (var j = 0; j < H2; j++) {
        for (var i = 0; i < W2; i++) {
          var x2 = (i + j*W2) * 4;
          var weight = 0;
          var weights = 0;
          var weights_alpha = 0;
          var gx_r = 0, gx_g = 0, gx_b = 0, gx_a = 0;
          var center_y = (j + 0.5) * ratio;
          for (var yy = Math.floor(j*ratio); yy < (j+1)*ratio; yy++) {
            var dy = Math.abs(center_y - (yy + 0.5)) / ratioHalf;
            var center_x = (i + 0.5) * ratio;
            var w0 = dy*dy //pre-calc part of w
            for (var xx = Math.floor(i*ratio); xx < (i+1)*ratio; xx++) {
              var dx = Math.abs(center_x - (xx + 0.5)) / ratioHalf;
              var w = Math.sqrt(w0 + dx*dx);
              if (w >= -1 && w <= 1) {
                //hermite filter
                weight = 2 * w*w*w - 3*w*w + 1;
                if (weight > 0) {
                  dx = 4*(xx + yy*img.width);
                  //alpha
                  gx_a += weight * data[dx + 3];
                  weights_alpha += weight;
                  //colors
                  if(data[dx+3] < 255) weight = weight*data[dx+3] / 250;
                  gx_r += weight * data[dx];
                  gx_g += weight * data[dx + 1];
                  gx_b += weight * data[dx + 2];
                  weights += weight;
                }
              }
            }
          }
          data2[x2] = gx_r/weights;
          data2[x2+1] = gx_g/weights;
          data2[x2+2] = gx_b/weights;
          data2[x2+3] = gx_a/weights_alpha;
        }
      }

      //...all so you can send the pixels, width, and the time taken to get
      //them back through the callback
      callback(data2, W2, new Date().getTime() - timeStartedGettingPixels);
    };

    img.src = location; //load the image
  }

  //two dimensional gaussian distribution function with variance parameters
  function gaussDist(x, y, sigma1, sigma2) {
    sigma1 = sigma1 || 1;
    sigma2 = sigma2 || sigma1;
    return (1/(2*Math.PI*sigma1*sigma2))*Math.exp(
      -(x*x)/(2*sigma1*sigma1) +
      -(y*y)/(2*sigma2*sigma2)
    );
  }

  // given a mapping (list of list of coordinate pairs),
  // return a list with coordinates of top left of bounding box and
  // dimensions: [x, y, width, height, idxInMapping]
  function getBoxes(mapping) {
    return mapping.map(function (pxList, idx) {
        var minx = Infinity, miny = Infinity;
        var maxx = -Infinity, maxy = -Infinity;
        Object.keys(pxList).forEach(function (key) {
          var pixel = key.split(',').map(function(comp) {
            return parseInt(comp);
          });
          if (pixel[0] < minx) {
            minx = pixel[0];
          }

          if (pixel[0] > maxx) {
            maxx = pixel[0];
          }

          if (pixel[1] < miny) {
            miny = pixel[1];
          }

          if (pixel[1] > maxy) {
            maxy = pixel[1];
          }
        });
        return [minx, miny, (maxx-minx), (maxy-miny), idx];
    }).filter(function(box) {
      return box[2] > 4 && box[2] > 4;
    });
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
