YAFF (Yet Another Flow Framework)
=================================
**Author:** Daniil Sobol

**Overview:** This library is intended to replace unsupported and abandoned node-seq (https://github.com/substack/node-seq/). It tries to be as compatible as possible. But it doesn't copy some weird behaviour of original library. So, in some complex cases it can't be drop-in replacement and requires you to rewrite implementation-dependent code. This library is much more simple and optimised compared to original one. Piece of pure awesomeness, I'd say.

YAFF is an asynchronous flow control library with a chainable interface for sequential and parallel actions. Even the error handling is chainable. Each action in the chain operates on a stack of values. Unlike Seq YAFF doesn't have variables hash and operates on plain old arguments stack only, if you need to modify something please use map/filter methods.
Example:

```javascript
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
    if (e)
      throw e;
    log(sizes);
  });
```


Each method executes callbacks with a context (its `this`) described in the next section. Every method returns `this`.
Whenever `this()` is called with a non-falsy first argument, the error value propagates down to the `finally` block, skipping over all actions in between. There is an implicit `finally` at the end of all chains that just throws error away.
.YAFF(initialStack=\[\])
------------------------
The constructor function creates a new `YAFF` chain with the methods described below. The optional array argument becomes the new context stack.

.seq(callback)
--------------
This eponymous function executes actions sequentially. Once all running parallel actions are finished executing, the supplied callback is `apply()`d with the context stack.
To execute the next action in the chain, call `this()`. The first argument must be the error value. The rest of the values will become the stack for the next action in the chain and are also available at `this.args`.

.mseq([cb1, cb2, ...])
--------------
Acts just like multiple `seq` invocations, i.e. takes an array of callbacks and builds chain of `seq` steps like this: `.seq(cb1).seq(cb2).seq(...)`

.par(callback)
--------------
Use par to execute actions in parallel. Chain multiple parallel actions together and collect all the responses on the stack with a sequential operation like seq.
Each par sets one element in the stack with the second argument to ```this()``` in the order in which it appears, so multiple pars can be chained together.
Like with seq, the first argument to ```this()``` should be the error value and the second will get pushed to the stack.

.mpar([cb1, cb2, ...])
--------------
Acts just like multiple 'par' invocations, i.e. takes an array of callbacksnd builds chain of 'par' steps like this: '.par(cb1).par(cb2).par(...)'

.forEach(cb)
--------------
Sequentually executes callback for each argument in the stack. Does not wait for callbacks to finish and moves to the next step in the chain.

.seqEach(cb)
--------------
Sequentually executes callback for each argument in the stack. Does wait for callbacks to complete before moving to the next step. Does not modify arguments stack.

.seqMap(cb)
--------------
Sequentually maps callback to arguments stack. Waits for callbacks to comlete and passes their return values to the next step as new arguments stack.

.seqFilter(cb)
--------------
Sequentually calls callback on arguments stack to filter it. To accept current value you should call `this()` inside callback with falsy first argument and truly second.

.parEach/.parMap/.parFilter (cb, [limit])
--------------
This set of function ts just like previously explained seq family, but runs callbacks in parallel. Also, each of this methods takes optional second argument - limit. It limits number of simultaneously running parallel tasks.

.map/filter(cb, thisArg) .reduce(cb, initialValue)
--------------
Your beloved plain old synchronous functions to work on arguments stack as on array.

.pop/push/shift/unshift(value)
--------------
Same as before: synchronous functions to modify stack as array.

.extend(array)
--------------
Extends stack with new values from passed array.

.splice(index, howMany, toAppend)
--------------
Another function to modify stack as array. Works just regular `Array.prototype.splice`.

.reverse()
--------------
Reverses order of arguments on the stack

.flatten([fully])
--------------
Flattens stack. i.e. turns `[[[], []], [], []]` into `[, , , , , ...]`. Very useful in case where previous function returns array as its first argument, but you want to call some of the asynchronous iterators on the stack. If `fully` is truly - complitely flattens all nested arrays, otherwise - flattens just first level.

.unflatten()
--------------
Unflattens arguments stack into single array as first argument on the stack i.e. turns `[ , , , , , ...]` into `[ [ , , , , , , ...] ]`

.empty()
--------------
Empties stack.

.set(array)
--------------
Sets passed `array` as new stack.

.load/save([name])
--------------
Allows you to save and load stack of arguments in case you need to preserve it from cluttering by another step in the chain. `name` is optional. Default name is `_`. Saved stacks also avaliable inside callbacks by accessing `this.hash['name']`.

.finally(callback)
------------------
Finalizes the chain. Handles errors as well as results and fires provided callback in nodejs manner, so first argument becomes error (may be ```undefined``` if everything is ok) and the rest arguments are results (may be ```undefined``` too if there is an error). ```finally``` is a syncronous sequential action. You can only have one ```finally``` block per chain and it should be in the very end of it.

It's handly if you use it inside asyncronous functions like that:
```javascript
var myAsyncFunction = funtion(callback) {
YAFF()
.par(...)
.par(...)
.seq(...)
.finally(callback)
}
```
