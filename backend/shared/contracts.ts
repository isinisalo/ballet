import { Ajv2020, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import addFormatsImport from "ajv-formats";
import type { JsonValue, VersionedRef } from "./json.js";
import { hashStableJson, isRecord } from "./json.js";

export type ContractKind = "event-data" | "agent-input" | "agent-output";

export interface ContractDefinition {
  id: string;
  version: number;
  name: string;
  description: string;
  kind: ContractKind;
  active: boolean;
  schema: Record<string, unknown>;
  examples: unknown[];
  createdAt: string;
  updatedAt: string;
  frontmatter?: Record<string, unknown>;
  body?: string;
  relativePath?: string;
  slug?: string;
  errors?: string[];
}

export interface ContractValidationErrorDetail {
  instancePath: string;
  schemaPath: string;
  message: string;
  keyword: string;
}

export interface ContractValidationResult {
  valid: boolean;
  contractId: string;
  contractVersion: number;
  contractHash: string;
  errors: ContractValidationErrorDetail[];
}

export class ContractRegistryError extends Error {
  constructor(message: string, readonly details?: unknown) {
    super(message);
    this.name = "ContractRegistryError";
  }
}

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  validateSchema: true
});
const addFormats = addFormatsImport as unknown as (target: Ajv2020) => Ajv2020;
addFormats(ajv);

const toDetails = (errors: ErrorObject[] | null | undefined): ContractValidationErrorDetail[] =>
  (errors ?? []).map((error) => ({
    instancePath: error.instancePath,
    schemaPath: error.schemaPath,
    message: error.message ?? "schema validation failed",
    keyword: error.keyword
  }));

const outputEnvelopeProperties = (schema: Record<string, unknown>): Record<string, unknown> => {
  const properties = isRecord(schema.properties) ? schema.properties : {};
  return properties;
};

const assertAgentOutputEnvelope = (contract: ContractDefinition): void => {
  if (contract.kind !== "agent-output") return;
  const required = Array.isArray(contract.schema.required) ? contract.schema.required.map(String) : [];
  const properties = outputEnvelopeProperties(contract.schema);
  const status = isRecord(properties.status) ? properties.status : undefined;
  const summary = isRecord(properties.summary) ? properties.summary : undefined;
  const result = isRecord(properties.result) ? properties.result : undefined;
  const evidence = isRecord(properties.evidence) ? properties.evidence : undefined;
  if (!required.includes("status") || !required.includes("summary")) {
    throw new ContractRegistryError(`Agent-output contract ${contract.id}@${contract.version} must require status and summary.`);
  }
  if (!status || !summary || !result || !evidence) {
    throw new ContractRegistryError(`Agent-output contract ${contract.id}@${contract.version} must define status, summary, result, and evidence properties.`);
  }
};

export const contractKey = (ref: VersionedRef): string => `${ref.id}@${ref.version}`;

export const contractSchemaHash = (contract: Pick<ContractDefinition, "schema">): string => hashStableJson(contract.schema);

export class ContractRegistry {
  private readonly contracts = new Map<string, ContractDefinition>();
  private readonly validators = new Map<string, ValidateFunction>();

  constructor(contracts: ContractDefinition[]) {
    const activeKeys = new Set<string>();
    for (const contract of contracts) {
      const key = contractKey(contract);
      if (contract.active) {
        if (activeKeys.has(key)) throw new ContractRegistryError(`Duplicate active contract ${key}.`);
        activeKeys.add(key);
      }
      this.assertValidContract(contract);
      this.contracts.set(key, contract);
    }
  }

  get(ref: VersionedRef): ContractDefinition | undefined {
    return this.contracts.get(contractKey(ref));
  }

  require(ref: VersionedRef, kind?: ContractKind): ContractDefinition {
    const contract = this.get(ref);
    if (!contract || !contract.active) throw new ContractRegistryError(`Active contract ${contractKey(ref)} was not found.`);
    if (kind && contract.kind !== kind) throw new ContractRegistryError(`Contract ${contractKey(ref)} must be kind ${kind}, got ${contract.kind}.`);
    return contract;
  }

  validate(ref: VersionedRef, value: JsonValue | Record<string, unknown> | unknown, kind?: ContractKind): ContractValidationResult {
    const contract = this.require(ref, kind);
    const hash = contractSchemaHash(contract);
    const validator = this.validator(contract, hash);
    const valid = validator(value);
    return {
      valid,
      contractId: contract.id,
      contractVersion: contract.version,
      contractHash: hash,
      errors: toDetails(validator.errors)
    };
  }

  assertValid(ref: VersionedRef, value: unknown, kind?: ContractKind): ContractValidationResult {
    const result = this.validate(ref, value, kind);
    if (!result.valid) {
      throw new ContractRegistryError(`Value failed contract ${result.contractId}@${result.contractVersion} validation.`, result.errors);
    }
    return result;
  }

  private assertValidContract(contract: ContractDefinition): void {
    if (!contract.id || !Number.isInteger(contract.version) || contract.version < 1) {
      throw new ContractRegistryError("Contract id and positive integer version are required.");
    }
    if (!["event-data", "agent-input", "agent-output"].includes(contract.kind)) {
      throw new ContractRegistryError(`Contract ${contract.id}@${contract.version} has invalid kind.`);
    }
    const validSchema = ajv.validateSchema(contract.schema);
    if (!validSchema) {
      throw new ContractRegistryError(`Contract ${contract.id}@${contract.version} schema is invalid.`, toDetails(ajv.errors));
    }
    assertAgentOutputEnvelope(contract);
    this.validator(contract, contractSchemaHash(contract));
  }

  private validator(contract: ContractDefinition, hash: string): ValidateFunction {
    const key = `${contractKey(contract)}:${hash}`;
    const existing = this.validators.get(key);
    if (existing) return existing;
    try {
      const validator = ajv.compile(contract.schema);
      this.validators.set(key, validator);
      return validator;
    } catch (error) {
      throw new ContractRegistryError(
        `Contract ${contract.id}@${contract.version} schema failed to compile: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
