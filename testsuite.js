var util = require('util');

exports.Seq;
exports.Test = function () {
  this.Seq()
    .seq(function () {
      console.log('seq function1');
      this(null, 'ololo');
    })
    .par(function (arg) {
      var self = this;
      console.log('par function1: ' + arg);
      setTimeout(function () {
        self(null, 'par1');
      }, 200);
    })
    .par(function (arg) {
      var self = this;
      console.log('par function2: ' + arg);
      setTimeout(function () {
        self(null, 'par2');
      }, 100);
    })
    .seq(function (arg1, arg2) {
      // console.log(util.inspect(arg1));
      console.log('seq function2. arg1: ' + arg1 + ', arg2: ' + arg2);
      // this('I\'m a Duke Nukem!');
      this();
    })
    .seq(function () {
      console.log('seq function3');
      this(null, 'seq3');
    })
    .seq(function (arg) {
      console.log('seq function4: ' + arg);
      this(null, 'OMG!');
    })
    .catch(function (e) {
      console.error('ERROR: ' + e);
    });
};