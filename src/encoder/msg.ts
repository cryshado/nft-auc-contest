import { Builder, Address, Cell } from 'ton'
import BN from 'bn.js'

/*
    ownership_assigned query_id:uint64 prev_owner:MsgAddress
        forward_payload:(Either Cell ^Cell) = InternalMsgBody;
*/
function encodeNFTOwnershipAssigned (queryId: BN, prevOwner: Address): Cell {
    const msg = new Builder()
        .storeUint(0x05138d91, 32)
        .storeUint(queryId, 64)
        .storeAddress(prevOwner)
        .storeBit(0)

    return msg.endCell()
}

export { encodeNFTOwnershipAssigned }
