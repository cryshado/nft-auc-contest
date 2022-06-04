import { expect } from 'chai'
import {
    Builder,
    InternalMessage,
    CommonMessageInfo,
    CellMessage,
    Cell,
    toNano,
    Address
} from 'ton'
import * as fs from 'fs'
import { SmartContract } from 'ton-contract-executor'
import { BN } from 'bn.js'
import { encodeAucStorage, encodeNFTOwnershipAssigned } from '../src/encoder'
import { getRandSigner } from '../src/utils'

function bocFileToTCell (filename: string): Cell {
    const file = fs.readFileSync(filename)
    return Cell.fromBoc(file)[0]
}

describe('SmartContract main tests', () => {
    let smc: SmartContract

    const SELF_ADDR = getRandSigner()

    const marketAddress = getRandSigner()
    const marketFeesAddress = getRandSigner()
    const royaltyFeeAddress = getRandSigner()
    const nftAddress = getRandSigner()

    const nftOwner = getRandSigner()
    const deployer = marketAddress

    beforeEach(async () => {
        const code = bocFileToTCell('./auto/code.boc')
        const data = encodeAucStorage(
            {
                mpFeesAddr: marketFeesAddress,
                mpFeePercent: 1,
                royaltyFeeAddr: royaltyFeeAddress,
                royaltyFeePercent: 5
            },
            {
                mminBid: toNano(0.1),
                mmaxBid: toNano(100),
                minStep: toNano(0.1),
                endTime: ~~(Date.now() / 1000) + (60 * 60 * 24) // 24h
            },
            marketAddress,
            nftAddress
        )

        smc = await SmartContract.fromCell(code, data)

        // send first deploy msg
        await smc.sendInternalMessage(new InternalMessage({
            to: SELF_ADDR,
            from: deployer,
            value: toNano(0.1),
            bounce: true,
            body: new CommonMessageInfo({ body: new CellMessage(new Builder().endCell()) })
        }))
    })

    describe('contract', () => {
        it('check new nft owner with OwnershipAssigned', async () => {
            const msg = encodeNFTOwnershipAssigned(new BN(123), nftOwner)

            await smc.sendInternalMessage(new InternalMessage({
                to: SELF_ADDR,
                from: nftAddress,
                value: toNano(0.1),
                bounce: true,
                body: new CommonMessageInfo({ body: new CellMessage(msg) })
            }))

            const get = await smc.invokeGetMethod('get_nft_owner', [])

            const nftOwnerState = new Address(
                Number(get.result[0].toString()),
                new BN(get.result[1].toString()).toBuffer()
            )

            expect(nftOwnerState.toFriendly()).to.equal(nftOwner.toFriendly())
        })
    })

    after(() => { process.exit(0) })
})
