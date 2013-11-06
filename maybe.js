var Type = require('type-of-is');

module.exports = function __maybe(value) {
  var obj = null;
  function isEmpty() { return value === undefined || value === null; }
  function nonEmpty() { return !isEmpty(); }
  function is(type) { return Type.is(value, type); }
  obj = {
    map: function (f) { return isEmpty() ? obj : __maybe(f(value)); },
    getOrElse: function (n) { return isEmpty() ? n : value; },
    is: function (type) { return is(type) ? obj : __maybe(); },
    isEmpty: isEmpty,
    nonEmpty: nonEmpty,
  };
  return obj;
};
