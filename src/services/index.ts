export { composePrompt } from "./prompt-composer";
export type { PromptContext, ComposedPrompt } from "./prompt-composer";

export {
  executeResearch,
  saveResearchOutput,
  logProviderPath,
} from "./researcher";
export type {
  ResearchInput,
  ResearchResult,
  ResearchExecutionResult,
  TrendItem,
  CompetitorItem,
  PricingSignal,
  KeywordItem,
  AudienceNote,
} from "./researcher";
