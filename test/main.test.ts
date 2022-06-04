import { expect } from 'chai'
import { Address, Builder, Cell } from 'ton'
import * as fs from 'fs'
import { SmartContract } from 'ton-contract-executor'

function bocFileToCell (filename: string): Cell {
    const file = fs.readFileSync(filename)
    return Cell.fromBoc(file)[0]
}

describe('SmartContract main tests', () => {
    let smc: SmartContract

    beforeEach(() => {
        const code = bocFileToCell('./auto/code.boc')
        const mpAddr = Address.parseFriendly(
            'EQD85CtgkwdmFF-0lAyPFbzk0yaM48PmXOiJ42sEtIW_hI8H'
        ).address

        const data = new Builder()
            .storeBit(true)
            .storeAddress(mpAddr)

        SmartContract.fromCell(code, data.endCell()).then((_smc) => {
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
