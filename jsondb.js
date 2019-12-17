const { resolve } = require('path');
const { statSync, mkdirSync, readdir, readFile, writeFile } = require('fs');
const { EventEmitter } = require('events');
const Queue = require('./queue');
module.exports = createDB;

function createDB(root, attachmentExtension) {

  root = resolve(process.cwd(), root);

  // Make sure we have a directory to work with
  let stat;
  try {
    stat = statSync(root);
  } catch (err) {
    // try to create it if it's not there
    if (err.code === "ENOENT") {
      mkdirSync(root);
      stat = statSync(root);
    } else {
      throw err;
    }
  }
  if (!stat.isDirectory()) {
    throw new Error("Path " + root + " is not a directory.");
  }

  const locks = {};

  const db = new EventEmitter();

  db.get = async (path, callback) => {
    let queue = locks[path];

    // If a read happens in locked state...
    if (queue) {
      const last = queue.last()
      // ...and last in queue is read batch, add to it
      if (last.read) {
        //      console.log("Read on locked cell - batched");
        last.batch.push(callback);
        return;
      }
      //      console.log("Read on locked cell");
      // ...else append a new read batch
      queue.push({ read: true, path: path, batch: [callback] });
      return;
    };

    //    console.log("Read on idle cell");
    // .. otherwise lock state, create a read batch, and process queue
    locks[path] = queue = new Queue();
    queue.push({ read: true, path: path, batch: [callback] });
    processQueue(path);
  };

  db.put = (path, data, callback) => {
    let queue = locks[path];

    const write = { write: true, path: path, data: data, callback: callback };

    // If write happens in locked state...
    if (queue) {
      //      console.log("Write on locked cell")
      queue.push(write);
      return
    }

    //    console.log("Write on idle cell")
    // otherwise lock state, create write transaction and process queue
    locks[path] = queue = new Queue();
    queue.push(write);
    processQueue(path);

  };

  return db;

  /////////////////////////////////////////////

  function processQueue(path) {
    const queue = locks[path];
    const next = queue.first();

    // If queue is empty, put in idle state
    if (!next) {
      //      console.log("Unlocking " + path);
      delete locks[path];
      db.emit("unlock", path);

      return;
    }

    // If next is read, kick off read
    if (next.read) {
      //      console.log("Process read " + next.path);
      get(next.path);
      return
    }

    // If next is write, kick off write
    if (next.write) {
      //      console.log("Process write " + next.path);
      put(next.path, next.data);
      return;
    }

    throw new Error("Invalid item");
  }

  function onReadComplete(path, err, data) {
    //    console.log("Read finished " + path);
    const queue = locks[path];
    const read = queue.shift();
    if (!(read.read && read.path === path)) {
      throw new Error("Corrupted queue " + path);
    }
    const batch = read.batch;

    // process queue
    processQueue(path);

    // When read finishes, get batch from queue and process it.
    for (let i = 0, l = batch.length; i < l; i++) {
      batch[i](err, data);
    }

  }

  function onWriteComplete(path, err) {
    //    console.log("Write finished " + path);
    const queue = locks[path];
    const write = queue.shift();
    if (!(write.write && write.path === path)) {
      throw new Error("Corrupted queue " + path);
    }

    processQueue(path);

    write.callback(err);

    db.emit("change", path, write.data);

  }

  // Lists entries in a folder
  function list(path) {
    readdir(resolve(root, path), (err, files) => {
      if (err) return onReadComplete(path, err);
      const entries = [];
      files.forEach((file) => {
        const i = file.length - 5;
        if (file.substr(i) === ".json") {
          entries.push(file.substr(0, i));
        }
      });
      onReadComplete(path, null, entries);
    });
  }


  // Load an entry
  function get(path) {
    const jsonPath = resolve(root, path + ".json");
    readFile(jsonPath, (err, json) => {
      if (err) {
        if (err.code === "ENOENT") {
          return list(path);
        }
        return onReadComplete(path, err);
      }
      let data;
      try {
        data = JSON.parse(json);
      } catch (err) {
        return onReadComplete(path, new Error("Invalid JSON in " + jsonPath + "\n" + err.message));
      }
      const attachmentPath = resolve(root, path + attachmentExtension);
      readFile(attachmentPath, 'utf8', (err, attachment) => {
        if (err) {
          if (err.code !== "ENOENT") {
            return onReadComplete(path, err);
          }
        } else {
          data.attachment = attachment;
        }
        onReadComplete(path, null, data);
      });
    });
  }

  // Put an entry
  function put(path, data) {
    let json;
    if (data.hasOwnProperty("attachment")) {
      Object.defineProperty(data, "attachment", { enumerable: false });
      json = JSON.stringify(data);
      Object.defineProperty(data, "attachment", { enumerable: true });
    } else {
      json = JSON.stringify(data);
    }
    const jsonPath = resolve(root, path + ".json");
    writeFile(jsonPath, json, (err) => {
      if (err) return onWriteComplete(path, err);
      if (data.hasOwnProperty("attachment")) {
        const attachmentPath = resolve(root, path + attachmentExtension);
        writeFile(attachmentPath, data.attachment, (err) => {
          onWriteComplete(path, err);
        });
        return;
      }
      onWriteComplete(path);
    });
  }


}


