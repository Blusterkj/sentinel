module sentinel::incident_registry {
    use std::string::String;

    public struct IncidentRecorded has copy, drop {
        blob_id: String,
        reporter: address,
        timestamp_ms: u64,
    }

    public fun record_incident(
        blob_id: String,
        ctx: &mut TxContext
    ) {
        let event = IncidentRecorded {
            blob_id,
            reporter: tx_context::sender(ctx),
            timestamp_ms: tx_context::epoch_timestamp_ms(ctx),
        };
        sui::event::emit(event);
    }
}
