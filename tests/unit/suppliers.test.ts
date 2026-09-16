import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { getRuntimeStore, setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import {
  archiveSupplier,
  attachSupplierToEvent,
  createSupplier,
  detachSupplierFromEvent,
  listSuppliersAvailableForEvent,
  listSuppliersForEvent,
  listSuppliersWithEvents,
  setSupplierStatus,
  supplierEventOptions,
  suppliersCsvForFilter,
  updateSupplier,
  SupplierRefusedError,
} from "@/services/suppliers/supplierRepository";
import { SUPPLIER_KIND_COPY, supplierRateLabel, supplierRefusal } from "@/types/suppliers";

/**
 * Contractors and vendors the owner can actually use: one record per person or company, attached
 * to as many events as they work, a status that moves both ways, and a CSV that is exactly the
 * rows on screen. The seed fixtures these pages used to render are gone.
 */
describe("contractors and vendors", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-suppliers-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); fs.rmSync(tempDir, { recursive: true, force: true }); });

  const camera = { kind: "contractor" as const, name: "Ada Okafor", company: "Freelance", roleOrService: "Camera op", email: "ada@example.com", phone: "555-0100", rateAmount: 650 };
  const captioner = { kind: "vendor" as const, name: "Jo Reyes", company: "ClearCaption", roleOrService: "Captioning", email: "jo@clearcaption.example", rateAmount: 1200 };

  it("refuses what it cannot save, in words", () => {
    expect(supplierRefusal({ kind: "contractor", name: "", company: "", email: "", rateAmount: 0 })).toContain("needs a name");
    expect(supplierRefusal({ kind: "vendor", name: "", company: "", email: "", rateAmount: 0 })).toContain("company name");
    // A vendor is a company, so the company alone is enough for one.
    expect(supplierRefusal({ kind: "vendor", name: "", company: "ClearCaption", email: "", rateAmount: 0 })).toBeUndefined();
    expect(supplierRefusal({ kind: "contractor", name: "Ada", company: "", email: "ada@", rateAmount: 0 })).toContain("not an email");
    expect(supplierRefusal({ kind: "contractor", name: "Ada", company: "", email: "", rateAmount: -1 })).toContain("negative");
  });

  it("an unagreed rate says so instead of reading as $0", () => {
    expect(supplierRateLabel({ rateKind: "day_rate", rateAmount: 0 })).toBe("No rate agreed");
    expect(supplierRateLabel({ rateKind: "quote", rateAmount: 0 })).toBe("No quote yet");
    expect(supplierRateLabel({ rateKind: "day_rate", rateAmount: 650 })).toBe("$650/day");
    expect(supplierRateLabel({ rateKind: "quote", rateAmount: 1200 })).toBe("$1,200 quoted");
  });

  it("a created contractor appears in the global list, and a vendor never appears in it", async () => {
    await createSupplier(camera);
    await createSupplier(captioner);
    const contractors = await listSuppliersWithEvents({ kind: "contractor" });
    expect(contractors).toHaveLength(1);
    expect(contractors[0].supplier.name).toBe("Ada Okafor");
    expect(contractors[0].events).toHaveLength(0);
    const vendors = await listSuppliersWithEvents({ kind: "vendor" });
    expect(vendors.map((row) => row.supplier.name)).toEqual(["Jo Reyes"]);
  });

  it("a refused create throws the sentence the form shows and writes nothing", async () => {
    await expect(createSupplier({ kind: "contractor", name: "   " })).rejects.toBeInstanceOf(SupplierRefusedError);
    expect(await listSuppliersWithEvents({ kind: "contractor" })).toHaveLength(0);
  });

  it("attaching puts them on the event's page and puts the event on their row; detaching undoes both", async () => {
    const ada = await createSupplier(camera);
    await attachSupplierToEvent(ada.id, "event-a", "2nd cam, hall B");
    const onEvent = await listSuppliersForEvent("event-a", "contractor");
    expect(onEvent.map((row) => row.supplier.id)).toEqual([ada.id]);
    expect(onEvent[0].events[0].note).toBe("2nd cam, hall B");
    const [row] = await listSuppliersWithEvents({ kind: "contractor" });
    expect(row.events.map((event) => event.eventId)).toEqual(["event-a"]);

    await detachSupplierFromEvent(ada.id, "event-a");
    expect(await listSuppliersForEvent("event-a", "contractor")).toHaveLength(0);
    // Detaching is not deleting: the person is still on file, now on no events.
    const [after] = await listSuppliersWithEvents({ kind: "contractor" });
    expect(after.supplier.id).toBe(ada.id);
    expect(after.events).toHaveLength(0);
  });

  it("one person is attached to many events, and attaching twice is still one attachment", async () => {
    const ada = await createSupplier(camera);
    await attachSupplierToEvent(ada.id, "event-a");
    await attachSupplierToEvent(ada.id, "event-b");
    await attachSupplierToEvent(ada.id, "event-a", "same show, corrected note");
    const [row] = await listSuppliersWithEvents({ kind: "contractor" });
    expect(row.events.map((event) => event.eventId).sort()).toEqual(["event-a", "event-b"]);
    expect(row.events.find((event) => event.eventId === "event-a")?.note).toBe("same show, corrected note");
  });

  it("the attach picker only offers people who are not already on the event", async () => {
    const ada = await createSupplier(camera);
    const sam = await createSupplier({ ...camera, name: "Sam Ellis", email: "sam@example.com" });
    await attachSupplierToEvent(ada.id, "event-a");
    expect((await listSuppliersAvailableForEvent("event-a", "contractor")).map((supplier) => supplier.id)).toEqual([sam.id]);
  });

  it("status moves shortlisted → booked → paid and back again", async () => {
    const ada = await createSupplier(camera);
    expect(ada.status).toBe("shortlisted");
    expect((await setSupplierStatus(ada.id, "booked"))?.status).toBe("booked");
    expect((await setSupplierStatus(ada.id, "paid"))?.status).toBe("paid");
    // A mis-click is corrected in place, not by making a second row.
    expect((await setSupplierStatus(ada.id, "booked"))?.status).toBe("booked");
    expect(await listSuppliersWithEvents({ kind: "contractor" })).toHaveLength(1);
  });

  it("editing corrects the one record, so every event they are on sees the new rate", async () => {
    const ada = await createSupplier(camera);
    await attachSupplierToEvent(ada.id, "event-a");
    await attachSupplierToEvent(ada.id, "event-b");
    await updateSupplier(ada.id, { ...camera, rateAmount: 725, phone: "555-0199" });
    for (const eventId of ["event-a", "event-b"]) {
      const [row] = await listSuppliersForEvent(eventId, "contractor");
      expect(row.supplier.rateAmount).toBe(725);
      expect(row.supplier.phone).toBe("555-0199");
    }
  });

  it("filtering by status and by event narrows the list", async () => {
    const ada = await createSupplier(camera);
    const sam = await createSupplier({ ...camera, name: "Sam Ellis" });
    await attachSupplierToEvent(ada.id, "event-a");
    await attachSupplierToEvent(sam.id, "event-b");
    await setSupplierStatus(ada.id, "booked");
    expect((await listSuppliersWithEvents({ kind: "contractor", status: "booked" })).map((row) => row.supplier.id)).toEqual([ada.id]);
    expect((await listSuppliersWithEvents({ kind: "contractor", eventId: "event-b" })).map((row) => row.supplier.id)).toEqual([sam.id]);
    expect(await listSuppliersWithEvents({ kind: "contractor", status: "paid", eventId: "event-a" })).toHaveLength(0);
    expect((await supplierEventOptions("contractor")).map((option) => option.eventId).sort()).toEqual(["event-a", "event-b"]);
  });

  it("the CSV is exactly the filtered view — no wider, no narrower", async () => {
    const ada = await createSupplier(camera);
    const sam = await createSupplier({ ...camera, name: "Sam Ellis", email: "sam@example.com" });
    await createSupplier(captioner);
    await attachSupplierToEvent(ada.id, "event-a");
    await attachSupplierToEvent(sam.id, "event-b");
    await setSupplierStatus(ada.id, "booked");

    const everyone = await suppliersCsvForFilter({ kind: "contractor" });
    expect(everyone.split("\n").filter(Boolean)).toHaveLength(3); // header + two contractors
    expect(everyone).not.toContain("Jo Reyes"); // a vendor is never in the contractor export

    const booked = await suppliersCsvForFilter({ kind: "contractor", status: "booked" });
    const rows = booked.split("\n").filter(Boolean);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe("kind,name,company,role_or_service,email,phone,rate_kind,rate_amount,status,events,notes,created_at,updated_at");
    expect(rows[1]).toContain('"Ada Okafor"');
    expect(rows[1]).toContain('"booked"');
    expect(rows[1]).toContain('"event-a"'); // no runtime event row, so the id is the honest name
    expect(booked).not.toContain("Sam Ellis");
  });

  it("archiving keeps the row and only takes them off the list", async () => {
    const ada = await createSupplier(camera);
    await attachSupplierToEvent(ada.id, "event-a");
    await archiveSupplier(ada.id);
    expect(await listSuppliersWithEvents({ kind: "contractor" })).toHaveLength(0);
    expect(await listSuppliersForEvent("event-a", "contractor")).toHaveLength(0);
    const kept = await listSuppliersWithEvents({ kind: "contractor", includeArchived: true });
    expect(kept).toHaveLength(1);
    // The events they worked are still on the record.
    expect(kept[0].events.map((event) => event.eventId)).toEqual(["event-a"]);
    expect((await getRuntimeStore().getSupplier(ada.id))?.archivedAt).toBeTruthy();
  });

  it("an empty store is empty, and the empty state has something to say", async () => {
    expect(await listSuppliersWithEvents({ kind: "contractor" })).toHaveLength(0);
    expect(await listSuppliersForEvent("event-a", "vendor")).toHaveLength(0);
    expect(await suppliersCsvForFilter({ kind: "vendor" })).toBe("kind,name,company,role_or_service,email,phone,rate_kind,rate_amount,status,events,notes,created_at,updated_at\n");
    for (const kind of ["contractor", "vendor"] as const) {
      expect(SUPPLIER_KIND_COPY[kind].emptyTitle).toMatch(/No (contractors|vendors) yet/);
      expect(SUPPLIER_KIND_COPY[kind].emptyBody.length).toBeGreaterThan(80);
    }
  });
});
