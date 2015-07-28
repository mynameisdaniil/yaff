var ins  = require('util').inspect;
var log  = console.log;
var err  = console.error;
var fs   = require('fs');
var path = require('path');


exports.Seq;
exports.Test = function () {
  var fs = require('fs');
  this.Seq([1,2,3,4,5,6,7])
    .parMap(function (num) {
      setTimeout(function () {
        // if (num % 2 == 0)
        //   return this('ha-ha! ' + num);
        this(null, num);
      }.bind(this), 100);
    })
    .seq(function () {
      log('regual seq', arguments);
      this();
    })
    .finally(function (e, res) {
      log('finally. e:', e, '\tres:', res);
    })
};
