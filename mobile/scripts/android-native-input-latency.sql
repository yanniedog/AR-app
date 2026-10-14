-- Direct Android renderer input-ID / vsync-ID evidence.
-- __AR_PACKAGE__ is rendered only from a validated APK package identifier.
-- Preserve raw legacy flags: they are independent of this native association.
-- Android 16 CanvasContext.cpp emits frameTimelineInfo(...) before publishing
-- the same IDs to the native window. See ANDROID_REDESIGN_ACCEPTANCE.md.
INCLUDE PERFETTO MODULE android.input;
INCLUDE PERFETTO MODULE slices.with_context;

CREATE PERFETTO TABLE direct_native_candidates AS
WITH
original_distinct AS (
  SELECT event_id, action, device_id, source,
         extract_arg(arg_set_id, 'event_time_nanos') AS original_event_time_monotonic,
         extract_arg(arg_set_id, 'down_time_nanos') AS down_time_monotonic,
         count(*) AS raw_equivalent_record_count
  FROM android_motion_events
  GROUP BY event_id, action, device_id, source, original_event_time_monotonic, down_time_monotonic
),
original_counts AS (
  SELECT event_id,count(*) AS distinct_input_identity_count
  FROM original_distinct GROUP BY event_id
),
received AS (
  SELECT input_event_id, upid, pid, process_name, normalized_event_channel,
         CASE WHEN count(DISTINCT read_time)=1 THEN min(read_time) END AS read_time,
         count(DISTINCT read_time) AS reader_time_candidate_count,
         CASE WHEN count(is_speculative_frame)=count(*) AND count(DISTINCT is_speculative_frame)=1
              THEN min(is_speculative_frame) END AS legacy_is_speculative_frame,
         group_concat(DISTINCT coalesce(CAST(is_speculative_frame AS TEXT),'null')) AS raw_legacy_speculative_flags,
         count(*) AS raw_receive_record_count
  FROM android_input_events
  WHERE process_name='__AR_PACKAGE__'
  GROUP BY input_event_id,upid,pid,process_name,normalized_event_channel
),
received_windows AS (
  SELECT input_event_id,upid,count(DISTINCT normalized_event_channel) AS received_window_candidate_count
  FROM received GROUP BY input_event_id,upid
),
bridge_parsed AS (
  SELECT id AS native_trace_slice_id,ts AS native_trace_ts,upid,
    CAST(str_split(str_split(name,'frameNumber=',1),',',0) AS INT) AS native_buffer_frame_number,
    CAST(str_split(str_split(name,'vsyncId=',1),',',0) AS INT) AS native_vsync_id,
    unhex(str_split(str_split(name,'inputEventId=',1),')',0)) AS input_event_id_u32
  FROM thread_slice
  WHERE process_name='__AR_PACKAGE__' AND thread_name='RenderThread'
    AND name GLOB 'frameTimelineInfo(frameNumber=*, vsyncId=*, inputEventId=0x*)'
),
bridge_distinct AS (
  SELECT upid,input_event_id_u32,native_buffer_frame_number,native_vsync_id,
         min(native_trace_slice_id) AS native_trace_slice_id,
         min(native_trace_ts) AS native_trace_ts,
         count(*) AS raw_equivalent_bridge_count
  FROM bridge_parsed
  WHERE input_event_id_u32>0 AND input_event_id_u32<=4294967295
    AND native_buffer_frame_number>0 AND native_vsync_id>0
  GROUP BY upid,input_event_id_u32,native_buffer_frame_number,native_vsync_id
),
bridge_counts AS (
  SELECT upid,input_event_id_u32,count(*) AS native_frame_candidate_count
  FROM bridge_distinct GROUP BY upid,input_event_id_u32
),
linked AS (
  SELECT r.*,w.received_window_candidate_count,o.event_id AS input_event_id_u32, o.action,o.device_id,o.source,
         o.original_event_time_monotonic,o.down_time_monotonic,o.raw_equivalent_record_count,
         c.distinct_input_identity_count,
         b.native_buffer_frame_number,b.native_vsync_id,b.native_trace_slice_id,
         b.native_trace_ts,b.raw_equivalent_bridge_count,
         bc.native_frame_candidate_count,
         app.id AS app_frame_slice_id,app.surface_frame_token,
         app.display_frame_token,app.layer_name,
         app.present_type AS app_present_type,app.dur AS app_frame_duration,
         sf.id AS display_frame_slice_id,sf.present_type AS display_present_type,
         sf.dur AS display_frame_duration,
         sf.ts+sf.dur AS actual_present_trace_time,
         to_monotonic(sf.ts+sf.dur) AS actual_present_monotonic,
         to_monotonic(r.read_time) AS read_time_monotonic
  FROM received r
  JOIN received_windows w USING(input_event_id,upid)
  LEFT JOIN original_distinct o ON o.event_id=unhex(r.input_event_id)
  LEFT JOIN original_counts c ON c.event_id=o.event_id
  LEFT JOIN bridge_distinct b ON b.input_event_id_u32=o.event_id AND b.upid=r.upid
  LEFT JOIN bridge_counts bc ON bc.input_event_id_u32=o.event_id AND bc.upid=r.upid
  LEFT JOIN actual_frame_timeline_slice app ON app.upid=r.upid
    AND app.surface_frame_token=b.native_vsync_id
    AND app.layer_name GLOB ('TX - '||r.normalized_event_channel||'#*')
    AND length(substr(app.layer_name,length('TX - '||r.normalized_event_channel||'#')+1))>0
    AND trim(substr(app.layer_name,length('TX - '||r.normalized_event_channel||'#')+1),'0123456789')=''
  LEFT JOIN actual_frame_timeline_slice sf ON sf.display_frame_token=app.display_frame_token
    AND sf.surface_frame_token IS NULL AND sf.id!=app.id
    AND sf.upid IN (SELECT upid FROM process WHERE name='/system/bin/surfaceflinger')
),
counts AS (
  SELECT input_event_id,upid,normalized_event_channel,
         count(DISTINCT app_frame_slice_id) AS app_frame_candidate_count,
         count(DISTINCT display_frame_slice_id) AS display_frame_candidate_count
  FROM linked GROUP BY input_event_id,upid,normalized_event_channel
)
SELECT l.*,n.app_frame_candidate_count,n.display_frame_candidate_count,
  CASE
    WHEN l.input_event_id_u32 IS NULL THEN 'original_input_missing'
    WHEN l.distinct_input_identity_count!=1 THEN 'input_id_reused_or_ambiguous'
    WHEN l.received_window_candidate_count!=1 THEN 'receiving_window_ambiguous'
    WHEN l.reader_time_candidate_count>1 THEN 'reader_time_ambiguous'
    WHEN l.device_id IS NULL OR l.device_id<0 OR l.read_time IS NULL OR l.read_time<=0 THEN 'hardware_reader_missing'
    WHEN l.original_event_time_monotonic IS NULL OR l.original_event_time_monotonic<=0 THEN 'original_time_missing'
    WHEN l.down_time_monotonic IS NULL OR l.down_time_monotonic<=0
      OR l.down_time_monotonic>l.original_event_time_monotonic THEN 'gesture_identity_missing'
    WHEN l.native_frame_candidate_count IS NULL THEN 'native_frame_mapping_missing'
    WHEN l.native_frame_candidate_count!=1 THEN 'multiple_native_frame_candidates'
    WHEN n.app_frame_candidate_count!=1 THEN 'same_window_app_frame_missing_or_ambiguous'
    WHEN n.display_frame_candidate_count!=1 THEN 'display_frame_missing_or_ambiguous'
    WHEN l.app_present_type='Dropped Frame' OR l.display_present_type='Dropped Frame' THEN 'dropped_frame'
    WHEN l.app_present_type IS NULL OR l.display_present_type IS NULL
      OR l.app_present_type NOT IN ('Early Present','On-time Present','Late Present')
      OR l.display_present_type NOT IN ('Early Present','On-time Present','Late Present') THEN 'present_state_unverified'
    WHEN l.app_frame_duration IS NULL OR l.display_frame_duration IS NULL
      OR l.app_frame_duration<=0 OR l.display_frame_duration<=0 THEN 'incomplete_frame'
    WHEN l.actual_present_monotonic IS NULL OR l.read_time_monotonic IS NULL
      OR to_monotonic(l.native_trace_ts) IS NULL THEN 'clock_conversion_missing'
    WHEN l.read_time_monotonic<l.original_event_time_monotonic
      OR to_monotonic(l.native_trace_ts)<l.read_time_monotonic
      OR l.actual_present_monotonic<to_monotonic(l.native_trace_ts) THEN 'invalid_time_order'
    ELSE 'direct_native_frame_info'
  END AS association_status
FROM linked l JOIN counts n USING(input_event_id,upid,normalized_event_channel);

SELECT *,
       (SELECT coalesce(sum(value),0) FROM stats WHERE severity='error') AS trace_error_count,
       (SELECT coalesce(sum(value),0) FROM stats WHERE severity='data_loss') AS trace_data_loss_count,
       to_monotonic(native_trace_ts) AS native_trace_monotonic,
       CASE WHEN association_status='direct_native_frame_info'
         THEN actual_present_monotonic-original_event_time_monotonic END AS original_input_to_present_ns
FROM direct_native_candidates
ORDER BY original_event_time_monotonic,native_vsync_id;
