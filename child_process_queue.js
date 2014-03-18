var child_process = require('child_process');

function ChildProcessQueue() {
  this._limit = 10;
  this._queue = [];
  this._active = 0;
}

// Private methods

ChildProcessQueue.prototype._next = function _next(first_argument) {
  if (this._active >= this._limit) {
    return;
  }
  this._active++;


  var next = this._queue.shift();
  if (!next) {
    // end of queue
    return;
  }

  var self = this;
  child_process.exec(next.command, function(/* err, stdout, stderr */) {
    next.callback.apply(this, arguments);

    self._active--;
    self._next();
  });
};

// Public methods

ChildProcessQueue.prototype.exec = function exec(command, callback) {
  this._queue.push({
    command: command,
    callback: callback
  });

  this._next();

  return this;
};


ChildProcessQueue.prototype.setLimit = function setLimit(limit) {
  this._limit = limit;

  return this;
};

module.exports.Queue = ChildProcessQueue;