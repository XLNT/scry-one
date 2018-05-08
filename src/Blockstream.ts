import 'isomorphic-fetch'

import { EventEmitter } from 'events'

import {
  Block as BlockstreamBlock,
  BlockAndLogStreamer,
  Log as BlockstreamLog,
} from 'ethereumjs-blockstream'

import {
  IJSONBlock,
  IJSONLog,
} from './Models'

class BlockStream extends EventEmitter {
  private streamer: BlockAndLogStreamer<IJSONBlock, IJSONLog>

  private onBlockAddedSubscriptionToken
  private onBlockRemovedSubscriptionToken
  private reconciling

  private blockHistory: IJSONBlock[] = []
  private announced: { [_: string]: boolean } = {}

  constructor (
    private api: any,
    private confidenceThreshold: number = 2,
    private interval: number = 5000,
  ) {
    super()

    this.streamer = new BlockAndLogStreamer(
      this.api.getBlockByHash,
      this.api.getLogs,
      {
        blockRetention: this.confidenceThreshold * 2,
      },
    )
  }

  public start = () => {
    this.onBlockAddedSubscriptionToken = this.streamer.subscribeToOnBlockAdded(this.onBlockAdd)
    this.onBlockRemovedSubscriptionToken = this.streamer.subscribeToOnBlockRemoved(this.onBlockInvalidated)

    this.beginTracking()
  }

  public stop = () => {
    clearInterval(this.reconciling)
    this.streamer.unsubscribeFromOnBlockAdded(this.onBlockAddedSubscriptionToken)
    this.streamer.unsubscribeFromOnBlockRemoved(this.onBlockRemovedSubscriptionToken)
  }

  private onBlockAdd = async (block: IJSONBlock) => {
    // shift the blockHistory window
    this.blockHistory.push(block)
    // once a block is confidenceThreshold blocks old, we notify consumers
    const hasEnoughHistory = this.blockHistory.length > this.confidenceThreshold
    if (hasEnoughHistory) {
      // the oldest block here is old enough, so let's shift it off and announce it
      const confidentBlock = this.blockHistory.shift()
      this.emit('block', confidentBlock)
    }
  }

  private onBlockInvalidated = (block: IJSONBlock) => {
    const popped = this.blockHistory.pop()
    if (popped.hash !== block.hash && this.blockHistory.length) {
      // if we pop a block in the wrong order, that's an invariant
      // unless it was the previous head block and we happened to get a reorg without enough
      // history to know
      throw new Error('Popped blocks in the wrong order oh no!')
    }
  }

  private beginTracking = () => {
    // @TODO - replace this with a filter
    this.reconciling = setInterval(async () => {
      await this.streamer.reconcileNewBlock(await this.api.getLatestBlock())
    }, this.interval)
  }
}

export default BlockStream
