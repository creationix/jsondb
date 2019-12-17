# Simple database for storing JSON to disk.

## Install

```sh
npm install jsondb
```

## Usage

```js
const createDB = require('jsondb');

const db = createDB('db', '.txt');

db.put('level1', {
    name: "Level One", map: [
        0, 0, 0, 0,
        0, 1, 2, 0,
        1, 1, 1, 1
    ],
    attachment: "This goes in a different file",
}, (err) => {
    if (err) throw err;
    console.log("level1 saved.")

    db.get('level1', (err, data) => {
        if (err) throw err;
        console.log('level 1 loaded', data);
    });
});
```