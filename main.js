/**
 * @title YAFF (Yet Another Flow Framework)
 * @author Daniil Sobol
 * @license MIT
 * @overview This library is intended to replace unsupported and abandoned node-seq. It tries to be as compatible as possible. But it doesn't copy some weird behaviour of original library. So in some complex cases it can't be drop-in replacement and requires you to rewrite implementation-dependent code. This library is much more simple and optimised compared to original one. Piece of pure awesomeness, I'd say.
 * YAFF is an asynchronous flow control library with a chainable interface for sequential and parallel actions. Even the error handling is chainable. Each action in the chain operates on a stack of values. There is also a variables hash for storing values by name; hash persists across all requests unless it is overwritten.
 **/

/*global maybe:true*/
var maybe = require('./maybe');
var ins   = require('util').inspect;
var log   = console.log;

const PAR = 'par';
const SEQ = 'seq';
const ERR = 'err';
const FIN = 'fin';

/**
 * @Class YAFF
 **/
var YAFF = module.exports = function YAFF(initialStack) {
  if (this instanceof YAFF) {
    var self = this;
    this.stack = [];
    this.queue = [];
    this.vars = {};
    this.finally;
    this.lastError;
    this.concurrencyLevel = 0;
    this.args = maybe(initialStack).kindOf(Array).getOrElse([]);
    process.nextTick(function waitForStack() {
      if (self.stack.length)
        self.conveyor();
      else
        setImmediate(waitForStack);
    });
  } else {
    return new YAFF(initialStack);
  }
};


//Handlers-----------------------------------------------------------------

YAFF.prototype.handlersMap = {};

YAFF.prototype.handlersMap[SEQ] = function (self, currItem) {
  currItem = self.stack.shift();
  executor(currItem, self);
};

YAFF.prototype.handlersMap[PAR] = function (self, currItem) {
  while (self.stack.length && self.stack[0].type == PAR) {
    currItem = self.stack.shift();
    if (self.concurrencyLevel >= currItem.limit)
      self.queue.push(currItem);
    else
      executor(currItem, self, true);
  }
  self.args = [];
};

YAFF.prototype.handlersMap[ERR] = function (self) {
  self.conveyor(self.stack.shift()); //Err handler shouldn't be executed in order, so skip current step
};

YAFF.prototype.handlersMap[FIN] = function (self) {
  self.stack.shift();
  self.finHandler();
};


//System methods-------------------------------------------------------------------------

YAFF.prototype.conveyor = function () {
  var currItem = this.stack[0];
  if (currItem)
    this.handlersMap[currItem.type](this, currItem);
};

var executor = function (currItem, self, merge) {
  self.concurrencyLevel++;
  self.lastError = undefined;
  var cb = function (e) {
    self.concurrencyLevel--;
    if (e) {
      if (!self.lastError)
        self.lastError = e;
      return self.errHandler(e);
    } else {
      var ret = Array.prototype.slice.call(arguments, 1);
      if (merge)
        self.args[currItem.position] = ret.length > 1 ? ret:ret[0];
      else
        self.args = ret;
    }
    if (self.queue.length) {
      var newItem = self.queue.pop();
      return executor(newItem, self, true);
    }
    if (!self.concurrencyLevel)
      process.nextTick(function () {
        self.conveyor();
      });
  };
  process.nextTick((function (cb, args) {
    cb.args = args;
    cb.vars = self.vars;
    cb.into = function (key) {
      return function (e, ret) {
        if (!e)
          self.vars[key] = ret;
        cb.apply(cb, Array.prototype.slice.call(arguments));
      };
    };
    return function () {
      currItem.fn.apply(cb, args);
    };
  })(cb, self.args.slice()));
};

YAFF.prototype.errHandler = function (e) {
  var currItem;
  var defaultHandler = function (e) { throw e; };
  /*jshint boss:true*/
  while (currItem = this.stack[0])
    if (currItem.type == ERR) {
      return this.conveyor(currItem.fn(e));
    } else {
      this.stack.shift(this.args.shift());
    }

  if (this.finally)
    this.finHandler(e);
  else
    this.conveyor(defaultHandler(e));
};

YAFF.prototype.finHandler = function (e) {
  e = maybe(e).getOrElse(this.lastError);
  this.finally.apply(this.finally, [].concat(e, e ? undefined:this.args));
};


//Interface methods--------------------------------------------------------------------------------------------------------------------------

YAFF.prototype.seq = function (fn) {
  this.stack.push({fn: fn, type: SEQ});
  return this;
};

YAFF.prototype.seq_ = function (fn) {
  var args = Array.prototype.slice.call(arguments, 1);
  return this.seq(function () { fn.apply(fn, (args.length ? args:this.args).concat(this)); });
};

YAFF.prototype.par = function (fn) {
  if (this.stack.length && this.stack[this.stack.length - 1].type == PAR)
    this.stack.push({fn: fn, type: PAR, position: this.stack[this.stack.length - 1].position + 1});
  else
    this.stack.push({fn: fn, type: PAR, position: 0});
  return this;
};

YAFF.prototype.par_ = function (fn) {
  var args = Array.prototype.slice.call(arguments, 1);
  return this.par(function () { fn.apply(fn, (args.length ? args:this.args).concat(this)); });
};

YAFF.prototype.finally = function (fn) {
  this.finally = fn;
  this.stack.push({fn: fn, type: FIN});
  return undefined;
};

YAFF.prototype.catch = function (fn) {
  this.stack.push({fn: fn, type: ERR});
  return this;
};

YAFF.prototype.limit = function (limit) {
  if (this.stack.length)
    this.stack[this.stack.length - 1].limit = limit;
  return this;
};

YAFF.prototype.forEach = function (limit, fn) {
  fn = maybe(fn).kindOf(Function).getOrElse(limit);
  limit = maybe(limit).kindOf(Number).getOrElse(Infinity);
  return this.seq(function () {
    var subseq = YAFF();
    subseq.vars = this.vars;
    this.args.forEach(function (item, index) {
      subseq.par(function () {
        fn.call(this, item, index);
      }).limit(limit);
    });
    this.apply(this, [null].concat(this.args));
  });
};

YAFF.prototype.seqEach = function (fn) {
  return this.seq(function () {
    var self = this;
    var subseq = YAFF();
    subseq.vars = this.vars;
    this.args.forEach(function (item, index) {
      subseq.seq(function () {
        fn.call(this, item, index);
      });
    });
    subseq.seq(function () {
      this(null, self.apply(self, [null].concat(self.args)));
    }).catch(this);
  });
};

YAFF.prototype.parEach = function (limit, fn) {
  fn = maybe(fn).kindOf(Function).getOrElse(limit);
  limit = maybe(limit).kindOf(Number).getOrElse(Infinity);
  return this.seq(function () {
    var self = this;
    var subseq = YAFF();
    subseq.vars = this.vars;
    this.args.forEach(function (item, index) {
      subseq.par(function () {
        fn.call(this, item, index);
      }).limit(limit);
    });
    subseq.seq(function () {
      this(null, self.apply(self, [null].concat(self.args)));
    }).catch(this);
  });
};

YAFF.prototype.seqMap = function (fn) {
  return this.seq(function () {
    var self = this;
    var subseq = YAFF();
    subseq.vars = this.vars;
    var stack = [null];
    this.args.forEach(function (item, index) {
      subseq.seq(function () {
        var that = this;
        fn.call(function (e, ret) {
          that(e, stack.push(ret));
        }, item, index);
      });
    });
    subseq.seq(function () {
      this(null, self.apply(self, stack));
    }).catch(this);
  });
};

YAFF.prototype.parMap = function (limit, fn) {
  fn = maybe(fn).kindOf(Function).getOrElse(limit);
  limit = maybe(limit).kindOf(Number).getOrElse(Infinity);
  return this.seq(function () {
    var self = this;
    var subseq = YAFF();
    subseq.vars = this.vars;
    this.args.forEach(function (item, index) {
      subseq.par(function () {
        fn.call(this, item, index);
      }).limit(limit);
    });
    subseq.seq(function () {
      this(null, self.apply(self, [null].concat(this.args)));
    }).catch(this);
  });
};

YAFF.prototype.seqFilter = function (fn) {
  return this.seq(function () {
    var self = this;
    var subseq = YAFF();
    subseq.vars = this.vars;
    var stack = [null];
    this.args.forEach(function (item, index) {
      subseq.seq(function () {
        var that = this;
        fn.call(function (e, ret) {
          if (e || !ret)
            that();
          else
            that(null, stack.push(item));
        }, item, index);
      });
    });
    subseq.seq(function () {
      this(null, self.apply(self, stack));
    }).catch(this);
  });
};

YAFF.prototype.parFilter = function (limit, fn) {
  fn = maybe(fn).kindOf(Function).getOrElse(limit);
  limit = maybe(limit).kindOf(Number).getOrElse(Infinity);
  return this.seq(function () {
    var self = this;
    var subseq = YAFF();
    subseq.vars = this.vars;
    this.args.forEach(function (item, index) {
      subseq.par(function () {
        var that = this;
        fn.call(function (e, ret) { that(null, (e || !ret) ? null:item); }, item, index);
      }).limit(limit);
    });
    subseq.seq(function () {
      this(null, self.apply(self, [null].concat(this.args.filter(function (value) { return !!value; }))));
    }).catch(this);
  });
};

YAFF.prototype.map = function (fn, thisArg) {
  thisArg = maybe(thisArg).getOrElse(fn);
  return this.seq(function () {
    this.apply(this, [null].concat(this.args.map(fn, thisArg)));
  });
};

YAFF.prototype.filter = function (fn, thisArg) {
  thisArg = maybe(thisArg).getOrElse(fn);
  return this.seq(function () {
    this.apply(this, [null].concat(this.args.filter(fn, thisArg)));
  });
};

YAFF.prototype.reduce = function (fn, initialValue) {
  return this.seq(function () {
    this.apply(this, [null].concat(this.args.reduce(fn, initialValue)));
  });
};

YAFF.prototype.flatten = function (fully) {
  return this.seq(function () {
    this.apply(this, [null].concat(this.args.reduce(function reducer(a, b) {
      return a.concat(fully && b instanceof Array ? b.reduce(reducer, []):b);
    }, [])));
  });
};

YAFF.prototype.unflatten = function () {
  return this.seq(function () {
    this.apply(this, [null, this.args]);
  });
};

YAFF.prototype.extend = function (arr) {
  return this.seq(function () {
    this.apply(this, [null].concat(this.args, arr));
  });
};

YAFF.prototype.set = function (arr) {
  return this.seq(function () {
    this.apply(this, [null].concat(arr));
  });
};

YAFF.prototype.empty = function () {
  return this.seq(function () {
    this();
  });
};

YAFF.prototype.push = function (/*args*/) {
  var args = Array.prototype.slice.call(arguments);
  return this.seq(function () {
    this.apply(this, [null].concat(this.args, args));
  });
};

YAFF.prototype.pop = function () {
  return this.seq(function () {
    this.apply(this, [null].concat(this.args.slice(0, -1)));
  });
};

YAFF.prototype.shift = function () {
  return this.seq(function () {
    this.apply(this, [null].concat(this.args.slice(1)));
  });
};

YAFF.prototype.unshift = function (/*args*/) {
  var args = Array.prototype.slice.call(arguments);
  return this.seq(function () {
    this.apply(this, [null].concat(args, this.args));
  });
};

YAFF.prototype.splice = function (index, howMany, toAppend) {
  toAppend = maybe(toAppend).kindOf(Array).getOrElse([toAppend]);
  return this.seq(function () {
    Array.prototype.splice.apply(this.args, [index, howMany].concat(toAppend));
    this.apply(this, [null].concat(this.args));
  });
};

YAFF.prototype.reverse = function () {
  return this.seq(function () {
    this.apply(this, [null].concat(this.args.reverse()));
  });
};

YAFF.prototype.debug = function (fn) {
  var self = this;
  var defaultDebug = function () {
    this.apply(this, [null].concat(this.args));
    log('̲........................................');
    log('->FUN STACK:');
    log(ins(self.stack));
    log('->ARG STACK:');
    log(ins(self.args));
    log('........................................');
  };
  return this.seq(maybe(fn).getOrElse(defaultDebug));
};
