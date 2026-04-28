use rusqlite::params;

use super::pathing::now_iso;
use super::persistence::upsert_local_notification;
use super::{LocalNotificationPayload, OfflineSyncAckPayload, P1LocalState};
use crate::store::sqlite::statements;

pub(super) fn upsert_local_notifications(
    state: &P1LocalState,
    notifications: Vec<LocalNotificationPayload>,
) -> Result<(), String> {
    let conn = state.open_connection().map_err(|error| error.to_string())?;
    for notification in notifications {
        upsert_local_notification(&conn, &notification).map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub(super) fn mark_local_notifications_read(
    state: &P1LocalState,
    notification_ids: Vec<String>,
    all: bool,
) -> Result<(), String> {
    let conn = state.open_connection().map_err(|error| error.to_string())?;
    let read_at = now_iso();
    if all {
        conn.execute(
            statements::MARK_ALL_LOCAL_NOTIFICATIONS_READ,
            params![read_at],
        )
        .map_err(|error| error.to_string())?;
        return Ok(());
    }

    for notification_id in notification_ids {
        conn.execute(
            statements::MARK_LOCAL_NOTIFICATION_READ,
            params![&read_at, notification_id],
        )
        .map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub(super) fn mark_offline_events_synced(
    state: &P1LocalState,
    event_ids: Vec<String>,
) -> Result<OfflineSyncAckPayload, String> {
    let conn = state.open_connection().map_err(|error| error.to_string())?;
    let synced_at = now_iso();
    for event_id in &event_ids {
        conn.execute(
            statements::MARK_OFFLINE_EVENT_SYNCED,
            params![synced_at, event_id],
        )
        .map_err(|error| error.to_string())?;
    }
    Ok(OfflineSyncAckPayload {
        synced_event_ids: event_ids,
    })
}
