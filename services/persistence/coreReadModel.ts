import { getRuntimeData } from "@/lib/runtime/getRuntimeData";
import type { Client, Event } from "@/types/core";
import type { AgencyDashboardRecordSet } from "@/types/persistence";
import { mapAgencyRecord, mapClientRecord, mapEventRecord } from "@/services/persistence/mapRecords";

export function buildCoreReadModel(records?: Partial<AgencyDashboardRecordSet>) {
  if (!records) return getRuntimeData();

  const mock = getRuntimeData();
  const agencies = records.agencies?.map(mapAgencyRecord) ?? mock.agencies;
  const clients = records.clients?.map(mapClientRecord) ?? mock.clients;
  const events = records.events?.map(mapEventRecord) ?? mock.events;

  return {
    ...mock,
    agencies,
    clients: clients as Client[],
    events: events as Event[],
  };
}

export function getPersistenceModeLabel(records?: Partial<AgencyDashboardRecordSet>) {
  return records ? "D1 read model" : "Mock fallback read model";
}
