module sentinel::sentinel {
    use sui::clock::{Self, Clock};
    use sui::tx_context::{Self, TxContext};
    use sui::object::{Self, UID};
    use sui::transfer;

    const ENotOwner: u64 = 1;
    const EAlreadyResolved: u64 = 2;

    public struct Incident has key, store {
        id: UID,
        blob_id: vector<u8>,
        description: vector<u8>,
        reporter: address,
        resolved: bool,
        timestamp: u64,
    }

    public fun create_incident(
        blob_id: vector<u8>,
        description: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let incident = Incident {
            id: object::new(ctx),
            blob_id,
            description,
            reporter: tx_context::sender(ctx),
            resolved: false,
            timestamp: clock::timestamp_ms(clock),
        };
        transfer::share_object(incident);
    }

    public fun resolve_incident(
        incident: &mut Incident,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == incident.reporter, ENotOwner);
        assert!(!incident.resolved, EAlreadyResolved);
        incident.resolved = true;
    }

    public fun get_incident(
        incident: &Incident
    ): (vector<u8>, vector<u8>, address, bool, u64) {
        (
            incident.blob_id,
            incident.description,
            incident.reporter,
            incident.resolved,
            incident.timestamp
        )
    }
}
