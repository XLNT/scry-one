# scry-one

> A Magic the Gathering themed ethereum event awaiter that supports confirmations and is very resilient against geth/parity irregularities.

## Usage

```bash
npm install --save @xlnt/scry-one
```

```js
new Watcher(
    'http://127.0.0.1:8545',  // your node url
    [/* An array of ABIs that you might be searching against. */],
    2,   // how many confirmations do you need?
    500  // the interval with which you'd like to poll your node
)
```

and then give it a txHash somehow

```js
const log = await watcher.scry(txHash, 'MyEvent')

console.log(`
    Found log:      ${log.fullName}
    with arguments: ${JSON.stringify(log.args)}
    in txHash:      ${txHash}
`)
```

... that's about it.

See [examples/test.js](examples/test.js) for more info.


