var ins  = require('util').inspect;
var log  = console.log;
var err  = console.error;
var fs   = require('fs');
var path = require('path');
var maybe = require('maybe2');

exports.Seq;
exports.Test = function () {
  var fs = require('fs');
  this.Seq(['./'])
    .mseq([function (path1) {
      fs.readdir(path1, this);
    }])
    .flatten()
    .parMap(function (file) {
      fs.stat(__dirname + '/' + file, this);
    })
    .map(function (stat) {
      return stat.size;
    })
    .unflatten()
    .finally(function (e, sizes) {
      log(sizes);
    });
};
