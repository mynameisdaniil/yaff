var ins = require('util').inspect;
var log = console.log;
var err = console.error;
var fs = require('fs');

exports.Seq;
exports.Test = function () {
  // this.Seq()
  //   .seq(function () {
  //     log('seq function1');
  //     this(null, 'ololo');
  //   })
  //   .par(function (arg) {
  //     setTimeout(function () {
  //       log('par function1: ' + arg);
  //       this(null, 'par1');
  //     }.bind(this), 2000);
  //   })
  //   .par(function (arg) {
  //     setTimeout(function () {
  //       log('par function2: ' + arg);
  //       this(null, 'par2');
  //     }.bind(this), 1000);
  //   })
  //   .forEach(function (arg) {
  //     setTimeout(function () {
  //       log('forEach: ' + arg);
  //     }, 100);
  //   })
  //   .seqEach(function (arg) {
  //     setTimeout(function () {
  //       log('seqEach: ' + arg);
  //       this();
  //     }.bind(this), 100);
  //   })
  //   .parEach(function (arg) {
  //     setTimeout(function () {
  //       log('parEach: ' + arg);
  //       this();
  //     }.bind(this), 100);
  //   })
  //   .splice(0, 1, 'hehehe')
  //   .seq(function (arg1, arg2) {
  //     log('seq function2. arg1: ' + arg1 + ', arg2: ' + arg2);
  //     // this('I\'m a Duke Nukem!');
  //     this();
  //   })
  //   .seq(function () {
  //     log('seq function3');
  //     this(null, 'seq3');
  //   })
  //   .seq(function (arg) {
  //     log('seq function4: ' + arg);
  //     this(null, 'OMG!');
  //   })
  //   .catch(function (e) {
  //     error('ERROR: ' + e);
  //   })
  //   .seq(function () {
  //     log('post apocalypse');
  //   });

  this.Seq()
    .seq(function () {
      this(null, [
        [[1, 2], [3, 4], [5, 6], [7, 8], [[9], [10, [11, [12, 13, [14]]]]]]
      ]);
    })
    .flatten(true)
    .parFilter(function (item) {
      setTimeout(function () {
        log('>>' + item);
        this(null, item % 2);
      }.bind(this), 500 + Math.random() * 500);
    })
    .unflatten()
    .seq(function (arr) {
      log(ins(arr));
      log('before end');
      this(new Error('Test'));
      // process.exit(0);
    })
    .catch(function (e) {
      err('ERROR: ' + e);
    })
    .seq(function () {
      log('post apocalypse');
    });


  // log('----------------------------------------');
  // setImmediate(function eventLoopTracker() {
  //   log('----------------------------------------');
  //   setImmediate(eventLoopTracker);
  // });
};
