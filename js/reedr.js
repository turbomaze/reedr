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

  /*************
  * constants */

  /*********************
  * working variables */

  /******************
  * work functions */
  function initReedr() {
    //swag
  }

  /********************
  * helper functions */
  function $s(id) { //for convenience
    if (id.charAt(0) !== '#') return false;
    return document.getElementById(id.substring(1));
  }

  return {
    init: initReedr
  };
})();

window.addEventListener('load', Reedr.init);
