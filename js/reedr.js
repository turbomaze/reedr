/******************\
| Real Life Speed  |
|  Reader - Reedr  |
| @author Anthony  |
| @author Liang    |
| @author Vahid    |
| @version 1.0     |
| @date 2015/11/07 |
| @edit 2015/11/08 |
\******************/

var Reedr = (function() {
  /**********
   * config */
  var DISP_WID = 180;
  var WORD_DISP_HT = 40;

  /*************
   * constants */
  var fr = Math.floor;
  var mx = Math.max;
  var mn = Math.min;
  var k = Array.prototype;
  k.p = k.push;
  k.q = k.filter;
  k.r = k.forEach;
  k.u = k.concat;

  /*********************
   * working variables */
  var canvas, ctx;
  var dw, dh, pixels;
  var gray;
  var mapping, boxes, wordIdx;

  /******************
  * work functions */
  function initReedr() {
    //canvas stuff
    canvas = $s('#c');
    canvas.style.width = DISP_WID+'px';
    canvas.style.height = DISP_WID+'px';
    ctx = canvas.getContext('2d');

    //misc variable init
    dw = 0, dh = 0, pixels = [];
    gray = [];
    mapping = [], boxes = [], wordIdx = 0;

    //do work whenever the selected picture changes
    $s('#d').addEventListener('change', function(e) {
      dw = 0, dh = 0, pixels = [];
      gray = [];
      mapping = [], boxes = [], wordIdx = 0;

      updatePixelData(e, function() {
        mapping = getMappingFromLabels(labelWords(getSmoothing(getSmoothing(colToBW(
          pixels, dw
        )))), dw);
        boxes = getBoxes(mapping);

        //sort the boxes
        boxes = sortBoxes(boxes);

        //get a nice gray representation of the image
        gray = colToGray(pixels, dw, true, 1.6);

        //prep the canvas
        canvas.width = DISP_WID;
        canvas.height = WORD_DISP_HT;
        canvas.style.width = 4*DISP_WID+'px';
        canvas.style.height = 4*WORD_DISP_HT+'px';

        //display the first word
        displayWord(0);

        //automatically loop through them
        displayUntilEnd(60000/400);
      });
    });
  }

  function displayUntilEnd(delay) {
    if (wordIdx < boxes.length) {
      displayWord(wordIdx);
      wordIdx++;
      setTimeout(displayUntilEnd, delay, delay);
    }
  }

  //displays the word at the given index
  function displayWord(idx) {
    drawWordPxArray(
      getWordPicInBox(
        gray[1], gray[0],
        mapping, boxes[idx]
      ), boxes[idx][2]
    );
  }

  //updates the pixels array with the selected image's data. From:
  //  www.syntaxxx.com/accessing-user-device-photos-with-the-html5-camera-api/
  function updatePixelData(e, callback) {
    //bring selected photo in
    var fileInput = e.target.files;
    if (fileInput.length > 0) {
      //get the file
      var picURL = URL.createObjectURL(fileInput[0]);
      getPixelsFromImage(picURL, 4*DISP_WID, function(data, width) {
        //fix funky orientations
        if (width > data.length/(4*width)) {
          //rotate it
          pixels = [];
          for (var x = 0; x < width; x++) {
            for (var y = data.length/(4*width)-1; y >= 0; y--) {
              var idx = 4*(y*width+x); //idx in data
              pixels.p(data[idx]);
              pixels.p(data[idx+1]);
              pixels.p(data[idx+2]);
              pixels.p(data[idx+3]);
            }
          }
          //update the dimension and pixels working vars
          dw = data.length/(4*width);
          dh = width;
        } else {
          //keep its orientation
          pixels = data;
          dw = width;
          dh = data.length/(4*width);
        }

        //get rid of the blob and finish
        URL.revokeObjectURL(picURL);
        callback();
      });
    }
  }

  //displays the currently loaded image in BW and returns the BW data
  function displayImageBW(bw) {
    //fix the dimensions
    canvas.style.display = 'block';
    canvas.style.height = (DISP_WID*(dh/dw))+'px';
    canvas.width = dw;
    canvas.height = dh;

    //display the bw image
    var currImageData = ctx.getImageData(0, 0, dw, dh);
    for (var y = 0; y < dh; y++) { //for all intended rows
      for (var x = 0; x < dw; x++) { //and for each intended column
        var idx = 4*(dw*y + x); //idx of this pixel in the pixels array
        for (var c = 0; c < 3; c++) { //and for all three colors, lol c++
          currImageData.data[idx+c] = fr(255*bw[idx/4]);
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
      gauss.p(0);
    }

    var dists = [];
    for (var j = -4; j <= 4; j++) {
      dists.p([]);
      for (var k = -4; k <= 4; k++) {
        dists[j + 4].p(gaussDist(j, k));
      }
    }

    for (var i = 0; i < bw.length; i++) {
      if (bw[i] === 0) {
        var row = fr(i / dw);
        var col = i % dw;
        for (var j = Math.max(row-4, 0); j <= Math.min(row+4, dh-1); j++) {
          for (var k = Math.max(col-4,0); k <= Math.min(col+4,dw-1); k++) {
            gauss[j * dw + k] += 4 * dists[j + 4 - row][k + 4 - col];
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
      labels.p(0);
    }
    var val = 1;
    var counter = 0;
    for (var i = 0; i < blurred.length; i++) {
      if (labels[i] !== 0 || blurred[i] === 1) {
        continue;
      } else {
        var q = [i];
        var ind = 0;
        while (ind < q.length) {
          var cur = q[ind];
          var row = fr(cur / dw)
          var col = cur % dw;
          if (row + 1 < dh) {
            var el = (row + 1) * dw + col;
            if (blurred[el] < threshold && labels[el] === 0) {
              labels[el] = val;
              q.p(el);
            }
          }
          if (row - 1 >= 0) {
            var el = (row - 1) * dw + col;
            if (blurred[el] < threshold && labels[el] === 0) {
              labels[el] = val;
              q.p(el);
            }
          }
          if (col - 1 >= 0) {
            var el = row * dw + col - 1;
            if (blurred[el] < threshold && labels[el] === 0) {
              labels[el] = val;
              q.p(el);
            }
          }
          if (col + 1 < dw) {
            var el = row * dw + col + 1;
            if (blurred[el] < threshold && labels[el] === 0) {
              labels[el] = val;
              q.p(el);
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
          var idx = y*dw + x;
          var fl = fr(gray[idx]);
          pxs = pxs.u(fl, fl, fl, 255);
        } else {
          pxs = pxs.u([255, 255, 255, 255]);
        }
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
    labels.r(function(label, idx) {
      if (label === 0) return; //ignore zero

      var x = idx % width;
      var y = fr(idx/width);
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
        ret.p(mapping[wi]);
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
        var idx = 4*(dw*y + x); //idx of this pixel in the pixels array
        var val = 0.21*data[idx]+0.72*data[idx+1]+0.07*data[idx+2];
        gray.p(Math.min(255, fr(contrast*val)));
        avgGray += val;
      }
    }
    avgGray /= dw*dh;
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
          for (var yy = fr(j*ratio); yy < (j+1)*ratio; yy++) {
            var dy = Math.abs(center_y - (yy + 0.5)) / ratioHalf;
            var center_x = (i + 0.5) * ratio;
            var w0 = dy*dy //pre-calc part of w
            for (var xx = fr(i*ratio); xx < (i+1)*ratio; xx++) {
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
      callback(data2, W2);
    };

    img.src = location; //load the image
  }

  //two dimensional gaussian distribution function with variance parameters
  function gaussDist(x, y) {
    return (1/(2*Math.PI*1.6))*Math.exp(
      -(x*x)/2 +
      -(y*y)/(2*1.6*1.6)
    );
  }

  // given a mapping (list of list of coordinate pairs),
  // return a list with coordinates of top left of bounding box and
  // dimensions: [x, y, width, height, idxInMapping]
  function getBoxes(mapping) {
    return mapping.map(function (pxList, idx) {
        var minx = 1/0, miny = 1/0;
        var maxx = -1/0, maxy = -1/0;
        Object.keys(pxList).r(function (key) {
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
    }).q(function(box) {
      return box[2] > 4 && box[2] > 4;
    });
  }

function sortBoxes(bxs) {

  var sortedBoxes = [];

  while (bxs.length > 0) {
      var newLine = false;
      var next;
      if (sortedBoxes.length > 0) {
          var last = sortedBoxes[sortedBoxes.length-1];
          var line = [];

          bxs.r(function (box, index) {
              if (sameLine(last, box)) {
                  line.p(box.u([index]));
              }
          });

          line = line.q(function (box){
              var distance = (box[0] + box[2]/2) - (last[0] + last[2]/2);
              var maxDistance = box[2] + last[2];
              return ((distance > 0) && (distance < maxDistance));
          }).sort(function (b1, b2) {
            return (b1[0] + b1[2]/2) - (b2[0] + b2[2]/2);
          });

          if (line.length > 0) {
              next = line[0];
          } else {
              newLine = true;
          }
      } else {
          newLine = true;
      }
      if (newLine) {
          var slope = 3;
          next = bxs.reduce(function(a, b, idx) {
            if (a[0]+a[1]*slope < b[0]+b[1]*slope) {
              return a;
            } else return b.u([idx]);
          }, [1/0, 1/0, 1/0, 1/0, -1]);
      }
      sortedBoxes.p(bxs.splice(next[5], 1)[0]);
  }
  return sortedBoxes;
}

  function sameLine (b1, b2) {
      var mid1 = b1[1] + b1[3]/2;
      var mid2 = b2[1] + b2[3]/2;
      var secondInFirst = (mid2 > b1[1]) && (mid2 < b1[1] + b1[3]);
      var firstInSecond = (mid1 > b2[1]) && (mid1 < b2[1] + b2[3]);
      return secondInFirst || firstInSecond;
  }

  function compareX (b1, b2) {
    return (b1[0] + b1[2]/2) - (b2[0] + b2[2]/2);
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
