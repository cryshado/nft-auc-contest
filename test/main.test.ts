import { expect } from 'chai'
import { Cell as TCell } from 'ton'
import { Address, BOC, Coins } from 'ton3'
import * as fs from 'fs'
import { SmartContract } from 'ton-contract-executor'
import { encodeAucStorage } from '../src/encoder'

function bocFileToTCell (filename: string): TCell {
    const file = fs.readFileSync(filename)
    return TCell.fromBoc(file)[0]
}

describe('SmartContract main tests', () => {
    let smc: SmartContract

    const marketAddress = new Address('EQAB_3oC0MH1r4fz1kztk6Nhq9GFQnrBUgObzrhyAXjzzjrc')
    const marketFeesAddress = new Address('EQD85CtgkwdmFF-0lAyPFbzk0yaM48PmXOiJ42sEtIW_hI8H')
    const royaltyFeeAddress = new Address('EQDQA68_iHZrDEdkqjJpXcVqEM3qQC9u0w4nAhYJ4Ddsjttc')
    const nftAddress = new Address('EQAQwQc4N7k_2q1ZQoTOi47_e5zyVCdEDrL8aCdi4UcTZef4')

    beforeEach(() => {
        const code = bocFileToTCell('./auto/code.boc')
        const data = encodeAucStorage(
            {
                mpFeesAddr: marketFeesAddress,
                mpFeePercent: 1,
                royaltyFeeAddr: royaltyFeeAddress,
                royaltyFeePercent: 5
            },
            {
                mminBid: new Coins(0.1),
                mmaxBid: new Coins(100),
                minStep: new Coins(0.1),
                endTime: ~~(Date.now() / 1000) + (60 * 60 * 24) // 24h
            },
            marketAddress,
            nftAddress
        )

        const tStorage = TCell.fromBoc(BOC.toHexStandard(data))[0]
        SmartContract.fromCell(code, tStorage).then((_smc) => {
            smc = _smc
        })
    })

    describe('#case1()', () => {
        it('invokeGetMethod test', async () => {
            const result = await smc.invokeGetMethod('test', [])
            const stack = Array.from(result.result.values())

            expect(stack[0].toString()).to.equal('12345')
        })
    })
})
