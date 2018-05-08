import web3Utils = require('web3-utils')

export const enhanceAbiItem = (item) => {
  const fullName = web3Utils._jsonInterfaceMethodToString(item)
  const signature = web3Utils.sha3(fullName)
  const shortId = signature.substr(0, 10)

  return {
    ...item,
    fullName,
    signature,
    shortId,
  }
}

export const timeout = async (ms: number = 1000) =>
  new Promise((resolve) =>
    setTimeout(resolve, ms))
