require('dotenv').config()

const Watcher = require('../lib').default

const Web3 = require('web3')
const HDWalletProvider = require('truffle-hdwallet-provider')
const web3 = new Web3(
  new HDWalletProvider(
    process.env.MNEMONIC,
    'http://127.0.0.1:8545'
  )
)

const EventContractArtifact = require('./EventContract.json')

let watcher
let stopMining
const main = async () => {

  stopMining = setInterval(() => {
    web3.currentProvider.sendAsync({
      jsonrpc: '2.0',
      method: 'evm_mine',
      id: +(new Date()),
    }, () => {})
  }, 1000)

  // important:
  watcher = new Watcher(
    'http://127.0.0.1:8545',
    EventContractArtifact.abi,
    7,
    500
  )

  const me = (await web3.eth.getAccounts())[0]
  // deploy a new contract
  const Event = new web3.eth.Contract(
    EventContractArtifact.abi,
    {
      data: EventContractArtifact.bytecode
    }
  )

  const event = await Event.deploy().send({
    from: me
  })

  // schedule an event to be send in the future
  const txHash = await new Promise((resolve) => {
    setTimeout(async () => {
      emitTx = event.methods.emitEvent('TEST').send({ from: me })
      const txHash = await new Promise((resolve) => {
        emitTx.on('transactionHash', resolve)
      })

      emitTx.on('confirmation', (confirmation, receipt) => {
        console.log('confirmations:', confirmation)
      })

      resolve(txHash)
    }, 1000);
  })

  try {
    console.log(`Watching txHash ${txHash} for MyEvent('TEST')`)
    // important:
    const log = await watcher.scry(txHash, 'MyEvent')

    console.log(`
      Found log:      ${log.fullName}
      with arguments: ${JSON.stringify(log.args)}
      in txHash:      ${txHash}
    `)
  } catch (error) {
    console.error(error)
    console.log('The scry command failed, which is most likely because the event did not arrive in time.')
  }

  gracefulExit()
}

process.on('unhandledRejection', (error) => {
  console.error(error)
  process.exit(1)
})

const gracefulExit = async () => {
  watcher.stop()
  clearInterval(stopMining)
  process.exit(0)
}

process.on('SIGINT', gracefulExit)
process.on('SIGTERM', gracefulExit)

main()
  .catch((error) => {
    console.error(error, error.stack)
    process.exit(1)
  })
