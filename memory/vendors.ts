// which graph store sits under the memory layer, decided from licences and bridges rather
// than vibes.
//
// the question anne asked was falkordb or hydradb, both "oss". the licences say otherwise and
// that decides the answer before performance enters the room:
//
//   mem0            Apache-2.0, so it can be vendored and read
//   falkordb        SSPLv1, source-available and NOT osi-approved, so it runs as a separate
//                   process over the network and is never linked in
//   mem0-falkordb   MIT: the glue is permissive even though the server is not
//   hydradb         Elastic License 2.0: source-available, and its terms reach the service
//                   you build on top, which is a licence argument on release day
//
// the second question is the bridge. mem0 ships graph memory for neo4j, memgraph, neptune,
// kuzu and apache age; falkordb is not upstream (issue 4537 asks for it) but falkordb
// publishes a first-party plugin and docs. hydradb publishes neither, so choosing it means
// writing and maintaining the adapter ourselves.

export type LicenceClass = "permissive" | "copyleft" | "source_available" | "proprietary";
export type Mem0Bridge = "native" | "plugin" | "none";

export interface Vendor {
  name: string;
  licence: string;
  licence_class: LicenceClass;
  // how it can be used under this repo's policy
  use: "vendored" | "separate_process" | "refused";
  mem0_bridge: Mem0Bridge;
  // does the bridge require patching mem0 itself
  patches_upstream: boolean;
  // can seven surfaces share it over the network, or does it live inside one process
  shared: boolean;
  verified_sources: string[];
  note?: string;
}

export const VENDORS: Vendor[] = [
  {
    name: "mem0",
    licence: "Apache-2.0",
    licence_class: "permissive",
    use: "vendored",
    mem0_bridge: "native",
    patches_upstream: false,
    shared: false,
    verified_sources: ["https://github.com/mem0ai/mem0"],
    note: "the memory layer itself",
  },
  {
    name: "falkordb",
    licence: "SSPLv1",
    licence_class: "source_available",
    use: "separate_process",
    mem0_bridge: "plugin",
    patches_upstream: true,
    shared: true,
    verified_sources: [
      "https://github.com/FalkorDB/FalkorDB/blob/master/LICENSE.txt",
      "https://github.com/FalkorDB/mem0-falkordb",
      "https://docs.falkordb.com/agentic-memory/mem0",
    ],
    note: "first-party MIT plugin and docs; the plugin patches GraphStoreConfig, so pin both versions and re-run the suite on upgrade",
  },
  {
    name: "neo4j",
    licence: "GPLv3 (community)",
    licence_class: "copyleft",
    use: "separate_process",
    mem0_bridge: "native",
    patches_upstream: false,
    shared: true,
    verified_sources: ["https://github.com/mem0ai/mem0/issues/4537"],
    note: "the upstream default: no glue of ours to maintain, a heavier runtime to run",
  },
  {
    name: "kuzu",
    licence: "MIT",
    licence_class: "permissive",
    use: "vendored",
    mem0_bridge: "native",
    patches_upstream: false,
    shared: false,
    verified_sources: ["https://github.com/mem0ai/mem0/issues/4537"],
    note: "embedded, permissive, no server. not chosen: an embedded graph serves one process, and this persona has several",
  },
  {
    name: "hydradb",
    licence: "Elastic License 2.0",
    licence_class: "source_available",
    use: "separate_process",
    mem0_bridge: "none",
    patches_upstream: false,
    shared: true,
    verified_sources: [
      "https://github.com/hydra-db/hydradb/blob/main/LICENSE",
      "https://hydradb.com/",
      "https://github.com/mem0ai/mem0/issues/4537",
    ],
    note: "object-store native and interesting, but ELv2 is not open source and there is no mem0 adapter, so adopting it means owning the bridge",
  },
];

export function vendorProblems(vendor: Vendor): string[] {
  const problems: string[] = [];
  if (vendor.licence_class === "permissive" && vendor.use !== "vendored") {
    problems.push(`${vendor.name}: a permissive licence can be vendored, and running it as a process loses the readability that came free`);
  }
  if (vendor.licence_class !== "permissive" && vendor.use === "vendored") {
    problems.push(`${vendor.name}: ${vendor.licence} cannot be vendored, whatever the convenience`);
  }
  if (vendor.licence_class === "source_available" && vendor.use === "refused") {
    problems.push(`${vendor.name}: source-available is allowed as a separate process, so refusing it should say why`);
  }
  if (vendor.mem0_bridge === "none" && vendor.use === "vendored") {
    problems.push(`${vendor.name}: no mem0 bridge, so vendoring it would mean writing the adapter`);
  }
  if ((vendor.verified_sources ?? []).length === 0) {
    problems.push(`${vendor.name}: a licence claim without a source is a rumour`);
  }
  return problems;
}

export interface StoreChoice {
  layer: "mem0";
  graph: string;
  why: string;
}

// the answer, as a function so it can be tested rather than remembered. the choice prefers a
// bridge that already exists over one we would write, and prefers running a source-available
// server to embedding one.
export function chooseStore(vendors: Vendor[] = VENDORS): StoreChoice {
  const usable = vendors.filter((vendor) => vendor.name !== "mem0" && vendor.use !== "refused");
  // shared comes first: an embedded graph cannot be reached by seven surfaces, which makes
  // every other advantage theoretical
  const ranked = [...usable].sort((a, b) => {
    const shared = (v: Vendor) => (v.shared ? 0 : 1);
    const bridge = (v: Vendor) => (v.mem0_bridge === "native" ? 0 : v.mem0_bridge === "plugin" ? 1 : 2);
    const patches = (v: Vendor) => (v.patches_upstream ? 1 : 0);
    return shared(a) - shared(b) || bridge(a) - bridge(b) || patches(a) - patches(b) || a.name.localeCompare(b.name);
  });
  const best = ranked[0];
  if (!best) throw new Error("memory: no graph vendor survives the policy");
  return {
    layer: "mem0",
    graph: best.name,
    why:
      best.mem0_bridge === "native"
        ? `${best.name} is an upstream mem0 graph store, so no glue of ours sits in the memory path`
        : `${best.name} is the only source-available store with a published mem0 bridge (${best.licence}), and it runs as a separate process`,
  };
}
