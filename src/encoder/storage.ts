import Decimal from 'decimal.js'
import { Address, Builder, Cell, Coins } from 'ton3'

interface feesOptions {
    mpFeesAddr: Address
    mpFeePercent: number
    royaltyFeeAddr: Address
    royaltyFeePercent: number 
}

interface bidsOptions {
    mminBid: Coins
    mmaxBid: Coins
    minStep: Coins
    endTime: number
}

function encodeStorage(fees: feesOptions): Cell {
    const factor = new Decimal(1e9)
    const mpFee = new Decimal(fees.mpFeePercent).mul(factor).toNumber()
    const royFee = new Decimal(fees.royaltyFeePercent).mul(factor).toNumber()

    const feesCell = new Builder()
        .storeAddress(fees.mpFeesAddr)      // mp_fee_addr
        .storeUint(mpFee, 32)               // mp_fee_percent
        .storeUint(factor.toNumber(), 32)   // mp_fee_factor
        .storeAddress(fees.royaltyFeeAddr)  // royalty_fee_addr
        .storeUint(royFee, 32)              // royalty_fee_percent
        .storeUint(factor.toNumber(), 32)   // royalty_fee_factor

    const bids_cell = new Builder()
        .storeCoins()
}

export { encodeStorage }