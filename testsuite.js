// var util = require('util');
var fs = require('fs');

exports.Seq;
exports.Test = function () {
  // this.Seq()
  //   .seq(function () {
  //     console.log('seq function1');
  //     this(null, 'ololo');
  //   })
  //   .par(function (arg) {
  //     setTimeout(function () {
  //       console.log('par function1: ' + arg);
  //       this(null, 'par1');
  //     }.bind(this), 2000);
  //   })
  //   .par(function (arg) {
  //     setTimeout(function () {
  //       console.log('par function2: ' + arg);
  //       this(null, 'par2');
  //     }.bind(this), 1000);
  //   })
  //   .forEach(function (arg) {
  //     setTimeout(function () {
  //       console.log('forEach: ' + arg);
  //     }, 100);
  //   })
  //   .seqEach(function (arg) {
  //     setTimeout(function () {
  //       console.log('seqEach: ' + arg);
  //       this();
  //     }.bind(this), 100);
  //   })
  //   .parEach(function (arg) {
  //     setTimeout(function () {
  //       console.log('parEach: ' + arg);
  //       this();
  //     }.bind(this), 100);
  //   })
  //   .splice(0, 1, 'hehehe')
  //   .seq(function (arg1, arg2) {
  //     console.log('seq function2. arg1: ' + arg1 + ', arg2: ' + arg2);
  //     // this('I\'m a Duke Nukem!');
  //     this();
  //   })
  //   .seq(function () {
  //     console.log('seq function3');
  //     this(null, 'seq3');
  //   })
  //   .seq(function (arg) {
  //     console.log('seq function4: ' + arg);
  //     this(null, 'OMG!');
  //   })
  //   .catch(function (e) {
  //     console.error('ERROR: ' + e);
  //   })
  //   .seq(function () {
  //     console.log('post apocalypse');
  //   });
  this.Seq()
    .seq(function () {
      fs.readdir(__dirname, this);
    })
    .flatten()
    .parEach(2, function (file) {
      fs.stat(__dirname + '/' + file, function (e, item) {
        setTimeout(function () {
          console.log(item.size);
          this();
        }.bind(this), 1000);
      }.bind(this));
    });
};
