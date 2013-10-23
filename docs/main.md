YAFF (Yet Another Flow Framework)
=================================
**Author:** Daniil Sobol

**Overview:** This library is intended to replace unsupported and abandoned node-seq. It tries to be as compatible as possible. But it doesn't copy some weird behaviour of original library. So in some complex cases it can't be drop-in replacement and requires you to rewrite implementation-dependent code. This library is much more simple and optimised compared to original one. Piece of pure awesomeness, I'd say.

YAFF is an asynchronous flow control library with a chainable interface for sequential and parallel actions. Even the error handling is chainable. Each action in the chain operates on a stack of values. There is also a variables hash for storing values by name; hash persists across all requests unless it is overwritten.


