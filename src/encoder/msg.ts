import { Builder, Address, Cell } from 'ton'
import BN from 'bn.js'

class MSG {
    /*
        ownership_assigned query_id:uint64 prev_owner:MsgAddress
            forward_payload:(Either Cell ^Cell) = InternalMsgBody;
    */
    public static nftOwnerAssigned (
        queryId: BN,
        prevOwner: Address,
        op: number = 0x05138d91
    ): Cell {
        const msg = new Builder()
            .storeUint(op, 32)
            .storeUint(queryId, 64)
            .storeAddress(prevOwner)
            .storeBit(0)

        return msg.endCell()
    }

    public static aucCancel (): Cell {
        const msg = new Builder()
            .storeUint(0, 32)
            .storeUint(0x63616e63656c, 48)  // cancel

        return msg.endCell()
    }
}

export { MSG }
