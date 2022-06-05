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

    const MAX_BID_TON = 100

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
                mminBid: toNano(1),
                mmaxBid: toNano(MAX_BID_TON),
                minStep: toNano(0.1),
                lastBid: toNano(0),
                endTime: ~~(Date.now() / 1000) + (60 * 60 * 24) // 24h
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

        it('6.1) place bids in incorrect order', async () => {
            await simpleTransferNFT()
            const result = await placeBidsOrder([ 10, 5 ])

            expect(result.length).to.equals(2)
            expect(result[1].out.length).to.equals(1)
            expect(result[1].out[0].type).to.equals('send_msg')
            const checkCase = <any>result[1].out[0]
            expect(checkCase.mode).to.equals(64)
        })

        it('7) a bid with instant redemption (the first bid at once)', async () => {
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
    })

    // after(() => { process.exit(0) })
})
