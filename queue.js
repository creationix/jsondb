module.exports = Queue;
function Queue() {
  this.tail = [];
  this.head = [];
  this.offset = 0;
}

Queue.prototype.normalize = function () {
  if (this.offset === this.head.length) {
    var tmp = this.head;
    tmp.length = 0;
    this.head = this.tail;
    this.tail = tmp;
    this.offset = 0;
  }
}

Queue.prototype.shift = function shift() {
  this.normalize();
  if (this.head.length === 0) {
    return;
  }
  return this.head[this.offset++]; // sorry, JSLint
};

Queue.prototype.first = function first() {
  this.normalize();
  return this.head[this.offset];
};

Queue.prototype.last = function last() {
  return this.tail.length ? this.tail[this.tail.length - 1]: this.head[this.head.length - 1];
};

Queue.prototype.push = function push(item) {
  return this.tail.push(item);
};

Object.defineProperty(Queue.prototype, "length", {
  get: function () {
    return this.head.length - this.offset + this.tail.length;
  }
});

