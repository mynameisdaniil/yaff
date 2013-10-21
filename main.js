/*global maybe: true*/
var maybe = require('./maybe');
var _     = require('lodash');
var util  = require('util');

const PAR = 'par';
const SEQ = 'seq';
const ERR = 'err';

var Seq = module.exports = function Seq(initialStack) {
  if (this instanceof Seq) {
    var self = this;
    this.stack = [];
    this.concurrencyLevel = 0;
    this.args = maybe(initialStack).kindOf(Array).getOrElse([]);
    process.nextTick(function waitForStack() {
      if (self.stack.length)
        self.conveyor();
      else
        setImmediate(waitForStack);
    });
  } else {
    console.log('creating new instance of Seq');
    return new Seq();
  }
};


//Handlers-----------------------------------------------------------------

Seq.prototype.handlersMap = {};

Seq.prototype.handlersMap[SEQ] = function (self, currItem) {
  currItem = self.stack.shift();
  executor(currItem, self);
};

Seq.prototype.handlersMap[PAR] = function (self, currItem) {
  while (self.stack.length && self.stack[0].type === PAR && (!currItem.limit || currItem.limit > self.concurrencyLevel)) {
    currItem = self.stack.shift();
    executor(currItem, self, currItem.limit, true);
  }
  self.args = [];
};

Seq.prototype.handlersMap[ERR] = function (self) {
  self.conveyor(self.stack.shift()); //Err handler shouldn't be executed in order, so skip current step
};


//System methods-------------------------------------------------------------------------

Seq.prototype.conveyor = function () {
  var currItem = this.stack[0];
  if (currItem)
    this.handlersMap[currItem.type](this, currItem);
};

var executor = function (currItem, self, limit, merge) { //TODO maybe we need to optimize use of nextTick/setImmediate
  limit = typeof limit == 'number' ? limit:1;
  self.concurrencyLevel++;
  var cb = function (e) {
    self.concurrencyLevel--;
    if (e) {
      return self.errHandler(e);
    } else {
      var ret = Array.prototype.slice.call(arguments, 1);
      if (!merge)
        self.args = ret;
      else
        self.args[currItem.position] = ret.length > 1 ? ret:ret[0];
    }
    if (self.concurrencyLevel < limit)
      (currItem.immediate ? process.nextTick:setImmediate)(function () {
        self.conveyor();
      });
  };
  cb.vars = self.args;
  (currItem.immediate ? process.nextTick:setImmediate)((function (cb, args) {
    // args.push(cb); //TODO remove for backwards compatibility
    return function () {
      currItem.fn.apply(cb, args);
    };
  })(cb, self.args.slice()));
};

Seq.prototype.errHandler = function (e) {
  var currItem = {};
  while (currItem && currItem.type !== ERR)
    currItem = this.stack.shift(this.args.shift()); //looking for closest error handler. Just shifting the args - we don't need them anymore
  (currItem ? currItem.fn : function (e) { throw e; })(e);
};


//Interface methods--------------------------------------------------------------------------------------------------------------------------

Seq.prototype.seq = function (fn) {
  this.stack.push({fn: fn, type: SEQ});
  return this;
};

Seq.prototype.par = function (fn) {
  if (this.stack.length && this.stack[this.stack.length - 1].type == PAR)
    this.stack.push({fn: fn, type: PAR, position: this.stack[this.stack.length - 1].position + 1});
  else
    this.stack.push({fn: fn, type: PAR, position: 0});
  return this;
};

Seq.prototype.catch = function (fn) {
  this.stack.push({fn: fn, type: ERR});
  return this;
};

Seq.prototype.immediate = function () {
  if (this.stack.length)
    this.stack[this.stack.length - 1].immediate = true;
  return this;
};

Seq.prototype.limit = function (limit) {
  if (this.stack.length)
    this.stack[this.stack.length - 1].limit = limit;
  return this;
};

Seq.prototype.forEach = function (fn) {
  return this.seq(function () {
    var subseq = Seq();
    var args = Array.prototype.slice.call(arguments);
    args.forEach(function (item, index) {
      subseq.par(function () {
        fn.call(this, item, index);
      });
    });
    subseq.catch(this);
    this.apply(this, [null].concat(args));
  }).immediate();
};

Seq.prototype.seqEach = function (fn) {
  return this.seq(function () {
    var self = this;
    var subseq = Seq();
    var args = Array.prototype.slice.call(arguments);
    args.forEach(function (item, index) {
      subseq.seq(function () {
        fn.call(this, item, index);
      });
    });
    subseq.seq(function () {
      this(null, self.apply(self, [null].concat(args)));
    }).catch(this);
  }).immediate();
};

Seq.prototype.parEach = function (limit, fn) {
  fn = maybe(fn).kindOf(Function).getOrElse(limit);
  limit = maybe(limit).kindOf(Number).getOrElse(Infinity);
  return this.seq(function () {
    var self = this;
    var subseq = Seq();
    var args = Array.prototype.slice.call(arguments);
    args.forEach(function (item, index) {
      subseq.par(function () {
        fn.call(this, item, index);
      }).limit(limit);
    });
    subseq.seq(function () {
      this(null, self.apply(self, [null].concat(args)));
    }).catch(this);
  }).immediate();
};

Seq.prototype.flatten = function (fully) {
  return this.seq(function () {
    this.apply(this, [null].concat(_.flatten(arguments, !fully)));
  }).immediate();
};

Seq.prototype.unflatten = function () {
  return this.seq(function () {
    this.apply(this, [null, Array.prototype.slice.call(arguments)]);
  }).immediate();
};

Seq.prototype.extend = function (arr) {
  return this.seq(function () {
    this.apply(this, [null].concat(Array.prototype.slice.call(arguments), arr));
  }).immediate();
};

Seq.prototype.set = function (arr) {
  return this.seq(function () {
    this.apply(this, [null, arr]);
  }).immediate();
};

Seq.prototype.empty = function () {
  return this.seq(function () {
    this();
  }).immediate();
};

Seq.prototype.push = function (/*args*/) {
  var args = Array.prototype.slice.call(arguments);
  return this.seq(function () {
    this.apply(this, [null].concat(Array.prototype.slice.call(arguments), args));
  }).immediate();
};

Seq.prototype.pop = function () {
  return this.seq(function () {
    this.apply(this, [null].concat(Array.prototype.slice.call(arguments, 0, -1)));
  }).immediate();
};

Seq.prototype.shift = function () {
  return this.seq(function () {
    this.apply(this, [null].concat(Array.prototype.slice.call(arguments, 1)));
  }).immediate();
};

Seq.prototype.unshift = function (/*args*/) {
  var args = Array.prototype.slice.call(arguments);
  return this.seq(function () {
    this.apply(this, [null].concat(args, Array.prototype.slice.call(arguments)));
  }).immediate();
};

Seq.prototype.splice = function (index, howMany, toAppend) {
  toAppend = maybe(toAppend).kindOf(Array).getOrElse([toAppend]);
  return this.seq(function () {
    var args = Array.prototype.slice.call(arguments);
    Array.prototype.splice.apply(args, [index, howMany].concat(toAppend));
    this.apply(this, [null].concat(args));
  }).immediate();
};

Seq.prototype.reverse = function () {
  return this.seq(function () {
    this.apply(this, [null].concat(Array.prototype.slice.call(arguments).reverse()));
  }).immediate();
};

Seq.prototype.debug = function () {
  var self = this;
  return this.seq(function () {
    this.apply(this, [null].concat(Array.prototype.slice.call(arguments)));
    console.log('̲........................................');
    console.log('->FUN STACK:');
    console.log(util.inspect(self.stack));
    console.log('->ARG STACK:');
    console.log(util.inspect(self.args));
    console.log('........................................');
  }).immediate();
};
