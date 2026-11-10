// the mem0 plan: what we deploy, under which licence, with which credentials by NAME.
//
// mem0 is Apache-2.0 and could be vendored. falkordb is SSPLv1 and could not, so it runs as
// a separate process and we only ever speak to it over the wire. the bridge between them is
// not upstream: mem0 supports neo4j, memgraph, neptune, kuzu and apache age, and falkordb
// arrives as a first-party MIT plugin that patches mem0's graph config. a plan that hides
// that is a plan that breaks on the next mem0 release with no explanation.
//
// so the plan is a DEPLOYMENT PLAN, not a config dict. the exact key names inside the graph
// block belong to the plugin's README at the pinned version, and this file refuses to invent
// them: it lists what a human must copy in, by name, at deploy time.

export type LicenceClass = "permissive" | "copyleft" | "source_available";

export interface Component {
  name: string;
  version_pin: string;
  licence: string;
  licence_class: LicenceClass;
  // a source-available component is a process, never a library we link
  runs_as: "vendored" | "separate_process" | "remote";
  endpoint_env?: string;
  credential_envs?: string[];
}

export interface Plugin {
  name: string;
  version_pin: string;
  licence: string;
  licence_class: LicenceClass;
  patches_upstream: boolean;
  // the keys only its own README can tell us
  keys_to_copy: string[];
}

export interface Mem0Plan {
  id: string;
  mem0: Component;
  graph: Component;
  plugin: Plugin | null;
  vector: Component & { dims: number };
  embedder: { model: string; dims: number };
  history: Component;
  note?: string;
}

export const PLAN_KEYS: (keyof Mem0Plan)[] = ["mem0", "graph", "plugin", "vector", "embedder", "history"];

export function componentProblems(label: string, c: Component): string[] {
  const problems: string[] = [];
  if (!c.name?.trim()) problems.push(`${label}: no name`);
  if (!/^\d+\.\d+/.test(c.version_pin ?? "")) {
    problems.push(`${label}: no version pin, so an upgrade changes behaviour silently`);
  }
  if (c.licence_class === "source_available" && c.runs_as === "vendored") {
    problems.push(
      `${label}: ${c.licence} is source available and cannot be vendored. run it as a process and speak to it over the wire`,
    );
  }
  for (const env of c.credential_envs ?? []) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(env)) {
      problems.push(`${label}: "${env}" is not an environment variable name, and a credential is never written here`);
    }
  }
  return problems;
}

export function planProblems(plan: Mem0Plan): string[] {
  const problems: string[] = [];
  if (!plan.id?.trim()) problems.push("plan: no id");
  for (const key of ["mem0", "graph", "vector", "history"] as const) {
    const value = plan[key] as unknown as Component;
    if (!value) {
      problems.push(`plan: ${key} is missing, and a memory layer with a hole in it is a memory layer that lies`);
      continue;
    }
    problems.push(...componentProblems(key, value));
  }
  // the embedder is a model, not a component: no licence, no endpoint, a width
  if (!plan.embedder?.model?.trim()) problems.push("embedder: no model");
  if (!Number.isInteger(plan.embedder?.dims) || plan.embedder.dims < 128) {
    problems.push("embedder: dims must be the model's real width");
  }

  // the vector store is where the embeddings land, so its width is not optional
  if (!Number.isInteger(plan.vector?.dims) || plan.vector.dims < 128) {
    problems.push("vector: dims must be the embedder's real width, so a mismatch is caught before a query returns nonsense");
  }
  if (plan.embedder && plan.vector && plan.embedder.dims !== plan.vector.dims) {
    problems.push(
      `vector: ${plan.vector.dims} dims cannot hold a ${plan.embedder.dims} dim embedding. one of them is a guess`,
    );
  }

  // the bridge is the fragile part and it has to say so
  const upstream = ["neo4j", "memgraph", "neptune", "kuzu", "age"];
  const provider = (plan.graph?.name ?? "").toLowerCase();
  if (!upstream.includes(provider)) {
    if (!plan.plugin) {
      problems.push(
        `graph: ${plan.graph?.name} is not a mem0 graph provider, so it needs the plugin that bridges it. without one this plan is a diagram`,
      );
    } else {
      if (!/^\d+\.\d+/.test(plan.plugin.version_pin ?? "")) problems.push("plugin: no version pin");
      if (!plan.plugin.keys_to_copy?.length) {
        problems.push("plugin: name the keys a human must copy from its README, or the deploy invents them");
      }
      if (plan.plugin.patches_upstream && !/patch/i.test(plan.note ?? "")) {
        problems.push("plugin: it patches mem0, and the plan has to say so where somebody will read it");
      }
    }
  }
  return problems;
}

// the yaml a human actually deploys. values that are credentials are placeholders that read
// the environment, never literals.
export function planDoc(plan: Mem0Plan): string {
  const lines: string[] = [
    `# ${plan.id}`,
    `# mem0 ${plan.mem0.version_pin} (${plan.mem0.licence}), graph ${plan.graph.name} ${plan.graph.version_pin} (${plan.graph.licence})`,
    `# ${plan.graph.runs_as.replace(/_/g, " ")}: ${plan.graph.endpoint_env ?? "no endpoint"}`,
  ];
  if (plan.plugin) {
    lines.push(
      `# graph bridge: ${plan.plugin.name} ${plan.plugin.version_pin} (${plan.plugin.licence}), ` +
        `${plan.plugin.patches_upstream ? "patches mem0" : "no patching"}`,
    );
    lines.push(`# keys this plan does NOT invent, copy from the plugin README: ${plan.plugin.keys_to_copy.join(", ")}`);
  }
  if (plan.note) lines.push(`# note: ${plan.note}`);
  return lines.join("\n");
}
