import abi = require('web3-eth-abi')

import BlockStream from './Blockstream'
import { IJSONBlock } from './Models'
import NodeApi from './NodeApi'

const AVERAGE_BLOCK_TIME = 15 * 1000  // millis (technically it's 14.4 but whatever)

import {
  enhanceAbiItem,
  timeout,
} from './utils'

class Watcher {

  private api: NodeApi
  private streamer: BlockStream
  private abis: any[] = []

  constructor (
    private nodeEndpoint: string = 'http://127.0.0.1:8545',
    abis: any[] = [],
    private confidenceThreshold: number = 2, // how many blocks to wait before assuming a tx is actually included
    private updateInterval: number = 5000, // ms to update blockstreamer
  ) {
    this.abis = abis.map(enhanceAbiItem)
    this.api = new NodeApi(nodeEndpoint)
    this.streamer = new BlockStream(this.api, confidenceThreshold, updateInterval)
    this.streamer.start()
  }

  public async scry (
    txHash: string,
    eventName: string,
    timeoutMs: number = AVERAGE_BLOCK_TIME * 10,
  ) {
    const start = new Date()
    return new Promise(async (resolve, reject) => {
      let concede
      const handleBlock = async (block: IJSONBlock) => {
        // every time we get one, check to see if it has the
        //  transaction receipt that we care about
        for (const tx of block.transactions) {
          if (tx.hash === txHash) {
            // we got it!

            const receipt = await this.api.getTransactionReciept(txHash)
            for (const log of receipt.logs) {
              const match = this.matchLogToAbi(log)
              if (match) {
                resolve(match)
                concede()
              }
            }
          }
        }
      }

      let running = true
      concede = () => {
        this.streamer.removeListener('block', handleBlock)
        running = false
      }
      // start listening for blocks
      this.streamer.on('block', handleBlock)

      // also start checking for timeouts
      while (running) {
        await timeout(100)
        const now = new Date()
        if ((+now - +start) > timeoutMs) {
          reject(new Error('TIMEOUT_REACHED'))
          concede()
        }
      }
    })
  }

  /**
   * stop watching blocks
   */
  public stop () {
    this.streamer.stop()
  }

  private matchLogToAbi = (log) => {
    if (log.topics.length === 0) { return null }
    // ^ there are no topics, which means this is an anonymous event or something

    // the first argument in topics (from solidity) is always the event signature
    const eventSig = log.topics[0]

    // find the inputs by signature
    const logAbiItem = this.abis.find((item) => item.signature === eventSig)
    if (logAbiItem === undefined) {
      // ^ we don't have an input that matches this event (incomplete ABI?)
      return null
    }

    const args = abi.decodeLog(
      logAbiItem.inputs,
      log.data,
      log.topics.slice(1),
      // ^ ignore the signature
    )

    return {
      ...log,
      ...logAbiItem,
      args,
    }
  }
}

export default Watcher
