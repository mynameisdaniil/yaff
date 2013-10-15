var util = require('util');
var Seq = require('./main.js');

Seq()
  .seq(function (cb) {
    console.log('seq function1');
    this(null, 'ololo');
  })
  .par(function (arg, cb) {
    console.log('par function1');
    cb();
  })
  .par(function (arg, cb) {
    console.log('par function2');
    cb();
  })
  .seq(function (arg, cb) {
    console.log('seq function2');
    cb();
  })
  .seq(function (arg, cb) {
    console.log('seq function3');
    cb();
  })
  .seq(function (arg, cb) {
    console.log('seq function4');
    cb();
  })
  .catch(function (e) {
    console.log('error caught!' + e);
  });
