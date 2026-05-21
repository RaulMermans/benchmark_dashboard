import { DERIVED_NUMERIC_FIELDS, REQUIRED_INTERFACE_FIELDS } from "../core/benchmarkUtils.js";

export const benchmarkPayloadContract = {
  ok: "boolean",
  meta: "object",
  data: {
    interface: "array",
    events: "array",
    dictionary: "array",
  },
};

export const requiredInterfaceFields = REQUIRED_INTERFACE_FIELDS;

export const optionalEnrichedFields = [
  ...DERIVED_NUMERIC_FIELDS,
  "forecast_scenario",
  "active",
  "color",
  "logo",
  "company_color",
  "event_summary",
  "event_names",
  "event_id",
  "event_name",
  "event_type",
  "event_origin",
  "expected_impact",
  "metric_affected",
];

export const benchmarkRowSchema = {
  required: requiredInterfaceFields,
  optional: optionalEnrichedFields,
};
