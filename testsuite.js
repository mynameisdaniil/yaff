var ins  = require('util').inspect;
var log  = console.log;
var err  = console.error;
var fs   = require('fs');
var path = require('path');
var maybe = require('maybe2');


exports.Seq;
exports.Test = function () {
  var fs = require('fs');
  this.Seq([1,2,3,4,5,6,7])
    .parEach(function (num) {
      if (num % 2 == 0)
        return this('ha-ha!');
      this(null, num);
    })
    .seq(function () {
      log('regual seq', arguments);
      this();
    })
    .finally(function (e, res) {
      log('finally:', arguments);
    })
};
