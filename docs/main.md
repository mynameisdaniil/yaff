YAFF (Yet Another Flow Framework)
=================================
**Author:** Daniil Sobol

**Overview:** This library is intended to replace unsupported and abandoned node-seq (https://github.com/substack/node-seq/). It tries to be as compatible as possible. But it doesn't copy some weird behaviour of original library. So, in some complex cases it can't be drop-in replacement and requires you to rewrite implementation-dependent code. This library is much more simple and optimised compared to original one. Piece of pure awesomeness, I'd say.

YAFF is an asynchronous flow control library with a chainable interface for sequential and parallel actions. Even the error handling is chainable. Each action in the chain operates on a stack of values. Unlike Seq YAFF doesn't have variables hash and operates on plain old arguments stack only, if you need to modify something please use map/filter methods.


Each method executes callbacks with a context (its ```this```) described in the next section. Every method returns ```this```.
Whenever ```this()``` is called with a non-falsy first argument, the error value propagates down to the first ```catch``` or ```finally``` block it sees, skipping over all actions in between. There is an implicit catch at the end of all chains that just throws error away.
.YAFF(initialStack=\[\])
------------------------
The constructor function creates a new ```YAFF``` chain with the methods described below. The optional array argument becomes the new context stack.


**Parameters**

**initialStack=[]**:  *Array*,  Initial stack of arguments

.seq(callback)
--------------
This eponymous function executes actions sequentially. Once all running parallel actions are finished executing, the supplied callback is ```apply()```'d with the context stack.
To execute the next action in the chain, call ```this()```. The first argument must be the error value. The rest of the values will become the stack for the next action in the chain and are also available at ```this.args```.


**Parameters**

**callback**:  *function*,  Function to be executed sequentially

.par(callback)
--------------
Use par to execute actions in parallel. Chain multiple parallel actions together and collect all the responses on the stack with a sequential operation like seq.
Each par sets one element in the stack with the second argument to ```this()``` in the order in which it appears, so multiple pars can be chained together.
Like with seq, the first argument to ```this()``` should be the error value and the second will get pushed to the stack.


**Parameters**

**callback**:  *function*,  Function to be executed in parallel

.finally(callback)
------------------
```finally``` does what you intended it to do. It is executed synchronously so, no need to call ```this()```. ```finally``` catches results as well as errors in nodejs manner, so first argument will be error and rest arguments are results. It's handly if you use YAFF inside asyncronous function like that:
```js
var myAsyncFunction = funtion(callback) {
YAFF()
.par(...)
.par(...)
.seq(...)
.finally(callback)
}
```


**Parameters**

**callback**:  *function*,  Function to be executed at the very end of the chain

