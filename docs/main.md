YAFF (Yet Another Flow Framework)
=================================
**Author:** Daniil Sobol

**Overview:** This library is intended to replace unsupported and abandoned node-seq. It tries to be as compatible as possible. But it doesn't copy some weird behaviour of original library. So in some complex cases it can't be drop-in replacement and requires you to rewrite implementation-dependent code. This library is much more simple and optimised compared to original one. Piece of pure awesomeness, I'd say.

YAFF is an asynchronous flow control library with a chainable interface for sequential and parallel actions. Even the error handling is chainable. Each action in the chain operates on a stack of values. Unlike Seq YAFF doesn't have variables hash and operates on plain old arguments stack only, so if you need to modify something please use map/filter methods.


