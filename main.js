/**
 * @title YAFF (Yet Another Flow Framework)
 * @author Daniil Sobol
 * @license MIT
 * @overview This library is intended to replace unsupported and abandoned node-seq (https://github.com/substack/node-seq/). It tries to be as compatible as possible. But it doesn't copy some weird behaviour of original library. So, in some complex cases it can't be drop-in replacement and requires you to rewrite implementation-dependent code. This library is much more simple and optimised compared to original one. Piece of pure awesomeness, I'd say.
 * YAFF is an asynchronous flow control library with a chainable interface for sequential and parallel actions. Even the error handling is chainable. Each action in the chain operates on a stack of values. Unlike Seq YAFF doesn't have variables hash and operates on plain old arguments stack only, if you need to modify something please use map/filter methods.
 * Example:
 *
  var fs = require('fs');
  YAFF(['./', '../'])
    .par(function (path) {
      fs.readdir(path, this);
    })
    .par(function (path) {
      fs.readdir(path, this);
    })
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
 **/

/*global maybe:true*/
var maybe = require('maybe2');
var ins   = require('util').inspect;
var log   = console.log;
var slice = Array.prototype.slice.call.bind(Array.prototype.slice);

const PAR = 'par';
const SEQ = 'seq';
const FIN = 'fin';


/**
 * @module
 *
 * Each method executes callbacks with a context (its ```this```) described in the next section. Every method returns ```this```.
 * Whenever ```this()``` is called with a non-falsy first argument, the error value propagates down to the ```finally``` block, skipping over all actions in between. There is an implicit ```finally``` at the end of all chains that just throws error away.
 */


/**
 * @function YAFF
 * @param {Array} initialStack=[] Initial stack of arguments
 * The constructor function creates a new ```YAFF``` chain with the methods described below. The optional array argument becomes the new context stack.
 */
var YAFF = module.exports = function YAFF(initialStack) {
  if (!(this instanceof YAFF))
    return new YAFF(initialStack);
  var self = this;
  this.stack = [];
  this.queue = [];
  this.fin;
  this.lastError;
  this.concurrencyLevel = 0;
  this.args = maybe(initialStack).is(Array).getOrElse([]);
  process.nextTick(function waitForStack() {
    if (self.stack.length)
      self.conveyor();
    else
      setImmediate(waitForStack);
  });
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
      var ret = slice(arguments, 1);
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
    return function () {
      currItem.fn.apply(cb, args);
    };
  })(cb, self.args.slice()));
};

YAFF.prototype.errHandler = function (e) {
  this.stack = [];
  if (this.fin)
    this.finHandler(e);
  else
    throw e;
};

YAFF.prototype.finHandler = function (e) {
  e = maybe(e).getOrElse(this.lastError);
  this.fin.apply(this.fin, [].concat(e, e ? undefined:this.args));
};


//Interface methods--------------------------------------------------------------------------------------------------------------------------

/**
 * This eponymous function executes actions sequentially. Once all running parallel actions are finished executing, the supplied callback is ```apply()```'d with the context stack.
 * To execute the next action in the chain, call ```this()```. The first argument must be the error value. The rest of the values will become the stack for the next action in the chain and are also available at ```this.args```.
 * @param {function} callback Function to be executed sequentially
 * */
YAFF.prototype.seq = function (fn) {
  this.stack.push({fn: fn, type: SEQ});
  return this;
};

YAFF.prototype.seq_ = function (fn) {
  var args = slice(arguments, 1);
  return this.seq(function () { fn.apply(fn, (args.length ? args:this.args).concat(this)); });
};

/**
 * Use par to execute actions in parallel. Chain multiple parallel actions together and collect all the responses on the stack with a sequential operation like seq.
 * Each par sets one element in the stack with the second argument to ```this()``` in the order in which it appears, so multiple pars can be chained together.
 * Like with seq, the first argument to ```this()``` should be the error value and the second will get pushed to the stack.
 * @param {function} callback Function to be executed in parallel
 * */
YAFF.prototype.par = function (fn) {
  if (this.stack.length && this.stack[this.stack.length - 1].type == PAR)
    this.stack.push({fn: fn, type: PAR, position: this.stack[this.stack.length - 1].position + 1});
  else
    this.stack.push({fn: fn, type: PAR, position: 0});
  return this;
};

YAFF.prototype.par_ = function (fn) {
  var args = slice(arguments, 1);
  return this.par(function () { fn.apply(fn, (args.length ? args:this.args).concat(this)); });
};

/**
 * Finalizes the chain. Handles errors as well as results and fires provided callback in nodejs manner, so first argument becomes error (may be ```undefined``` if everything is ok) and the rest arguments are results (may be ```undefined``` too if there is an error). ```finally``` is a syncronous sequential action. You can only have one ```finally``` block per chain and it should be in the very end of it.
 *
 * It's handly if you use it inside asyncronous functions like that:
 * ```javascript
 * var myAsyncFunction = funtion(callback) {
 *      YAFF()
 *        .par(...)
 *        .par(...)
 *        .seq(...)
 *        .finally(callback)
 * }
 * ```
 * @param {function} callback Function to be executed at the very end of the chain
 */
YAFF.prototype.finally = function (fn) {
  this.stack.push({fn: this.fin = fn, type: FIN});
  return undefined;
};

YAFF.prototype.limit = function (limit) {
  if (this.stack.length)
    this.stack[this.stack.length - 1].limit = limit;
  return this;
};

YAFF.prototype.iterate = function (method, fn, limit) {
  limit = maybe(limit).is(Number).getOrElse(Infinity);
  this.args.forEach(function (item, index, args) {
    method.call(this, function () { fn.call(this, item, index, args, this); }).limit(limit);
  }, this);
  return this;
};

YAFF.prototype.forEach = function (fn, limit) {
  return this.seq(function () {
    YAFF(this.args).iterate(YAFF.prototype.par, fn, limit).finally(this);//TODO pass errors to main chain
    this.apply(this, [null].concat(this.args));
  });
};

YAFF.prototype.seqEach = function (fn) {
  return this.seq(function () {
    YAFF(this.args).iterate(YAFF.prototype.seq, fn).set(this.args).finally(this);
  });
};

YAFF.prototype.parEach = function (fn, limit) {
  return this.seq(function () {
    YAFF(this.args).iterate(YAFF.prototype.par, fn, limit).set(this.args).finally(this);
  });
};

YAFF.prototype.seqMap = function (fn) {
  return this.seq(function () {
    var stack = [];
    YAFF(this.args).iterate(YAFF.prototype.seq, function (item, index, args, cb) {
        fn.call(function (e, ret) {
          cb(e, stack.push(ret));
        }, item, index, args);
      }).set(stack).finally(this);
  });
};

YAFF.prototype.parMap = function (fn, limit) {
  return this.seq(function () {
    YAFF(this.args).iterate(YAFF.prototype.par, fn, limit).finally(this);
  });
};

YAFF.prototype.seqFilter = function (fn) {
  return this.seq(function () {
    var stack = [];
    YAFF(this.args).iterate(YAFF.prototype.seq, function (item, index, args, cb) {
        fn.call(function (e, ret) {
          if (ret && !e)
            stack.push(item);
          cb();
        }, item, index, args);
      }).set(stack).finally(this);
  });
};

YAFF.prototype.parFilter = function (fn, limit) {
  return this.seq(function () {
    var stack = [];
    YAFF(this.args).iterate(YAFF.prototype.par, function (item, index, args, cb) {
        fn.call(function (e, ret) {
          if (ret && !e)
            stack.push(item);
          cb();
        }, item, index, args);
      }, limit).set(stack).finally(this);
  });
};

YAFF.prototype.map = function (fn, thisArg) {
  return this.seq(function () {
    this.apply(this, [null].concat(this.args.map(fn, maybe(thisArg).getOrElse(fn))));
  });
};

YAFF.prototype.filter = function (fn, thisArg) {
  return this.seq(function () {
    this.apply(this, [null].concat(this.args.filter(fn, maybe(thisArg).getOrElse(fn))));
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
  return this.seq(function () {//TODO seq -> seq_
    this.apply(this, [null].concat(this.args, slice(arguments)));
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
  return this.seq(function () {
    this.apply(this, [null].concat(slice(arguments), this.args));
  });
};

YAFF.prototype.splice = function (index, howMany, toAppend) {
  return this.seq(function () {
    Array.prototype.splice.apply(this.args, [index, howMany].concat(maybe(toAppend).is(Array).getOrElse([toAppend])));
    this.apply(this, [null].concat(this.args));
  });
};

YAFF.prototype.reverse = function () {
  return this.seq(function () {
    this.apply(this, [null].concat(this.args.reverse()));
  });
};

YAFF.prototype.dummy = function () {
  return this.seq(function () {
    this.apply(this, [null].concat(this.args));
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
