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
    if (!Array.isArray(initialStack))
      initialStack = [];
    this.args = [initialStack];
    setImmediate(function () {
      self.conveyor();
    });
  } else {
    return new Seq();
  }
};

//Handlers-----------------------------------------------------------------

Seq.prototype.handlersMap = {};

Seq.prototype.handlersMap[SEQ] = function (self, currItem) {
  currItem = self.stack.shift();
  executor(currItem.fn, self);
};

Seq.prototype.handlersMap[PAR] = function (self, currItem) {
  while (self.stack.length && self.stack[0].type === PAR) {
    currItem = self.stack.shift();
    executor(currItem.fn, self, true, currItem.position);
  }
  self.args = [];
};

//-------------------------------------------------------------------------

Seq.prototype.conveyor = function () {
  var currItem = this.stack[0];
  if (currItem) {
    // console.log('-------------------------------------');
    if (this.handlersMap[currItem.type])
      this.handlersMap[currItem.type](this, currItem);
    else
      return this.conveyor(this.stack.shift()); //skip current step
  }
};

Seq.prototype.seq = function (fn) {
  this.stack.push({fn: fn, type: SEQ});
  return this;
};

Seq.prototype.par = function (fn) {
  if (this.stack[this.stack.length - 1].type == PAR) {
    this.stack.push({fn: fn, type: PAR, position: this.stack[this.stack.length - 1].position + 1});
  } else {
    this.stack.push({fn: fn, type: PAR, position: 0});
  }
  return this;
};

Seq.prototype.forEach = function (fn) {
  var self = this;
  this.stack.push({fn: function () {
    self.stack.forEach(function (item, index) {
    });
    this();
  }, type: SEQ});
  return this;
};

Seq.prototype.seqEach = function (fn) {
};

Seq.prototype.parEach = function (fn) {
};

Seq.prototype.flatten = function (fully) {
  this.stack.push({fn: function () {
    this.apply(this, [null].concat(_.flatten(arguments, !fully)));
  }, type: SEQ});
  return this;
};

Seq.prototype.unflatten = function () {
  this.stack.push({fn: function () {
    this.apply(this, [null, Array.prototype.slice.call(arguments)]);
  }, type: SEQ});
  return this;
};

Seq.prototype.extend = function (arr) {
  this.stack.push({fn: function () {
    this.apply(this, [null].concat(Array.prototype.slice.call(arguments), arr));
  }, type: SEQ});
  return this;
};

Seq.prototype.set = function (arr) {
  this.stack.push({fn: function () {
    this.apply(this, [null, arr]);
  }, type: SEQ});
  return this;
};

Seq.prototype.empty = function () {
  this.stack.push({fn: function () {
    this();
  }, type: SEQ});
  return this;
};

Seq.prototype.push = function (/*args*/) {
  var args = Array.prototype.slice.call(arguments);
  this.stack.push({fn: function () {
    this.apply(this, [null].concat(Array.prototype.slice.call(arguments), args));
  }, type: SEQ});
  return this;
};

Seq.prototype.pop = function () {
  this.stack.push({fn: function () {
    this.apply(this, [null].concat(Array.prototype.slice.call(arguments, 0, -1)));
  }, type: SEQ});
  return this;
};

Seq.prototype.shift = function () {
  this.stack.push({fn: function () {
    this.apply(this, [null].concat(Array.prototype.slice.call(arguments, 1)));
  }, type: SEQ});
  return this;
};

Seq.prototype.unshift = function (/*args*/) {
  var args = Array.prototype.slice.call(arguments);
  this.stack.push({fn: function () {
    this.apply(this, [null].concat(args, Array.prototype.slice.call(arguments)));
  }, type: SEQ});
  return this;
};

Seq.prototype.splice = function (index, howMany, toAppend) {
  toAppend = maybe(toAppend).kindOf(Array).getOrElse([toAppend]);
  this.stack.push({fn: function () {
    this.apply(this, [null].concat(Array.prototype.splice.apply(Array.prototype.slice.call(arguments), [index, howMany].concat(toAppend))));
  }, type: SEQ});
  return this;
};

Seq.prototype.reverse = function () {
  this.stack.push({fn: function () {
    this.apply(this, [null].concat(Array.prototype.slice.call(arguments).reverse()));
  }, type: SEQ});
  return this;
};

Seq.prototype.catch = function (fn) {
  this.stack.push({fn: fn, type: ERR});
  return this;
};

Seq.prototype.debug = function () {
  var self = this;
  this.stack.push({fn: function () {
    this.apply(this, [null].concat(Array.prototype.slice.call(arguments)));
    console.log('̲........................................');
    console.log('->FUN STACK:');
    console.log(util.inspect(self.stack));
    console.log('->ARG STACK:');
    console.log(util.inspect(self.args));
    console.log('........................................');
  }, type: SEQ});
  return this;
};

var executor = function (fn, self, merge, position) {
  if (typeof executor.concurencyLevel === 'undefined')
    executor.concurencyLevel = 0;
  executor.concurencyLevel++;
  var cb = function (e) {
    executor.concurencyLevel--;
    if (e) {
      return self.errHandler(e);
    } else {
      var ret = Array.prototype.slice.call(arguments, 1);
      if (!merge)
        self.args = ret;
      else
        self.args[position] = ret.length > 1 ? ret:ret[0];
    }
    if (!executor.concurencyLevel)
      setImmediate(function () {
        self.conveyor();
      });
  };
  setImmediate((function (cb, args) {
    // args.push(cb); //TODO remove for backwards compatibility
    return function () {
      fn.apply(cb, args);
    };
  })(cb, self.args.slice()));
};

Seq.prototype.errHandler = function (e) {
  var currItem = {};
  while (currItem && currItem.type !== ERR)
    currItem = this.stack.shift(this.args.shift()); //looking for closest error handler. Just shifting the args - we don't need them anymore
  (currItem ? currItem.fn : function (e) { return console.error(e.stack ? e.stack : e); })(e);
};
