var util = require('util');

var Seq = module.exports = function Seq() {
  if (this instanceof Seq) {
    console.log('Constructor called');
    this.stack = [];
    this.args = [];
    this.concurencyLevel = 0;
    setImmediate((function (stack, args, concurencyLevel) {
      return function () {
        conveyor(stack, args, null, concurencyLevel);
      };
    })(this.stack, this.args, this.concurencyLevel));
  } else {
    return new Seq();
  }
};

var conveyor = function (stack, args, error, concurencyLevel) {
  var currItem = stack.shift();
  if (currItem) {
    console.log('-------------------------------------');
    currItem.handler(currItem.fn, stack, args, conveyor, concurencyLevel);
  }
};

Seq.prototype.seq = function (fn) {
  console.log('seq');
  this.stack.push({fn: fn, handler: seqExecutor});
  console.log(util.inspect(this.stack));
  return this;
};

Seq.prototype.par = function (fn) {
  console.log('par');
  this.stack.push({fn: fn, handler: parExecutor});
  console.log(util.inspect(this.stack));
  return this;
};

Seq.prototype.catch = function (fn) {
  console.log('catch');
  this.stack.push({fn: fn, handler: errHandler});
  console.log(util.inspect(this.stack));
  return this;
};

var seqExecutor = function (fn, stack, args, conveyor) {
  console.log('seqExecutor');
  var cb = function (e) {
    console.log('seq callback called');
    if (e) {
      //TODO GOTO first visible error handler
    } else {
      var ret = Array.prototype.slice.call(arguments);
      ret.shift();
      args = [];
      args.concat(ret);
    }
    setImmediate((function (stack, args, e) {
      return function () {
        conveyor(stack, args, e);
      };
    })(stack, args, e));
  };
  args.push(cb);
  fn.apply(cb, args);
};

var parExecutor = function (fn, stack, args, conveyor, concurencyLevel) {
  console.log('parExecutor');
  concurencyLevel++;
  var cb = function (e) {
    concurencyLevel--;
    if (e) {
      //TODO GOTO first visible error handler
    } else {
      var ret = Array.prototype.slice.call(arguments);
      ret.shift();
      args.concat(ret);
    }
    if (!concurencyLevel)
      setImmediate((function (stack, args, e) {
        return function () {
          conveyor(stack, args, e);
        };
      })(stack, args, e));
  };
  args.push(cb);
  setImmediate((function (cb, args) {
    return function () {
      fn.apply(cb, args);
    };
  })(cb, args));
  if (stack[0].handler == parExecutor)
    conveyor(stack, args, null);
};

var errHandler = function (fn, stack, args, conveyor) {
};
