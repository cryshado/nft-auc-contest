import { expect } from 'chai'
import * as fs from 'fs'
import BN from 'bn.js'
import {
    Builder,
    InternalMessage,
    CommonMessageInfo,
    CellMessage,
    Cell,
    toNano,
    Address
} from 'ton'
import { OutAction, SmartContract } from 'ton-contract-executor'
import { encodeAucStorage, MSG } from '../src/encoder'
import { getRandSigner } from '../src/utils'

function bocFileToTCell (filename: string): Cell {
    const file = fs.readFileSync(filename)
    return Cell.fromBoc(file)[0]
}

function queryId (): BN {
    return new BN(~~(Date.now() / 1000))
}

const TVM_EXIT_CODES = {
    OK: 0,
    lowBid: 1000,
    auctionInit: 1001,
    noTransfer: 1002,
    notMessage: 1003,
    notCancel: 1004,
    auctionEnd: 1005
}

describe('SmartContract main tests', () => {
    let smc: SmartContract

    const SELF_ADDR = getRandSigner()

    const MARKET_ADDR = getRandSigner()
    const MARKET_FEE_ADDR = getRandSigner()
    const ROYALTY_FEE_ADDR = getRandSigner()

    const NFT_ADDR = getRandSigner()
    const NFT_OWNER = getRandSigner()
    const DEPLOYER = MARKET_ADDR

    const MIN_BET_TON = 1
    const MAX_BID_TON = 100
    const END_AUC = ~~(Date.now() / 1000) + (60 * 60 * 24) // 24h

    const EMPTY_BODY = new CommonMessageInfo(
        { body: new CellMessage(new Builder().endCell()) }
    )

    beforeEach(async () => {
        const code = bocFileToTCell('./auto/code.boc')
        const data = encodeAucStorage(
            {
                mpFeesAddr: MARKET_FEE_ADDR,
                mpFeePercent: 1,
                royaltyFeeAddr: ROYALTY_FEE_ADDR,
                royaltyFeePercent: 5
            },
            {
                mminBid: toNano(MIN_BET_TON),
                mmaxBid: toNano(MAX_BID_TON),
                minStep: toNano(0.5),
                lastBid: toNano(0),
                endTime: END_AUC
            },
            MARKET_ADDR,
            NFT_ADDR
        )

        smc = await SmartContract.fromCell(code, data)

        // send first deploy msg
        await smc.sendInternalMessage(new InternalMessage({
            to: SELF_ADDR,
            from: DEPLOYER,
            value: toNano(0.1),
            bounce: true,
            body: EMPTY_BODY
        }))
    })

    describe('contract', () => {
        interface ISimpleResult {
            exit_code: number
            out: OutAction[]
        }

        async function placeBidsOrder (values: number[]): Promise<ISimpleResult[]> {
            const resultArr: ISimpleResult[] = []
            for (let i: number = 0; i < values.length; i += 1) {
                const result = await smc.sendInternalMessage(new InternalMessage({
                    to: SELF_ADDR,
                    from: getRandSigner(),
                    value: toNano(values[i]),
                    bounce: true,
                    body: EMPTY_BODY
                }))
                resultArr.push({ exit_code: result.exit_code, out: result.actionList })
            }
            return resultArr
        }

        async function simpleTransferNFT (): Promise<void> {
            const msg = MSG.nftOwnerAssigned(queryId(), NFT_OWNER)
            await smc.sendInternalMessage(new InternalMessage({
                to: SELF_ADDR,
                from: NFT_ADDR,
                value: toNano(0.1),
                bounce: true,
                body: new CommonMessageInfo({ body: new CellMessage(msg) })
            }))
        }

        it('1) simple transfer nft', async () => {
            const msg = MSG.nftOwnerAssigned(queryId(), NFT_OWNER)

            const result = await smc.sendInternalMessage(new InternalMessage({
                to: SELF_ADDR,
                from: NFT_ADDR,
                value: toNano(0.1),
                bounce: true,
                body: new CommonMessageInfo({ body: new CellMessage(msg) })
            }))

            const get = await smc.invokeGetMethod('get_nft_owner', [])
            const nftOwnerState = new Address(
                Number(get.result[0].toString()),
                new BN(get.result[1].toString()).toBuffer()
            )

            expect(nftOwnerState.toFriendly()).to.equal(NFT_OWNER.toFriendly())
            expect(result.exit_code).to.equals(TVM_EXIT_CODES.OK)
        })

        it('2) transfer nft from the wrong address', async () => {
            const msg = MSG.nftOwnerAssigned(queryId(), NFT_OWNER)

            const result = await smc.sendInternalMessage(new InternalMessage({
                to: SELF_ADDR,
                from: getRandSigner(),
                value: toNano(0.1),
                bounce: true,
                body: new CommonMessageInfo({ body: new CellMessage(msg) })
            }))

            const get = await smc.invokeGetMethod('get_nft_owner', [])
            const valueString = `${get.result[0].toString()}${get.result[1].toString()}`

            expect(valueString).to.equals('00' /* addr_none$00  */)
            expect(result.exit_code).to.equals(TVM_EXIT_CODES.auctionEnd)
        })

        it('3) nft transfer with the wrong op', async () => {
            const wrongOP = 12345
            const msg = MSG.nftOwnerAssigned(queryId(), NFT_OWNER, wrongOP)

            const result = await smc.sendInternalMessage(new InternalMessage({
                to: SELF_ADDR,
                from: getRandSigner(),
                value: toNano(0.1),
                bounce: true,
                body: new CommonMessageInfo({ body: new CellMessage(msg) })
            }))

            const get = await smc.invokeGetMethod('get_nft_owner', [])
            const valueString = `${get.result[0].toString()}${get.result[1].toString()}`

            expect(valueString).to.equal('00' /* addr_none$00  */)
            expect(result.exit_code).to.equals(TVM_EXIT_CODES.auctionEnd)
        })

        it('4) place bid, the contract has not yet init with a nft', async () => {
            const result = await smc.sendInternalMessage(new InternalMessage({
                to: SELF_ADDR,
                from: getRandSigner(),
                value: toNano(10),
                bounce: true,
                body: EMPTY_BODY
            }))

            expect(result.exit_code).to.equals(TVM_EXIT_CODES.auctionEnd)
        })

        it('5) transfer nft and simple place a bid', async () => {
            // for first transfer nft
            const msg = MSG.nftOwnerAssigned(queryId(), NFT_OWNER)
            await smc.sendInternalMessage(new InternalMessage({
                to: SELF_ADDR,
                from: NFT_ADDR,
                value: toNano(0.1),
                bounce: true,
                body: new CommonMessageInfo({ body: new CellMessage(msg) })
            }))

            // then try place a bid
            const result = await smc.sendInternalMessage(new InternalMessage({
                to: SELF_ADDR,
                from: getRandSigner(),
                value: toNano(10),
                bounce: true,
                body: EMPTY_BODY
            }))

            expect(result.exit_code).to.equal(TVM_EXIT_CODES.OK)
        })

        it('6) place bids in order', async () => {
            await simpleTransferNFT()

            const results = await placeBidsOrder([ 10, 15, 30 ])
            results.forEach((res, i: number) => {
                if (i > 0) {
                    expect(res.out.length).to.equals(1)
                    expect(res.out[0].type).to.equal('send_msg')
                    const checkCase = <any>res.out[0]
                    expect(checkCase.mode).to.equals(2 /* send mode must be 2 */)
                } else {
                    expect(res.out.length).to.equals(0)
                }
                expect(res.exit_code).to.equal(TVM_EXIT_CODES.OK)
            })
        })

        it('7) place bids in incorrect order', async () => {
            await simpleTransferNFT()
            const result = await placeBidsOrder([ 10, 5 ])

            expect(result.length).to.equals(2)
            expect(result[1].out.length).to.equals(1)
            expect(result[1].out[0].type).to.equals('send_msg')
            const checkCase = <any>result[1].out[0]
            expect(checkCase.mode).to.equals(64)
        })

        it('8) a bid with instant redemption (the first bid at once)', async () => {
            await simpleTransferNFT()
            const result = await placeBidsOrder([ MAX_BID_TON ])

            expect(result[0].out.length).to.equals(5)
            const modes: number[] = [ 2, 3, 3, 0, 128 ]
            const types: string[] = [ 'send_msg', 'send_msg', 'send_msg', 'reserve_currency', 'send_msg' ]

            result[0].out.forEach((e, i: number) => {
                const msgo = <any>e
                expect(msgo.mode).to.equals(modes[i])
                expect(msgo.type).to.equals(types[i])
            })
        })

        it('9) a bid with instant redemption (when there were already bids)', async () => {
            await simpleTransferNFT()

            const result = await placeBidsOrder([ 10, 50, MAX_BID_TON ])

            expect(result[2].out.length).to.equals(6)
            const modes: number[] = [ 2, 2, 3, 3, 0, 128 ]
            const types: string[] = [ 'send_msg', 'send_msg', 'send_msg', 'send_msg', 'reserve_currency', 'send_msg' ]

            result[2].out.forEach((e, i: number) => {
                const msgo = <any>e
                expect(msgo.mode).to.equals(modes[i])
                expect(msgo.type).to.equals(types[i])
            })
        })

        it('10) bid with the end of time', async () => {
            await simpleTransferNFT()
            smc.setUnixTime(END_AUC + 1)

            const result = await placeBidsOrder([ 50 ])

            const modes: number[] = [ 64, 2, 3, 3, 0, 128 ]
            const types: string[] = [ 'send_msg', 'send_msg', 'send_msg', 'send_msg', 'reserve_currency', 'send_msg' ]

            expect(result[0].exit_code).to.equals(TVM_EXIT_CODES.OK)
            result[0].out.forEach((e, i: number) => {
                const msgo = <any>e
                expect(msgo.mode).to.equals(modes[i])
                expect(msgo.type).to.equals(types[i])
            })
        })

        it('11) try to bet less than the minimum bet', async () => {
            await simpleTransferNFT()
            const result = await placeBidsOrder([ MIN_BET_TON - 0.1 ])
            expect(result[0].exit_code).to.equals(TVM_EXIT_CODES.lowBid)
        })

        it('12) bid in increments less than in the contract', async () => {
            await simpleTransferNFT()
            const result = await placeBidsOrder([ 2, 2.09 ])

            expect(result[1].exit_code).to.equals(TVM_EXIT_CODES.OK)
            expect(result[1].out.length).to.equals(1)
            expect(result[1].out[0].type).to.equals('send_msg')
            const msgo = <any>result[1].out[0]
            expect(msgo.mode).to.equals(64)
        })
    })

    after(() => { setTimeout(() => { process.exit(0) }, 2500) })
})
