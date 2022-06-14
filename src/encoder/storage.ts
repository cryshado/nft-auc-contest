import { Decimal } from 'decimal.js'
import { Address, Builder, Cell } from 'ton'
import BN from 'bn.js'

interface FeesOptions {
    mpFeesAddr: Address
    mpFeePercent: number
    royaltyFeeAddr: Address
    royaltyFeePercent: number
}

interface BidsOptions {
    mminBid: BN
    mmaxBid: BN
    lastBid: BN
    minStep: BN
    endTime: number
}

function encodeAucStorage (
    fees: FeesOptions,
    bids: BidsOptions,
    mpAddr: Address,
    nftAddr: Address
): Cell {
    const factor = new Decimal(1e9)
    const mpFee = new Decimal(fees.mpFeePercent).mul(factor).div(100).toNumber()
    const royFee = new Decimal(fees.royaltyFeePercent).mul(factor).div(100).toNumber()

    const feesCell = new Builder()
        .storeAddress(fees.mpFeesAddr)      // mp_fee_addr
        .storeUint(mpFee, 32)               // mp_fee_percent
        .storeUint(factor.toNumber(), 32)   // mp_fee_factor
        .storeAddress(fees.royaltyFeeAddr)  // royalty_fee_addr
        .storeUint(royFee, 32)              // royalty_fee_percent
        .storeUint(factor.toNumber(), 32)   // royalty_fee_factor
        .endCell()

    const bidsCell = new Builder()
        .storeCoins(bids.mminBid)       // min_bid
        .storeCoins(bids.mmaxBid)       // max_bid
        .storeCoins(bids.minStep)       // min_step
        .storeBitArray([ 0, 0 ])        // last_member
        .storeCoins(bids.lastBid)       // last_bid
        .storeUint(bids.endTime, 32)    // end_time
        .storeUint(0, 32)               // step_time
        .storeUint(0, 32)               // try_step_time
        .endCell()

    const nftCell = new Builder()
        .storeBitArray([ 0, 0 ])        // nft_owner
        .storeAddress(nftAddr)          // nft_addr
        .endCell()

    const storage = new Builder()
        .storeBit(1)            // end?
        .storeAddress(mpAddr)   // mp_addr
        .storeRef(feesCell)
        .storeRef(bidsCell)
        .storeRef(nftCell)

    return storage.endCell()
}

export { encodeAucStorage }
