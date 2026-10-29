import { test } from "node:test";
import assert from "node:assert/strict";
import { photonAddresses, parseProjectAddress } from "../src/lib/address";
test("only complete numbered US addresses are offered, with longitude/latitude in correct order", () => {
  const feature = {
    properties: {
      osm_type: "W",
      osm_id: 123,
      housenumber: "225",
      street: "Baker Street",
      city: "Atlanta",
      countrycode: "US",
      state: "Georgia",
      postcode: "30313",
    },
    geometry: { coordinates: [-84.39, 33.76] },
  };
  const rows = photonAddresses({
    features: [
      feature,
      feature,
      {
        ...feature,
        properties: { ...feature.properties, housenumber: undefined },
      },
      { ...feature, properties: { ...feature.properties, countrycode: "DE" } },
    ],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].lat, 33.76);
  assert.equal(rows[0].lon, -84.39);
  const f = new FormData();
  f.set("address", rows[0].label);
  f.set("address_choice", JSON.stringify(rows[0]));
  assert.equal(parseProjectAddress(f).address_source, "photon");
  f.set("address", "Changed street");
  assert.throws(() => parseProjectAddress(f));
  f.set("address_choice", "{}");
  assert.throws(() => parseProjectAddress(f));
  f.set("address_manual", "on");
  assert.throws(() => parseProjectAddress(f));
  f.set("address_review_note", "New construction confirmed with builder");
  assert.equal(parseProjectAddress(f).address_source, "manual");
});
