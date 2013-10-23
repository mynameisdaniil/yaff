/**
 * @title YAFF (Yet Another Flow Framework)
 * @author Daniil Sobol
 * @license MIT
 * @overview This library is intended to replace unsupported and abandoned node-seq. It tries to be as compatible as possible. But it doesn't copy some weird behaviour of original library. So in some complex cases it can't be drop-in replacement and requires you to rewrite implementation-dependent code. This library is much more simple and optimised compared to original one. Piece of pure awesomeness, I'd say.
 * YAFF is an asynchronous flow control library with a chainable interface for sequential and parallel actions. Even the error handling is chainable. Each action in the chain operates on a stack of values. Unlike Seq YAFF doesn't have variables hash and operates on plain old arguments stack only, so if you need to modify something please use map/filter methods.
 **/

/*global maybe:true*/
var maybe = require('./maybe');
var ins   = require('util').inspect;
var log   = console.log;

const PAR = 'par';
const SEQ = 'seq';
const ERR = 'err';

/**
 * @Class Seq
 **/
var Seq = module.exports = function Seq(initialStack) {
  if (this instanceof Seq) {
    var self = this;
    this.stack = [];
    this.queue = [];
    this.vars = {};
    this.concurrencyLevel = 0;
    this.args = maybe(initialStack).kindOf(Array).getOrElse([]);
    process.nextTick(function waitForStack() {
      if (self.stack.length)
        self.conveyor();
      else
        setImmediate(waitForStack);
    });
  } else {
    return new Seq(initialStack);
  }
};


//Handlers-----------------------------------------------------------------

Seq.prototype.handlersMap = {};

Seq.prototype.handlersMap[SEQ] = function (self, currItem) {
  currItem = self.stack.shift();
  executor(currItem, self, currItem.context);
};

Seq.prototype.handlersMap[PAR] = function (self, currItem) {
  while (self.stack.length && self.stack[0].type == PAR) {
    currItem = self.stack.shift();
    if (self.concurrencyLevel >= currItem.limit)
      self.queue.push(currItem);
    else
      executor(currItem, self, currItem.context, true);
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

var executor = function (currItem, self, context, merge) {
  self.concurrencyLevel++;
  var cb = function (e) {
    self.concurrencyLevel--;
    if (e) {
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
      return executor(newItem, self, newItem.context, true);
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
        self.vars[key] = ret;
        cb.apply(cb, Array.prototype.slice.call(arguments));
      };
    };
    if (context)
      args.push(cb);
    return function () {
      currItem.fn.apply(context || cb, args);
    };
  })(cb, self.args.slice()));
};

Seq.prototype.errHandler = function (e) {
  var currItem;
  var defaultHandler = function (e) { throw e; };
  /*jshint boss:true*/
  while (currItem = this.stack[0])
    if (currItem.type == ERR)
      return this.conveyor(currItem.fn(e));
    else
      this.stack.shift(this.args.shift());
  return this.conveyor(defaultHandler(e));
};


//Interface methods--------------------------------------------------------------------------------------------------------------------------

Seq.prototype.seq = function (fn) {
  this.stack.push({fn: fn, type: SEQ});
  return this;
};

Seq.prototype.seq_ = function (fn) {
  return this.seq(fn).context(fn);
};

Seq.prototype.par = function (fn) {
  if (this.stack.length && this.stack[this.stack.length - 1].type == PAR)
    this.stack.push({fn: fn, type: PAR, position: this.stack[this.stack.length - 1].position + 1});
  else
    this.stack.push({fn: fn, type: PAR, position: 0});
  return this;
};

Seq.prototype.par_ = function (fn) {
  return this.par(fn).context(fn);
};

Seq.prototype.catch = function (fn) {
  this.stack.push({fn: fn, type: ERR});
  return this;
};

Seq.prototype.limit = function (limit) {
  if (this.stack.length)
    this.stack[this.stack.length - 1].limit = limit;
  return this;
};

Seq.prototype.context = function (context) {
  if (this.stack.length)
    this.stack[this.stack.length - 1].context = context;
  return this;
};

Seq.prototype.forEach = function (limit, fn) {
  fn = maybe(fn).kindOf(Function).getOrElse(limit);
  limit = maybe(limit).kindOf(Number).getOrElse(Infinity);
  return this.seq(function () {
    var subseq = Seq();
    this.args.forEach(function (item, index) {
      subseq.par(function () {
        fn.call(this, item, index);
      }).limit(limit);
    });
    this.apply(this, [null].concat(this.args));
  });
};

Seq.prototype.seqEach = function (fn) {
  return this.seq(function () {
    var self = this;
    var subseq = Seq();
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

Seq.prototype.parEach = function (limit, fn) {
  fn = maybe(fn).kindOf(Function).getOrElse(limit);
  limit = maybe(limit).kindOf(Number).getOrElse(Infinity);
  return this.seq(function () {
    var self = this;
    var subseq = Seq();
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

Seq.prototype.seqMap = function (fn) {
  return this.seq(function () {
    var self = this;
    var subseq = Seq();
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

Seq.prototype.parMap = function (limit, fn) {
  fn = maybe(fn).kindOf(Function).getOrElse(limit);
  limit = maybe(limit).kindOf(Number).getOrElse(Infinity);
  return this.seq(function () {
    var self = this;
    var subseq = Seq();
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

Seq.prototype.seqFilter = function (fn) {
  return this.seq(function () {
    var self = this;
    var subseq = Seq();
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

Seq.prototype.parFilter = function (limit, fn) {
  fn = maybe(fn).kindOf(Function).getOrElse(limit);
  limit = maybe(limit).kindOf(Number).getOrElse(Infinity);
  return this.seq(function () {
    var self = this;
    var subseq = Seq();
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

Seq.prototype.map = function (fn, thisArg) {
  thisArg = maybe(thisArg).getOrElse(fn);
  return this.seq(function () {
    this.apply(this, [null].concat(this.args.map(fn, thisArg)));
  });
};

Seq.prototype.filter = function (fn, thisArg) {
  thisArg = maybe(thisArg).getOrElse(fn);
  return this.seq(function () {
    this.apply(this, [null].concat(this.args.filter(fn, thisArg)));
  });
};

Seq.prototype.reduce = function (fn, initialValue) {
  return this.seq(function () {
    this.apply(this, [null].concat(this.args.reduce(fn, initialValue)));
  });
};

Seq.prototype.flatten = function (fully) {
  return this.seq(function () {
    this.apply(this, [null].concat(this.args.reduce(function reducer(a, b) {
      return a.concat(fully && b instanceof Array ? b.reduce(reducer, []):b);
    }, [])));
  });
};

Seq.prototype.unflatten = function () {
  return this.seq(function () {
    this.apply(this, [null, this.args]);
  });
};

Seq.prototype.extend = function (arr) {
  return this.seq(function () {
    this.apply(this, [null].concat(this.args, arr));
  });
};

Seq.prototype.set = function (arr) {
  return this.seq(function () {
    this.apply(this, [null].concat(arr));
  });
};

Seq.prototype.empty = function () {
  return this.seq(function () {
    this();
  });
};

Seq.prototype.push = function (/*args*/) {
  var args = Array.prototype.slice.call(arguments);
  return this.seq(function () {
    this.apply(this, [null].concat(this.args, args));
  });
};

Seq.prototype.pop = function () {
  return this.seq(function () {
    this.apply(this, [null].concat(this.args.slice(0, -1)));
  });
};

Seq.prototype.shift = function () {
  return this.seq(function () {
    this.apply(this, [null].concat(this.args.slice(1)));
  });
};

Seq.prototype.unshift = function (/*args*/) {
  var args = Array.prototype.slice.call(arguments);
  return this.seq(function () {
    this.apply(this, [null].concat(args, this.args));
  });
};

Seq.prototype.splice = function (index, howMany, toAppend) {
  toAppend = maybe(toAppend).kindOf(Array).getOrElse([toAppend]);
  return this.seq(function () {
    Array.prototype.splice.apply(this.args, [index, howMany].concat(toAppend));
    this.apply(this, [null].concat(this.args));
  });
};

Seq.prototype.reverse = function () {
  return this.seq(function () {
    this.apply(this, [null].concat(this.args.reverse()));
  });
};

Seq.prototype.debug = function () {
  var self = this;
  return this.seq(function () {
    this.apply(this, [null].concat(this.args));
    log('̲........................................');
    log('->FUN STACK:');
    log(ins(self.stack));
    log('->ARG STACK:');
    log(ins(self.args));
    log('........................................');
  });
};
