/* Generated from schemas/consulting-content.schema.json by scripts/gen-types.mjs — do not edit by hand. */

/**
 * ConsultingWhere Insights content (Stage 8, CI-01, CI-04): the service catalogue and the generic 'About ConsultingWhere' text. Generic capability descriptions only: no clients, project references, staff credentials, accreditations, budgets or procurement claims (P14).
 */
export interface ConsultingContent {
  schemaVersion: 1;
  status: {
    approval: "draft-for-approval" | "approved";
    note: string;
  };
  about: {
    title: string;
    /**
     * @minItems 1
     */
    paragraphs: [string, ...string[]];
    /**
     * @minItems 1
     */
    principles: [string, ...string[]];
  };
  /**
   * @minItems 1
   */
  services: [
    {
      id: string;
      title: string;
      strapline: string;
      /**
       * @minItems 2
       */
      challenges: [string, string, ...string[]];
      /**
       * @minItems 2
       */
      approach: [string, string, ...string[]];
      /**
       * @minItems 2
       */
      deliverables: [string, string, ...string[]];
      /**
       * @minItems 1
       */
      value: [string, ...string[]];
      /**
       * @minItems 1
       */
      stakeholders: [string, ...string[]];
      /**
       * @minItems 1
       */
      modules: [
        "origins" | "seasonal" | "access" | "risks" | "profiles" | "scenarios" | "insights",
        ...("origins" | "seasonal" | "access" | "risks" | "profiles" | "scenarios" | "insights")[]
      ];
    },
    ...{
      id: string;
      title: string;
      strapline: string;
      /**
       * @minItems 2
       */
      challenges: [string, string, ...string[]];
      /**
       * @minItems 2
       */
      approach: [string, string, ...string[]];
      /**
       * @minItems 2
       */
      deliverables: [string, string, ...string[]];
      /**
       * @minItems 1
       */
      value: [string, ...string[]];
      /**
       * @minItems 1
       */
      stakeholders: [string, ...string[]];
      /**
       * @minItems 1
       */
      modules: [
        "origins" | "seasonal" | "access" | "risks" | "profiles" | "scenarios" | "insights",
        ...("origins" | "seasonal" | "access" | "risks" | "profiles" | "scenarios" | "insights")[]
      ];
    }[]
  ];
}
